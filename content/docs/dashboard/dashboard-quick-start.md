---
title: "Dashboard Quick Start"
description: "Get the admin dashboard running in 5 minutes"
category: "dashboard"
audience: "dashboard-admin"
order: 1
---

# Dashboard Quick Start

This guide is for **deploying/running the Claims Admin Dashboard** (the admin UI), not for integrating claims into your user-facing app.

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

## What’s Next

- **Next:** [Dashboard Setup Guide](/docs/setup) — deeper setup, troubleshooting, and production notes.
- **Implementers:** If you’re integrating auth/claims into your app, start here: [Getting Started Overview](/docs/overview) → [Quick Start](/docs/quick-start).


---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
