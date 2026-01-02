---
title: "Getting Started Overview"
description: "What this auth + custom claims system is, how it works, and when to use it."
category: "getting-started"
audience: "app-developer"
order: 1
---

# Getting Started Overview

This documentation is for **implementing our Supabase-based auth + custom-claims framework into your own Next.js App Router application**.

## What you get

- **Authentication** via Supabase Auth (email/password, magic links, OAuth)
- **Authorization** via **custom claims stored in `app_metadata`**, embedded in the user’s JWT
- **Multi-app support**: one Supabase project can serve multiple apps, with per-app roles/permissions
- **Admin dashboard (optional)** to manage users, apps, roles, API keys, and claims centrally

## Mental model (Dashboard vs Your App)

- **Your App**: user-facing app where users sign up/sign in and you enforce access control.
- **Admin Dashboard (this repo)**: admin-only tool that can manage access/claims for users across apps.
- **Supabase**: shared auth + database, where claims live in `auth.users.raw_app_meta_data` and are surfaced to apps as `user.app_metadata`.

## Claims structure (what you’ll read in your app)

```json
{
  "claims_admin": false,
  "apps": {
    "your-app-id": {
      "enabled": true,
      "role": "user",
      "permissions": ["read"]
    }
  }
}
```

### The one rule that matters

In your app, always gate access with:

- `user.app_metadata.apps[APP_ID].enabled === true`

Do **not** rely on “user exists” or “user is authenticated” alone.

## How this compares (Auth0 + Supabase feel)

- Like Auth0, you get **roles/permissions in the token** and can build RBAC/ABAC cleanly.
- Like Supabase, you use **Supabase Auth + RLS** — with the added benefit that your authorization data can be **JWT-embedded** via claims.

## When to use this

- You want **fast auth checks** (no DB fetch for role/permissions).
- You want **RLS policies** that reference claims in the JWT.
- You have **multiple apps** sharing one Supabase project with per-app entitlements.

## When not to use claims

- Values change frequently (users must refresh session to see changes).
- Large data (JWT bloat).
- Secrets (claims are readable by the client).

---

## What's Next

- **Next:** [5-Minute Quick Start](/docs/quick-start) — implement sign-up/sign-in + app access checks end-to-end
- **Then:** [Complete Integration Guide](/docs/complete-integration-guide) — deeper walkthrough and patterns
- **Reference:** [Agent Context](/docs/agent-context) — single-page "everything an agent needs" reference
- **Auth patterns:** [Authentication Guide](/docs/authentication-guide)
- **Authorization patterns:** [Authorization Patterns](/docs/authorization-patterns)
- **Production config:** [Environment Configuration](/docs/environment-configuration)
