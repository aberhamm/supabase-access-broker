---
title: "Role Frontend Patterns"
description: "React and Next.js patterns for role-based UI"
category: "authorization"
audience: "app-developer"
order: 4
---

# Role Frontend Patterns

This guide provides React/Next.js patterns for working with roles in your frontend application.

## Custom Hooks for Role Checking

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

## Role-Based Component Rendering

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

## Admin-Only Components

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

## Complete Page Examples

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

## Dynamic Navigation with Role Checks

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

## Role Selector Component

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

## User Role Management Component

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

## Type-Safe Role Helpers

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

## Loading and Error States

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

## Related Documentation

- [Role Management Guide](/docs/role-management-guide)
- [Admin Types and Permissions](/docs/admin-types)
