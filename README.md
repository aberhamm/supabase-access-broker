# Supabase Access Broker

**A unified identity and access management platform for Supabase applications.**

## Is this for you?

| Use Case | Is this project for you? |
|----------|--------------------------|
| I need basic auth (sign up, sign in) for one app | **No** — use [Supabase Auth](https://supabase.com/docs/guides/auth) directly |
| I need custom claims/roles in my JWT tokens | **Yes** — install the SQL functions |
| I have multiple apps sharing one Supabase project | **Yes** — use the full platform |
| I want a central login portal (SSO) for my apps | **Yes** — deploy the auth portal |
| I need an admin UI to manage users and permissions | **Yes** — deploy the dashboard |

**TL;DR:** If you have ONE app and just need auth, use Supabase Auth directly. Come back when you need custom JWT claims, multi-app support, or an admin dashboard.

---

## What this project provides

| Component | Description | Use it when... |
|-----------|-------------|----------------|
| **SQL Functions** | `set_claim()`, `set_app_claim()`, etc. | You need custom claims in JWT tokens |
| **Admin Dashboard** | Web UI for user/app/role management | You want a GUI to manage access |
| **Auth Portal** | SSO hub with passkeys, OAuth, MFA | You have multiple apps on different domains |
| **TypeScript Helpers** | Type-safe claim utilities | You're building with Next.js/TypeScript |

You can use these **independently** — just the SQL functions, or the full platform.

---

## Overview

Supabase Access Broker provides centralized authentication, authorization, and user management for single or multi-application environments. It combines:

- **Authentication Portal** — SSO hub with passkeys, OAuth, MFA, and passwordless options
- **Authorization Engine** — JWT claims-based permissions embedded in tokens
- **User Management Console** — Admin interface for user lifecycle operations
- **Multi-App Access Control** — Per-application roles, permissions, and API keys

## Core Capabilities

### Authentication Portal (SSO)

A central authentication service that your applications redirect to for sign-in:

| Method | Description |
|--------|-------------|
| **Passkeys** | WebAuthn biometric auth (Face ID, Touch ID, Windows Hello) |
| **OAuth** | Google, GitHub (extensible) |
| **Email OTP** | 6-digit verification codes |
| **Magic Links** | One-click email authentication |
| **Password** | Traditional email/password |
| **MFA** | TOTP authenticator apps, phone factors |

All methods are feature-flagged for controlled rollout.

### Authorization Engine

JWT claims embedded directly in tokens for high-performance authorization:

```typescript
// Claims available instantly from the JWT — no database queries
const user = await supabase.auth.getUser();
const isAdmin = user.app_metadata?.claims_admin;
const appRole = user.app_metadata?.apps?.['my-app']?.role;
const permissions = user.app_metadata?.apps?.['my-app']?.permissions;
```

- Global claims (user-level attributes)
- App-specific claims (per-application roles/permissions)
- Full RLS policy integration
- Type-safe TypeScript support

### User Management Console

Administrative interface for user lifecycle operations:

- **User CRUD** — Create users directly or via email invite
- **Profile Management** — Email, phone, display name, metadata
- **Access Control** — Grant/revoke admin status, app access
- **Security Operations** — Password resets, ban/unban with durations
- **Activity Monitoring** — Last sign-in, account creation dates
- **External Accounts** — Link/unlink OAuth and third-party identities

### Multi-App Access Control

Manage multiple applications from a single broker:

- **App Registry** — Register applications with metadata (name, color, icon)
- **Role Definitions** — Create roles per application
- **Permission Assignment** — Assign users to apps with specific roles
- **API Key Infrastructure** — Generate, validate, and track API keys per app
- **SSO Configuration** — Allowed redirect URLs per application

## Quick Start

### 1. Install SQL Functions

```bash
# Clone and install
git clone https://github.com/aberhamm/supabase-access-broker.git
cd supabase-access-broker
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run migrations
pnpm migrate
```

**Alternative:** Run [install.sql](./install.sql) manually in the Supabase SQL Editor.

> **Which method should I use?**
> | Scenario | Method |
> |----------|--------|
> | Fresh installation (new project) | Either works — `pnpm migrate` is recommended |
> | Upgrading an existing installation | Use `pnpm migrate` (runs only new migrations) |
> | Quick setup without CLI | Use `install.sql` in SQL Editor |
> | CI/CD pipelines | Use `pnpm migrate` for tracking |
>
> **Note:** Don't mix methods. If you started with `install.sql`, continue with manual SQL. If you use the migration runner, it tracks applied migrations automatically.

### 2. Grant Admin Access

```sql
-- In Supabase SQL Editor
SELECT set_claim('your-user-id', 'claims_admin', 'true');
```

### 3. Start the Broker

```bash
pnpm dev
```

Access the console at `http://localhost:3000`

## Integration

### For Client Applications

Redirect users to the Access Broker for authentication:

```typescript
// Redirect to SSO
const ssoUrl = new URL('/login', BROKER_URL);
ssoUrl.searchParams.set('redirect_uri', 'https://myapp.com/auth/callback');
ssoUrl.searchParams.set('app_id', 'my-app');
window.location.href = ssoUrl.toString();
```

After authentication, users are redirected back with an auth code to exchange for a session.

Important integration requirements:

- Perform the auth-code exchange from your backend only.
- Always send `app_secret` to `POST /api/auth/exchange`.
- Always send `app_secret` to `POST /api/users/lookup`.
- Do not rely on `connected_accounts` in exchange or lookup responses.

### Reading Claims

```typescript
import { createClient } from '@supabase/supabase-js';

const { data: { user } } = await supabase.auth.getUser();

// Global claims
const isAdmin = user?.app_metadata?.claims_admin;
const userTier = user?.app_metadata?.tier;

// App-specific claims
const myAppAccess = user?.app_metadata?.apps?.['my-app'];
if (myAppAccess?.enabled) {
  const role = myAppAccess.role;        // e.g., 'editor'
  const perms = myAppAccess.permissions; // e.g., ['read', 'write']
}
```

### RLS Policy Integration

```sql
-- Row Level Security using JWT claims
CREATE POLICY "Users can access their org data"
ON documents FOR SELECT
USING (
  org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
);

CREATE POLICY "Admins have full access"
ON documents FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean = true
);
```

## Documentation

| Guide | Purpose |
|-------|---------|
| **[Complete Integration Guide](./content/docs/integrator/complete-integration-guide.md)** | Step-by-step implementation |
| **[SSO Integration Guide](./content/docs/integrator/sso-integration-guide.md)** | Connect your apps to the broker |
| **[Claims Guide](./content/docs/concepts/claims-guide.md)** | Understanding JWT claims |
| **[Authorization Patterns](./content/docs/concepts/authorization-patterns.md)** | RBAC implementation |
| **[API Reference](./docs/EXTERNAL_API_CONTRACT.md)** | RPC function documentation |
| **[Multi-App Guide](./content/docs/operator/multi-app-guide.md)** | Managing multiple applications |

**[Full Documentation Index](./content/docs/INDEX.md)**

## Deployment

### Docker (Recommended)

```bash
# Setup
cp .env.docker.example .env.production

# Deploy
docker-compose up -d

# Access at http://localhost:3050
```

With Nginx + SSL:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

See [Docker Deployment Guide](./DOCKER_DEPLOYMENT.md) for full production setup.

### Vercel / Other Platforms

Standard Next.js deployment. See [Environment Configuration](./content/docs/operator/environment-configuration.md).

## Architecture

```
supabase-access-broker/
├── app/
│   ├── (auth)/           # Auth portal routes (login, SSO, callbacks)
│   ├── (dashboard)/      # Admin console routes (users, apps, settings)
│   ├── account/          # User self-service (profile, passkeys, MFA)
│   ├── api/              # API routes (webhooks, passkey endpoints)
│   └── actions/          # Server actions
├── components/
│   ├── auth/             # Auth UI components
│   ├── claims/           # Claims management components
│   ├── users/            # User management components
│   └── ui/               # Base UI components (shadcn)
├── lib/
│   ├── supabase/         # Supabase client utilities
│   └── claims.ts         # Claims helper functions
├── migrations/           # SQL migration files
└── types/                # TypeScript definitions
```

## Technology Stack

- **Next.js 15** / **React 19** — App framework
- **TypeScript** — Type safety
- **Supabase** — Auth, database, RLS
- **@simplewebauthn** — Passkey/WebAuthn support
- **Tailwind CSS** / **shadcn/ui** — Styling
- **Radix UI** — Accessible components

## Database Migrations

```bash
# Check migration status
pnpm migrate:status

# Run pending migrations
pnpm migrate

# Force re-run a migration
pnpm migrate:force <migration_name>
```

See [Migration Guide](./docs/MIGRATION_GUIDE.md) for details.

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Route Protection** | Middleware-based authentication checks |
| **Authorization** | JWT claims embedded in tokens |
| **Database** | Row Level Security policies |
| **API Keys** | SHA-256 hashed, with usage tracking |
| **SSO** | Redirect URI whitelisting, short-lived auth codes |
| **Audit** | SSO event logging |

### Access Control

- **Admin routes** (`/`, `/users`, `/apps`) require `claims_admin: true`
- **Auth portal routes** (`/login`, `/account`, `/sso/*`) are available to authenticated users
- **API routes** validate API keys or session tokens

## Contributing

See [Contributing Guide](./content/docs/contributing/contributing.md).

## License

MIT License


### Application login branding

Apply migration `030_app_login_theme.sql` through the normal migration process
before saving themes. It adds nullable `apps.login_theme` in the existing registry;
existing claims-admin RLS remains in force. The **Branding** tab on each app supports
an approved font, wordmark case, light/dark palettes, live preview, contrast checks,
and restoring shared defaults. Saving requires `claims_admin` (app-admin alone is
insufficient). No deployment or production data update is part of this change.

`lib/app-branding.ts` defines the version-1 contract. Palette overrides accept only
opaque six-digit RGB hex colors; CSS, HTML, URLs, arbitrary fonts and unknown keys
are rejected. Text/primary/error/muted colors must contrast at least 4.5:1 against
both backgrounds; focus colors at least 3:1. Button foregrounds are derived for
contrast, while the accent is reserved for the wordmark and filled controls.
Use `mode: light`, `dark`, or `system`; missing colors inherit that mode's defaults.
The approved asset ID `lookbook` in the existing `apps.icon` field resolves to the
bundled icon. Other icon values safely fall back to the registry-name wordmark;
remote image URLs and arbitrary SVG are deliberately unsupported. Adding another
logo or font requires a reviewed bundled asset and a contract allowlist update.

Only an enabled registered app with a validated SSO callback can supply login
branding. The server reads presentation fields per request, never client CSS or
unvalidated `app_id` alone. Unknown, disabled, deleted, unauthorized or unavailable
apps use the shared login shell. Malformed themes use safe defaults with the existing
validated `apps.color` hint. Missing migration columns retain legacy name/color.
No client secrets, callbacks or other registry fields are serialized as branding.
Authentication handlers, state, redirect validation and MFA gates are unchanged.

**Lookbook reference:** `lib/branding-presets.ts` is a reviewed SSO snapshot of
`unstructured-data-portal/packages/theme/src/palettes.ts` (commit `2ad4d77`),
`LOOKBOOK_WEBSITE_THEME_CONFIG`, and the primary-button recipe, inspected 2026-09-08.
The public `/api/theme-config` returned `{config:{}, updatedAt:null}`, so shipped
code defaults apply: Inter Tight, uppercase weight-800 wordmark, red `#ff0001`,
chalk `#f4f1ed`, cream card `#f5ede7`, black primary buttons, muted `#57514c`,
error/focus `#c20000`, border `#d2cfcb`. Executable tokens supersede stale DESIGN.md
values (weight 900, bright-red small error text, older border). Lookbook has no
canonical automatic dark pairing, so this preset stays light. The app's share
URLs, native share-intent settings, feed layouts and remote product-theme editor
remain Lookbook-owned. SSO does not fetch those settings at login. To adopt later
Lookbook changes, review the canonical tokens and update the snapshot explicitly.
The Lookbook preset button stages palette changes for an admin to review and save;
it never creates an app or changes its registered name/icon/callbacks.

Fonts and the icon in `public/branding/` are copied from the canonical Lookbook
assets; font licenses are included. The fixture uses app ID `lookbook-social`
and both web/mobile HTTPS callbacks; it is test data only, not a production seed.

Run `pnpm exec playwright test --config=playwright.branding.config.ts` for isolated
production-build browser coverage on desktop/mobile. It starts a local Supabase
HTTP fixture on 3063 and Next on 3062, overrides Supabase keys/URLs with fake values,
and bypasses the normal account-creating global setup. It performs no migrations,
real auth, email, or production writes. Unit coverage also exercises malformed CSS,
contrast, authorization, no-row/RLS outcomes, deleted apps and rollout fallback.
