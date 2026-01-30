---
title: "Shared Auth Patterns"
description: "Common setup and auth patterns reused across the docs"
category: "reference"
audience: "app-developer"
order: 20
---

# Shared Auth Patterns

This page collects the shared code snippets used across multiple guides. Use these patterns as the canonical versions, and link here instead of duplicating code.

## Supabase Client Setup

### Client (Browser)

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Server (App Router)

```typescript
// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
```

## URL Helper

Use this helper whenever you need a base URL for redirects.

```typescript
// lib/app-url.ts
export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  );
}
```

## Standard Middleware

Protect routes and enforce app access on every request.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const APP_ID = 'your-app-id';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const publicRoutes = ['/login', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (!user && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && !isPublicRoute) {
    const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;
    if (!hasAccess && !pathname.startsWith('/access-denied')) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## Auth Callback (Standard Supabase)

Use this for magic links and OAuth callbacks.

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/app-url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${getAppUrl()}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${getAppUrl()}/login?error=callback_failed`);
  }

  return NextResponse.redirect(`${getAppUrl()}${next}`);
}
```

## Session Refresh After Claim Updates

Claims are cached in the JWT, so refresh after any update.

```typescript
// Client-side refresh after updating claims
await supabase.auth.refreshSession();
```

## When This Does NOT Apply

- **SSO Auth Portal callbacks** use a different exchange flow. See [SSO Integration Guide](/docs/sso-integration-guide).
- **Edge runtime** requires a different cookie adapter; check the Next.js App Router docs if you deploy to Edge.
