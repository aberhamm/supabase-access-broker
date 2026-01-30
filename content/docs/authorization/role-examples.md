---
title: "Role Management Examples"
description: "Complete, copy-paste role and permission examples"
category: "authorization"
audience: "app-developer"
order: 5
---

# Role Management Examples

This guide provides complete, copy-paste examples for common scenarios.

## Example 1: Blog Platform with Role-Based Features

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

## Example 2: Multi-Tenant SaaS Application

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

## Example 3: E-commerce with Customer Tiers

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

## Example 4: Admin Dashboard with Delegation

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

## Related Documentation

- [Role Management Guide](/docs/role-management-guide)
- [Role Frontend Patterns](/docs/role-frontend-patterns)
