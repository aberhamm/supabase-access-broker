---
title: "Multi-App Architecture Guide"
description: "Managing multiple applications with one auth system"
category: "advanced"
audience: "all"
order: 2
---

# Multi-App Claims Management Guide

This guide explains how to use the multi-app claims system to manage user access across multiple applications using a single Supabase Auth instance.

## Table of Contents

- [Overview](#overview)
- [Concepts](#concepts)
- [Adding New Apps](#adding-new-apps)
- [Permission Model](#permission-model)
- [App Integration](#app-integration)
- [Migration Guide](#migration-guide)
- [Examples](#examples)

## Overview

The multi-app claims system allows you to:
- Manage user access to multiple applications from one dashboard
- Assign app-specific roles and permissions
- Designate app-specific admins (in addition to global admins)
- Keep global claims separate from app-specific claims

## Concepts

### Global Claims vs App Claims

**Global Claims** (stored at `app_metadata` root level):
- Available to all applications
- Example: `claims_admin`, `company_id`, `user_level`
- Best for organization-wide data

**App Claims** (stored at `app_metadata.apps.{app_id}`):
- Specific to one application
- Example: `apps.app1.role`, `apps.app2.permissions`
- Best for app-specific permissions and data

### Data Structure

```json
{
  "claims_admin": true,          // Global super-admin
  "company_id": "acme-corp",     // Global claim
  "apps": {
    "app1": {
      "enabled": true,           // Required: grants access to app1
      "role": "admin",           // App-specific role
      "admin": true,             // App-specific admin rights
      "permissions": ["read", "write", "delete"],
      "custom_field": "value"
    },
    "app2": {
      "enabled": true,
      "role": "viewer"
    }
  }
}
```

### Admin Hierarchy

1. **Global Admin** (`claims_admin: true`)
   - Can manage all users
   - Can manage all apps
   - Can grant/revoke app admin rights
   - Full access to everything

2. **App Admin** (`apps.{app_id}.admin: true`)
   - Can manage users for their specific app only
   - Cannot grant app admin rights
   - Cannot access other apps' data

3. **Regular User**
   - No admin access
   - Can only view their own claims

## Adding New Apps

### 1. Update App Configuration

Edit `lib/apps-config.ts`:

```typescript
export const APPS: AppInfo[] = [
  {
    id: 'my-new-app',           // Unique identifier (use kebab-case)
    name: 'My New App',          // Display name
    description: 'Description',  // Optional
    color: 'purple',             // Optional: for UI badges
  },
  // ... existing apps
];
```

### 2. Deploy Database Migration (if not already done)

If this is your first time adding app support, run the migration:

```sql
-- In Supabase SQL Editor, run:
-- migrations/001_multi_app_support.sql
```

For new installations, just run `install.sql` - it includes everything.

### 3. That's it!

The app will immediately appear in:
- User detail page (App Access card)
- App selector dropdowns
- Claims management interface

## Permission Model

### Checking Access in Your App

Each application should verify access using the `enabled` flag:

```javascript
// Example: Check if user has access to your app
const { data: { user } } = await supabase.auth.getUser();
const appId = 'my-app';
const hasAccess = user?.app_metadata?.apps?.[appId]?.enabled === true;

if (!hasAccess) {
  // Redirect to access denied page
}
```

### Role-Based Access

```javascript
// Check user's role for your app
const role = user?.app_metadata?.apps?.[appId]?.role;

if (role === 'admin') {
  // Show admin features
} else if (role === 'editor') {
  // Show editor features
} else {
  // Show read-only features
}
```

**Using Database-Backed Roles:**

This system supports database-backed roles with permissions. Instead of hardcoding roles, you can define them in the database:

```typescript
import { getRoles } from '@/lib/apps-service';

// Get available roles for the app
const roles = await getRoles('blog-app');

// Find user's role definition
const userRoleName = user?.app_metadata?.apps?.['blog-app']?.role;
const userRole = roles.find(r => r.name === userRoleName);

// Check permissions
if (userRole?.permissions.includes('publish')) {
  // Show publish button
}
```

See the **[Role Management Guide](/docs/role-management-guide)** for complete details on creating and managing roles.

### Custom Permissions

```javascript
// Check custom permissions array
const permissions = user?.app_metadata?.apps?.[appId]?.permissions || [];

if (permissions.includes('delete')) {
  // Allow deletion
}
```

## App Integration

### Next.js App Router Example

```typescript
// middleware.ts in your app
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const APP_ID = 'my-app'; // Your app's ID from apps-config.ts

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user has access to this app
  const hasAccess = user?.app_metadata?.apps?.[APP_ID]?.enabled === true;

  if (!hasAccess) {
    return NextResponse.redirect(new URL('/access-denied', request.url));
  }

  return NextResponse.next();
}
```

### React Component Example

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const APP_ID = 'my-app';

export function ProtectedFeature() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userRole = user?.app_metadata?.apps?.[APP_ID]?.role;
      setRole(userRole);
    }
    loadUserRole();
  }, []);

  if (role === 'admin') {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
}
```

### Using RLS Policies

Create Row Level Security policies that check app access:

```sql
-- Example: Restrict table access based on app claims
CREATE POLICY "Users with app access can read"
ON my_table
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->'apps'->'my-app'->>'enabled')::boolean = true
  )
);
```

## Migration Guide

### Migrating from Single-App to Multi-App

If you have existing claims, they'll continue to work as global claims. To migrate to app-specific claims:

#### Option 1: Keep as Global Claims
Do nothing! Global claims work across all apps automatically.

#### Option 2: Move to App-Specific Claims

For a specific user:

1. Go to user detail page
2. Enable access to the app (App Access card)
3. Set the app-specific role
4. Optionally copy claim values from global to app-specific
5. Remove old global claims if no longer needed

#### Option 3: Bulk Migration Script

```typescript
// Example script to migrate users to app structure
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceRoleKey);

