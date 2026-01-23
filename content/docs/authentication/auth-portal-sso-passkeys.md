---
title: "Auth Portal (SSO + Passkeys)"
description: "Central auth portal for multiple apps: passkeys (Face ID/Touch ID) + SSO code exchange"
category: "authentication"
audience: "all"
order: 7
---

# Auth Portal (SSO + Passkeys)

This repo can act as a **central auth portal** for multiple applications (Option B):

- Users authenticate **once** on the portal (passkeys, OAuth, OTP, password — all feature-flagged)
- Client apps redirect to the portal to sign in
- The portal redirects back with a short-lived **code**
- The client app exchanges that code for user info + app claims via `POST /api/auth/exchange`

## Passkeys (Face ID / Touch ID / Windows Hello)

### Requirements

- **Passkeys are origin/RP-bound**. For the portal they must be registered on the portal domain (e.g. `auth.company.com`).
- **HTTPS is required** in production. `http://localhost` is allowed for local dev.

### Environment variables

Set these on the portal:

```env
NEXT_PUBLIC_APP_URL=https://access-broker.yourdomain.com
NEXT_PUBLIC_AUTH_PASSKEYS=true
NEXT_PUBLIC_AUTH_PASSKEY_RP_ID=access-broker.yourdomain.com
```

### User UX

- Login: `/login` → “Sign in with Passkey”
- Manage passkeys: `/account`

## SSO flow (cross-domain)

### Redirect flow

Client app redirects user to the portal:

```
GET https://access-broker.yourdomain.com/login?app_id=app1&redirect_uri=https://app1.com/auth/callback&state=xyz
```

After authentication, the portal completes SSO:

```
GET /sso/complete?app_id=app1&redirect_uri=https://app1.com/auth/callback&state=xyz
→ redirects to https://app1.com/auth/callback?code=...&state=xyz
```

### Register allowed callback URLs (required)

For security, the portal only redirects to pre-approved callback URLs.

In Supabase, set `public.apps.allowed_callback_urls` for each app (exact match):

```sql
UPDATE public.apps
SET allowed_callback_urls = ARRAY[
  'https://app1.com/auth/callback',
  'https://app1.com/auth/callback/'
]
WHERE id = 'app1';
```

> These columns are added by `migrations/007_auth_and_passkeys.sql`.

### Exchange the code

Client app backend exchanges the code:

```
POST https://access-broker.yourdomain.com/api/auth/exchange
Content-Type: application/json

{
  "code": "…",
  "app_id": "app1",
  "app_secret": "optional"
}
```

Response:

```json
{
  "user": { "id": "…", "email": "…" },
  "app_id": "app1",
  "app_claims": { "enabled": true, "role": "admin" },
  "expires_in": 300
}
```

### Optional: require an app secret

If you want to prevent third parties from exchanging codes, set `public.apps.sso_client_secret_hash`
to a SHA-256 hex of a shared secret known by the app backend:

```sql
UPDATE public.apps
SET sso_client_secret_hash = '<sha256_hex_of_secret>'
WHERE id = 'app1';
```

Then include `app_secret` in `/api/auth/exchange` requests.

## Client SDK (browser helper)

The portal hosts a tiny helper at:

`/sdk/auth-portal.js` (see `public/sdk/auth-portal.js`)

Example usage in a client app:

```html
<script>
  window.__AUTH_PORTAL_URL__ = 'https://access-broker.yourdomain.com';
</script>
<script src="https://access-broker.yourdomain.com/sdk/auth-portal.js"></script>

<button onclick="AuthPortal.login({ appId: 'app1', redirectUri: 'https://app1.com/auth/callback', state: 'xyz' })">
  Sign in
</button>
```

Then in the client app callback page, read `code` and call `AuthPortal.exchangeCode(...)` from your backend (recommended) or from the browser for non-sensitive use cases.

## Feature flags (rollout / testing)

All login methods can be enabled independently on the portal:

```env
NEXT_PUBLIC_AUTH_PASSKEYS=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
NEXT_PUBLIC_AUTH_EMAIL_OTP=false
NEXT_PUBLIC_AUTH_PASSWORD=false
NEXT_PUBLIC_AUTH_MAGIC_LINK=true
```
