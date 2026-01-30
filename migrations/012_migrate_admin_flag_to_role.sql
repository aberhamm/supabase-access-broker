-- Migration: Convert admin flag to role='admin'
-- Description: Simplify admin model by merging admin:true flag with role='admin'
-- Date: 2026-01-30
--
-- IMPORTANT: Deploy code changes FIRST, then run this migration
--
-- This migration:
-- 1. Creates a backup table for rollback
-- 2. Upgrades role to 'admin' where admin:true exists
-- 3. Removes the admin flag from app_metadata
--
-- Rollback: Use the backup table to restore original state

-- Step 1: Create backup table for rollback reference
CREATE TABLE IF NOT EXISTS _migration_012_admin_backup AS
SELECT
  id,
  email,
  raw_app_meta_data->'apps' as apps_before,
  created_at
FROM auth.users
WHERE raw_app_meta_data->'apps' IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_each(raw_app_meta_data->'apps')
    WHERE value ? 'admin'
  );

-- Log affected users count
DO $$
DECLARE
  affected_count integer;
BEGIN
  SELECT COUNT(*) INTO affected_count FROM _migration_012_admin_backup;
  RAISE NOTICE 'Created backup for % users with admin flag', affected_count;
END $$;

-- Step 2: Upgrade role to 'admin' where admin:true, then remove admin flag
UPDATE auth.users
SET raw_app_meta_data = (
  SELECT jsonb_set(
    raw_app_meta_data,
    '{apps}',
    (
      SELECT jsonb_object_agg(
        key,
        CASE
          -- If admin:true and no role or role isn't admin, upgrade to admin
          WHEN (value->>'admin')::bool = true
               AND coalesce(value->>'role', '') != 'admin'
          THEN (value - 'admin') || '{"role": "admin"}'::jsonb
          -- Otherwise just remove admin flag
          ELSE value - 'admin'
        END
      )
      FROM jsonb_each(raw_app_meta_data->'apps')
    )
  )
)
WHERE raw_app_meta_data->'apps' IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_each(raw_app_meta_data->'apps')
    WHERE value ? 'admin'
  );

-- Step 3: Log migration results
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM auth.users u
  INNER JOIN _migration_012_admin_backup b ON u.id = b.id
  WHERE u.raw_app_meta_data->'apps' IS DISTINCT FROM b.apps_before;

  RAISE NOTICE 'Migration complete: % users updated', updated_count;
  RAISE NOTICE 'Backup table created: _migration_012_admin_backup';
  RAISE NOTICE 'To verify: SELECT id, email, raw_app_meta_data->''apps'' FROM auth.users WHERE id IN (SELECT id FROM _migration_012_admin_backup);';
  RAISE NOTICE 'To rollback: See rollback script in migration file comments';
END $$;

-- Step 4: Verification query (run manually to check results)
-- SELECT
--   u.id,
--   u.email,
--   b.apps_before as before_migration,
--   u.raw_app_meta_data->'apps' as after_migration
-- FROM auth.users u
-- INNER JOIN _migration_012_admin_backup b ON u.id = b.id
-- LIMIT 10;

-- Step 5: Clean up backup table after verification (run manually)
-- DROP TABLE IF EXISTS _migration_012_admin_backup;

/*
ROLLBACK SCRIPT (if needed):
-------------------------------

-- Restore original state from backup
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
  u.raw_app_meta_data,
  '{apps}',
  b.apps_before
)
FROM _migration_012_admin_backup b
WHERE u.id = b.id;

-- Verify rollback
SELECT
  u.id,
  u.email,
  u.raw_app_meta_data->'apps' as restored_apps
FROM auth.users u
INNER JOIN _migration_012_admin_backup b ON u.id = b.id
LIMIT 10;
*/
