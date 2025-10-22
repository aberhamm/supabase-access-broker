-- Migration: Performance Optimizations
-- Description: Adds indexes and efficient query functions to improve performance
-- Safe to re-run: Yes (uses CREATE INDEX IF NOT EXISTS and CREATE OR REPLACE)

-- ============================================================================
-- Additional Indexes for Performance
-- ============================================================================

-- Composite index for app + role lookups (common in API key queries)
CREATE INDEX IF NOT EXISTS idx_api_keys_app_role ON public.api_keys(app_id, role_id) WHERE enabled = true;

-- Index for expiring keys cleanup queries
CREATE INDEX IF NOT EXISTS idx_api_keys_expired ON public.api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Index for role lookups by app (with global flag)
CREATE INDEX IF NOT EXISTS idx_roles_app_global ON public.roles(app_id, is_global);

-- Index for external sources by app and enabled status
CREATE INDEX IF NOT EXISTS idx_external_sources_app_enabled ON public.external_key_sources(app_id, enabled);

-- ============================================================================
-- Efficient Dashboard Stats Function
-- ============================================================================

-- Get dashboard statistics without loading all users into memory
-- This function uses efficient aggregation queries instead of processing all users
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users integer;
  claims_admins integer;
  recent_signups integer;
  total_apps integer;
  enabled_apps integer;
  total_roles integer;
  total_api_keys integer;
BEGIN
  -- Only admins can view dashboard stats
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view dashboard stats';
  END IF;

  -- Count total users
  SELECT COUNT(*) INTO total_users FROM auth.users;

  -- Count claims admins
  SELECT COUNT(*) INTO claims_admins
  FROM auth.users
  WHERE (raw_app_meta_data->>'claims_admin')::boolean = true;

  -- Count recent signups (last 7 days)
  SELECT COUNT(*) INTO recent_signups
  FROM auth.users
  WHERE created_at > NOW() - INTERVAL '7 days';

  -- Count apps
  SELECT COUNT(*), COUNT(*) FILTER (WHERE enabled = true)
  INTO total_apps, enabled_apps
  FROM public.apps;

  -- Count roles
  SELECT COUNT(*) INTO total_roles FROM public.roles;

  -- Count API keys
  SELECT COUNT(*) INTO total_api_keys FROM public.api_keys WHERE enabled = true;

  RETURN jsonb_build_object(
    'totalUsers', total_users,
    'claimsAdmins', claims_admins,
    'recentSignups', recent_signups,
    'totalApps', total_apps,
    'enabledApps', enabled_apps,
    'totalRoles', total_roles,
    'totalApiKeys', total_api_keys
  );
END;
$$;

-- ============================================================================
-- Efficient Recent Users Function
-- ============================================================================

-- Get recent users without loading all users
-- Returns only the most recent N users with proper filtering
CREATE OR REPLACE FUNCTION get_recent_users(limit_count integer DEFAULT 5)
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  app_metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can view users
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view users';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.raw_app_meta_data as app_metadata
  FROM auth.users u
  WHERE u.last_sign_in_at IS NOT NULL
  ORDER BY u.last_sign_in_at DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- Efficient Claim Distribution Function
-- ============================================================================

-- Get claim distribution statistics efficiently
-- This uses a more efficient approach than loading all users
CREATE OR REPLACE FUNCTION get_claim_distribution(limit_count integer DEFAULT 10)
RETURNS TABLE(
  claim_key text,
  user_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can view claim distribution
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view claim distribution';
  END IF;

  -- Note: This function uses a simplified approach since PostgreSQL doesn't have
  -- a built-in way to efficiently aggregate jsonb keys across rows.
  -- For production use with many users, consider using a materialized view
  -- that updates periodically, or implementing this logic in application code
  -- with pagination.

  RETURN QUERY
  WITH claim_keys AS (
    SELECT
      jsonb_object_keys(raw_app_meta_data) as key
    FROM auth.users
    WHERE raw_app_meta_data IS NOT NULL
  ),
  filtered_keys AS (
    SELECT key
    FROM claim_keys
    WHERE key NOT IN ('provider', 'providers')
  )
  SELECT
    key as claim_key,
    COUNT(*) as user_count
  FROM filtered_keys
  GROUP BY key
  ORDER BY user_count DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- Paginated User List Function
-- ============================================================================

-- Get users with pagination for better performance
CREATE OR REPLACE FUNCTION get_users_paginated(
  page_size integer DEFAULT 50,
  page_offset integer DEFAULT 0,
  search_email text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  app_metadata jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users bigint;
BEGIN
  -- Only admins can view users
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view users';
  END IF;

  -- Get total count
  IF search_email IS NOT NULL THEN
    SELECT COUNT(*) INTO total_users
    FROM auth.users
    WHERE email ILIKE '%' || search_email || '%';
  ELSE
    SELECT COUNT(*) INTO total_users FROM auth.users;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.raw_app_meta_data as app_metadata,
    total_users as total_count
  FROM auth.users u
  WHERE search_email IS NULL OR u.email ILIKE '%' || search_email || '%'
  ORDER BY u.created_at DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$;

NOTIFY pgrst, 'reload schema';
