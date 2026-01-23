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
GET https://AUTH_PORTAL/login?app_id=APP_ID&redirect_uri=CALLBACK_URL&state=OPTIONAL
```

Minimal browser snippet:

```ts
const portalUrl = 'https://auth.yourdomain.com';
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
const res = await fetch('https://auth.yourdomain.com/api/auth/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code,
    app_id: 'app1',
    app_secret: process.env.SSO_APP_SECRET, // optional
  }),
});

if (!res.ok) throw new Error(`SSO exchange failed (${res.status})`);
const payload = await res.json();
// payload: { user, app_id, app_claims, expires_in }
// user: { id, email, connected_accounts: { telegram: TelegramData | null } }
```

### A4) Client app: enforce access

Treat this as the canonical access gate:

```ts
if (payload.app_claims?.enabled !== true) {
  // deny access in the client app
}
```

### A5) Client app: consume connected accounts (optional)

Only use the specific connected account fields you need. Example:

```ts
const telegram = payload.user?.connected_accounts?.telegram ?? null;
if (telegram) {
  // Use telegram.id / username / first_name / last_name / linked_at
}
```

**Acceptance criteria (Task A):**

- Redirects only work for allowlisted `redirect_uri`
- `/api/auth/exchange` rejects expired/used codes
- Client app denies access if `app_claims.enabled !== true`

## Task B — Require an app secret for exchange (recommended)

### B1) Pick a secret (per app)

Store it in the client app backend env as `SSO_APP_SECRET`.

### B2) Hash it and store on the portal

Store SHA-256 hex in `public.apps.sso_client_secret_hash`.

Example command to compute SHA-256 hex:

```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1],'utf8').digest('hex'))" "YOUR_SECRET"
```

Then:

```sql
UPDATE public.apps
SET sso_client_secret_hash = '<sha256_hex>'
WHERE id = 'app1';
```

**Acceptance criteria (Task B):**

- `/api/auth/exchange` returns 401 if `app_secret` is missing/invalid (only for apps with a stored hash)

## Task C — Passkeys (portal-side)

Passkeys are enabled on the portal with:

```env
NEXT_PUBLIC_AUTH_PASSKEYS=true
NEXT_PUBLIC_APP_URL=https://auth.yourdomain.com
NEXT_PUBLIC_AUTH_PASSKEY_RP_ID=auth.yourdomain.com
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
  window.__AUTH_PORTAL_URL__ = 'https://auth.yourdomain.com';
</script>
<script src="https://auth.yourdomain.com/sdk/auth-portal.js"></script>
```

Usage:

```js
AuthPortal.login({ appId: 'app1', redirectUri: 'https://app1.com/auth/callback', state: 'xyz' });
```
