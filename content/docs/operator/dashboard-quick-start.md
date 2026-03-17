---
title: 'Access Broker Quick Start'
description: 'Get Access Broker running in 5 minutes'
category: 'operator'
audience: 'dashboard-admin'
order: 1
---

# Access Broker Quick Start

This guide is for **deploying Access Broker** (the admin console + auth portal), not for integrating claims into your user-facing app.

**Scope:** Operating the Access Broker app (dashboard + auth portal). For client app integration, start with [Authentication Guide](/docs/authentication-guide) or [SSO Integration Guide](/docs/sso-integration-guide).

## Get Started in 5 Minutes

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment

```bash
cp env.example .env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for admin operations like listing users)
- `NEXT_PUBLIC_APP_URL` (required in production for auth redirects)

For production redirect setup, see: [Environment Configuration](/docs/environment-configuration)

### 3) Bootstrap an admin user

In Supabase SQL Editor:

```sql
select set_claim('your-user-id-here', 'claims_admin', 'true');
```

### 4) Run the dashboard

```bash
pnpm dev
```

Open `http://localhost:3050` and sign in.

---

## What's Next

- **Dashboard setup:** [Dashboard Setup Guide](/docs/setup)
- **Getting started:** [Overview](/docs/overview) → [Quick Start](/docs/quick-start)
- **Docs home:** [/docs](/docs)
