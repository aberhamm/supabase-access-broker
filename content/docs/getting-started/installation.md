---
title: "Installation"
description: "Install the SQL functions in Supabase and configure your Next.js app for production-safe auth redirects"
category: "getting-started"
audience: "dashboard-admin"
order: 3
---

# Installation

This guide installs the **database + auth plumbing** needed for the custom claims framework.

## 1) Install the SQL functions

1. Open **Supabase Dashboard → SQL Editor**
2. Copy/paste the contents of `install.sql` from this repo
3. Run it

This installs RPC functions used by your app (and the admin dashboard), including:

- `set_claim`, `get_claim`, `delete_claim`
- `set_app_claim`, `get_app_claim`, `delete_app_claim`

## 2) Verify installation

In the SQL Editor, run:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('set_app_claim', 'get_app_claim', 'delete_app_claim');
```

You should see all three functions.

## 3) Configure Supabase Auth URLs (redirect safety)

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: set to your production origin (example: `https://app.example.com`)
- **Redirect URLs**: allow both dev and prod callback URLs, e.g.

```
http://localhost:3050/auth/callback
http://localhost:3050/**
https://app.example.com/auth/callback
https://app.example.com/**
```

Why this matters: magic links / password resets / OAuth flows must redirect back to your app.

## 4) Set Next.js environment variables

In your Next.js app:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://app.example.com
```

### Security rules

- `SUPABASE_SERVICE_ROLE_KEY` must be used **server-side only** (API routes / server actions).
- Never ship the service role key to the browser.

## 5) Register your app (APP_ID)

Pick an `APP_ID` (kebab-case recommended), for example:

- `my-app`
- `analytics-dashboard`

Create the app in the admin dashboard, and use the same ID in your Next.js app (`APP_ID` constant).

---

## What's Next

- **Next:** [Quick Start](/docs/quick-start)
- **Authorization:** [Claims Guide](/docs/claims-guide) → [Authorization Patterns](/docs/authorization-patterns)
- **Production:** [Environment Configuration](/docs/environment-configuration)
