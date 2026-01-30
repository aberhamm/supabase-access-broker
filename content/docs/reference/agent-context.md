---
title: "Agent Context"
description: "Single-page reference for AI agents integrating this auth + custom claims framework into a Next.js app"
category: "reference"
audience: "app-developer"
order: 1
---

# Agent Context (AI/LLM Reference)

Use this page when you are an AI agent helping a developer integrate the system into a **Next.js App Router** application.

If you are working specifically on the **central auth portal** (SSO + passkeys), use:
- **[Agent Instructions: Auth Portal](/docs/auth-portal-agent-instructions)**

## System overview (2–3 sentences)

This system uses **Supabase Auth** for authentication, and **custom claims stored in `auth.users.raw_app_meta_data`** for authorization. Claims are surfaced to applications as `user.app_metadata` and are embedded into JWTs, enabling fast role/permission checks and RLS policies without extra DB reads.

## Key concepts (what matters)

| Concept | Meaning | Where it lives |
|--------|---------|----------------|
| `app_metadata` | App-controlled claims (roles/permissions/etc.) | Supabase Auth user + JWT |
| `user_metadata` | User-controlled profile data | Supabase Auth user |
| `APP_ID` | Unique identifier for an application | Your app code + dashboard config |
| `apps[APP_ID].enabled` | **Primary access gate** for an app | `user.app_metadata.apps[APP_ID]` |
| Service Role Key | Admin secret that can update claims | Server only |

## Claims data structure (canonical)

```json
{
  "claims_admin": false,
  "apps": {
    "your-app-id": {
      "enabled": true,
      "role": "user",
      "permissions": ["read", "write"],
      "any_other_fields": "ok"
    }
  }
}
```

### Mandatory gate

Always gate user access to an app by:

```ts
const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;
```

## Environment variables

| Variable | Required | Where | Notes |
|---------|----------|-------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | client+server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | client+server | public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (for claim writes) | server only | never expose to browser |
| `NEXT_PUBLIC_APP_URL` | prod yes | client+server | redirect safety for magic links/OAuth |

## Required files (copy/paste into the developer’s app)

### `lib/constants.ts`

```ts
export const APP_ID = 'your-app-id';
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
            // ignore
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
    if (!error) return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

### `app/api/auth/register-user/route.ts` (server-side: assigns claims)

```ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_ID } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Enable app access
    const { error: enableError } = await supabaseAdmin.rpc('set_app_claim', {
      uid: userId,
      app_id: APP_ID,
      claim: 'enabled',
      value: true,
    });
    if (enableError) throw enableError;

    // Default role
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

### `middleware.ts` (auth + app-access gate)

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
    path.startsWith('/auth/callback') ||
    path.startsWith('/access-denied');

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

## RPC functions (what the SQL install provides)

Use these via `supabase.rpc(...)`:

- **Global claims**: `set_claim(uid, claim, value)`, `get_claim(uid, claim)`, `delete_claim(uid, claim)`
- **App-scoped claims**: `set_app_claim(uid, app_id, claim, value)`, `get_app_claim(uid, app_id, claim)`, `delete_app_claim(uid, app_id, claim)`
- **Self helpers**: `get_my_claims()`, `get_my_claim(claim)`, `is_claims_admin()`

## Common patterns

### Pattern: sign-in → check access

```ts
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
const hasAccess = data.user?.app_metadata?.apps?.[APP_ID]?.enabled === true;
if (!hasAccess) {
  await supabase.auth.signOut();
  throw new Error('No access to this application');
}
```

### Pattern: after updating claims, refresh session

Claims are cached in JWTs; refresh to see changes:

```ts
await supabase.auth.refreshSession();
```

## RLS example (claims gate)

```sql
create policy "app_access_required"
on your_table
for select
using (
  coalesce((auth.jwt() -> 'app_metadata' -> 'apps' -> 'your-app-id' ->> 'enabled')::boolean, false) = true
);
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|--------|--------------|-----|
| User can sign in but gets denied | `enabled` missing/false | call `set_app_claim(enabled=true)` via server |
| Claims don’t appear | token not refreshed | `refreshSession()` or log out/in |
| Magic link redirects to localhost | `NEXT_PUBLIC_APP_URL` not set | set it in prod + update Supabase redirect URLs |
| 401/403 in API routes | missing user/session | check server client cookie wiring + middleware |

## Security constraints (must follow)

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Do not let clients set their own claims; only server-side routes/actions can write claims.
- Use `enabled === true` as the **first** authorization check for app access.

---

## What's Next

- **Auth Portal / SSO / Passkeys:** [Agent Instructions: Auth Portal](/docs/auth-portal-agent-instructions) — for implementing SSO in client apps
- **Getting Started:** [Overview](/docs/overview) → [Quick Start](/docs/quick-start)
- **Full walkthrough:** [Complete Integration Guide](/docs/complete-integration-guide)
- **Auth patterns:** [Authentication Guide](/docs/authentication-guide)
- **Environment config:** [Environment Configuration](/docs/environment-configuration)
