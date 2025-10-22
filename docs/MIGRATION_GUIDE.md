# Database Migration Guide

This project uses an automated migration system to manage database schema changes safely and consistently.

## Quick Start

### Check Migration Status
```bash
# Using pnpm
pnpm migrate:status

# Using make
make migrate-status
```

### Run Pending Migrations
```bash
# Using pnpm
pnpm migrate

# Using make
make migrate
```

### Force Re-run a Migration
```bash
# Using pnpm
pnpm migrate:force 001_multi_app_support

# Using make
make migrate-force NAME=001_multi_app_support
```

## How It Works

The migration system:

1. **Tracks Applied Migrations** - Uses a `migrations` table to record which migrations have been run
2. **Runs in Order** - Executes migrations in alphabetical order (001, 002, 003, etc.)
3. **Prevents Duplicates** - Skips migrations that have already been successfully applied
4. **Detects Changes** - Checksums detect if migration files have been modified after being applied
5. **Records Errors** - Failed migrations are logged with error messages for troubleshooting

## Migration Files

Migrations are SQL files in the `/migrations` directory, named with a numeric prefix:

```
migrations/
  000_migration_tracker.sql    # Migration system infrastructure (run first)
  001_multi_app_support.sql    # Multi-app support functions
  002_app_configuration_tables.sql  # App and role tables
  002_seed_default_apps.sql    # Seed data
  003_api_keys.sql             # API key management
  004_external_key_sources.sql # External key sources
  006_performance_optimizations.sql # Performance improvements
```

## First-Time Setup

For a **new installation**, you need to run the migration tracker setup first:

### Option 1: Manual Setup (Recommended for First Install)

1. Open your Supabase dashboard → SQL Editor
2. Copy and paste the contents of `migrations/000_migration_tracker.sql`
3. Execute the SQL
4. Then run: `pnpm migrate` to apply all other migrations

### Option 2: Use the Main Install Script

The `install.sql` file in the project root includes all migrations and can be run directly for new installations.

## Environment Variables

The migration script requires these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

⚠️ **Important**: The service role key is required for migrations as it has admin privileges.

## Migration Status Output

When you run `pnpm migrate:status`, you'll see:

```
══════════════════════════════════════════════════════════════════
  Database Migration Status
══════════════════════════════════════════════════════════════════

✓ Applied  001_multi_app_support
          2024-01-15 10:30:45

✓ Applied  002_app_configuration_tables
          2024-01-15 10:31:12

○ Pending  003_api_keys

○ Pending  004_external_key_sources

──────────────────────────────────────────────────────────────────
  Total: 4 | Applied: 2 | Pending: 2
══════════════════════════════════════════════════════════════════
```

### Status Indicators

- ✓ **Applied** (green) - Migration has been successfully applied
- ✗ **Failed** (red) - Migration execution failed (see error details)
- ○ **Pending** (yellow) - Migration has not been run yet
- ⚠ **Checksum mismatch** (yellow) - File has been modified since it was applied

## Running Migrations

### Automatic (Recommended)

```bash
pnpm migrate
```

This will:
1. Check which migrations have been applied
2. Run any pending migrations in order
3. Stop if any migration fails
4. Show a summary of results

### Manual (For Testing)

You can still manually run migrations via Supabase SQL Editor if needed. Simply copy and paste the SQL file contents.

## Common Scenarios

### New Developer Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials
3. Install dependencies: `pnpm install`
4. Run the migration tracker setup manually (see First-Time Setup above)
5. Run migrations: `pnpm migrate`

### Existing Installation Upgrade

1. Pull latest code
2. Check migration status: `pnpm migrate:status`
3. Run pending migrations: `pnpm migrate`

### Migration Failed Halfway

If a migration fails:

1. Check the error message in the output
2. Fix the issue (usually in your Supabase database or environment)
3. The migration system tracks failed migrations
4. Re-run `pnpm migrate` to retry failed migrations

### Force Re-run a Migration

If you need to re-run a migration (e.g., after fixing it):

