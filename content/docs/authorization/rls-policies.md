---
title: "RLS Policies Guide"
description: "Set up Row Level Security policies with custom claims"
category: "authorization"
audience: "app-developer"
order: 3
---

# Row Level Security (RLS) Policies Guide

**Context:** This guide shows how to use custom claims with Supabase Row Level Security (RLS) policies to control database access at the row level. RLS policies leverage the claims stored in user JWT tokens for high-performance authorization without additional database queries.

**Technology Stack:** PostgreSQL, Supabase, Custom Claims

**Prerequisites:**
- Custom claims functions installed (see install.sql)
- Understanding of custom claims (see CLAIMS_GUIDE.md)
- Basic PostgreSQL knowledge
- Tables created in your Supabase database

**Key Terminology:**
- **RLS (Row Level Security)**: PostgreSQL feature that restricts row access based on user
- **Policy**: Rule that determines which rows a user can access
- **Claims**: Custom user attributes stored in JWT tokens
- **JWT Token**: JSON Web Token containing user data and claims
- **auth.uid()**: PostgreSQL function that returns current user's ID
- **USING clause**: Defines which rows are visible (SELECT)
- **WITH CHECK clause**: Defines which rows can be modified (INSERT/UPDATE)

## Table of Contents

- [Overview](#overview)
- [Understanding RLS with Claims](#understanding-rls-with-claims)
- [Basic Policies](#basic-policies)
- [App-Specific Policies](#app-specific-policies)
- [Role-Based Policies](#role-based-policies)
- [Permission-Based Policies](#permission-based-policies)
- [Advanced Patterns](#advanced-patterns)
- [Multi-Tenant Policies](#multi-tenant-policies)
- [Performance Optimization](#performance-optimization)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

**What is RLS?**

Row Level Security (RLS) is a PostgreSQL feature that allows you to restrict which rows users can access based on policies you define. When combined with custom claims, RLS becomes a powerful tool for fine-grained access control.

**Why Use RLS with Claims?**

1. **Performance**: Claims are in the JWT token - no database lookup needed
2. **Security**: Row-level access control enforced at the database level
3. **Simplicity**: Write policies once, apply everywhere
4. **Consistency**: Same rules apply whether accessed via API, SQL, or admin panel

### How It Works

```
User Request → JWT Token (with claims) → PostgreSQL → RLS Policy (checks claims) → Filtered Rows
```

**Flow Example:**
1. User makes a request
2. Supabase validates JWT token
3. Claims from token are available in PostgreSQL
4. RLS policy checks claims
5. Only matching rows are returned

## Understanding RLS with Claims

### Accessing Claims in Policies

Custom claims are stored in the JWT token and accessible via PostgreSQL functions:

```sql
-- Get current user ID
auth.uid()

-- Get user's raw app metadata (contains all claims)
auth.jwt() -> 'app_metadata'

-- Access specific claim
(auth.jwt() -> 'app_metadata' ->> 'claim_name')

-- Access nested app claim
(auth.jwt() -> 'app_metadata' -> 'apps' -> 'app-id' ->> 'enabled')
```

### Basic RLS Setup

**Enable RLS on a table:**

```sql
-- Enable RLS on your table
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Now NO ONE can access the table without a policy (including you!)
-- You must create policies to grant access
```

### Policy Structure

```sql
CREATE POLICY "policy_name"
ON table_name
FOR operation        -- SELECT, INSERT, UPDATE, DELETE, or ALL
USING (condition)    -- Which rows are visible (for SELECT)
WITH CHECK (condition);  -- Which rows can be modified (for INSERT/UPDATE)
```

**Important:**
- `USING` clause filters which rows the user can see/access
- `WITH CHECK` clause validates which rows can be inserted/updated
- Both can use claims to make decisions

## Basic Policies

### Allow Users to Read Their Own Data

**Use Case:** Users can only see their own records

**Schema:**
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

**Policy:**
```sql
-- Users can only read their own profile
CREATE POLICY "Users can read own profile"
ON user_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Global Admin Access

**Use Case:** Users with `claims_admin: true` can access everything

**Policy:**
```sql
-- Claims admins can read all profiles
CREATE POLICY "Claims admins can read all profiles"
ON user_profiles
FOR SELECT
USING (
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);

-- Claims admins can modify all profiles
CREATE POLICY "Claims admins can update all profiles"
ON user_profiles
FOR UPDATE
USING (
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

**Explanation:**
- `auth.jwt() -> 'app_metadata' ->> 'claims_admin'` extracts the claim
- `::boolean` casts to boolean
- `COALESCE(..., false)` handles null values (returns false if claim doesn't exist)

## App-Specific Policies

### Restrict Access by App

**Use Case:** Only users with access to a specific app can see data for that app

**Schema:**
```sql
CREATE TABLE app_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
```

**Policy:**
```sql
-- Users can only read data from apps they have access to
CREATE POLICY "Users can read app data they have access to"
ON app_data
FOR SELECT
USING (
  -- Check if user has enabled: true for this app
  COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'enabled')::boolean,
    false
  ) = true
);

-- Users can only insert data for apps they have access to
CREATE POLICY "Users can insert app data they have access to"
ON app_data
FOR INSERT
WITH CHECK (
  COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'enabled')::boolean,
    false
  ) = true
);
```

**What This Does:**
1. Extracts `app_metadata.apps.{app_id}.enabled` from JWT
2. Checks if it's true
3. Only shows/allows rows where user has app access

### App Admin Access

**Use Case:** App admins can see all data for their app, regular users see only their own

**Policy:**
```sql
-- Users can read own data OR all data if they're app admin
CREATE POLICY "Users can read app data based on role"
ON app_data
FOR SELECT
USING (
  -- User owns the data
  auth.uid() = user_id
  OR
  -- User is admin for this app (role='admin')
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
  OR
  -- User is global admin
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

## Role-Based Policies

### Check User Role

**Use Case:** Different access levels based on user role within an app

**Schema:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  title TEXT,
  content TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
```

**Policy - View Access:**
```sql
-- Viewers can read published documents
-- Editors can read all documents
-- Admins can read everything
CREATE POLICY "Role-based document read access"
ON documents
FOR SELECT
USING (
  -- Document is published (public)
  is_published = true
  OR
  -- User owns the document
  auth.uid() = owner_id
  OR
  -- User is editor or admin for this app
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role')
    IN ('editor', 'admin')
  OR
  -- User is global admin
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

**Policy - Edit Access:**
```sql
-- Only editors and admins can update documents
CREATE POLICY "Editors and admins can update documents"
ON documents
FOR UPDATE
USING (
  -- User owns the document
  auth.uid() = owner_id
  OR
  -- User is editor or admin for this app
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role')
    IN ('editor', 'admin')
)
WITH CHECK (
  -- Same check for the updated data
  auth.uid() = owner_id
  OR
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role')
    IN ('editor', 'admin')
);
```

**Policy - Delete Access:**
```sql
-- Only admins can delete documents
CREATE POLICY "Only admins can delete documents"
ON documents
FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
  OR
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

## Permission-Based Policies

### Check Custom Permissions Array

**Use Case:** Fine-grained permissions stored as an array in claims

**Schema:**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  name TEXT,
  budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
```

**Policy - Permission Array:**
```sql
-- Users need 'read' permission to view projects
CREATE POLICY "Users with read permission can view projects"
ON projects
FOR SELECT
USING (
  -- Check if 'read' is in the permissions array
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions')
    ? 'read'
  OR
  -- Or if user is admin (role='admin')
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
);

-- Users need 'write' permission to modify projects
CREATE POLICY "Users with write permission can update projects"
ON projects
FOR UPDATE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions')
    ? 'write'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions')
    ? 'write'
);

-- Users need 'delete' permission to delete projects
CREATE POLICY "Users with delete permission can delete projects"
ON projects
FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions')
    ? 'delete'
);
```

**Explanation:**
- `? 'permission'` checks if string exists in JSONB array
- Returns true if permission is found in array
- Returns false if permission doesn't exist or array is null

### Multiple Permission Check

```sql
-- User needs BOTH 'read' AND 'write' permissions
CREATE POLICY "Users with read and write can modify"
ON projects
FOR UPDATE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions') ?&
    ARRAY['read', 'write']
);

-- User needs EITHER 'admin' OR 'manager' permission
CREATE POLICY "Admins or managers can access"
ON projects
FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions') ?|
    ARRAY['admin', 'manager']
);
```

**Operators:**
- `?` - Contains element
- `?&` - Contains all elements (AND)
- `?|` - Contains any element (OR)

## Advanced Patterns

### Hierarchical Roles

**Use Case:** Role hierarchy where higher roles inherit lower role permissions

**Helper Function:**
```sql
-- Create a function to check role level
CREATE OR REPLACE FUNCTION get_role_level(role_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'admin' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Policy:**
```sql
-- Users with role level >= 2 can edit
CREATE POLICY "Editors and above can update"
ON documents
FOR UPDATE
USING (
  get_role_level(
    auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role'
  ) >= 2
);
```

### Conditional Access Based on Multiple Claims

**Use Case:** Access based on multiple claim conditions

```sql
-- Premium users in specific region can access
CREATE POLICY "Premium users in US can access premium content"
ON premium_content
FOR SELECT
USING (
  -- User has premium subscription
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'subscription_tier')
    = 'premium'
  AND
  -- User is in US region
  (auth.jwt() -> 'app_metadata' ->> 'region') = 'US'
  AND
  -- Subscription is active
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'subscription_active')::boolean
    = true
);
```

### Time-Based Access

**Use Case:** Grant access based on claim with expiration date

**Schema:**
```sql
CREATE TABLE temporary_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE temporary_data ENABLE ROW LEVEL SECURITY;
```

**Policy:**
```sql
-- Users can access if their access hasn't expired
CREATE POLICY "Users with valid access can read"
ON temporary_data
FOR SELECT
USING (
  -- Check if user's access_expires_at is in the future
  COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> 'app1' ->> 'access_expires_at')::timestamptz,
    '1970-01-01'::timestamptz
  ) > NOW()
  AND
  -- And the data itself hasn't expired
  (expires_at IS NULL OR expires_at > NOW())
);
```

## Multi-Tenant Policies

### Organization-Based Access

**Use Case:** Multi-tenant SaaS where data is scoped to organizations

**Schema:**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_data ENABLE ROW LEVEL SECURITY;
```

**Policy:**
```sql
-- Users can only access data from their organization
CREATE POLICY "Users can access own organization data"
ON org_data
FOR SELECT
USING (
  -- User's organization_id matches row's organization_id
  organization_id = (
    auth.jwt() -> 'app_metadata' ->> 'organization_id'
  )::uuid
);

-- Users can insert data for their organization
CREATE POLICY "Users can insert own organization data"
ON org_data
FOR INSERT
WITH CHECK (
  organization_id = (
    auth.jwt() -> 'app_metadata' ->> 'organization_id'
  )::uuid
);
```

### Team-Based Access

**Use Case:** Access based on team membership stored in claims

```sql
-- User can access data for any team they belong to
CREATE POLICY "Users can access team data"
ON team_data
FOR SELECT
USING (
  -- team_id is in user's teams array
  team_id = ANY(
    ARRAY(
      SELECT jsonb_array_elements_text(
        auth.jwt() -> 'app_metadata' -> 'team_ids'
      )
    )::uuid[]
  )
);
```

## Performance Optimization

### Use Indexes

**Create indexes on columns used in RLS policies:**

```sql
-- Index on user_id for owner-based policies
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Index on app_id for app-based policies
CREATE INDEX idx_app_data_app_id ON app_data(app_id);

-- Index on organization_id for org-based policies
CREATE INDEX idx_org_data_org_id ON org_data(organization_id);

-- Composite index for common query patterns
CREATE INDEX idx_app_data_app_user ON app_data(app_id, user_id);
```

### Simplify Complex Policies

**Bad - Complex nested checks:**
```sql
-- Avoid deeply nested JSON operations
USING (
  (((auth.jwt() -> 'app_metadata') -> 'apps') -> app_id) ->> 'enabled'
)
```

**Good - Use helper functions:**
```sql
-- Create a helper function
CREATE OR REPLACE FUNCTION has_app_access(app_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'enabled')::boolean,
    false
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Use in policy
USING (has_app_access(app_id))
```

### Cache JWT Parsing

**Use STABLE or IMMUTABLE functions when possible:**

```sql
-- Mark functions as STABLE if they don't modify data
CREATE OR REPLACE FUNCTION get_user_role(app_id TEXT)
RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role';
$$ LANGUAGE sql STABLE;
```

## Common Patterns

### Pattern 1: Owner + Admin Access

```sql
-- Users can access their own data OR admins can access everything
CREATE POLICY "Owner or admin access"
ON your_table
FOR ALL
USING (
  auth.uid() = owner_id
  OR
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

### Pattern 2: App-Scoped with Role Check

```sql
-- Access scoped to app with role-based permissions
CREATE POLICY "App access with role check"
ON your_table
FOR SELECT
USING (
  -- User has app access
  COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'enabled')::boolean,
    false
  ) = true
  AND
  -- User has required role
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role')
    IN ('admin', 'editor')
);
```

### Pattern 3: Public + Authenticated

```sql
-- Allow public read, but authenticated users can write
CREATE POLICY "Public read access"
ON your_table
FOR SELECT
USING (true);  -- Everyone can read

CREATE POLICY "Authenticated write access"
ON your_table
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);  -- Must be logged in
```

### Pattern 4: Graduated Access

```sql
-- Different access levels based on subscription tier
CREATE POLICY "Graduated access by tier"
ON content
FOR SELECT
USING (
  -- Free content for everyone
  tier = 'free'
  OR
  -- Basic content for basic+ subscribers
  (
    tier = 'basic'
    AND
    (auth.jwt() -> 'app_metadata' -> 'apps' -> 'app1' ->> 'subscription_tier')
      IN ('basic', 'premium', 'enterprise')
  )
  OR
  -- Premium content for premium+ subscribers
  (
    tier = 'premium'
    AND
    (auth.jwt() -> 'app_metadata' -> 'apps' -> 'app1' ->> 'subscription_tier')
      IN ('premium', 'enterprise')
  )
);
```

## Troubleshooting

### Policy Not Working

**Problem:** Policy is defined but users still can't access data

**Solutions:**

1. **Check if RLS is enabled:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'your_table';
```

2. **Check active policies:**
```sql
SELECT * FROM pg_policies
WHERE tablename = 'your_table';
```

3. **Test policy directly:**
```sql
-- View what the JWT contains
SELECT auth.jwt();

-- Test specific claim extraction
SELECT auth.jwt() -> 'app_metadata' -> 'apps' -> 'app1' ->> 'enabled';
```

4. **Disable RLS temporarily to test:**
```sql
-- DANGER: Only for debugging!
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
-- Test if data is accessible
-- RE-ENABLE immediately after:
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

### Claims Not in JWT

**Problem:** Claims are set but not appearing in JWT

**Solution:**
```typescript
// User must refresh their session to get updated claims
const { error } = await supabase.auth.refreshSession();
```

### NULL Values

**Problem:** Policy fails when claim doesn't exist

**Solution:** Always use COALESCE to handle nulls:
```sql
-- BAD - fails if claim is null
USING ((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean = true)

-- GOOD - handles null gracefully
USING (
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'admin')::boolean,
    false
  ) = true
)
```

### Performance Issues

**Problem:** Queries are slow with RLS enabled

**Solutions:**

1. **Add indexes:**
```sql
CREATE INDEX idx_table_user ON your_table(user_id);
```

2. **Simplify policies:**
```sql
-- Create helper function instead of inline JSON parsing
CREATE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  );
$$ LANGUAGE sql STABLE;
```

3. **Use EXPLAIN to analyze:**
```sql
EXPLAIN ANALYZE
SELECT * FROM your_table WHERE app_id = 'app1';
```

## Best Practices

### 1. Always Use COALESCE

**Why:** Handles cases where claim doesn't exist

```sql
-- Good practice
COALESCE(
  (auth.jwt() -> 'app_metadata' ->> 'claim_name')::boolean,
  false  -- Default value if claim is null
)
```

### 2. Create Helper Functions

**Why:** Simplifies policies and improves maintainability

```sql
-- Create reusable functions
CREATE OR REPLACE FUNCTION is_claims_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  );
$$ LANGUAGE sql STABLE;

-- Use in policies
USING (is_claims_admin())
```

### 3. Test Policies Thoroughly

**Test with different user types:**

```sql
-- Test as regular user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-id", "app_metadata": {}}';
SELECT * FROM your_table;

-- Test as admin
SET LOCAL request.jwt.claims TO '{"sub": "admin-id", "app_metadata": {"claims_admin": true}}';
SELECT * FROM your_table;
```

### 4. Document Your Policies

**Add comments to policies:**

```sql
-- Policy: Only app admins and document owners can edit
-- Checks: app_metadata.apps.{app_id}.role = 'admin' OR owner_id match
CREATE POLICY "App admins and owners can edit documents"
ON documents
FOR UPDATE
USING (
  auth.uid() = owner_id
  OR
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
);
```

### 5. Use Appropriate Operation Types

**Be specific about operations:**

```sql
-- Different policies for different operations
CREATE POLICY "read_policy" ON table FOR SELECT ...;
CREATE POLICY "insert_policy" ON table FOR INSERT ...;
CREATE POLICY "update_policy" ON table FOR UPDATE ...;
CREATE POLICY "delete_policy" ON table FOR DELETE ...;

-- Instead of one policy with FOR ALL
```

### 6. Plan for Scale

**Consider indexes from the start:**

```sql
-- Add indexes on foreign keys and frequently filtered columns
CREATE INDEX idx_data_app_id ON data(app_id);
CREATE INDEX idx_data_user_id ON data(user_id);
CREATE INDEX idx_data_created_at ON data(created_at);
```

### 7. Audit Your Policies

**Regularly review policies:**

```sql
-- List all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Related Documentation

- [Role Management Guide](/docs/role-management-guide) - Database-backed roles and permissions
- [Claims Guide](/docs/claims-guide) - Understanding custom claims
- [Authorization Patterns](/docs/authorization-patterns) - Authorization best practices
- [Multi-App Guide](/docs/multi-app-guide) - Multi-app architecture
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## Summary

RLS policies combined with custom claims provide powerful, performant access control:

✅ **High Performance** - Claims are in JWT, no extra database queries
✅ **Secure** - Enforced at database level, can't be bypassed
✅ **Flexible** - Support complex access patterns
✅ **Maintainable** - Centralized in database schema

**Key Takeaways:**
1. Always enable RLS on tables with sensitive data
2. Use COALESCE to handle null claims
3. Create helper functions for complex logic
4. Test policies with different user types
5. Add indexes for performance
6. Document your policies

Start with simple policies and add complexity as needed. Remember: simpler policies are easier to maintain and often perform better!

---

## What's Next

- **Claims:** [/docs/claims-guide](/docs/claims-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Roles:** [/docs/role-management-guide](/docs/role-management-guide)
- **Multi-app:** [/docs/multi-app-guide](/docs/multi-app-guide)
