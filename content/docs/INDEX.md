---
title: "Documentation"
description: "Supabase Access Broker — unified identity and access management for Supabase applications"
category: "getting-started"
audience: "all"
order: 0
---

# Supabase Access Broker Documentation

Supabase Access Broker provides centralized authentication, authorization, and user management for single or multi-application environments built on Supabase.

## Choose your path

- **I want to integrate auth + claims into my app**
  Start here: [Getting Started Overview](./getting-started/overview.md) → [Quick Start](./getting-started/quick-start.md) → [Installation](./getting-started/installation.md)

- **I want to connect my app to the Access Broker (SSO)**
  Start here: **[SSO Integration Guide](./guides/sso-integration-guide.md)** — simple 3-step integration

- **I want to deploy the Access Broker**
  Start here: [Dashboard Quick Start](./dashboard/dashboard-quick-start.md) → [Dashboard Setup](./dashboard/setup.md) → **[Auth Portal (SSO + Passkeys)](./authentication/auth-portal-sso-passkeys.md)**

- **I'm an AI agent helping a developer**
  Use: [Agent Context](./reference/agent-context.md) → **[Agent Instructions: Auth Portal](./reference/auth-portal-agent-instructions.md)**

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
