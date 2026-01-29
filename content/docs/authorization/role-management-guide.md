---
title: "Role Management Guide"
description: "Complete guide to database-backed role management system"
category: "authorization"
audience: "all"
order: 2
---

# Role Management Guide

**Context:** This guide explains the database-backed role management system that provides a structured way to define, manage, and assign user roles across your applications. Roles define templates of permissions that can be assigned to users via custom claims.

**Technology Stack:** PostgreSQL, Supabase Auth, Custom Claims, Next.js

**Prerequisites:**
- Custom claims functions installed (see [Claims Guide](/docs/claims-guide))
- Understanding of [Authorization Patterns](/docs/authorization-patterns)
- Basic PostgreSQL knowledge

**Key Concept:**

```
Roles (Database) → User Claims (JWT) → Authorization (RLS/Middleware)
     ↓                    ↓                       ↓
  Templates           Assignment              Enforcement
```

## Table of Contents

- [Overview](#overview)
- [Role Types](#role-types)
- [Role Structure](#role-structure)
- [Creating Roles](#creating-roles)
- [Assigning Roles to Users](#assigning-roles-to-users)
- [Using Roles in Authorization](#using-roles-in-authorization)
- [Role-Based Permissions](#role-based-permissions)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

## Overview

### What are Roles?

Roles are **database-backed templates** that define a set of permissions and access rights. They provide a structured, maintainable way to manage user permissions across your applications.

**Architecture:**

```
┌─────────────────┐
│  Roles Table    │  ← Database-backed role definitions
│  (PostgreSQL)   │     with permissions, labels, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Claims    │  ← Roles assigned to users via claims
│  (app_metadata) │     stored in JWT tokens
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Authorization  │  ← Roles checked in middleware, RLS,
│  (RLS/Code)     │     and application code
└─────────────────┘
```

### Why Use Database-Backed Roles?

**Before (Hardcoded):**
```typescript
// roles defined in code
const ROLES = ['admin', 'editor', 'viewer'];
```

❌ Must redeploy to change roles
❌ No role descriptions or metadata
❌ Hard to audit or track changes

**After (Database-Backed):**
```typescript
// roles defined in database
SELECT * FROM roles WHERE app_id = 'myapp';
```

✅ Change roles without redeploying
✅ Store rich metadata (descriptions, permissions)
✅ Audit trail with timestamps
✅ Dynamic role management via dashboard

### Roles vs Claims

| Aspect | Roles | Claims |
|--------|-------|--------|
| **Location** | PostgreSQL database | User's JWT token |
| **Purpose** | Define permission templates | Assign permissions to users |
| **Mutability** | Changed by admins | Assigned to users |
| **Scope** | Application-wide definitions | User-specific assignments |
| **Example** | "editor" role with permissions ["read", "write"] | User has role="editor" claim |

**Workflow:**
1. **Define** a role in the database (e.g., "editor" with ["read", "write"] permissions)
2. **Assign** the role to a user via custom claims (set user's `role` claim to "editor")
3. **Check** the user's role in authorization logic

## Role Types

The system supports two types of roles:

### 1. Global Roles

**Definition:** Available across all applications

**Use Cases:**
- Organization-wide roles (e.g., "employee", "contractor")
- Cross-app admin roles
- Standard user levels

**Example:**
```typescript
{
  id: "uuid-1",
  name: "employee",
  label: "Employee",
  description: "Standard employee access",
  is_global: true,
  app_id: null,  // No specific app
  permissions: ["read", "write"]
}
```

**When to Use:**
- User types that apply across all apps
- Company-wide roles
- Base permission sets

### 2. App-Specific Roles

**Definition:** Only available for a specific application

**Use Cases:**
- Application-specific roles (e.g., "blog-editor")
- Feature-specific access
- Custom app workflows

**Example:**
```typescript
{
  id: "uuid-2",
  name: "blog_editor",
  label: "Blog Editor",
  description: "Can edit blog posts",
  is_global: false,
  app_id: "blog-app",  // Specific app
  permissions: ["read", "write", "publish"]
}
```

**When to Use:**
- Roles specific to one application
- Different permission models per app
- App-specific workflows

## Role Structure

### Database Schema

Roles are stored in the `public.roles` table:

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- Role identifier (e.g., 'editor')
  label TEXT NOT NULL,             -- Display name (e.g., 'Content Editor')
  description TEXT,                -- Role description
  app_id TEXT REFERENCES apps(id), -- App (NULL for global roles)
  is_global BOOLEAN DEFAULT false, -- Global vs app-specific
  permissions JSONB DEFAULT '[]',  -- Array of permission strings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, app_id)             -- Unique per app
);
```

### Role Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `name` | Text | Yes | Role identifier (lowercase, underscores) |
| `label` | Text | Yes | Display name for UI |
| `description` | Text | No | Human-readable description |
| `app_id` | Text | Conditional | Required for app-specific roles, NULL for global |
| `is_global` | Boolean | Yes | True for global roles |
| `permissions` | JSONB | No | Array of permission strings |
| `created_at` | Timestamp | Auto | Creation timestamp |

### TypeScript Interface

```typescript
interface RoleConfig {
  id: string;
  name: string;              // 'editor'
  label: string;             // 'Content Editor'
  description?: string | null;
  app_id?: string | null;    // null for global roles
  is_global: boolean;
  permissions: string[];     // ['read', 'write', 'publish']
  created_at: string;
}
```

## Creating Roles

### Via Dashboard (Recommended)

1. **Navigate to App Settings**
   - Go to Apps → Select your app → Roles tab

2. **Click "Create Role"**
   - Enter role details
   - Select permissions

3. **Save**
   - Role is immediately available for assignment

### Via SQL

**Create a Global Role:**

```sql
SELECT create_role(
  'employee',              -- name
  'Employee',             -- label
  'Standard employee access', -- description
  NULL,                   -- app_id (NULL = global)
  true,                   -- is_global
  '["read", "write"]'::jsonb -- permissions
);
```

**Create an App-Specific Role:**

```sql
SELECT create_role(
  'blog_editor',          -- name
  'Blog Editor',          -- label
  'Can edit and publish blog posts',
  'blog-app',            -- app_id
  false,                 -- is_global
  '["read", "write", "publish"]'::jsonb
);
```

### Via API (TypeScript)

```typescript
import { createRoleAction } from '@/app/actions/apps';

// Create app-specific role
const result = await createRoleAction({
  name: 'content_moderator',
  label: 'Content Moderator',
  description: 'Can moderate user-generated content',
  app_id: 'forum-app',
  is_global: false,
  permissions: ['read', 'write', 'moderate', 'delete']
});

if (result.error) {
  console.error('Failed to create role:', result.error);
} else {
  console.log('Role created successfully');
}
```

### Common Permission Patterns

**Basic CRUD:**
```typescript
permissions: ['read', 'write', 'delete']
```

**Graduated Access:**
```typescript
// Viewer
permissions: ['read']

// Editor
permissions: ['read', 'write']

// Manager
permissions: ['read', 'write', 'delete', 'manage_users']

// Admin
permissions: ['read', 'write', 'delete', 'manage_users', 'admin']
```

**Feature-Specific:**
```typescript
permissions: [
  'view_reports',
  'export_data',
  'share_reports',
  'create_alerts'
]
```

## Assigning Roles to Users

### Important: Roles vs Claims Assignment

**Roles are assigned to users via custom claims.** The role database defines *what roles exist*, but assigning them to users happens through the claims system.

### Via Dashboard

1. **Go to user details page**
   - Navigate to Users → Select user

2. **Find App Access card**
   - Enable access to the app
   - Select role from dropdown

3. **Save**
   - User's claims updated with role
   - User must refresh session to see changes

### Via Server Actions

```typescript
import { setAppRoleAction } from '@/app/actions/claims';

// Assign role to user for specific app
await setAppRoleAction(
  'user-id-123',
  'blog-app',
  'blog_editor'  // Role name from roles table
);
```

### Via SQL (Direct Claims Management)

```sql
-- Set user's role for an app
SELECT set_app_claim(
  'user-id-123'::uuid,
  'blog-app',
  'role',
  '"blog_editor"'::jsonb  -- Note: strings need quotes in JSONB
);
```

### Via Supabase RPC

```typescript
// Using Supabase client
const { data, error } = await supabase.rpc('set_app_claim', {
  uid: 'user-id-123',
  app_id: 'blog-app',
  claim: 'role',
  value: 'blog_editor'
});
```

### Result: User Claims Structure

After assignment, the user's `app_metadata` looks like:

```json
{
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "blog_editor"  // ← Role assigned from roles table
    }
  }
}
```

## Using Roles in Authorization

### In Client-Side Code

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ProtectedFeature() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.app_metadata?.apps?.['blog-app']?.role;
      setUserRole(role);
    }
    loadRole();
  }, []);

  // Show features based on role
  if (userRole === 'blog_editor') {
    return <EditorDashboard />;
  }

  return <ViewerDashboard />;
}
```

### In Server Components

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function BlogEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check user's role
  const userRole = user?.app_metadata?.apps?.['blog-app']?.role;

  if (userRole !== 'blog_editor' && userRole !== 'blog_admin') {
    redirect('/access-denied');
  }

  return <BlogEditor />;
}
```

### In Middleware

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();

  // Check role for protected routes
  if (request.nextUrl.pathname.startsWith('/blog/edit')) {
    const role = user?.app_metadata?.apps?.['blog-app']?.role;
    const allowedRoles = ['blog_editor', 'blog_admin'];

    if (!allowedRoles.includes(role)) {
      return NextResponse.redirect('/access-denied');
    }
  }

  return NextResponse.next();
}
```

### In Row Level Security Policies

```sql
-- Only users with 'blog_editor' or 'blog_admin' role can edit posts
CREATE POLICY "Editors can update blog posts"
ON blog_posts
FOR UPDATE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> 'blog-app' ->> 'role')
    IN ('blog_editor', 'blog_admin')
);
```

## Role-Based Permissions

### Fetching Role Permissions

Roles define permissions, but they're stored separately from user claims. To use role permissions in authorization:

**Option 1: Check permissions on backend**

```typescript
// Server action or API route
import { getRoles } from '@/lib/apps-service';

async function checkUserPermission(userId: string, appId: string, requiredPermission: string) {
  // Get user's role
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userRole = user?.app_metadata?.apps?.[appId]?.role;

  if (!userRole) return false;

  // Get role definition
  const roles = await getRoles(appId);
  const role = roles.find(r => r.name === userRole);

  // Check if role has permission
  return role?.permissions.includes(requiredPermission) ?? false;
}
```

**Option 2: Include permissions in user claims**

Instead of just storing the role name, you can also store permissions directly:

```typescript
// When assigning role, also set permissions
await setAppClaim(supabase, userId, appId, 'role', 'blog_editor');
await setAppClaim(supabase, userId, appId, 'permissions', ['read', 'write', 'publish']);
```

Then check directly in claims:

```typescript
const permissions = user?.app_metadata?.apps?.['blog-app']?.permissions || [];
if (permissions.includes('publish')) {
  // Allow publishing
}
```

**Trade-offs:**

| Approach | Pros | Cons |
|----------|------|------|
| **Permissions from role definition** | Single source of truth, update role affects all users | Requires DB query |
| **Permissions in user claims** | Fast (in JWT), no DB query | Must update all users when role changes |

### Helper Functions

```typescript
// lib/auth-helpers.ts
import { getRoles } from '@/lib/apps-service';

/**
 * Check if user has a specific permission for an app
 */
export async function userHasPermission(
  userId: string,
  appId: string,
  permission: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userRole = user?.app_metadata?.apps?.[appId]?.role;
  if (!userRole) return false;

  const roles = await getRoles(appId);
  const role = roles.find(r => r.name === userRole);

  return role?.permissions.includes(permission) ?? false;
}

/**
 * Get all permissions for a user's role in an app
 */
export async function getUserPermissions(
  userId: string,
  appId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userRole = user?.app_metadata?.apps?.[appId]?.role;
  if (!userRole) return [];

  const roles = await getRoles(appId);
  const role = roles.find(r => r.name === userRole);

  return role?.permissions ?? [];
}
```

## API Reference

### SQL Functions

#### `create_role()`

Create a new role.

```sql
SELECT create_role(
  p_name TEXT,              -- Role identifier (e.g., 'editor')
  p_label TEXT,             -- Display name
  p_description TEXT,       -- Optional description
  p_app_id TEXT,            -- App ID or NULL for global
  p_is_global BOOLEAN,      -- true for global roles
  p_permissions JSONB       -- Array of permissions
) RETURNS TEXT;

-- Example
SELECT create_role(
  'moderator',
  'Content Moderator',
  'Can moderate user content',
  'forum-app',
  false,
  '["read", "write", "moderate"]'::jsonb
);
```

#### `update_role()`

Update an existing role.

```sql
SELECT update_role(
  p_id UUID,                -- Role ID
  p_label TEXT,             -- New label (optional)
  p_description TEXT,       -- New description (optional)
  p_permissions JSONB       -- New permissions (optional)
) RETURNS TEXT;

-- Example
SELECT update_role(
  'role-uuid'::uuid,
  'Senior Moderator',
  NULL,  -- Keep existing description
  '["read", "write", "moderate", "delete"]'::jsonb
);
```

#### `delete_role()`

Delete a role.

```sql
SELECT delete_role(p_id UUID) RETURNS TEXT;

-- Example
SELECT delete_role('role-uuid'::uuid);
```

#### `get_app_roles()`

Get all roles for a specific app (or all roles).

```sql
SELECT get_app_roles(p_app_id TEXT) RETURNS TABLE(...);

-- Get all roles for an app
SELECT * FROM get_app_roles('blog-app');

-- Get all roles (global + all apps)
SELECT * FROM get_app_roles(NULL);
```

#### `get_global_roles()`

Get only global roles.

```sql
SELECT * FROM get_global_roles();
```

### TypeScript Functions

#### Server Service

```typescript
import { getRoles, getGlobalRoles, getAppRoles } from '@/lib/apps-service';

// Get all roles for an app (includes global roles)
const roles = await getRoles('blog-app');

// Get only global roles
const globalRoles = await getGlobalRoles();

// Get app-specific roles
const appRoles = await getAppRoles('blog-app');
```

#### Server Actions

```typescript
import { createRoleAction, updateRoleAction, deleteRoleAction } from '@/app/actions/apps';

// Create role
await createRoleAction({
  name: 'moderator',
  label: 'Content Moderator',
  description: 'Can moderate content',
  app_id: 'forum-app',
  is_global: false,
  permissions: ['read', 'write', 'moderate']
});

// Update role
await updateRoleAction('role-id', {
  label: 'Senior Moderator',
  permissions: ['read', 'write', 'moderate', 'delete']
});

// Delete role
await deleteRoleAction('role-id');
```

## Best Practices

### 1. Naming Conventions

**Role Names (IDs):**
```typescript
// ✅ Good: lowercase, underscores
'blog_editor'
'content_moderator'
'senior_manager'

// ❌ Bad: spaces, capitals, special chars
'Blog Editor'
'Content-Moderator'
'Senior Manager!'
```

**Role Labels (Display):**
```typescript
// ✅ Good: human-readable
'Blog Editor'
'Content Moderator'
'Senior Manager'
```

### 2. Permission Naming

Use consistent, descriptive permission names:

```typescript
// ✅ Good: verb_noun or action patterns
'read_posts'
'write_posts'
'delete_posts'
'manage_users'
'export_data'

// ❌ Avoid: vague or inconsistent
'posts'
'can_delete'
'admin'
```

### 3. Role Granularity

**Too Few Roles:**
```typescript
// ❌ Only 'user' and 'admin' - not flexible
roles: ['user', 'admin']
```

**Too Many Roles:**
```typescript
// ❌ Too granular - hard to manage
roles: [
  'can_read_posts',
  'can_write_posts',
  'can_delete_own_posts',
  'can_delete_any_posts',
  // ... 50 more roles
]
```

**Just Right:**
```typescript
// ✅ Balanced hierarchy
roles: [
  'viewer',      // Read-only
  'editor',      // Can edit
  'moderator',   // Can moderate
  'manager',     // Can manage users
  'admin'        // Full access
]

// Use permissions for granular control
permissions: ['read', 'write', 'delete', 'moderate', 'manage_users']
```

### 4. Global vs App-Specific

**Use Global Roles for:**
- Organization-wide roles (employee, contractor)
- Cross-app roles (company_admin)
- Standard access levels (guest, member, premium)

**Use App-Specific Roles for:**
- App-unique workflows
- Feature-specific access
- Different permission models per app

### 5. Role Assignment Workflow

```typescript
// ✅ Recommended workflow
1. Create roles in database (via dashboard or SQL)
2. Assign role to user via claims (setAppRoleAction)
3. Optionally sync permissions to claims for performance
4. User refreshes session or logs in again
5. Authorization checks role/permissions

// ❌ Avoid
- Hardcoding roles in application code
- Storing role definitions in JWT claims
- Mixing role sources (DB + code)
```

### 6. Role Updates

When updating roles, consider:

```typescript
// Changing permissions affects all users with that role
await updateRoleAction('editor', {
  permissions: ['read', 'write', 'publish']  // Added 'publish'
});

// Users must refresh session to see new permissions
// Consider notifying users or forcing session refresh
```

### 7. Audit Trail

Track role changes:

```sql
-- Add audit table (optional)
CREATE TABLE role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id),
  action TEXT,  -- 'created', 'updated', 'deleted'
  changed_by UUID REFERENCES auth.users(id),
  changes JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Migration Guide

### From Hardcoded Roles to Database Roles

If you're currently using hardcoded roles (e.g., `COMMON_ROLES` in code):

#### Step 1: Migrate Role Definitions

```typescript
// Old: roles defined in code
const COMMON_ROLES = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  { value: 'editor', label: 'Editor', description: 'Can edit content' },
  { value: 'admin', label: 'Admin', description: 'Full access' }
];

// New: create in database
for (const role of COMMON_ROLES) {
  await createRoleAction({
    name: role.value,
    label: role.label,
    description: role.description,
    app_id: 'your-app-id',
    is_global: false,
    permissions: getPermissionsForRole(role.value)
  });
}
```

#### Step 2: User Claims Already Work

User claims don't need to change! If users already have `role: "editor"` in their claims, they'll continue to work. The database roles add metadata and management capabilities.

#### Step 3: Update UI Components

Replace hardcoded role lists with database queries:

```typescript
// Old
import { COMMON_ROLES } from '@/lib/apps-config';

// New
import { getRoles } from '@/lib/apps-service';

export async function RoleSelector({ appId }) {
  const roles = await getRoles(appId);

  return (
    <select>
      {roles.map(role => (
        <option key={role.name} value={role.name}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
```

#### Step 4: Gradual Migration

You can migrate gradually:

```typescript
// Support both during transition
const roles = await getRoles(appId);
const fallbackRoles = COMMON_ROLES;

const availableRoles = roles.length > 0 ? roles : fallbackRoles;
```

## Troubleshooting

### Role Not Appearing in Dropdown

**Problem:** Created a role but it doesn't show up when assigning to users

**Solutions:**
1. Verify role was created: `SELECT * FROM roles WHERE name = 'your-role';`
2. Check if role is for correct app (or is global)
3. Clear cache: `SELECT access_broker_app.clear_cache();`
4. Refresh the page

### User Has Role But No Access

**Problem:** User has role assigned but authorization fails

**Checks:**

1. **Verify role is in claims:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
console.log(user?.app_metadata?.apps?.['your-app']?.role);
```

2. **User refreshed session?**
```typescript
// Force refresh
await supabase.auth.refreshSession();
```

3. **Authorization logic checking correct role name?**
```typescript
// Make sure names match exactly (case-sensitive)
const userRole = user?.app_metadata?.apps?.['blog-app']?.role;
console.log(`User role: "${userRole}"`);  // Check for whitespace, typos
```

### Permission Check Always Fails

**Problem:** Permission checks return false even though user has role

**Solutions:**

1. **Role has the permission:**
```sql
SELECT * FROM roles
WHERE name = 'editor'
AND permissions @> '["write"]'::jsonb;
```

2. **User actually has the role:**
```sql
SELECT email, raw_app_meta_data->'apps'->'blog-app'->>'role' as role
FROM auth.users
WHERE email = 'user@example.com';
```

3. **Permission check logic is correct:**
```typescript
// Check if you're looking in the right place
const role = roles.find(r => r.name === userRole);
console.log('Role permissions:', role?.permissions);
```

### Can't Delete Role

**Problem:** Role deletion fails

**Causes:**
1. **Users still have this role assigned** - Check and reassign users first
2. **Not a claims_admin** - Only admins can delete roles
3. **Referenced by API keys** - Remove API key references first

**Check users with role:**
```sql
SELECT email, raw_app_meta_data->'apps'->'blog-app'->>'role' as role
FROM auth.users
WHERE raw_app_meta_data->'apps'->'blog-app'->>'role' = 'role-to-delete';
```

### Role Updates Not Reflecting

**Problem:** Updated role permissions but users don't have new permissions

**Why:** Role permissions are stored in the database, but user checks may be cached.

**Solutions:**
1. User must refresh session: `supabase.auth.refreshSession()`
2. Or store permissions in user claims (see "Role-Based Permissions" section)
3. Clear app cache if using server-side caching

## Related Documentation

- [Claims Guide](/docs/claims-guide) - Understanding custom claims system
- [Authorization Patterns](/docs/authorization-patterns) - Authorization patterns and best practices
- [RLS Policies](/docs/rls-policies) - Using roles in Row Level Security
- [Multi-App Guide](/docs/multi-app-guide) - Managing multiple applications

## What's Next

After setting up roles:

1. **Assign roles to users** via the dashboard or API
2. **Implement authorization checks** in your app using roles
3. **Set up RLS policies** that use role-based permissions
4. **Create role-based UI** that shows/hides features based on roles

---

**Key Takeaways:**

✅ Roles are database-backed templates of permissions
✅ Roles are assigned to users via custom claims
✅ Role checks happen in middleware, RLS, and application code
✅ Global roles work across all apps, app-specific roles for one app
✅ Keep role definitions in database, role assignments in claims

---

## What's Next

- **Docs home:** [/docs](/docs)
- **Claims Guide:** [/docs/claims-guide](/docs/claims-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **RLS Policies:** [/docs/rls-policies](/docs/rls-policies)
