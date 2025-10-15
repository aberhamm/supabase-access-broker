# Database Migrations

This directory contains database migrations for the Supabase Claims Admin Dashboard.

## Migration Files

- `001_multi_app_support.sql` - Adds support for multi-app claims management
- `002_app_configuration_tables.sql` - Adds database tables for managing apps and roles
- `002_seed_default_apps.sql` - Seeds initial apps and roles (optional)

## How to Apply Migrations

### For Existing Installations

If you already have the dashboard installed and want to upgrade:

1. Open your Supabase project dashboard
2. Navigate to the **SQL Editor**
3. Copy the contents of `001_multi_app_support.sql`
4. Paste and execute the SQL

All migrations use `CREATE OR REPLACE FUNCTION`, so they are safe to re-run.

### For New Installations

If you're setting up the dashboard for the first time:

1. Simply run the main `install.sql` file from the project root
2. This file includes all migrations and base functions

## Migration Details

### 001_multi_app_support.sql

**Purpose**: Extends the claims system to support multiple applications with app-scoped permissions.

**What it adds**:
- `get_user_apps(uid)` - Returns all apps a user has access to
- `get_app_claim(uid, app_id, claim)` - Gets a specific claim from a specific app
- `set_app_claim(uid, app_id, claim, value)` - Sets an app-scoped claim
- `delete_app_claim(uid, app_id, claim)` - Removes an app-scoped claim
- `is_app_admin(app_id)` - Checks if the current user is an admin for a specific app
- `list_app_users(app_id)` - Lists all users with access to a specific app

**Backward compatibility**: ✅ Yes
- Existing claims remain at the top level of `app_metadata`
- New app-scoped claims are stored in `app_metadata.apps.{app_id}`
- No schema changes to database tables
- Existing functions remain unchanged

**Safe to re-run**: ✅ Yes

## Data Structure

### Before (Single App)
```json
{
  "claims_admin": true,
  "role": "admin",
  "subscription": "premium"
}
```

### After (Multi-App Support)
```json
{
  "claims_admin": true,
  "role": "admin",
  "apps": {
    "app1": {
      "enabled": true,
      "role": "admin",
      "admin": true,
      "permissions": ["read", "write"]
    },
    "app2": {
      "enabled": true,
      "role": "user"
    }
  }
}
```

### 002_app_configuration_tables.sql

**Purpose**: Adds database tables and functions for dynamic app and role management.

**What it adds**:
- `public.apps` table - Stores application configurations
- `public.roles` table - Stores role definitions (global or app-specific)
- RLS policies for admin-only access
- `get_all_apps(enabled_only)` - Returns all apps
- `create_app(...)` - Creates a new app
- `update_app(...)` - Updates an app
- `delete_app(app_id)` - Deletes an app
- `get_app_roles(app_id)` - Returns roles for an app
- `get_global_roles()` - Returns global roles
- `create_role(...)` - Creates a new role
- `update_role(...)` - Updates a role
- `delete_role(role_id)` - Deletes a role

**Backward compatibility**: ✅ Yes
- Falls back to TypeScript config if database is empty
- No changes to existing data
- Additive only (no breaking changes)

**Safe to re-run**: ✅ Yes

## Rollback

### For 001_multi_app_support.sql

Since this migration only adds new functions and doesn't modify existing data or functions, rollback is simple:

```sql
DROP FUNCTION IF EXISTS get_user_apps(uuid);
DROP FUNCTION IF EXISTS get_app_claim(uuid, text, text);
DROP FUNCTION IF EXISTS set_app_claim(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS delete_app_claim(uuid, text, text);
DROP FUNCTION IF EXISTS is_app_admin(text);
DROP FUNCTION IF EXISTS list_app_users(text);
```

However, any app-scoped claims data will remain in user metadata (harmless but unused).

### For 002_app_configuration_tables.sql

To rollback the database tables and functions:

```sql
-- Drop functions
DROP FUNCTION IF EXISTS get_all_apps(BOOLEAN);
DROP FUNCTION IF EXISTS create_app(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS update_app(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS delete_app(TEXT);
DROP FUNCTION IF EXISTS get_app_roles(TEXT);
DROP FUNCTION IF EXISTS get_global_roles();
DROP FUNCTION IF EXISTS create_role(TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS update_role(UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS delete_role(UUID);

-- Drop tables (will cascade to roles)
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.apps CASCADE;
```

System will automatically fall back to TypeScript configuration.
