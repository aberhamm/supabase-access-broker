---
title: "Supabase Custom Claims Guide"
description: "Complete guide to Supabase custom claims"
category: "core"
audience: "all"
order: 1
---

# Supabase Custom Claims Guide

## What are Custom Claims?

Custom Claims are special attributes attached to a user that you can use to control access to portions of your application. They're stored in the `raw_app_meta_data` field of the `auth.users` table and are included in the user's JWT access token.

### Example Claims

```json
{
  "plan": "TRIAL",
  "user_level": 100,
  "group_name": "Super Guild!",
  "joined_on": "2022-05-20T14:28:18.217Z",
  "group_manager": false,
  "items": ["toothpick", "string", "ring"],
  "claims_admin": true
}
```

## Why Use Custom Claims?

### Performance Benefits

Custom claims are stored in the JWT token, making them available to:
- Your application (client-side)
- PostgreSQL database (via `current_setting('request.jwt.claims', true)`)
- RLS (Row Level Security) policies

**No database queries needed!** This can eliminate thousands or millions of database calls when checking permissions, especially in RLS policies.

### Use Cases

- ✅ Authorization and permissions
- ✅ Feature flags
- ✅ Subscription tiers/plans
- ✅ User roles and groups
- ✅ Rate limiting metadata
- ✅ Temporary access grants

### When NOT to Use Claims

❌ Frequently changing data (requires session refresh)
❌ Large amounts of data (increases token size)
❌ Sensitive secrets (claims are in JWT, readable by client)
❌ User profile data (use `raw_user_meta_data` instead)

## Installation

### 1. Install the SQL Functions

Copy the contents of `install.sql` and run it in your Supabase SQL Editor:

```sql
-- The file includes these functions:
-- - get_claims(uid uuid)
-- - get_claim(uid uuid, claim text)
-- - set_claim(uid uuid, claim text, value jsonb)
-- - delete_claim(uid uuid, claim text)
-- - get_my_claims()
-- - get_my_claim(claim text)
-- - is_claims_admin()
```

Go to: https://app.supabase.com/project/YOUR-PROJECT/sql

### 2. Bootstrap Your First Admin

Grant yourself claims_admin access:

```sql
select set_claim('YOUR-USER-ID', 'claims_admin', 'true');
```

Find your user ID in: **Authentication → Users** in the Supabase dashboard.

## Usage

### In the Dashboard (This App)

The dashboard provides a UI for all claim operations:
- View all users and their claims
- Add new claims with JSON validation
- Edit existing claims
- Delete claims
- Toggle claims_admin status

### In SQL Editor

#### Get All Claims for a User

```sql
select get_claims('03acaa13-7989-45c1-8dfb-6eeb7cf0b92e');
```

#### Get a Specific Claim

```sql
select get_claim('03acaa13-7989-45c1-8dfb-6eeb7cf0b92e', 'userlevel');
```

#### Set Claims (Different Types)

**Number:**
```sql
select set_claim('user-id', 'userlevel', '200');
```

**String:** (requires double quotes)
```sql
select set_claim('user-id', 'userrole', '"MANAGER"');
```

**Boolean:**
```sql
select set_claim('user-id', 'useractive', 'true');
```

**Array:**
```sql
select set_claim('user-id', 'items', '["bread", "cheese", "butter"]');
```

**Object:**
```sql
select set_claim('user-id', 'gamestate', '{"level": 5, "items": ["knife", "gun"]}');
```

#### Delete a Claim

```sql
select delete_claim('user-id', 'gamestate');
```

### In Your Application (JavaScript/TypeScript)

#### Reading Claims from Session

```typescript
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    console.log(session.user.app_metadata); // All custom claims
    const userLevel = session.user.app_metadata.userlevel;
    const isAdmin = session.user.app_metadata.claims_admin;
  }
});
```

#### Using RPC Functions

**For Current User:**

```typescript
// Get all my claims
const { data, error } = await supabase.rpc('get_my_claims');

// Get a specific claim
const { data, error } = await supabase.rpc('get_my_claim', {
  claim: 'userlevel'
});

// Check if I'm an admin
const { data, error } = await supabase.rpc('is_claims_admin');
```

**For Any User (Requires claims_admin):**

