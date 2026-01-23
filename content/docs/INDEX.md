---
title: "Documentation"
description: "Supabase Access Broker — unified identity and access management for Supabase applications"
category: "getting-started"
audience: "all"
order: 0
---

# Supabase Access Broker Documentation

Supabase Access Broker provides centralized authentication, authorization, and user management for single or multi-application environments built on Supabase.

## Do I need this?

**Answer these questions first:**

| Question | If YES | If NO |
|----------|--------|-------|
| Do you have **multiple apps** sharing one Supabase project? | This is for you | Maybe overkill |
| Do you need **per-app roles/permissions** (not just global roles)? | This is for you | Use vanilla Supabase Auth |
| Do you want a **central SSO portal** for all your apps? | This is for you | Use Supabase Auth directly |
| Do you need an **admin dashboard** to manage users across apps? | This is for you | Use Supabase Dashboard |
| Do you just need **basic auth** (sign up, sign in, protected routes)? | Skip to [Simple Auth Guide](#simple-auth-just-supabase) | — |

### Simple Auth (Just Supabase)

If you just need authentication for a single app without multi-app claims, you don't need this project. Use Supabase Auth directly:

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({ email, password });

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// Get user
const { data: { user } } = await supabase.auth.getUser();

// Protect routes in middleware
if (!user) redirect('/login');
```

See [Supabase Auth Docs](https://supabase.com/docs/guides/auth) for the official guide.

**Come back here when you need:**
- Multiple apps with different access levels
- Custom claims in JWT tokens for RLS policies
- Centralized user management dashboard
- SSO across multiple domains

---

## What this project provides

| Component | What it does |
|-----------|--------------|
| **SQL Functions** | `set_claim`, `set_app_claim`, etc. — manage JWT claims stored in `app_metadata` |
| **Admin Dashboard** | Web UI to manage users, apps, roles, and permissions |
| **Auth Portal** | Optional SSO hub with passkeys, OAuth, MFA for multi-app environments |
| **TypeScript Helpers** | Type-safe claim reading and middleware patterns |

You can use **just the SQL functions** without the dashboard, or deploy the **full platform**.

---

## Choose your path

### Path 1: I want auth + claims in my Next.js app (single app)

You want Supabase Auth with custom claims for authorization.

1. [Quick Start](./getting-started/quick-start.md) — sign up/sign in with app access in 10 minutes
2. [Claims Guide](./authorization/claims-guide.md) — understand how claims work
3. [Authorization Patterns](./authorization/authorization-patterns.md) — implement RBAC

### Path 2: I have multiple apps sharing one Supabase project

You want centralized auth with per-app permissions.

1. [Multi-App Guide](./advanced/multi-app-guide.md) — architecture overview
2. [SSO Integration Guide](./guides/sso-integration-guide.md) — connect apps to central auth
3. [Complete Integration Guide](./guides/complete-integration-guide.md) — full implementation

### Path 3: I want to deploy the Access Broker (admin dashboard + auth portal)

You're setting up the platform for your organization.

1. [Dashboard Quick Start](./dashboard/dashboard-quick-start.md) — deploy the admin UI
2. [Dashboard Setup](./dashboard/setup.md) — configure apps and roles
3. [Auth Portal (SSO + Passkeys)](./authentication/auth-portal-sso-passkeys.md) — enable SSO

### Path 4: I'm an AI agent helping a developer

1. [Agent Context](./reference/agent-context.md) — system overview
2. [Agent Instructions: Auth Portal](./reference/auth-portal-agent-instructions.md) — copy/paste tasks

## Core implementation docs (recommended reading order)

1. **[Quick Start](./getting-started/quick-start.md)** — end-to-end sign-up/sign-in + access gate
2. **[Complete Integration Guide](./guides/complete-integration-guide.md)** — deeper walkthrough
3. **[Authentication Guide](./authentication/authentication-guide.md)** — auth patterns (OTP, OAuth, callbacks)
4. **[Session Management](./authentication/session-management.md)** — session lifecycle and persistence
5. **[Logout Guide](./authentication/logout-guide.md)** — internal logout, SSO logout, and Single Logout (SLO)
6. **[Claims Guide](./authorization/claims-guide.md)** — how claims work + constraints
7. **[Authorization Patterns](./authorization/authorization-patterns.md)** — RBAC/permissions patterns
8. **[RLS Policies](./authorization/rls-policies.md)** — database security using JWT claims
9. **[Environment Configuration](./guides/environment-configuration.md)** — production deployment + redirect safety

## Reference / Quick copy-paste

- **[Glossary](./reference/glossary.md)** — definitions of terms (claims, JWT, RLS, etc.)
- **[Auth Quick Reference](./guides/auth-quick-reference.md)**
- **[Agent Context](./reference/agent-context.md)**

## SSO & Auth Portal

- **[SSO Integration Guide](./guides/sso-integration-guide.md)** — integrate your app with the central auth portal (simple)
- **[Logout Guide](./authentication/logout-guide.md)** — implement logout for internal apps and SSO clients (SLO)
- **[Auth Portal (SSO + Passkeys)](./authentication/auth-portal-sso-passkeys.md)** — technical spec (API, DB schema)
- **[Agent Instructions: Auth Portal](./reference/auth-portal-agent-instructions.md)** — copy/paste tasks for AI agents

## Advanced topics

- **[Multi-App Guide](./advanced/multi-app-guide.md)**
- **[API Keys Guide](./advanced/api-keys-guide.md)**
- **[Connected Accounts](./advanced/connected-accounts.md)**
- **[App Auth Integration](./advanced/app-auth-integration.md)**

## Contributing (codebase docs)

These are intentionally separate from implementation docs:

- [Architecture](./contributing/architecture.md)
- [Development](./contributing/development.md)
- [Contributing](./contributing/contributing.md)
