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

## Database Migrations

Migrations are stored in `/migrations/*.sql` and are applied **manually** to the Supabase project.

### How to apply migrations

**Option 1: Supabase SQL Editor**
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy/paste the migration SQL and run it

**Option 2: Supabase MCP (via Cursor/Claude)**

Ask the AI assistant to apply the migration using the Supabase MCP tool:

```
Apply migrations/XXX_migration_name.sql to prod using the Supabase MCP
```

**Option 3: `make deploy-migrate` (local)**

Runs `pnpm migrate` locally, connecting directly to Supabase using credentials from `.env.production`. Note: requires migration infrastructure to be set up first (see below).

### Migration tracking (optional)

The `pnpm migrate` script can track applied migrations automatically, but requires a one-time bootstrap:

1. Apply `migrations/000_migration_tracker.sql` via SQL Editor
2. Create the `exec_sql` helper function:

```sql
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN EXECUTE sql; END; $$;

REVOKE ALL ON FUNCTION public.exec_sql FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;
```

After that, `make deploy-migrate` will work automatically.

### Creating new migrations

1. Create a new file: `migrations/NNN_description.sql` (increment the number)
2. Add the same SQL to `install.sql` for fresh installations
3. Apply to prod via one of the methods above

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