```typescript
// Get all claims for a user
const { data, error } = await supabase.rpc('get_claims', {
  uid: 'user-id'
});

// Get specific claim for a user
const { data, error } = await supabase.rpc('get_claim', {
  uid: 'user-id',
  claim: 'userlevel'
});

// Set a claim for a user
const { data, error } = await supabase.rpc('set_claim', {
  uid: 'user-id',
  claim: 'userlevel',
  value: 100
});

// Delete a claim for a user
const { data, error } = await supabase.rpc('delete_claim', {
  uid: 'user-id',
  claim: 'userlevel'
});
```

### In Row Level Security (RLS) Policies

Use claims to control database access:

#### Only Allow Managers

```sql
get_my_claim('userrole') = '"MANAGER"'::jsonb
```

#### Only Allow High-Level Users

```sql
coalesce(get_my_claim('userlevel')::numeric, 0) > 100
```

#### Only Allow Claims Admins

```sql
coalesce(get_my_claim('claims_admin')::bool, false)
```

### In PostgreSQL Functions and Triggers

Use any of the claim functions inside your database code:

```sql
CREATE OR REPLACE FUNCTION check_user_permissions()
RETURNS trigger AS $$
BEGIN
  -- Check if user has required claim
  IF get_my_claim('can_edit') != 'true'::jsonb THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Querying Users by Claims

Find users with specific claims:

**Find all admins:**
```sql
SELECT * FROM auth.users
WHERE (raw_app_meta_data->'claims_admin')::bool = true;
```

**Find users with level > 100:**
```sql
SELECT * FROM auth.users
WHERE (raw_app_meta_data->'userlevel')::numeric > 100;
```

**Find users with specific role:**
```sql
SELECT * FROM auth.users
WHERE (raw_app_meta_data->'userrole')::text = '"MANAGER"';
```

## Important Notes

### Session Refresh

When you update a claim, users need to refresh their session to see changes:

**In your app:**
```typescript
await supabase.auth.refreshSession();
```

**Or ask users to log out and back in.**

### Reserved Claim Names

❌ **Avoid these names:**
- `provider` - Used by Supabase Auth
- `providers` - Used by Supabase Auth
- `exp` - Reserved by JWT standard
- `role` - Reserved by Supabase Realtime

✅ **Best practice:** Use prefixed names like `myapp_role`, `myapp_level`, etc.

### Data Types

All claim values are stored as JSONB:
- **Strings** must be wrapped in double quotes: `"value"`
- **Numbers** are plain: `100`
- **Booleans** are: `true` or `false`
- **Arrays** need brackets: `["a", "b"]`
- **Objects** need braces: `{"key": "value"}`

### Security

**`raw_app_meta_data` vs `raw_user_meta_data`:**

| Field | Purpose | User Access | Admin Access |
|-------|---------|-------------|--------------|
| `raw_app_meta_data` | App/system data, custom claims | ❌ No | ✅ Yes |
| `raw_user_meta_data` | User profile data | ✅ Yes | ✅ Yes |

- Use `raw_app_meta_data` for permissions/roles (this is custom claims)
- Use `raw_user_meta_data` for user profiles (name, avatar, etc.)

### Security Considerations

By default:
- ✅ Any authenticated user can read their own claims
- ❌ Only `claims_admin` users can modify claims
- ✅ SQL Editor can always modify claims

To tighten security (SQL Editor only), edit the `is_claims_admin()` function in `install.sql`.

## Troubleshooting

### "Invalid input syntax for type json"

You forgot double quotes around a string:
```sql
-- ❌ Wrong
select set_claim('id', 'name', 'John');

-- ✅ Correct
select set_claim('id', 'name', '"John"');
```

### Claims not updating in my app

Users need to refresh their session:
```typescript
await supabase.auth.refreshSession();
```

Or log out and back in.

### Can't set claims from my app

Make sure:
1. The SQL functions are installed (`install.sql`)
2. Your user has `claims_admin: true` set
3. You're using the RPC functions, not direct SQL

## Additional Resources

- [Supabase Auth API](https://supabase.com/docs/reference/javascript/auth-api)
- [JWT Tokens](https://jwt.io/)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [GitHub Issues](https://github.com/supabase-community/supabase-custom-claims/issues)

## Uninstalling

To remove all custom claims functions:

1. Run the contents of `uninstall.sql` in your SQL Editor
2. This removes all functions but preserves existing claim data

Your claims data in `auth.users.raw_app_meta_data` will remain intact.
