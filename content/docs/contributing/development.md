---
title: "Development"
description: "Local development workflow for the admin dashboard (for contributors)"
category: "contributing"
audience: "all"
order: 2
---

# Development

This is for contributors working on the **admin dashboard** code.

## Prerequisites

- Node.js + pnpm
- A Supabase project (URL + keys)
- `install.sql` applied to that Supabase project

## Install + run

```bash
pnpm install
cp env.example .env.local
pnpm dev
```

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (required in prod; optional in local)

## Auth portal feature flags (optional)

All login methods are feature-flagged so you can roll out gradually:

```env
NEXT_PUBLIC_AUTH_PASSKEYS=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
NEXT_PUBLIC_AUTH_EMAIL_OTP=false
NEXT_PUBLIC_AUTH_PASSWORD=false
NEXT_PUBLIC_AUTH_MAGIC_LINK=true
```

Passkeys (WebAuthn) require the portal origin/RP ID to match. For local dev, `http://localhost` is fine; for production use HTTPS:

```env
# Optional (defaults to NEXT_PUBLIC_APP_URL hostname)
NEXT_PUBLIC_AUTH_PASSKEY_RP_ID=access-broker.yourdomain.com
```

## Bootstrapping admin access

The dashboard requires `claims_admin: true` in the user’s claims.

```sql
select set_claim('YOUR-USER-ID', 'claims_admin', 'true');
```

## Common issues

- **Access denied after login**: you didn’t set `claims_admin`
- **Can’t list users**: missing/incorrect `SUPABASE_SERVICE_ROLE_KEY`
- **Auth redirects to localhost in prod**: set `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs
- **Passkeys fail**: check `NEXT_PUBLIC_APP_URL`/origin and `NEXT_PUBLIC_AUTH_PASSKEY_RP_ID` match the deployed portal host; use HTTPS in production
- **SSO redirect fails**: ensure `public.apps.allowed_callback_urls` includes the exact `redirect_uri` used by your client app

---

## What’s Next

- **Contributing:** [Contributing](/docs/contributing)


---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
