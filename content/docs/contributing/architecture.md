---
title: "Architecture"
description: "How the admin dashboard + claims system is structured (for contributors)"
category: "contributing"
audience: "all"
order: 1
---

# Architecture

This repository contains an **admin dashboard** for managing Supabase Auth users + custom claims, plus the SQL/migration assets that power the claims system.

If you’re an application developer integrating the system (not contributing to the dashboard code), start at: [Getting Started](/docs/overview).

## High-level components

- **Supabase project**
  - Auth users live in `auth.users`
  - Custom claims live in `auth.users.raw_app_meta_data` (surfaced as `user.app_metadata`)
  - SQL installs RPC functions used to read/write claims
- **Admin Dashboard (Next.js App Router)**
  - Lists users (requires service role key)
  - Manages claims, roles, app access, API keys
  - Enforces admin-only access via `claims_admin` claim
- **Docs site**
  - Markdown docs in `content/docs/*`
  - `/docs` route renders the docs UI

## Key directories

- `app/`: Next.js routes/pages (dashboard UI + docs pages)
- `components/`: UI components for apps/claims/users/docs
- `lib/`: services + Supabase client helpers + docs loader
- `content/docs/`: implementation docs + admin docs + contributing docs
- `install.sql`: SQL functions that implement claims RPC
- `migrations/`: incremental DB changes for multi-app support, API keys, etc.

## Where core auth/claims rules live

- **SQL / RPC functions**: `install.sql` and `migrations/*`
- **Dashboard access control**: `middleware.ts` (root)
- **Claims operations**: `app/actions/*` and `lib/*service.ts`

---

## What's Next

- **Dev setup:** [Development](/docs/development)
- **Contributing workflow:** [Contributing](/docs/contributing)
- **Docs home:** [/docs](/docs)
