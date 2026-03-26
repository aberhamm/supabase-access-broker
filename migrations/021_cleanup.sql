-- Migration: Non-security cleanup
-- Date: 2026-03-26
-- Separated from 020_security_hardening.sql to reduce blast radius.
-- Addresses: Low #22 (key_hash exposure), Low #24 (migration backup table)

BEGIN;

-- ============================================================================
-- 1. Remove key_hash from get_app_api_keys return (Low #22)
-- Exposing hashes to admin UI is unnecessary — admins can't reconstruct keys
-- from hashes, and it increases risk of hash leakage via logs/caches.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_app_api_keys(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  description TEXT,
  role_id UUID,
  role_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  enabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view api keys';
  END IF;

  RETURN QUERY
  SELECT
    k.id,
    k.app_id,
    k.name,
    k.description,
    k.role_id,
    r.name as role_name,
    k.expires_at,
    k.last_used_at,
    k.created_by,
    k.enabled,
    k.created_at
  FROM access_broker_app.api_keys k
  LEFT JOIN access_broker_app.roles r ON k.role_id = r.id
  WHERE k.app_id = p_app_id
  ORDER BY k.created_at DESC;
END;
$$;

-- ============================================================================
-- 2. Drop migration backup table (Low #24)
-- Created by migration 012 for rollback safety. No longer needed.
-- Table contains historical user IDs, emails, and app metadata without RLS.
-- ============================================================================

DROP TABLE IF EXISTS public._migration_012_admin_backup;
DROP TABLE IF EXISTS _migration_012_admin_backup;

COMMIT;

NOTIFY pgrst, 'reload schema';
