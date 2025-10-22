---
title: "Authentication Quick Reference"
description: "Copy-paste ready code snippets"
category: "integration"
audience: "app-developer"
order: 4
---

# Authentication Quick Reference

**Context:** Quick copy-paste reference for common authentication tasks with Supabase Auth and custom claims. All snippets are production-ready and tested.

**Technology:** Next.js 14+ App Router, Supabase Auth, TypeScript

**How to Use:** Find the pattern you need, copy the code, replace placeholders (your-app-id, etc.) with your values.

**Note:** For detailed explanations, see AUTHENTICATION_GUIDE.md or APP_AUTH_INTEGRATION_GUIDE.md

**Important Placeholders to Replace:**
- `your-app-id` → Your actual app identifier (e.g., 'my-app', 'analytics-dashboard')
- `your-project.supabase.co` → Your Supabase project URL
- `your-anon-key` → Your Supabase anonymous/public key
- `your-service-role-key` → Your Supabase service role key (SECRET!)

## Table of Contents

- [Setup](#setup)
- [Sign Up](#sign-up)
- [Sign In](#sign-in)
- [Role Assignment](#role-assignment)
- [Access Control](#access-control)
- [Common Patterns](#common-patterns)

## Setup

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Supabase Client (Client-Side)

**File:** `lib/supabase/client.ts`
**When to Use:** Client Components, browser-side auth operations
**What It Does:** Creates a Supabase client using browser cookies for auth

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Supabase Client (Server-Side)

**File:** `lib/supabase/server.ts`
**When to Use:** Server Components, Server Actions, API Routes
**What It Does:** Creates a Supabase client with server-side cookie handling

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

## Sign Up

### Basic Email/Password Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});
```

### Sign Up with Metadata

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe',
      age: 30,
    },
    emailRedirectTo: `${window.location.origin}/welcome`,
  },
});
```

### OAuth Sign Up

```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

## Sign In

### Email/Password Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});
```

### Magic Link Sign In

**Admin Dashboard (Existing Users Only):**
```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    shouldCreateUser: false, // Security: Only existing users
  },
});
```

**User-Facing App (Allow New Users):**
```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    shouldCreateUser: true, // Allow new user creation
  },
});
```

**Required Callback Handler** (`app/auth/callback/route.ts`):
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

### Get Current User

```typescript
const { data: { user } } = await supabase.auth.getUser();
```

### Sign Out

```typescript
const { error } = await supabase.auth.signOut();
```

## Role Assignment

### Assign Default Role (Server-Side API)

**File:** `app/api/assign-role/route.ts`
**Security:** Uses service role key - server-side only
**What It Does:** Assigns app access and role to a user after sign up

```typescript
// app/api/assign-role/route.ts
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { userId, appId, role } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Enable app access
  await supabase.rpc('set_app_claim', {
    uid: userId,
    app_id: appId,
    claim: 'enabled',
    value: true,
  });

  // Set role
  await supabase.rpc('set_app_claim', {
    uid: userId,
    app_id: appId,
    claim: 'role',
    value: role,
  });

  return Response.json({ success: true });
}
```

### Database Trigger for Automatic Role Assignment

**Run Location:** Supabase SQL Editor
**What It Does:** Automatically assigns default role when new user is created
**When to Use:** For consistent default roles for all users

```sql
CREATE OR REPLACE FUNCTION assign_default_roles()
RETURNS trigger AS $$
BEGIN
  NEW.raw_app_meta_data = jsonb_set(
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
    '{apps,my-app}',
    jsonb_build_object(
      'enabled', true,
      'role', 'user'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_roles();
```

## Access Control

### Check App Access

**Context:** Verifies if a user has access to a specific app
**Where to Use:** Server Components, API Routes, Client Components

```typescript
const APP_ID = 'your-app-id';
const { data: { user } } = await supabase.auth.getUser();
const hasAccess = user?.app_metadata?.apps?.[APP_ID]?.enabled === true;

if (!hasAccess) {
  router.push('/access-denied');
}
```

### Check User Role

```typescript
const APP_ID = 'your-app-id';
const { data: { user } } = await supabase.auth.getUser();
const role = user?.app_metadata?.apps?.[APP_ID]?.role;

if (role === 'admin') {
  // Show admin features
}
```

### Middleware Protection

**File:** `middleware.ts` (must be in project root)
**What It Does:** Protects all routes by checking auth and app access before request
**Runs:** On every request matching the matcher pattern

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const APP_ID = 'your-app-id';

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();

  // Check authentication
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check app access
  if (user) {
    const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;
    if (!hasAccess && !request.nextUrl.pathname.startsWith('/access-denied')) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }
  }

  return NextResponse.next();
}
```

### Server Component Protection

**File:** `app/dashboard/page.tsx` (example)
**What It Does:** Protects a single page/route with server-side auth check
**When to Use:** For page-level protection with role-based content

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const APP_ID = 'your-app-id';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;
  if (!hasAccess) redirect('/access-denied');

  return <div>Dashboard Content</div>;
}
```

## Common Patterns

### Sign Up with Automatic Role Assignment

```typescript
'use client';

async function handleSignUp(email: string, password: string) {
  const supabase = createClient();

  // Create account
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;

  if (data.user) {
    // Assign role via server action
    await fetch('/api/assign-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.user.id,
        appId: 'my-app',
        role: 'user',
      }),
    });
  }
}
```

### Check Multiple Apps

```typescript
const { data: { user } } = await supabase.auth.getUser();
const userApps = user?.app_metadata?.apps || {};

const enabledApps = Object.entries(userApps)
  .filter(([_, data]: [string, any]) => data.enabled === true)
  .map(([id, data]: [string, any]) => ({
    id,
    role: data.role,
  }));

console.log('User has access to:', enabledApps);
```

### Refresh Session After Claim Change

```typescript
// After updating claims via dashboard or API
const { error } = await supabase.auth.refreshSession();

// Now user.app_metadata will have updated claims
const { data: { user } } = await supabase.auth.getUser();
```

### Conditional UI Based on Role

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const APP_ID = 'my-app';

export function ConditionalUI() {
  const [role, setRole] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      setRole(user?.app_metadata?.apps?.[APP_ID]?.role || null);
    }
    loadRole();
  }, []);

  if (role === 'admin') {
    return <AdminDashboard />;
  } else if (role === 'user') {
    return <UserDashboard />;
  } else {
    return <ViewOnlyDashboard />;
  }
}
```

### API Route with Role Check

```typescript
// app/api/admin/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const APP_ID = 'my-app';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.app_metadata?.apps?.[APP_ID]?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Admin-only logic here
  return NextResponse.json({ message: 'Admin data' });
}
```

### Handle OAuth Callback

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(requestUrl.origin);
}
```

### Listen to Auth Changes

```typescript
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function AuthListener() {
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
```

## RPC Functions Reference

### Set App Claim

```typescript
await supabase.rpc('set_app_claim', {
  uid: 'user-id',
  app_id: 'my-app',
  claim: 'role',
  value: 'admin',
});
```

### Get App Claim

```typescript
const { data } = await supabase.rpc('get_app_claim', {
  uid: 'user-id',
  app_id: 'my-app',
  claim: 'role',
});
```

### Delete App Claim

```typescript
await supabase.rpc('delete_app_claim', {
  uid: 'user-id',
  app_id: 'my-app',
  claim: 'role',
});
```

### Check if App Admin

```typescript
const { data: isAdmin } = await supabase.rpc('is_app_admin', {
  app_id: 'my-app',
});
```

## Related Documentation

- [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) - Complete authentication setup
- [APP_AUTH_INTEGRATION_GUIDE.md](./APP_AUTH_INTEGRATION_GUIDE.md) - Integration patterns
- [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Custom claims reference
- [MULTI_APP_GUIDE.md](./MULTI_APP_GUIDE.md) - Multi-app architecture

---

**Note:** This is a quick reference. For detailed explanations and advanced patterns, see the full guides.
