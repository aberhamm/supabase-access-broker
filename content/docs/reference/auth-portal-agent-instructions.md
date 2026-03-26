---
title: "Agent Instructions: Auth Portal"
description: "Implementation checklist + copy/paste instructions for agents working on the auth portal (SSO + passkeys)"
category: "reference"
audience: "all"
order: 2
---

# Agent Instructions: Auth Portal (SSO + Passkeys)

This page is intended for AI agents implementing features for the **central auth portal** in this repo and integrating **client apps** with it.

## Source of truth

- **SSO / passkeys spec**: `/docs/auth-portal-sso-passkeys`
- **Portal endpoints**:
  - `app/sso/complete/route.ts`
  - `app/api/auth/exchange/route.ts`
  - `lib/sso-service.ts`
  - `lib/passkey-service.ts`
- **Client SDK**: `public/sdk/auth-portal.js`
- **Feature flags**: `lib/auth-config.ts`
- **DB migration**: `migrations/007_auth_and_passkeys.sql`

## Do / Don’t (non-negotiable)

- DO validate `redirect_uri` against `public.apps.allowed_callback_urls` (no open redirects).
- DO keep auth codes short-lived and single-use (portal already does this).
- DO exchange the code from a **server** in the client app when possible.
- DO NOT expose `SUPABASE_SERVICE_ROLE_KEY` to browsers.
- DO NOT store secrets in `app_metadata` / client-readable places.

## Rollout controls (feature flags)

All methods are toggled via env vars on the portal:

```env
NEXT_PUBLIC_AUTH_PASSKEYS=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
NEXT_PUBLIC_AUTH_EMAIL_OTP=false
NEXT_PUBLIC_AUTH_PASSWORD=false
NEXT_PUBLIC_AUTH_MAGIC_LINK=true
```

## Task A — Integrate a client app with SSO (Option B)

### A1) Client app: redirect user to portal login

Client app must redirect to:

```
GET https://access-broker.yourdomain.com/login?app_id=APP_ID&redirect_uri=CALLBACK_URL&state=OPTIONAL
```

Minimal browser snippet:

```ts
const portalUrl = 'https://access-broker.yourdomain.com';
const appId = 'app1';
const redirectUri = 'https://app1.com/auth/callback';

const url = new URL(`${portalUrl}/login`);
url.searchParams.set('app_id', appId);
url.searchParams.set('redirect_uri', redirectUri);
url.searchParams.set('state', crypto.randomUUID()); // optional
window.location.href = url.toString();
```

Alternative: use hosted SDK `https://AUTH_PORTAL/sdk/auth-portal.js` (see Task D).

### A2) Portal: allowlist the callback URL

In Supabase (portal DB), set the exact allowed callback:

```sql
UPDATE public.apps
SET allowed_callback_urls = ARRAY['https://app1.com/auth/callback']
WHERE id = 'app1';
```

### A3) Client app: handle callback and exchange code

The portal redirects back to:

```
https://app1.com/auth/callback?code=...&state=...
```

In the client app backend, exchange the code:

```ts
const res = await fetch('https://access-broker.yourdomain.com/api/auth/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code,
    app_id: 'app1',
    redirect_uri: REDIRECT_URI,
    app_secret: process.env.SSO_APP_SECRET,
  }),
});

if (!res.ok) throw new Error(`SSO exchange failed (${res.status})`);
const payload = await res.json();
// payload: { user, app_id, app_claims, expires_in }
// user: { id, email }
```

### A4) Client app: enforce access

Treat this as the canonical access gate:

```ts
if (payload.app_claims?.enabled !== true) {
  // deny access in the client app
}
```

**Acceptance criteria (Task A):**

- Redirects only work for allowlisted `redirect_uri`
- `/api/auth/exchange` rejects expired/used codes
- Client app denies access if `app_claims.enabled !== true`

## Task B — Require an app secret for exchange (recommended)

### B1) Generate a secret (per app, per environment)

Each app supports multiple named secrets (e.g. "production", "staging", "local"). Generate secrets from the dashboard under the app's SSO settings tab. The plaintext is shown once — store it in the client app backend env as `SSO_APP_SECRET`.

The portal checks the incoming secret against all active secrets for the app, so you can add a new secret for a new environment without invalidating existing ones.

### B2) Delete old secrets

When rotating, generate the new secret first, deploy it to the client, then delete the old secret from the dashboard.

**Acceptance criteria (Task B):**

- `/api/auth/exchange` returns 401 if `app_secret` is missing/invalid
- `/api/auth/exchange` returns 403 if the app has no configured secret
- Multiple secrets per app are supported (checked against all active secrets)

## Task C — Passkeys (portal-side)

Passkeys are enabled on the portal with:

```env
NEXT_PUBLIC_AUTH_PASSKEYS=true
NEXT_PUBLIC_APP_URL=https://access-broker.yourdomain.com
NEXT_PUBLIC_AUTH_PASSKEY_RP_ID=access-broker.yourdomain.com
```

User flows:

- Sign in: `/login` → "Sign in with Passkey"
- Manage passkeys: `/account`

**Acceptance criteria (Task C):**

- Passkey registration works on the portal domain
- Passkey login works without email interaction
- Non-admin users can access `/account` and `/sso/*` but cannot access admin dashboard routes

## Task D — Optional client SDK usage

Portal hosts:

- `public/sdk/auth-portal.js` at `/sdk/auth-portal.js`

Client app HTML:

```html
<script>
  window.__AUTH_PORTAL_URL__ = 'https://access-broker.yourdomain.com';
</script>
<script src="https://access-broker.yourdomain.com/sdk/auth-portal.js"></script>
```

Usage:

```js
AuthPortal.login({ appId: 'app1', redirectUri: 'https://app1.com/auth/callback', state: 'xyz' });
```

## Task E — User lookup API integration

When a client app needs to look up user information by ID, email, or Telegram ID (e.g., when handling webhooks or background jobs), use the backend-only `/api/users/lookup` endpoint.

### E1) Client app: call user lookup endpoint

From the client app backend:

```ts
const response = await fetch('https://access-broker.yourdomain.com/api/users/lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    app_id: process.env.APP_ID,
    app_secret: process.env.SSO_APP_SECRET,
    telegram_id: 123456789, // or user_id / email (use exactly one)
  }),
});

const data = await response.json();
// { user: { id, email }, app_claims }
```

### E2) Portal implementation

**Endpoint:** `app/api/users/lookup/route.ts`

- Validates app credentials (same as `/api/auth/exchange`)
- Looks up user via `lookup_user_by_identifier()` SQL function
- Returns minimal user payload (`id`, `email`) plus `app_claims`
- Logs audit events: `user_lookup_success` / `user_lookup_error`

**Database function:** `lookup_user_by_identifier(p_user_id, p_email, p_telegram_id)`

- Defined in `migrations/011_user_lookup_function.sql`
- Returns user data from `auth.users` by any identifier
- SECURITY DEFINER to access auth schema

**Acceptance criteria (Task E):**

- Endpoint validates app_id and app_secret
- Supports lookup by user_id, email, or telegram_id (exactly one per request)
- Returns same safe payload shape as `/api/auth/exchange`
- Returns 404 if user not found
- Audit logs all lookup attempts
