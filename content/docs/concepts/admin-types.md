---
title: "Admin Types and Permissions"
description: "Understand global admins, app admins, and admin roles"
category: 'concepts'
audience: "app-developer"
order: 3
---

# Admin Types and Permissions

**Context:** This system has **two distinct admin concepts** that serve different purposes. Understanding the differences is critical for correct authorization.

```mermaid
graph TD
    GlobalAdmin[claims_admin Global Super-Admin] --> AllApps[Manages Everything]
    AppAdmin[role: admin App Admin Role] --> OneApp[Dashboard + App Permissions]
```

## The Two Types of Admins

### 1. Global Super-Admin (`claims_admin`)

**What it is:** A special claim flag that grants full system access.

**Location:** `app_metadata.claims_admin: true`

**Powers:**
- ✅ Manage all users across all apps
- ✅ Create, update, and delete apps
- ✅ Create, update, and delete roles
- ✅ Grant/revoke app admin rights
- ✅ Access admin dashboard
- ✅ Modify any user's claims
- ✅ Full database access (if RLS policies allow)

**Use Case:** System administrators who manage the entire platform

**How to Grant:**
```sql
-- Via SQL Editor (one-time bootstrap)
SELECT set_claim('user-id'::uuid, 'claims_admin', 'true');
```

**Example User:**
```json
{
  "claims_admin": true,  // ← Global super-admin
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "viewer"  // Can still have regular roles in apps
    }
  }
}
```

**Security Note:** This is the highest privilege level. Only grant to trusted administrators.

### 2. App Admin Role (`apps.{app_id}.role: "admin"`)

**What it is:** A role that grants BOTH dashboard management rights AND full app permissions for a specific application.

**Location:** `app_metadata.apps.{app_id}.role: "admin"`

**Powers (for that app only):**
- ✅ Manage users who have access to their app
- ✅ View and modify app-specific claims for users
- ✅ Assign roles to users (for their app)
- ✅ Full app permissions (admin role permissions)
- ✅ Access to the dashboard for this app
- ❌ Cannot manage global claims
- ❌ Cannot manage other apps
- ❌ Cannot create/delete apps or roles

**Use Case:** Application owners who manage their specific app's users

**How to Grant:**
```typescript
import { setAppRoleAction } from '@/app/actions/claims';

// Grant app admin role
await setAppRoleAction('user-id', 'blog-app', 'admin');
```

**Example User:**
```json
{
  "claims_admin": false,  // Not a global admin
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "admin"  // ← App admin for blog-app (dashboard + permissions)
    },
    "forum-app": {
      "enabled": true,
      "role": "moderator"  // Regular user in forum-app
    }
  }
}
```

**Use Case Example:**
- Blog app owner can manage blog users in the dashboard
- Has full admin permissions within the blog app itself
- Cannot see or manage forum app users
- Cannot create new apps or modify global settings

## Comparison Table

| Aspect | `claims_admin` | `role: "admin"` |
|--------|---------------|-----------------|
| **Type** | Global flag | Role assignment |
| **Scope** | All apps | One app |
| **Can manage users** | All users | App users only |
| **Can create roles** | ✅ Yes | ❌ No |
| **Can grant app admin** | ✅ Yes | ❌ No |
| **Access dashboard** | ✅ Full access | ✅ Limited to their app |
| **App permissions** | Determined by app-specific role | Admin permissions |
| **Defined in** | Hardcoded system flag | `roles` table + assignment |
| **Typical use** | Platform admin | App owner + power user |

## Authorization Check Examples

**Check for global super-admin:**
```typescript
const isGlobalAdmin = user?.app_metadata?.claims_admin === true;

if (isGlobalAdmin) {
  // Can do anything
}
```

**Check for app-specific admin:**
```typescript
const userRole = user?.app_metadata?.apps?.['blog-app']?.role;
const isAppAdmin = userRole === 'admin';
const isGlobalAdmin = user?.app_metadata?.claims_admin === true;

if (isGlobalAdmin || isAppAdmin) {
  // Can manage blog-app users
}
```

**Using the helper function:**
```typescript
import { hasAnyAppAdmin } from '@/types/claims';

const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
const isAppAdmin = hasAnyAppAdmin(user?.app_metadata?.apps);

if (isGlobalAdmin || isAppAdmin) {
  // Has admin access to at least one app
}
```

**In RLS Policies:**
```sql
-- Global super-admins can do anything
CREATE POLICY "Global admins have full access"
ON any_table FOR ALL
USING (
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);

-- App admins can manage their app's data
CREATE POLICY "App admins can manage app data"
ON app_data FOR ALL
USING (
  -- Global admin
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
  OR
  -- App-specific admin (role='admin')
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
);

-- Users with admin role have full app permissions
CREATE POLICY "Admin role can access features"
ON blog_posts FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> 'blog-app' ->> 'role')
    IN ('admin', 'editor')
);
```

## Combining Admin Types

A user can be a global admin while also having specific roles in apps:

```json
{
  "claims_admin": true,  // Global super-admin
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "viewer"    // Has viewer role in blog-app
    },
    "forum-app": {
      "enabled": true,
      "role": "admin"     // Admin role in forum-app
    }
  }
}
```

**Best Practice:** Keep it simple:
- **Global admin** → Full system access, manages all apps
- **App admin (role='admin')** → Manages specific app + has full app permissions

## When to Use Each

**Use `claims_admin` for:**
- Platform administrators
- System maintainers
- Users who need to manage multiple apps
- Bootstrap/initial admin users

**Use `role: "admin"` for:**
- Application owners who manage their app
- Team leads for specific apps
- Delegated administration
- Multi-tenant scenarios where app owners manage their users
- Power users with full app permissions

## Security Considerations

1. **Least Privilege:** Don't grant `claims_admin` unless necessary
2. **Audit Trail:** Log when admin privileges are granted/revoked
3. **Regular Review:** Periodically audit who has admin access
4. **Separation of Concerns:** App admins should not have global access

**Query all admins:**
```sql
-- Find global admins
SELECT email, created_at
FROM auth.users
WHERE (raw_app_meta_data->'claims_admin')::bool = true;

-- Find app admins for specific app (role='admin')
SELECT email,
       raw_app_meta_data->'apps'->'blog-app'->>'role' as role
FROM auth.users
WHERE raw_app_meta_data->'apps'->'blog-app'->>'role' = 'admin';

-- Find all users with admin access to any app
SELECT email,
       jsonb_object_keys(raw_app_meta_data->'apps') as app_id
FROM auth.users
WHERE EXISTS (
  SELECT 1
  FROM jsonb_each(raw_app_meta_data->'apps')
  WHERE value->>'role' = 'admin'
);
```

## Related Documentation

- [Role Management Guide](/docs/role-management-guide)
- [Authorization Patterns](/docs/authorization-patterns)
- [RLS Policies](/docs/rls-policies)