```bash
pnpm migrate:force 003_api_keys
```

⚠️ **Warning**: This will re-execute the entire migration. Make sure it's idempotent (safe to run multiple times).

## Creating New Migrations

### Naming Convention

Use a numeric prefix followed by a descriptive name:

```
007_add_audit_log.sql
008_user_preferences.sql
009_notification_settings.sql
```

### Best Practices

1. **Make migrations idempotent** - Use `CREATE OR REPLACE FUNCTION`, `CREATE TABLE IF NOT EXISTS`, etc.
2. **Test thoroughly** - Run migrations on a dev/staging database first
3. **Keep migrations small** - One logical change per migration
4. **Document changes** - Add comments explaining what and why
5. **Use transactions** - Wrap related changes in BEGIN/COMMIT blocks
6. **Handle rollback** - Consider what happens if migration fails halfway

### Migration Template

```sql
-- Migration: 007_add_audit_log
-- Description: Adds audit logging for user actions
-- Date: 2024-01-20

BEGIN;

-- Create audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own audit logs" ON public.audit_log
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" ON public.audit_log
    FOR SELECT
    USING (is_claims_admin());

-- Create helper function
CREATE OR REPLACE FUNCTION public.log_audit(
    action_name TEXT,
    action_details JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_log (user_id, action, details)
    VALUES (auth.uid(), action_name, action_details);
END;
$$;

COMMIT;

COMMENT ON TABLE public.audit_log IS 'Audit log for tracking user actions';
COMMENT ON FUNCTION public.log_audit IS 'Helper function to log user actions';
```

## Troubleshooting

### "Missing required environment variables"

Make sure you have a `.env.local` file with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### "relation 'migrations' does not exist"

Run the migration tracker setup first:
```bash
# In Supabase SQL Editor, run:
migrations/000_migration_tracker.sql
```

### "permission denied"

Make sure you're using the **service role key**, not the anon key. The service role key has admin privileges needed for schema changes.

### Migration shows "checksum mismatch"

This means the migration file has been changed after it was applied. This is usually fine for development, but in production:

1. **Don't modify applied migrations** - Create a new migration instead
2. If you must re-run: `pnpm migrate:force <migration-name>`

### "Unexpected error" during migration

1. Check your Supabase database is accessible
2. Verify your service role key is correct
3. Look at the error message for SQL-specific issues
4. Try running the SQL manually in Supabase SQL Editor to see detailed error

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Run Migrations

on:
  push:
    branches: [main, staging]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Run migrations
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: pnpm migrate
```

### Docker Integration

Add to your Dockerfile or docker-compose:

```dockerfile
# Run migrations on startup
CMD pnpm migrate && pnpm start
```

Or use a separate migration container:

```yaml
services:
  migrate:
    build: .
    command: pnpm migrate
    environment:
      - NEXT_PUBLIC_SUPABASE_URL
      - SUPABASE_SERVICE_ROLE_KEY
    depends_on:
      - app
```

## Migration System Architecture

### Database Schema

The `public.migrations` table tracks all migrations:

```sql
CREATE TABLE public.migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);
```

### Helper Functions

- `is_migration_applied(migration_name)` - Check if a migration has been applied
- `record_migration(...)` - Record a migration execution (success or failure)

### Security

- RLS is enabled on the migrations table
- Only claims admins can view and insert migrations
- Migration functions use `SECURITY DEFINER` for elevated privileges

## Best Practices Summary

✅ **DO**:
- Run migrations in development/staging first
- Test migrations thoroughly
- Make migrations idempotent
- Use descriptive migration names
- Keep migrations focused and small
- Document complex changes
- Review migration status regularly

❌ **DON'T**:
- Modify migrations after they've been applied to production
- Run untested migrations in production
- Skip the migration tracker setup
- Delete old migrations (they're your history)
- Combine unrelated changes in one migration
- Use the anon key for migrations (use service role key)

## Further Reading

- [Supabase Database Migrations](https://supabase.com/docs/guides/database/migrations)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- Project migrations: `/migrations/README.md`

