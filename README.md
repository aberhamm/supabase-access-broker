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
- **SSO Configuration** — Allowed callback URLs per application

## Quick Start

### 1. Install SQL Functions

```bash
# Clone and install
git clone <repo-url>
cd supabase-access-broker
pnpm install

# Configure environment
cp env.example .env.local
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
| **[Complete Integration Guide](./content/docs/guides/complete-integration-guide.md)** | Step-by-step implementation |
| **[SSO Integration Guide](./content/docs/guides/sso-integration-guide.md)** | Connect your apps to the broker |
| **[Claims Guide](./content/docs/authorization/claims-guide.md)** | Understanding JWT claims |
| **[Authorization Patterns](./content/docs/authorization/authorization-patterns.md)** | RBAC implementation |
| **[API Reference](./docs/EXTERNAL_API_CONTRACT.md)** | RPC function documentation |
| **[Multi-App Guide](./content/docs/advanced/multi-app-guide.md)** | Managing multiple applications |

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

Standard Next.js deployment. See [Environment Configuration](./content/docs/guides/environment-configuration.md).

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
