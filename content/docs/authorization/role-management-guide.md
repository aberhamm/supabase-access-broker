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
- [Admin Roles and Permissions](#admin-roles-and-permissions)
- [Creating Roles](#creating-roles)
- [Assigning Roles to Users](#assigning-roles-to-users)
- [Using Roles in Authorization](#using-roles-in-authorization)
- [Frontend Integration Patterns](#frontend-integration-patterns)
- [Role-Based Permissions](#role-based-permissions)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)
- [Real-World Examples](#real-world-examples)
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

## Admin Roles and Permissions

**Important:** This system has **three distinct admin concepts** that serve different purposes. Understanding the differences is critical for proper authorization.

### The Three Types of Admins

#### 1. Global Super-Admin (`claims_admin`)

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

#### 2. App-Specific Admin (`apps.{app_id}.admin`)

**What it is:** A flag that grants admin rights for a specific application only.

**Location:** `app_metadata.apps.{app_id}.admin: true`

**Powers (for that app only):**
- ✅ Manage users who have access to their app
- ✅ View and modify app-specific claims for users
- ✅ Assign roles to users (for their app)
- ❌ Cannot grant app admin rights
- ❌ Cannot manage global claims
- ❌ Cannot manage other apps
- ❌ Cannot create/delete apps or roles

**Use Case:** Application owners who manage their specific app's users

**How to Grant:**
```typescript
import { toggleAppAdminAction } from '@/app/actions/claims';

// Grant app admin status
await toggleAppAdminAction('user-id', 'blog-app', true);
```

**Example User:**
```json
{
  "claims_admin": false,  // Not a global admin
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "editor",
      "admin": true  // ← App-specific admin for blog-app
    },
    "forum-app": {
      "enabled": true,
      "role": "moderator"  // Regular user in forum-app
    }
  }
}
```

**Use Case Example:**
- Blog app owner can manage blog users
- Cannot see or manage forum app users
- Cannot make other users app admins

#### 3. Admin Role (Database Role)

**What it is:** A regular role from the `roles` table that happens to be named "admin" (or similar).

**Location:** `roles` table + assigned via `app_metadata.apps.{app_id}.role: "admin"`

**Powers:** Whatever permissions are defined in the role's `permissions` array

**This is NOT a special privilege** - it's just a role name with associated permissions.

**How to Create:**
```sql
SELECT create_role(
  'admin',                    -- Just a name, no special meaning
  'Administrator',
  'Full access to blog features',
  'blog-app',
  false,
  '["read", "write", "delete", "publish", "moderate"]'::jsonb
);
```

**How to Assign:**
```typescript
import { setAppRoleAction } from '@/app/actions/claims';

// Assign "admin" role (just like any other role)
await setAppRoleAction('user-id', 'blog-app', 'admin');
```

**Example User:**
```json
{
  "claims_admin": false,
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "admin"  // ← Has "admin" role (from roles table)
      // No "admin: true" flag - not an app admin
    }
  }
}
```

**Important:** Having `role: "admin"` does NOT make you an app admin! You need `admin: true` for that.

### Comparison Table

| Aspect | `claims_admin` | `apps.{id}.admin` | `role: "admin"` |
|--------|---------------|-------------------|-----------------|
| **Type** | Global flag | App-specific flag | Regular role |
| **Scope** | All apps | One app | One app |
| **Can manage users** | All users | App users only | No (unless given permission) |
| **Can create roles** | ✅ Yes | ❌ No | ❌ No |
| **Can grant app admin** | ✅ Yes | ❌ No | ❌ No |
| **Access dashboard** | ✅ Full access | ✅ Limited to their app | ❌ No |
| **Defined in** | Hardcoded system flag | Hardcoded system flag | `roles` table |
| **Typical use** | Platform admin | App owner | Power user |

### Authorization Check Examples

**Check for global super-admin:**
```typescript
const isGlobalAdmin = user?.app_metadata?.claims_admin === true;

if (isGlobalAdmin) {
  // Can do anything
}
```

**Check for app-specific admin:**
```typescript
const isAppAdmin = user?.app_metadata?.apps?.['blog-app']?.admin === true;
const isGlobalAdmin = user?.app_metadata?.claims_admin === true;

if (isGlobalAdmin || isAppAdmin) {
  // Can manage blog-app users
}
```

**Check for "admin" role:**
```typescript
const userRole = user?.app_metadata?.apps?.['blog-app']?.role;

if (userRole === 'admin') {
  // Has admin role permissions (from roles table)
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
  -- App-specific admin
  COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'admin')::boolean,
    false
  ) = true
);

-- Users with "admin" role can access admin features
CREATE POLICY "Admin role can access features"
ON blog_posts FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> 'blog-app' ->> 'role')
    IN ('admin', 'editor')
);
```

### Combining Admin Types

A user can have multiple admin attributes:

```json
{
  "claims_admin": true,  // Global super-admin
  "apps": {
    "blog-app": {
      "enabled": true,
      "role": "admin",    // Has admin role
      "admin": true       // Also app admin for blog-app
    }
  }
}
```

**Best Practice:** Keep it simple. Usually pick one:
- **Global admin** → Full system access
- **App admin** → Manage specific app
- **Admin role** → App-specific power user

### When to Use Each

**Use `claims_admin` for:**
- Platform administrators
- System maintainers
- Users who need to manage multiple apps
- Bootstrap/initial admin users

**Use `apps.{id}.admin` for:**
- Application owners
- Team leads for specific apps
- Delegated administration
- Multi-tenant scenarios where app owners manage their users

**Use "admin" role for:**
- Power users within an app
- Users with elevated permissions (but not admin rights)
- Role-based feature access
- Fine-grained permission control

### Security Considerations

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

-- Find app admins for specific app
SELECT email,
       raw_app_meta_data->'apps'->'blog-app'->>'role' as role
FROM auth.users
WHERE (raw_app_meta_data->'apps'->'blog-app'->>'admin')::bool = true;

-- Find users with "admin" role
SELECT email,
       raw_app_meta_data->'apps'->'blog-app'->>'role' as role
FROM auth.users
WHERE raw_app_meta_data->'apps'->'blog-app'->>'role' = 'admin';
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

## Frontend Integration Patterns

This section provides comprehensive React/Next.js patterns for working with roles in your frontend application.

### Custom Hooks for Role Checking

Create reusable hooks for role and permission checks:

```typescript
// hooks/useUserRole.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useUserRole(appId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        const userRole = user.app_metadata?.apps?.[appId]?.role;
        const globalAdmin = user.app_metadata?.claims_admin === true;
        const appAdmin = user.app_metadata?.apps?.[appId]?.admin === true;

        setRole(userRole || null);
        setIsAdmin(globalAdmin);
        setIsAppAdmin(appAdmin || globalAdmin);
      }

      setLoading(false);
    }

    loadUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appId, supabase]);

  return { user, role, isAdmin, isAppAdmin, loading };
}

// hooks/usePermissions.ts
'use client';

import { useEffect, useState } from 'react';
import { useUserRole } from './useUserRole';

export function usePermissions(appId: string) {
  const { user, role, loading: roleLoading } = useUserRole(appId);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPermissions() {
      if (!role) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Fetch role permissions from API
      try {
        const response = await fetch(`/api/apps/${appId}/roles`);
        const roles = await response.json();
        const roleData = roles.find((r: any) => r.name === role);
        setPermissions(roleData?.permissions || []);
      } catch (error) {
        console.error('Failed to load permissions:', error);
        setPermissions([]);
      }

      setLoading(false);
    }

    if (!roleLoading) {
      loadPermissions();
    }
  }, [appId, role, roleLoading]);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]) => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    return perms.every(p => permissions.includes(p));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loading: roleLoading || loading,
  };
}
```

### Role-Based Component Rendering

**Conditional rendering based on roles:**

```typescript
// components/RoleGate.tsx
'use client';

import { useUserRole } from '@/hooks/useUserRole';
import { ReactNode } from 'react';

interface RoleGateProps {
  appId: string;
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ appId, allowedRoles, children, fallback = null }: RoleGateProps) {
  const { role, loading } = useUserRole(appId);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
export function BlogEditor() {
  return (
    <RoleGate
      appId="blog-app"
      allowedRoles={['blog_editor', 'blog_admin']}
      fallback={<div>You don't have permission to edit posts.</div>}
    >
      <EditorInterface />
    </RoleGate>
  );
}
```

**Permission-based rendering:**

```typescript
// components/PermissionGate.tsx
'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { ReactNode } from 'react';

interface PermissionGateProps {
  appId: string;
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ appId, permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission, loading } = usePermissions(appId);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
export function BlogControls() {
  return (
    <div className="flex gap-2">
      <PermissionGate appId="blog-app" permission="write">
        <button>Edit</button>
      </PermissionGate>

      <PermissionGate appId="blog-app" permission="delete">
        <button>Delete</button>
      </PermissionGate>

      <PermissionGate appId="blog-app" permission="publish">
        <button>Publish</button>
      </PermissionGate>
    </div>
  );
}
```

### Admin-Only Components

**Check for any admin type:**

```typescript
// components/AdminGate.tsx
'use client';

import { useUserRole } from '@/hooks/useUserRole';
import { ReactNode } from 'react';

interface AdminGateProps {
  appId?: string;  // Optional - if provided, checks app admin too
  requireGlobalAdmin?: boolean;  // Only allow global admins
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminGate({
  appId,
  requireGlobalAdmin = false,
  children,
  fallback = null
}: AdminGateProps) {
  const { isAdmin, isAppAdmin, loading } = useUserRole(appId || '');

  if (loading) {
    return <div>Loading...</div>;
  }

  const hasAccess = requireGlobalAdmin
    ? isAdmin
    : (isAdmin || (appId && isAppAdmin));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage examples
export function DashboardNav() {
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>

      {/* Only global admins see this */}
      <AdminGate requireGlobalAdmin>
        <Link href="/admin/users">User Management</Link>
        <Link href="/admin/apps">App Management</Link>
      </AdminGate>

      {/* App admins for blog-app see this */}
      <AdminGate appId="blog-app">
        <Link href="/blog/settings">Blog Settings</Link>
      </AdminGate>
    </nav>
  );
}
```

### Complete Page Examples

**Protected page with role check:**

```typescript
// app/blog/editor/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { EditorInterface } from '@/components/EditorInterface';

export default async function BlogEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userRole = user.app_metadata?.apps?.['blog-app']?.role;
  const allowedRoles = ['blog_editor', 'blog_admin'];

  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/access-denied');
  }

  return (
    <div>
      <h1>Blog Editor</h1>
      <p>Welcome, {userRole}</p>
      <EditorInterface />
    </div>
  );
}
```

**Admin dashboard with multiple checks:**

```typescript
// app/admin/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminStats } from '@/components/AdminStats';
import { UserManagement } from '@/components/UserManagement';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is global admin
  const isGlobalAdmin = user.app_metadata?.claims_admin === true;

  if (!isGlobalAdmin) {
    redirect('/access-denied');
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <AdminStats />
      <UserManagement />
    </div>
  );
}
```

### Dynamic Navigation with Role Checks

```typescript
// components/AppNavigation.tsx
'use client';

import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';

export function AppNavigation({ appId }: { appId: string }) {
  const { role, isAdmin, isAppAdmin, loading } = useUserRole(appId);
  const { hasPermission } = usePermissions(appId);

  if (loading) {
    return <div>Loading navigation...</div>;
  }

  return (
    <nav className="flex gap-4">
      <Link href={`/${appId}`}>Home</Link>

      {/* Everyone with access sees this */}
      {role && <Link href={`/${appId}/dashboard`}>Dashboard</Link>}

      {/* Only users with write permission */}
      {hasPermission('write') && (
        <Link href={`/${appId}/create`}>Create</Link>
      )}

      {/* Only editors and above */}
      {(role === 'editor' || role === 'admin') && (
        <Link href={`/${appId}/edit`}>Edit</Link>
      )}

      {/* Only app admins or global admins */}
      {(isAppAdmin || isAdmin) && (
        <Link href={`/${appId}/settings`}>Settings</Link>
      )}

      {/* Only global admins */}
      {isAdmin && (
        <Link href="/admin">System Admin</Link>
      )}
    </nav>
  );
}
```

### Role Selector Component

```typescript
// components/RoleSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RoleConfig } from '@/types/claims';

interface RoleSelectorProps {
  appId: string;
  currentRole?: string;
  onRoleChange: (role: string) => void;
  disabled?: boolean;
}

export function RoleSelector({
  appId,
  currentRole,
  onRoleChange,
  disabled = false
}: RoleSelectorProps) {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoles() {
      try {
        const response = await fetch(`/api/apps/${appId}/roles`);
        const data = await response.json();
        setRoles(data);
      } catch (error) {
        console.error('Failed to load roles:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, [appId]);

  if (loading) {
    return <div>Loading roles...</div>;
  }

  return (
    <Select value={currentRole} onValueChange={onRoleChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.name}>
            <div>
              <div className="font-medium">{role.label}</div>
              <div className="text-xs text-muted-foreground">
                {role.description}
              </div>
              {role.permissions.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Permissions: {role.permissions.join(', ')}
                </div>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### User Role Management Component

```typescript
// components/UserRoleManager.tsx
'use client';

import { useState } from 'react';
import { RoleSelector } from './RoleSelector';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface UserRoleManagerProps {
  userId: string;
  appId: string;
  currentRole?: string;
}

export function UserRoleManager({ userId, appId, currentRole }: UserRoleManagerProps) {
  const [selectedRole, setSelectedRole] = useState(currentRole || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/users/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          appId,
          role: selectedRole
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      toast.success('Role updated successfully');
    } catch (error) {
      toast.error('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Select Role
        </label>
        <RoleSelector
          appId={appId}
          currentRole={selectedRole}
          onRoleChange={setSelectedRole}
          disabled={saving}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || selectedRole === currentRole}
      >
        {saving ? 'Saving...' : 'Update Role'}
      </Button>
    </div>
  );
}
```

### Type-Safe Role Helpers

```typescript
// lib/role-helpers.ts
import type { User } from '@supabase/supabase-js';

export function getUserRole(user: User | null, appId: string): string | null {
  return user?.app_metadata?.apps?.[appId]?.role || null;
}

export function isGlobalAdmin(user: User | null): boolean {
  return user?.app_metadata?.claims_admin === true;
}

export function isAppAdmin(user: User | null, appId: string): boolean {
  if (isGlobalAdmin(user)) return true;
  return user?.app_metadata?.apps?.[appId]?.admin === true;
}

export function hasRole(user: User | null, appId: string, role: string): boolean {
  return getUserRole(user, appId) === role;
}

export function hasAnyRole(user: User | null, appId: string, roles: string[]): boolean {
  const userRole = getUserRole(user, appId);
  return userRole ? roles.includes(userRole) : false;
}

export function userHasAppAccess(user: User | null, appId: string): boolean {
  return user?.app_metadata?.apps?.[appId]?.enabled === true;
}

// Usage in components
import { useUserRole } from '@/hooks/useUserRole';
import { hasAnyRole, isAppAdmin } from '@/lib/role-helpers';

export function SomeComponent() {
  const { user } = useUserRole('blog-app');

  const canEdit = hasAnyRole(user, 'blog-app', ['editor', 'admin']);
  const canManageUsers = isAppAdmin(user, 'blog-app');

  return (
    <div>
      {canEdit && <EditButton />}
      {canManageUsers && <UserManagementPanel />}
    </div>
  );
}
```

### Loading and Error States

```typescript
// components/ProtectedContent.tsx
'use client';

import { useUserRole } from '@/hooks/useUserRole';
import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProtectedContentProps {
  appId: string;
  requiredRole: string | string[];
  children: ReactNode;
}

export function ProtectedContent({
  appId,
  requiredRole,
  children
}: ProtectedContentProps) {
  const { role, loading, user } = useUserRole(appId);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          Please sign in to access this content.
        </AlertDescription>
      </Alert>
    );
  }

  // Check role
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasAccess = role && allowedRoles.includes(role);

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          You don't have permission to access this content.
          Required role: {allowedRoles.join(' or ')}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
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

## Real-World Examples

This section provides complete, copy-paste examples for common scenarios.

### Example 1: Blog Platform with Role-Based Features

**Setup:**

```sql
-- Create roles
SELECT create_role(
  'viewer', 'Viewer', 'Can read blog posts',
  'blog-app', false, '["read"]'::jsonb
);

SELECT create_role(
  'author', 'Author', 'Can write and publish own posts',
  'blog-app', false, '["read", "write", "publish_own"]'::jsonb
);

SELECT create_role(
  'editor', 'Editor', 'Can edit and publish all posts',
  'blog-app', false, '["read", "write", "publish_all", "moderate"]'::jsonb
);
```

**Frontend implementation:**

```typescript
// app/blog/page.tsx - Blog homepage
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BlogList } from '@/components/BlogList';
import { CreatePostButton } from '@/components/CreatePostButton';

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userRole = user.app_metadata?.apps?.['blog-app']?.role;
  const canWrite = ['author', 'editor'].includes(userRole || '');

  return (
    <div>
      <h1>Blog</h1>
      {canWrite && <CreatePostButton />}
      <BlogList />
    </div>
  );
}

// components/BlogPost.tsx - Individual post with actions
'use client';

import { useUserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';

interface BlogPostProps {
  post: {
    id: string;
    title: string;
    content: string;
    author_id: string;
    published: boolean;
  };
}

export function BlogPost({ post }: BlogPostProps) {
  const { user, role } = useUserRole('blog-app');
  const { hasPermission } = usePermissions('blog-app');

  const isAuthor = user?.id === post.author_id;
  const canEdit = isAuthor && hasPermission('write') || hasPermission('publish_all');
  const canPublish = isAuthor && hasPermission('publish_own') || hasPermission('publish_all');
  const canModerate = hasPermission('moderate');

  return (
    <article>
      <h2>{post.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <div className="flex gap-2 mt-4">
        {canEdit && (
          <Button onClick={() => handleEdit(post.id)}>
            Edit
          </Button>
        )}

        {!post.published && canPublish && (
          <Button onClick={() => handlePublish(post.id)}>
            Publish
          </Button>
        )}

        {canModerate && (
          <Button variant="destructive" onClick={() => handleModerate(post.id)}>
            Moderate
          </Button>
        )}
      </div>
    </article>
  );
}
```

### Example 2: Multi-Tenant SaaS Application

**Setup:**

```sql
-- Global role for all customers
SELECT create_role(
  'customer', 'Customer', 'Standard customer account',
  NULL, true, '["read_own_data"]'::jsonb
);

-- App-specific roles for admin panel
SELECT create_role(
  'org_admin', 'Organization Admin', 'Manages organization',
  'admin-panel', false, '["read", "write", "manage_users", "manage_billing"]'::jsonb
);

SELECT create_role(
  'org_member', 'Organization Member', 'Standard member',
  'admin-panel', false, '["read", "write"]'::jsonb
);
```

**Frontend implementation:**

```typescript
// app/[orgId]/layout.tsx - Organization layout with access control
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { OrgNavigation } from '@/components/OrgNavigation';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user belongs to this organization
  const userOrgId = user.app_metadata?.organization_id;
  if (userOrgId !== params.orgId) {
    notFound();
  }

  // Check app access
  const hasAccess = user.app_metadata?.apps?.['admin-panel']?.enabled === true;
  if (!hasAccess) {
    redirect('/access-denied');
  }

  const role = user.app_metadata?.apps?.['admin-panel']?.role;

  return (
    <div>
      <OrgNavigation orgId={params.orgId} role={role} />
      {children}
    </div>
  );
}

// app/[orgId]/settings/page.tsx - Settings page (admin only)
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRoles } from '@/lib/apps-service';

export default async function OrgSettingsPage({
  params,
}: {
  params: { orgId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's role
  const userRole = user.app_metadata?.apps?.['admin-panel']?.role;

  // Get role permissions
  const roles = await getRoles('admin-panel');
  const role = roles.find(r => r.name === userRole);

  // Check for admin permission
  const canManageOrg = role?.permissions.includes('manage_users');

  if (!canManageOrg) {
    redirect(`/${params.orgId}`);
  }

  return (
    <div>
      <h1>Organization Settings</h1>
      <OrganizationSettingsForm orgId={params.orgId} />
    </div>
  );
}
```

### Example 3: E-commerce with Customer Tiers

**Setup:**

```sql
-- Create customer tier roles
SELECT create_role(
  'free_tier', 'Free Tier', 'Basic access',
  'ecommerce', false, '["browse", "purchase"]'::jsonb
);

SELECT create_role(
  'premium_tier', 'Premium Tier', 'Premium features',
  'ecommerce', false, '["browse", "purchase", "save_favorites", "early_access"]'::jsonb
);

SELECT create_role(
  'vip_tier', 'VIP Tier', 'Full access',
  'ecommerce', false, '["browse", "purchase", "save_favorites", "early_access", "priority_support", "exclusive_deals"]'::jsonb
);
```

**Frontend implementation:**

```typescript
// components/ProductCard.tsx
'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    isEarlyAccess?: boolean;
    isExclusive?: boolean;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { hasPermission, loading } = usePermissions('ecommerce');

  const canPurchase = hasPermission('purchase');
  const canAccessEarly = hasPermission('early_access');
  const canSeeExclusive = hasPermission('exclusive_deals');
  const canSaveFavorites = hasPermission('save_favorites');

  // Hide exclusive products from non-VIP users
  if (product.isExclusive && !canSeeExclusive) {
    return null;
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold">{product.name}</h3>
        {product.isEarlyAccess && canAccessEarly && (
          <Badge>Early Access</Badge>
        )}
      </div>

      <p className="text-2xl font-bold">${product.price}</p>

      <div className="flex gap-2 mt-4">
        {canPurchase && (
          <Button onClick={() => handlePurchase(product.id)}>
            Buy Now
          </Button>
        )}

        {canSaveFavorites && (
          <Button variant="outline" onClick={() => handleSaveFavorite(product.id)}>
            Save
          </Button>
        )}
      </div>

      {product.isEarlyAccess && !canAccessEarly && (
        <p className="text-sm text-muted-foreground mt-2">
          Upgrade to Premium for early access
        </p>
      )}
    </div>
  );
}

// components/UpgradeTierButton.tsx
'use client';

import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function UpgradeTierButton() {
  const { role } = useUserRole('ecommerce');
  const router = useRouter();

  if (role === 'vip_tier') {
    return null; // Already at highest tier
  }

  const nextTier = role === 'free_tier' ? 'Premium' : 'VIP';

  return (
    <Button onClick={() => router.push('/upgrade')}>
      Upgrade to {nextTier}
    </Button>
  );
}
```

### Example 4: Admin Dashboard with Delegation

**Setup:**

```sql
-- Platform admin (global)
-- Already exists: claims_admin flag

-- Department admins (app-specific admins)
-- Can manage users in their department but not grant admin rights
```

**Frontend implementation:**

```typescript
// app/admin/users/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserManagementTable } from '@/components/UserManagementTable';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isGlobalAdmin = user.app_metadata?.claims_admin === true;
  const appAdmin = user.app_metadata?.apps?.['hr-app']?.admin === true;

  if (!isGlobalAdmin && !appAdmin) {
    redirect('/access-denied');
  }

  return (
    <div>
      <h1>User Management</h1>
      <UserManagementTable
        isGlobalAdmin={isGlobalAdmin}
        canGrantAdmin={isGlobalAdmin} // Only global admins can grant admin
      />
    </div>
  );
}

// components/UserManagementTable.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/RoleSelector';

interface UserManagementTableProps {
  isGlobalAdmin: boolean;
  canGrantAdmin: boolean;
}

export function UserManagementTable({
  isGlobalAdmin,
  canGrantAdmin
}: UserManagementTableProps) {
  const [users, setUsers] = useState([]);

  const handleSetRole = async (userId: string, appId: string, role: string) => {
    await fetch('/api/users/set-role', {
      method: 'POST',
      body: JSON.stringify({ userId, appId, role })
    });
    // Refresh users
  };

  const handleToggleAppAdmin = async (userId: string, appId: string, isAdmin: boolean) => {
    if (!canGrantAdmin) {
      alert('You do not have permission to grant admin rights');
      return;
    }

    await fetch('/api/users/toggle-app-admin', {
      method: 'POST',
      body: JSON.stringify({ userId, appId, isAdmin })
    });
    // Refresh users
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Role</th>
          <th>App Admin</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.email}</td>
            <td>
              <RoleSelector
                appId="hr-app"
                currentRole={user.role}
                onRoleChange={(role) => handleSetRole(user.id, 'hr-app', role)}
              />
            </td>
            <td>
              <input
                type="checkbox"
                checked={user.isAppAdmin}
                onChange={(e) => handleToggleAppAdmin(user.id, 'hr-app', e.target.checked)}
                disabled={!canGrantAdmin}
              />
            </td>
            <td>
              {/* Additional actions */}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
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
