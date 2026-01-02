---
title: "Documentation"
description: "Implement Supabase Auth + Custom Claims (roles/permissions in JWT) in your Next.js app"
category: "getting-started"
audience: "all"
order: 0
---

# Documentation

This documentation is aimed at **implementing our Supabase Auth + Custom Claims framework in your Next.js application** (Auth0/Supabase style), with an optional admin dashboard to manage users/claims centrally.

## Choose your path

- **I want to integrate auth + claims into my app (recommended)**
  Start here: [Getting Started Overview](./getting-started/overview.md) → [Quick Start](./getting-started/quick-start.md) → [Installation](./getting-started/installation.md)

- **I’m an agent helping a developer**
  Use: [Agent Context](./reference/agent-context.md) → **[Agent Instructions: Auth Portal](./reference/auth-portal-agent-instructions.md)**

- **I want to integrate my app with the auth portal (SSO)**
  Start here: **[SSO Integration Guide](./guides/sso-integration-guide.md)** — simple 3-step integration

- **I want to run the admin dashboard + auth portal**
  Start here: [Dashboard Quick Start](./dashboard/dashboard-quick-start.md) → [Dashboard Setup](./dashboard/setup.md) → **[Auth Portal (SSO + Passkeys)](./authentication/auth-portal-sso-passkeys.md)**

## Core implementation docs (recommended reading order)

1. **[Quick Start](./getting-started/quick-start.md)** — end-to-end sign-up/sign-in + access gate
2. **[Complete Integration Guide](./guides/complete-integration-guide.md)** — deeper walkthrough
3. **[Authentication Guide](./authentication/authentication-guide.md)** — auth patterns (OTP, OAuth, callbacks)
4. **[Claims Guide](./authorization/claims-guide.md)** — how claims work + constraints
5. **[Authorization Patterns](./authorization/authorization-patterns.md)** — RBAC/permissions patterns
6. **[RLS Policies](./authorization/rls-policies.md)** — database security using JWT claims
7. **[Environment Configuration](./guides/environment-configuration.md)** — production deployment + redirect safety

## Reference / Quick copy-paste

- **[Auth Quick Reference](./guides/auth-quick-reference.md)**
- **[Agent Context](./reference/agent-context.md)**

## SSO & Auth Portal

- **[SSO Integration Guide](./guides/sso-integration-guide.md)** — integrate your app with the central auth portal (simple)
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
