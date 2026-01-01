---
title: "Quick Start"
description: "Implement sign-up/sign-in + app access checks in a Next.js App Router app"
category: "getting-started"
audience: "app-developer"
order: 2
---

# Quick Start

Goal: in ~5–10 minutes, you’ll have a Next.js App Router app where:

- users can **sign up**
- your server assigns **app access + default role** via RPC (`set_app_claim`)
- users can **sign in**
- protected routes are gated by `apps[APP_ID].enabled === true`

## Prerequisites

- You have a Supabase project
- You have run `install.sql` in your Supabase SQL Editor (installs `set_app_claim`, etc.)
- You have created an **app** in the admin dashboard and chosen an `APP_ID` (example: `my-app`)

## 1) Install deps + env vars

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
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

## What’s Next

- **Deep dive:** [Complete Integration Guide](/docs/complete-integration-guide)
- **Auth patterns:** [Authentication Guide](/docs/authentication-guide)
- **Permissions/RBAC:** [Authorization Patterns](/docs/authorization-patterns)
- **Production:** [Environment Configuration](/docs/environment-configuration)


---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
