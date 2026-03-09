---
title: "Authentication Setup Guide"
description: "Set up Supabase Auth with access broker claims"
category: "authentication"
audience: "app-developer"
order: 1
---

# Authentication Setup Guide

**TL;DR:**
- Choose your auth method (password, passwordless, or SSO)
- Use shared setup patterns for clients, middleware, and callbacks
- Assign app access via claims after sign up
- Gate access in middleware and server components

**Time to read:** 10 minutes | **Prerequisites:** [Installation](/docs/installation) | **Next steps:** [Authorization Patterns](/docs/authorization-patterns)

**Context:** This guide explains how to set up Supabase Auth (not NextAuth.js) and integrate it with access broker claims so you can control user access during sign up and sign in.

**Scope:** This is for **client apps** integrating with the access broker. If you're operating the access broker portal itself, see [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys).

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript

**Prerequisites:**
- Supabase project created
- Custom claims functions installed (`install.sql`)
- Basic understanding of Next.js App Router

## Table of Contents

- [Overview](#overview)
- [Architecture: Dashboard vs Your Applications](#architecture-dashboard-vs-your-applications)
- [Environment Setup](#environment-setup)
- [Choose Your Auth Method](#choose-your-auth-method)
- [Shared Auth Patterns](#shared-auth-patterns)
- [App Access Checks](#app-access-checks)
- [Sign Up: Assign App Access](#sign-up-assign-app-access)
- [Sign In: Gate by Claims](#sign-in-gate-by-claims)
- [Advanced: Database Triggers](#advanced-database-triggers)
- [Troubleshooting](#troubleshooting)

## Overview

access broker builds on Supabase Auth by storing authorization data in `app_metadata` claims:

```typescript
{
  id: "uuid-string",
  email: "user@example.com",
  app_metadata: {
    claims_admin: true,
    apps: {
      "my-app": {
        enabled: true,
        role: "admin",
        permissions: ["read", "write"]
      }
    }
  },
  user_metadata: {
    full_name: "Jane Doe"
  }
}
```

## Architecture: Dashboard vs Your Applications

**Dashboard (this repo):**
- Admin UI for managing users, apps, and claims
- Can also serve as an auth portal for SSO

**Your applications (separate codebases):**
- Implement sign up/sign in
- Use the same Supabase project
- Enforce access with claims

## Environment Setup

Use the full environment checklist here:
- [Environment Configuration](/docs/environment-configuration)

## Choose Your Auth Method

Pick the method you want to implement:
- **Passwordless / magic links:** [Passwordless Auth](/docs/passwordless-auth)
- **Password auth:** [Password Auth](/docs/password-auth)
- **SSO with auth portal:** [SSO Integration Guide](/docs/sso-integration-guide)

## Shared Auth Patterns

Use the canonical setup patterns here:
- [Shared Auth Patterns](/docs/shared-patterns)

## App Access Checks

Use claims to gate access to a specific app:

```typescript
const APP_ID = 'your-app-id';
const { data: { user } } = await supabase.auth.getUser();
const hasAccess = user?.app_metadata?.apps?.[APP_ID]?.enabled === true;

if (!hasAccess) {
  redirect('/access-denied');
}
```

## Sign Up: Assign App Access

After sign up, assign app access with claims. Use either:
- [Claims Guide](/docs/claims-guide) for claim functions
- [Role Management Guide](/docs/role-management-guide) for database-backed roles

## Sign In: Gate by Claims

On sign in, enforce access in middleware or server components:

```typescript
const APP_ID = 'your-app-id';
const { data: { user } } = await supabase.auth.getUser();
const hasAccess = user?.app_metadata?.apps?.[APP_ID]?.enabled === true;

if (!hasAccess) {
  redirect('/access-denied');
}
```

## Advanced: Database Triggers

If you want to auto-assign app access at user creation time, use a trigger:
- [Complete Integration Guide](/docs/complete-integration-guide)

## Troubleshooting

- **Claims updated but not reflected?** Refresh the session: `supabase.auth.refreshSession()`
- **User can’t access app?** Verify `apps.{app_id}.enabled` in `app_metadata`
- **Incorrect role checks?** Ensure role names match exactly and refresh the session

## What's Next

- [Session Management](/docs/session-management)
- [Logout Guide](/docs/logout-guide)
- [Authorization Patterns](/docs/authorization-patterns)
