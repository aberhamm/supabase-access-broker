# Supabase Access Broker

A unified identity and access management platform for Supabase applications. Provides centralized authentication, authorization, and user management for single or multi-application environments.

## When to use this project

| Use Case | Is this project for you? |
|----------|--------------------------|
| I need basic auth (sign up, sign in) for one app | **No** — use Supabase Auth directly |
| I need custom claims/roles in my JWT tokens | **Yes** — install the SQL functions |
| I have multiple apps sharing one Supabase project | **Yes** — use the full platform |
| I want a central login portal (SSO) for my apps | **Yes** — deploy the auth portal |
| I need an admin UI to manage users and permissions | **Yes** — deploy the dashboard |

## Tech stack

- Next.js (App Router) + TypeScript
- pnpm (package manager)
- Supabase (PostgreSQL + Auth + RLS)
- Vitest (unit tests)
- Playwright (e2e tests)
- Docker (production deployment)

## Development commands

```bash
pnpm dev          # start dev server (localhost, uses tsx scripts/dev.ts)
pnpm build        # production build
pnpm lint         # ESLint
pnpm test         # vitest run (unit tests)
pnpm test:watch   # vitest watch mode
pnpm test:e2e     # playwright e2e tests
pnpm test:e2e:ui  # playwright with UI
pnpm test:e2e:headed  # playwright headed
pnpm test:e2e:debug   # playwright debug
pnpm migrate          # run migrations (tsx scripts/migrate.ts)
pnpm migrate:status   # check migration status
pnpm migrate:force    # force apply migration
```

## Project structure

```
app/                  # Next.js App Router pages and API routes
  (dashboard)/        # Admin dashboard (parallel route group)
  access-denied/
  account/
  api/                # API routes
  auth/
  login/
  signup/
  sso/
components/           # Shared UI components
lib/                  # Server-side service modules
  api-keys-service.ts
  apps-service.ts
  audit-service.ts
  auth-config.ts
  claims.ts
  external-keys-service.ts
  mfa-gate.ts
  ...
migrations/           # SQL migration files (numbered sequence)
  000_migration_tracker.sql
  001_multi_app_support.sql
  002_app_configuration_tables.sql
  003_api_keys.sql
  004_external_key_sources.sql
  006_performance_optimizations.sql
  007_auth_and_passkeys.sql
  008_sso_app_columns.sql
  009_sso_audit_logs.sql
docs/
  EXTERNAL_API_CONTRACT.md   # REST contract for external key sources
  MIGRATION_GUIDE.md
  SECURITY_AUDIT_2026-03-26.md
  SESSION_CONFIGURATION.md
  SIGNUP_LOCKDOWN.md
  plans/                     # Implementation plan docs
```

## Core capabilities

### Authentication portal (SSO)

Central auth service that applications redirect to for sign-in:

| Method | Description |
|--------|-------------|
| Passkeys | WebAuthn biometric auth (Face ID, Touch ID, Windows Hello) |
| OAuth | Google, GitHub (extensible) |
| Email OTP | 6-digit verification codes |
| Magic Links | One-click email authentication |
| Password | Traditional email/password |
| MFA | TOTP authenticator apps, phone factors |

All methods are feature-flagged for controlled rollout.

### Authorization engine

JWT claims embedded directly in tokens for high-performance authorization. Key SQL functions: `set_claim()`, `set_app_claim()`.

### External API key contract

External systems (n8n, Django, etc.) can expose their API keys via a standardized REST API (`GET /api/keys`). Configure authentication method (API Key header, Bearer token, Basic Auth) in "Manage External Sources" in the admin dashboard. See `docs/EXTERNAL_API_CONTRACT.md` for full schema.

## Environment variables

The build requires Supabase env vars; placeholders are used during CI/build if not set:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Docker deployment

```bash
docker-compose up           # local with Docker
docker-compose -f docker-compose.prod.yml up   # production
```

See `DOCKER_DEPLOYMENT.md` and `DOCKER_QUICK_START.md` for full deployment instructions.