async function migrateToAppStructure(appId: string) {
  const { data: users } = await supabase.auth.admin.listUsers();

  for (const user of users.users) {
    const role = user.app_metadata?.role; // Old global role

    if (role) {
      // Set app-specific role
      await supabase.rpc('set_app_claim', {
        uid: user.id,
        app_id: appId,
        claim: 'enabled',
        value: true
      });

      await supabase.rpc('set_app_claim', {
        uid: user.id,
        app_id: appId,
        claim: 'role',
        value: role
      });
    }
  }
}
```

## Examples

### Example 1: E-commerce Platform with Multiple Storefronts

```typescript
// apps-config.ts
export const APPS: AppInfo[] = [
  { id: 'storefront-us', name: 'US Storefront', color: 'blue' },
  { id: 'storefront-eu', name: 'EU Storefront', color: 'green' },
  { id: 'admin-portal', name: 'Admin Portal', color: 'red' },
];

// User's claims
{
  "claims_admin": false,
  "employee_id": "12345",        // Global
  "apps": {
    "storefront-us": {
      "enabled": true,
      "role": "manager",
      "store_id": "NYC-001"
    },
    "storefront-eu": {
      "enabled": true,
      "role": "viewer"
    },
    "admin-portal": {
      "enabled": false           // No access
    }
  }
}
```

### Example 2: SaaS with Multiple Products

```typescript
// User can access different products with different permissions
{
  "company_id": "acme-corp",     // Global
  "apps": {
    "analytics-dashboard": {
      "enabled": true,
      "role": "admin",
      "features": ["export", "share", "alerts"]
    },
    "crm-system": {
      "enabled": true,
      "role": "user",
      "team_id": "sales"
    },
    "billing-portal": {
      "enabled": false           // Not subscribed
    }
  }
}
```

### Example 3: App-Specific Admin

```typescript
// This user is admin for app1 but not a global admin
{
  "claims_admin": false,         // Not global admin
  "apps": {
    "app1": {
      "enabled": true,
      "role": "manager",
      "admin": true              // App-specific admin
    },
    "app2": {
      "enabled": true,
      "role": "user"
    }
  }
}
```

This user can:
- ✅ View and manage users for app1
- ✅ Set claims for app1 users
- ❌ Cannot manage global claims
- ❌ Cannot manage app2 users
- ❌ Cannot grant app admin rights

## Best Practices

1. **Use Global Claims Sparingly**
   - Only for truly cross-app data
   - Examples: `company_id`, `employee_id`, `region`

2. **Always Check `enabled` Flag**
   - Don't just check for role existence
   - Always verify `apps.{app_id}.enabled === true`

3. **Standardize Role Names**
   - Use consistent roles across apps: `admin`, `user`, `viewer`
   - Or define custom roles in `apps-config.ts`

4. **Document Custom Claims**
   - If adding custom fields, document them
   - Keep claim names descriptive

5. **Use App-Specific Admins**
   - Delegate app management to app teams
   - Reduces burden on global admins

## Troubleshooting

### Users can't access my app
- Check `apps.{app_id}.enabled` is `true`
- Verify app ID matches exactly (case-sensitive)
- Ensure app is defined in `apps-config.ts`

### Changes not reflecting
- Users need to refresh their session: `supabase.auth.refreshSession()`
- Or log out and back in
- JWT tokens cache claims

### App admin can't see users
- Verify they have `apps.{app_id}.admin: true`
- Check middleware allows app admins
- Ensure RPC functions are deployed

## API Reference

### RPC Functions

```sql
-- Get all apps for a user
SELECT get_user_apps(user_id);

-- Get specific app claim
SELECT get_app_claim(user_id, 'app1', 'role');

-- Set app claim (admin only)
SELECT set_app_claim(user_id, 'app1', 'role', '"admin"'::jsonb);

-- Delete app claim
SELECT delete_app_claim(user_id, 'app1', 'role');

-- Check if user is app admin
SELECT is_app_admin('app1');

-- List all users for an app (app admin or global admin)
SELECT * FROM list_app_users('app1');
```

### Server Actions

```typescript
// Toggle app access
await toggleAppAccessAction(userId, appId, enabled);

// Set app role
await setAppRoleAction(userId, appId, role);

// Grant app admin
await toggleAppAdminAction(userId, appId, isAdmin);

// Set custom claim
await setAppClaimAction(userId, appId, claimKey, value);

// Delete claim
await deleteAppClaimAction(userId, appId, claimKey);
```

## Related Documentation

- **[Role Management Guide](/docs/role-management-guide)** - Database-backed roles and permissions
- **[Claims Guide](/docs/claims-guide)** - Understanding custom claims
- **[Authorization Patterns](/docs/authorization-patterns)** - Authorization best practices
- **[RLS Policies](/docs/rls-policies)** - Using roles in Row Level Security

## Support

For issues or questions:
1. Check the main README.md
2. Review the implementation in source code
3. Check Supabase Auth documentation
4. Open an issue on GitHub

---

## What's Next

- **Docs home:** [/docs](/docs)
- **Role Management:** [/docs/role-management-guide](/docs/role-management-guide)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
