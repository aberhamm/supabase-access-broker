---
title: "Quick Start"
description: "Implement sign-up/sign-in + app access checks in a Next.js App Router app"
category: "getting-started"
audience: "dashboard-admin"
order: 2
---

# Quick Start

## Choose your complexity level

| What you need | Time | Guide |
|---------------|------|-------|
| **Basic auth only** (sign up, sign in, protected routes) | 5 min | [Option A: Simple Auth](#option-a-simple-auth-no-claims) |
| **Auth + claims** (roles, permissions in JWT) | 10 min | [Option B: Full Quick Start](#option-b-full-quick-start-with-claims) |

---

## Option A: Simple Auth (No Claims)

If you just need basic authentication without custom claims or multi-app support:

### 1) Install dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

### 2) Create Supabase clients

**`lib/supabase/client.ts`**
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**`lib/supabase/server.ts`**
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### 3) Sign up page

**`app/signup/page.tsx`**
```tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setError(error.message);
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleSignUp}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### 4) Protect routes with middleware

**`middleware.ts`**
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/signup')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### 5) Login page

**`app/login/page.tsx`**
```tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleLogin}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Sign In</button>
      <p><a href="/signup">Need an account? Sign up</a></p>
    </form>
  );
}
```

### 6) Protected dashboard page

**`app/dashboard/page.tsx`**
```tsx
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.email}</p>
    </div>
  );
}
```

### Verify it works

1. Run `pnpm dev`
2. Go to `/signup` → create account
3. Go to `/dashboard` → should see your email
4. Open incognito → go to `/dashboard` → should redirect to `/login`

**Done!** You now have basic auth. When you need roles/permissions, continue to Option B.

---

## Option B: Full Quick Start (With Claims)

This adds custom claims (roles, permissions) to your JWT tokens for authorization.

**Goal:** In ~10 minutes, you'll have:
- users can **sign up**
- your server assigns **app access + default role** via RPC (`set_app_claim`)
- users can **sign in**
- protected routes are gated by `apps[APP_ID].enabled === true`

### Prerequisites

| Requirement | How to get it |
|-------------|---------------|
| Supabase project | [Create one](https://supabase.com/dashboard) |
| SQL functions installed | Run `install.sql` or `pnpm migrate` |
| App created in dashboard | Deploy dashboard, create app with an `APP_ID` |

> **Don't have the dashboard yet?** You can still use claims by running just the SQL functions. Set your `APP_ID` to any string (e.g., `'my-app'`), and manually run `SELECT set_app_claim('user-uuid', 'my-app', 'enabled', 'true')` when needed.

## 1) Install deps + env vars

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3050
```

## 2) Add required files

### `lib/constants.ts`

```ts
// Must match the app_id you created in the admin dashboard
export const APP_ID = 'my-app';
```

### `lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### `lib/supabase/server.ts`

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components may throw when setting cookies; ignore safely.
          }
        },
      },
    },
  );
}
```

### `app/auth/callback/route.ts`

```ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

## 3) Implement sign-up (create user + assign app access)

### `app/api/auth/register-user/route.ts` (server-only; uses service role key)

```ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_ID } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Enable access to THIS app
    const { error: enableError } = await supabaseAdmin.rpc('set_app_claim', {
      uid: userId,
      app_id: APP_ID,
      claim: 'enabled',
      value: true,
    });
    if (enableError) throw enableError;

    // Set default role
    const { error: roleError } = await supabaseAdmin.rpc('set_app_claim', {
      uid: userId,
      app_id: APP_ID,
      claim: 'role',
      value: 'user',
    });
    if (roleError) throw roleError;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
```

### `app/signup/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) return setError(signUpError.message);
    if (!data.user) return setError('User creation failed');

    const res = await fetch('/api/auth/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.user.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? 'Failed to assign app access');
    }

    router.push('/dashboard');
  };

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-3">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      {error ? <p className="text-red-600">{error}</p> : null}
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
      <button type="submit">Create account</button>
    </form>
  );
}
```

## 4) Protect routes with middleware

### `middleware.ts`

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { APP_ID } from '@/lib/constants';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/auth/callback');

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;
    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

## 5) Add a simple protected page

### `app/dashboard/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div>
      <h1>Dashboard</h1>
      <pre>{JSON.stringify({ email: user?.email, app_metadata: user?.app_metadata }, null, 2)}</pre>
    </div>
  );
}
```

---

## Common Mistakes

Avoid these pitfalls when implementing auth:

### 1. Using Service Role Key on the Client

```typescript
// ❌ WRONG - exposes your secret key
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ✅ RIGHT - use anon key on client, service role only on server
const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
```

### 2. Not Checking `enabled === true`

```typescript
// ❌ WRONG - truthy check passes for any object
if (user.app_metadata?.apps?.[APP_ID]) { ... }

// ✅ RIGHT - explicit check for enabled
if (user.app_metadata?.apps?.[APP_ID]?.enabled === true) { ... }
```

### 3. Forgetting to Refresh Session After Setting Claims

Claims are embedded in the JWT. Users must refresh their session to see new claims:

```typescript
// After setting claims server-side, client needs to refresh
await supabase.auth.refreshSession();
```

### 4. APP_ID Mismatch

```typescript
// ❌ WRONG - different APP_IDs in different files
// lib/constants.ts: APP_ID = 'my-app'
// middleware.ts: APP_ID = 'myapp'  // Different!

// ✅ RIGHT - import from single source
import { APP_ID } from '@/lib/constants';
```

### 5. Not Setting NEXT_PUBLIC_APP_URL in Production

Without this, magic links redirect to localhost:

```env
# ❌ Missing in production
# NEXT_PUBLIC_APP_URL=

# ✅ Set to your production domain
NEXT_PUBLIC_APP_URL=https://myapp.com
```

### 6. Checking Only Authentication, Not Authorization

```typescript
// ❌ WRONG - only checks if logged in
if (!user) redirect('/login');

// ✅ RIGHT - checks both authentication AND app access
if (!user) redirect('/login');
if (!user.app_metadata?.apps?.[APP_ID]?.enabled) redirect('/access-denied');
```

---

## Verify It Works

Test your implementation:

| Test | Expected Result |
|------|-----------------|
| Sign up new user | Account created, claims assigned, redirected to dashboard |
| Sign in existing user | Logged in, sees dashboard |
| Access `/dashboard` without login | Redirected to `/login` |
| User without app access tries to sign in | Sees "access denied" or error message |
| Check Supabase Dashboard → Users | User has `app_metadata.apps.{APP_ID}.enabled: true` |

---

## What's Next

- **Deep dive:** [Complete Integration Guide](/docs/complete-integration-guide)
- **Auth patterns:** [Authentication Guide](/docs/authentication-guide)
- **Permissions/RBAC:** [Authorization Patterns](/docs/authorization-patterns)
- **Production:** [Environment Configuration](/docs/environment-configuration)
- **Terminology:** [Glossary](/docs/reference/glossary)
