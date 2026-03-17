---
title: "Authorization Patterns"
description: "Implementing access control and user permissions"
category: 'concepts'
audience: "app-developer"
order: 7
---

# Authorization Patterns

**TL;DR:**
- Enforce authorization at multiple layers (callback, middleware, server, RLS)
- Store roles and permissions in `app_metadata`
- Use app-specific claims to gate access
- Prefer deny-by-default checks

**Time to read:** 20 minutes | **Prerequisites:** [Claims Guide](/docs/claims-guide) | **Next steps:** [RLS Policies](/docs/rls-policies)

**Context:** Authorization controls what authenticated users can access and do in your application. This guide shows you how to implement robust authorization patterns using Supabase Auth metadata.

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript

**Prerequisites:**
- Users are already authenticated (via password, magic link, or OAuth)
- Basic understanding of `app_metadata` in Supabase Auth

**Key Concept:**

```
Authentication = Who you are (identity)
Authorization  = What you can do (permissions)
```

## Table of Contents

- [Overview](#overview)
- [Authorization Layers](#authorization-layers)
- [Common Patterns](#common-patterns)
- [Implementation Examples](#implementation-examples)
- [Best Practices](#best-practices)
- [Database-Backed Roles](#database-backed-roles)
- [Troubleshooting](#troubleshooting)

## Overview

### The Authorization Problem

Just because a user can sign in doesn't mean they should access your application!

```typescript
// ❌ Dangerous: Anyone who can authenticate can access everything
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  return <AdminDashboard />;
}

// ✅ Safe: Check specific permissions
const { data: { user } } = await supabase.auth.getUser();
const isAdmin = user?.app_metadata?.role === 'admin';
if (isAdmin) {
  return <AdminDashboard />;
}
```

### Authorization Data Structure

User permissions are stored in `app_metadata`:

```typescript
{
  id: "user-id",
  email: "user@example.com",
  app_metadata: {
    // Simple role-based
    role: "admin",

    // Feature flags
    features: {
      analytics: true,
      exports: false
    },

    // Multi-app access
    apps: {
      "dashboard": {
        enabled: true,
        role: "admin"
      },
      "analytics": {
        enabled: true,
        role: "viewer"
      }
    },

    // Organizational access
    organization_id: "org-123",
    team_ids: ["team-1", "team-2"]
  }
}
```

## Authorization Layers

Implement authorization at multiple layers for defense in depth:

### Layer 1: Auth Callback (First Defense)

Block unauthorized users immediately after authentication:

```typescript
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const supabase = await createClient();
  const code = request.searchParams.get('code');

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);

    const { data: { user } } = await supabase.auth.getUser();

    // ✅ Check authorization HERE
    const hasAccess = user?.app_metadata?.role === 'admin';

    if (!hasAccess) {
      return NextResponse.redirect('/access-denied');
    }

    return NextResponse.redirect('/dashboard');
  }
}
```

### Layer 2: Middleware (Every Request)

Verify permissions on every request:

**Basic middleware with role check:**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Public routes
  const publicRoutes = ['/login', '/signup', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check authorization for protected routes
  if (user && !isPublicRoute) {
    // Admin routes
    if (pathname.startsWith('/admin')) {
      const isAdmin = user.app_metadata?.claims_admin === true;
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/access-denied', request.url));
      }
    }

    // App-specific routes
    if (pathname.startsWith('/blog')) {
      const hasAccess = user.app_metadata?.apps?.['blog-app']?.enabled === true;
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/access-denied', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Advanced middleware with app-specific and role-based routing:**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Define route permissions
const ROUTE_PERMISSIONS = {
  '/admin': {
    requireGlobalAdmin: true,
  },
  '/blog/admin': {
    appId: 'blog-app',
    requireAppAdmin: true,
  },
  '/blog/editor': {
    appId: 'blog-app',
    allowedRoles: ['editor', 'admin'],
  },
  '/blog/publish': {
    appId: 'blog-app',
    requiredPermission: 'publish',
  },
} as const;

export async function middleware(request: NextRequest) {
  // ... (supabase client setup same as above)

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/callback')) {
    return response;
  }

  // Must be authenticated
  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check route-specific permissions
  for (const [route, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      // Check global admin requirement
      if (permissions.requireGlobalAdmin) {
        const isGlobalAdmin = user.app_metadata?.claims_admin === true;
        if (!isGlobalAdmin) {
          return NextResponse.redirect(new URL('/access-denied', request.url));
        }
      }

      // Check app admin requirement
      if (permissions.requireAppAdmin && permissions.appId) {
        const isGlobalAdmin = user.app_metadata?.claims_admin === true;
        const userRole = user.app_metadata?.apps?.[permissions.appId]?.role;
        const isAppAdmin = userRole === 'admin';

        if (!isGlobalAdmin && !isAppAdmin) {
          return NextResponse.redirect(new URL('/access-denied', request.url));
        }
      }

      // Check role requirement
      if (permissions.allowedRoles && permissions.appId) {
        const userRole = user.app_metadata?.apps?.[permissions.appId]?.role;
        const hasRole = userRole && permissions.allowedRoles.includes(userRole);

        if (!hasRole) {
          return NextResponse.redirect(new URL('/access-denied', request.url));
        }
      }

      // Note: Permission checks would require fetching role definitions
      // Better to do those in server components or API routes
    }
  }

  return response;
}
```

**Middleware with dynamic app detection:**

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // ... (setup)

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Extract app ID from URL (e.g., /apps/blog-app/editor)
  const appMatch = pathname.match(/^\/apps\/([^\/]+)/);

  if (appMatch) {
    const appId = appMatch[1];

    // Check if user has access to this app
    const hasAccess = user?.app_metadata?.apps?.[appId]?.enabled === true;

    if (!hasAccess) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }

    // Check for admin routes within the app
    if (pathname.includes('/admin')) {
      const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
      const userRole = user?.app_metadata?.apps?.[appId]?.role;
      const isAppAdmin = userRole === 'admin';

      if (!isGlobalAdmin && !isAppAdmin) {
        return NextResponse.redirect(new URL('/access-denied', request.url));
      }
    }
  }

  return response;
}
```

### Layer 3: Server Components (Page Level)

Verify before rendering sensitive data:

```typescript
// app/admin/page.tsx
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ✅ Verify authorization
  const isAdmin = user?.app_metadata?.role === 'admin';

  if (!isAdmin) {
    redirect('/access-denied');
  }

  return <AdminDashboard />;
}
```

### Layer 4: Server Actions (Operation Level)

Check permissions before operations:

```typescript
// app/actions/users.ts
'use server';

export async function deleteUser(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ✅ Verify authorization
  const isAdmin = user?.app_metadata?.role === 'admin';

  if (!isAdmin) {
    return { error: 'Unauthorized' };
  }

  // Perform operation
  const adminClient = await createAdminClient();
  await adminClient.auth.admin.deleteUser(userId);

  return { success: true };
}
```

### Layer 5: Database (RLS Policies)

Final security layer at the data level:

```sql
-- Only admins can delete users
CREATE POLICY "Admins can delete users"
ON auth.users
FOR DELETE
USING (
  auth.jwt() ->> 'app_metadata'::text)::jsonb ->> 'role' = 'admin'
);
```

## Common Patterns

### Pattern 1: Simple Role-Based Access

**Use case:** Basic admin vs. user distinction

```typescript
// Set role during user creation
const { data } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'password123',
  app_metadata: {
    role: 'admin', // or 'user', 'viewer'
  },
});

// Check role
const { data: { user } } = await supabase.auth.getUser();
const userRole = user?.app_metadata?.role;

if (userRole === 'admin') {
  // Full access
} else if (userRole === 'user') {
  // Limited access
} else {
  // Read-only
}
```

### Pattern 2: Feature Flags

**Use case:** Gradual rollout or tiered access

```typescript
// Set features
app_metadata: {
  features: {
    analytics: true,
    exports: false,
    api_access: true
  }
}

// Check feature access
const canExport = user?.app_metadata?.features?.exports === true;

if (canExport) {
  return <ExportButton />;
}
```

### Pattern 3: Multi-App Access

**Use case:** Single auth system, multiple applications

```typescript
// Set app access
app_metadata: {
  apps: {
    "dashboard": {
      enabled: true,
      role: "admin"
    },
    "analytics": {
      enabled: true,
      role: "viewer"
    },
    "billing": {
      enabled: false
    }
  }
}

// Check app access
const appId = 'dashboard';
const hasAccess = user?.app_metadata?.apps?.[appId]?.enabled === true;
const appRole = user?.app_metadata?.apps?.[appId]?.role;

if (!hasAccess) {
  redirect('/access-denied');
}
```

### Pattern 4: Organization/Team-Based

**Use case:** Multi-tenant SaaS applications

```typescript
// Set organization
app_metadata: {
  organization_id: "org-123",
  team_ids: ["team-1", "team-2"]
}

// Check organization access
const orgId = params.organizationId;
const userOrgId = user?.app_metadata?.organization_id;

if (userOrgId !== orgId) {
  redirect('/access-denied');
}

// Check team access
const teamId = params.teamId;
const userTeams = user?.app_metadata?.team_ids || [];

if (!userTeams.includes(teamId)) {
  redirect('/access-denied');
}
```

### Pattern 5: Permission-Based

**Use case:** Granular access control

```typescript
// Set permissions
app_metadata: {
  permissions: [
    'users:read',
    'users:write',
    'users:delete',
    'reports:read'
  ]
}

// Check permission
function hasPermission(user: User, permission: string): boolean {
  const permissions = user?.app_metadata?.permissions || [];
  return permissions.includes(permission);
}

// Use in code
if (hasPermission(user, 'users:delete')) {
  return <DeleteUserButton />;
}
```

## Implementation Examples

### Access Denied Page

```typescript
// app/access-denied/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AccessDeniedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  async function handleLogout() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-4xl font-bold text-red-600">Access Denied</h1>
        <p className="text-lg">
          You don't have permission to access this application.
        </p>

        <div className="rounded-lg border p-4 bg-gray-50">
          <p className="text-sm text-gray-600">
            Signed in as: <strong>{user.email}</strong>
          </p>
        </div>

        <form action={handleLogout}>
          <button
            type="submit"
            className="w-full bg-gray-600 text-white py-2 rounded-md"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
```

### Conditional UI Rendering

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const userRole = user?.app_metadata?.role;
  const canManageUsers = userRole === 'admin';
  const canViewReports = ['admin', 'manager'].includes(userRole || '');

  return (
    <div>
      <h1>Dashboard</h1>

      {canViewReports && <ReportsSection />}
      {canManageUsers && <UserManagementSection />}

      {!canViewReports && !canManageUsers && (
        <p>You don't have access to any features.</p>
      )}
    </div>
  );
}
```

### Helper Functions

```typescript
// lib/auth-helpers.ts
import { User } from '@supabase/supabase-js';

export function hasRole(user: User | null, role: string): boolean {
  return user?.app_metadata?.role === role;
}

export function hasAnyRole(user: User | null, roles: string[]): boolean {
  const userRole = user?.app_metadata?.role;
  return userRole ? roles.includes(userRole) : false;
}

export function hasPermission(user: User | null, permission: string): boolean {
  const permissions = user?.app_metadata?.permissions || [];
  return permissions.includes(permission);
}

export function hasAppAccess(user: User | null, appId: string): boolean {
  return user?.app_metadata?.apps?.[appId]?.enabled === true;
}

export function getAppRole(user: User | null, appId: string): string | null {
  return user?.app_metadata?.apps?.[appId]?.role || null;
}
```

## Database-Backed Roles

This system includes **database-backed roles** that provide a structured way to define and manage user permissions. Instead of hardcoding roles in your application, you can define roles in the database with permissions and metadata.

### Why Use Database-Backed Roles?

**Traditional Approach (Hardcoded):**
```typescript
// Roles defined in code
const userRole = user?.app_metadata?.role;
if (userRole === 'admin' || userRole === 'editor') {
  // Allow access
}
```

❌ Must redeploy to add/change roles
❌ No role metadata or descriptions
❌ Hard to audit changes

**Database-Backed Approach:**
```typescript
// Roles defined in database with permissions
const roles = await getRoles(appId);
const userRole = roles.find(r => r.name === user?.app_metadata?.apps?.[appId]?.role);

if (userRole?.permissions.includes('edit')) {
  // Allow access
}
```

✅ Change roles without redeploying
✅ Store permissions and metadata
✅ Audit trail with timestamps
✅ Dynamic role management via dashboard

### Role Structure

Roles are stored in the `roles` table:

```typescript
interface RoleConfig {
  id: string;
  name: string;              // 'editor'
  label: string;             // 'Content Editor'
  description?: string;      // 'Can edit and publish content'
  app_id?: string;           // 'blog-app' or null for global
  is_global: boolean;        // true for global roles
  permissions: string[];     // ['read', 'write', 'publish']
  created_at: string;
}
```

### Creating Roles

**Via Dashboard:**
1. Navigate to Apps → Select App → Roles tab
2. Click "Create Role"
3. Define permissions and metadata

**Via SQL:**
```sql
SELECT create_role(
  'content_moderator',           -- name
  'Content Moderator',           -- label
  'Can moderate user content',   -- description
  'forum-app',                   -- app_id
  false,                         -- is_global
  '["read", "write", "moderate", "delete"]'::jsonb
);
```

**Via TypeScript:**
```typescript
import { createRoleAction } from '@/app/actions/apps';

await createRoleAction({
  name: 'content_moderator',
  label: 'Content Moderator',
  description: 'Can moderate user content',
  app_id: 'forum-app',
  is_global: false,
  permissions: ['read', 'write', 'moderate', 'delete']
});
```

### Assigning Roles to Users

Roles are assigned via custom claims:

```typescript
import { setAppRoleAction } from '@/app/actions/claims';

// Assign role to user
await setAppRoleAction(
  'user-id',
  'forum-app',
  'content_moderator'  // Role name from roles table
);
```

This sets the user's claim:
```json
{
  "apps": {
    "forum-app": {
      "enabled": true,
      "role": "content_moderator"
    }
  }
}
```

### Using Roles in Authorization

**Check role name:**
```typescript
const userRole = user?.app_metadata?.apps?.['forum-app']?.role;
if (userRole === 'content_moderator' || userRole === 'admin') {
  // Allow moderation
}
```

**Check role permissions:**
```typescript
import { getRoles } from '@/lib/apps-service';

const roles = await getRoles('forum-app');
const userRoleName = user?.app_metadata?.apps?.['forum-app']?.role;
const userRole = roles.find(r => r.name === userRoleName);

if (userRole?.permissions.includes('moderate')) {
  // Allow moderation
}
```

**In RLS policies:**
```sql
-- Check role name
CREATE POLICY "Moderators can delete posts"
ON forum_posts
FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> 'forum-app' ->> 'role')
    IN ('content_moderator', 'admin')
);
```

### Global vs App-Specific Roles

**Global Roles** - Available across all apps:
- Organization-wide roles (employee, contractor)
- Cross-app permissions (company_admin)
- Standard access levels (guest, member, premium)

**App-Specific Roles** - Only for specific app:
- App-unique workflows (blog_editor, forum_moderator)
- Feature-specific access (can_export, can_publish)
- Custom app requirements

### Admin Types

This system has **two distinct admin concepts**:

1. **`claims_admin`** - Global super-admin (manages everything)
2. **`role: "admin"`** - App-specific admin (manages one app + has full app permissions)

For full details and examples, see **[Admin Types and Permissions](/docs/admin-types)**.

### Learn More

For complete role management documentation:
- **[Role Management Guide](/docs/role-management-guide)** - Complete guide to roles
- **[Admin Types and Permissions](/docs/admin-types)** - Understanding admin types
- **[Claims Guide](/docs/claims-guide)** - Understanding custom claims
- **[RLS Policies](/docs/rls-policies)** - Using roles in database security

## Best Practices

### 1. Defense in Depth

```typescript
// ✅ Good: Multiple layers
1. Auth Callback - Block on entry
2. Middleware - Verify every request
3. Server Components - Check before render
4. Server Actions - Verify before operations
5. Database RLS - Final data-level security
```

### 2. Fail Secure

```typescript
// ❌ Bad: Defaults to allowing
const isAdmin = user?.app_metadata?.role || 'admin';

// ✅ Good: Explicit check, defaults to denying
const isAdmin = user?.app_metadata?.role === 'admin';
```

### 3. Clear Error Messages

```typescript
// ❌ Bad: Generic
if (!hasAccess) {
  return { error: 'Access denied' };
}

// ✅ Good: Specific
if (!user) {
  return { error: 'You must be signed in' };
}
if (!isAdmin) {
  return { error: 'This action requires admin privileges' };
}
```

### 4. Audit Logging

```typescript
export async function grantAdminAccess(userId: string) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Log the action
  await supabase.from('audit_log').insert({
    action: 'grant_admin',
    performed_by: currentUser?.id,
    target_user: userId,
    timestamp: new Date().toISOString(),
  });

  // Perform action
  await updateUserMetadata(userId, { role: 'admin' });
}
```

### 5. Regular Access Reviews

Periodically review user permissions:

```sql
-- Find all admins
SELECT email, raw_app_meta_data
FROM auth.users
WHERE raw_app_meta_data->>'role' = 'admin';

-- Find users with specific permission
SELECT email, raw_app_meta_data->'permissions'
FROM auth.users
WHERE raw_app_meta_data->'permissions' ? 'users:delete';
```

## Troubleshooting

### Unauthorized Users Accessing App

**Problem:** Users without permissions can access protected pages

**Solutions:**
1. Add authorization check in auth callback
2. Verify middleware includes authorization logic
3. Check `app_metadata` is set correctly in Supabase
4. Use strict equality (`===`) not truthy checks
5. Ensure `/access-denied` route exists

**Debug:**
```typescript
// Log user metadata to verify
console.log('User metadata:', user?.app_metadata);

// Check the exact value
console.log('Role:', user?.app_metadata?.role);
console.log('Is admin?', user?.app_metadata?.role === 'admin');
```

### Authorized Users Getting "Access Denied"

**Problem:** User with permissions can't access app

**Solutions:**
1. Verify `app_metadata` in Supabase Dashboard
2. Check user signed out and back in (to refresh token)
3. Verify authorization logic isn't too restrictive
4. Check for typos in role/permission names

**Verify in SQL:**
```sql
SELECT
  email,
  raw_app_meta_data,
  raw_app_meta_data->>'role' as role
FROM auth.users
WHERE email = 'user@example.com';
```

### Permissions Not Updating

**Problem:** User permissions changed but not reflected

**Solutions:**
1. User must sign out and sign in again
2. Or call `supabase.auth.refreshSession()` client-side
3. JWT tokens cache `app_metadata` until refresh

**Force refresh:**
```typescript
const { data, error } = await supabase.auth.refreshSession();
```

## Next Steps

- [Role Management Guide](/docs/role-management-guide) - Database-backed roles and permissions
- [Claims Guide](/docs/claims-guide) - Understanding custom claims
- [RLS Policies](/docs/rls-policies) - Database-level security with roles
- [Authentication Guide](/docs/authentication-guide) - Full auth patterns

## Additional Resources

- [Supabase Auth Metadata](https://supabase.com/docs/guides/auth/managing-user-data#managing-user-identity)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)





---

## What's Next

- **Claims:** [/docs/claims-guide](/docs/claims-guide)
- **Roles:** [/docs/role-management-guide](/docs/role-management-guide)
- **RLS policies:** [/docs/rls-policies](/docs/rls-policies)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
