-- Migration: Move Access Broker Tables to Dedicated Schema
-- Description: Moves Access Broker app tables from public to access_broker_app schema
-- for better organization and portability across Supabase instances.
-- Safe to re-run: NO - this migration should only be run once

-- ============================================================================
-- 1. Create the new schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS access_broker_app;

-- ============================================================================
-- 2. Move tables to new schema
-- Tables: apps, roles, api_keys, external_key_sources, system_settings,
--         auth_codes, passkey_credentials, passkey_challenges
-- Note: RLS policies, indexes, and constraints move with the tables
-- ============================================================================

-- First, drop the FK constraint from sso_audit_logs that references public.apps
-- (we'll recreate it pointing to the new schema)
ALTER TABLE IF EXISTS public.sso_audit_logs
  DROP CONSTRAINT IF EXISTS sso_audit_logs_app_id_fkey;

-- Move tables in dependency order (parent tables first)
ALTER TABLE public.apps SET SCHEMA access_broker_app;
ALTER TABLE public.roles SET SCHEMA access_broker_app;
ALTER TABLE public.api_keys SET SCHEMA access_broker_app;
ALTER TABLE public.external_key_sources SET SCHEMA access_broker_app;
ALTER TABLE public.system_settings SET SCHEMA access_broker_app;
ALTER TABLE public.auth_codes SET SCHEMA access_broker_app;
ALTER TABLE public.passkey_credentials SET SCHEMA access_broker_app;
ALTER TABLE public.passkey_challenges SET SCHEMA access_broker_app;

-- Recreate FK constraint on sso_audit_logs pointing to new schema
ALTER TABLE IF EXISTS public.sso_audit_logs
  ADD CONSTRAINT sso_audit_logs_app_id_fkey
  FOREIGN KEY (app_id) REFERENCES access_broker_app.apps(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. Grant permissions on the new schema
-- ============================================================================

GRANT USAGE ON SCHEMA access_broker_app TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA access_broker_app TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA access_broker_app TO authenticated;

-- Grant sequence permissions (for IDENTITY columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA access_broker_app TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA access_broker_app TO authenticated;

-- ============================================================================
-- 4. Update search_path for API roles
-- This ensures tables are discoverable without schema prefix
-- ============================================================================

ALTER ROLE authenticator SET search_path TO public, access_broker_app, extensions;
ALTER ROLE authenticated SET search_path TO public, access_broker_app, extensions;
ALTER ROLE anon SET search_path TO public, access_broker_app, extensions;
ALTER ROLE service_role SET search_path TO public, access_broker_app, extensions;

-- ============================================================================
-- 5. Recreate functions with new schema references
-- All functions need to reference access_broker_app.* instead of public.*
-- ============================================================================

-- ----------------------------------------------------------------------------
-- App Management Functions (from 002_app_configuration_tables.sql)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_all_apps(enabled_only BOOLEAN DEFAULT true)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  description TEXT,
  color TEXT,
  icon TEXT,
  enabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view apps';
  END IF;

  RETURN QUERY
  SELECT a.id, a.name, a.description, a.color, a.icon, a.enabled, a.created_at, a.updated_at
  FROM access_broker_app.apps a
  WHERE NOT enabled_only OR a.enabled = true
  ORDER BY a.name;
END;
$$;

CREATE OR REPLACE FUNCTION create_app(
  p_id TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT true
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  INSERT INTO access_broker_app.apps (id, name, description, color, icon, enabled)
  VALUES (p_id, p_name, p_description, p_color, p_icon, p_enabled);

  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'error: app with this ID already exists';
  WHEN OTHERS THEN
    RETURN 'error: ' || SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION update_app(
  p_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE access_broker_app.apps
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    color = COALESCE(p_color, color),
    icon = COALESCE(p_icon, icon),
    enabled = COALESCE(p_enabled, enabled),
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: app not found';
  END IF;

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION delete_app(p_id TEXT)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM access_broker_app.apps WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: app not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- ----------------------------------------------------------------------------
-- Role Management Functions (from 002_app_configuration_tables.sql)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_app_roles(p_app_id TEXT DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  name TEXT,
  label TEXT,
  description TEXT,
  app_id TEXT,
  is_global BOOLEAN,
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view roles';
  END IF;

  IF p_app_id IS NULL THEN
    RETURN QUERY
    SELECT r.id, r.name, r.label, r.description, r.app_id, r.is_global, r.permissions, r.created_at
    FROM access_broker_app.roles r
    ORDER BY r.is_global DESC, r.label;
  ELSE
    RETURN QUERY
    SELECT r.id, r.name, r.label, r.description, r.app_id, r.is_global, r.permissions, r.created_at
    FROM access_broker_app.roles r
    WHERE r.app_id = p_app_id OR r.is_global = true
    ORDER BY r.is_global DESC, r.label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_global_roles()
RETURNS TABLE(
  id UUID,
  name TEXT,
  label TEXT,
  description TEXT,
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view roles';
  END IF;

  RETURN QUERY
  SELECT r.id, r.name, r.label, r.description, r.permissions, r.created_at
  FROM access_broker_app.roles r
  WHERE r.is_global = true
  ORDER BY r.label;
END;
$$;

CREATE OR REPLACE FUNCTION create_role(
  p_name TEXT,
  p_label TEXT,
  p_description TEXT DEFAULT NULL,
  p_app_id TEXT DEFAULT NULL,
  p_is_global BOOLEAN DEFAULT false,
  p_permissions JSONB DEFAULT '[]'::jsonb
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  IF p_is_global AND p_app_id IS NOT NULL THEN
    RETURN 'error: global roles cannot be app-specific';
  END IF;

  IF NOT p_is_global AND p_app_id IS NULL THEN
    RETURN 'error: non-global roles must have an app_id';
  END IF;

  INSERT INTO access_broker_app.roles (name, label, description, app_id, is_global, permissions)
  VALUES (p_name, p_label, p_description, p_app_id, p_is_global, p_permissions);

  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'error: role with this name already exists for this app';
  WHEN foreign_key_violation THEN
    RETURN 'error: app_id does not exist';
  WHEN OTHERS THEN
    RETURN 'error: ' || SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION update_role(
  p_id UUID,
  p_label TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_permissions JSONB DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE access_broker_app.roles
  SET
    label = COALESCE(p_label, label),
    description = COALESCE(p_description, description),
    permissions = COALESCE(p_permissions, permissions)
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: role not found';
  END IF;

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION delete_role(p_id UUID)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM access_broker_app.roles WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: role not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- ----------------------------------------------------------------------------
-- API Key Functions (from 003_api_keys.sql)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_app_api_keys(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  description TEXT,
  key_hash TEXT,
  role_id UUID,
  role_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  enabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
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
    k.key_hash,
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

CREATE OR REPLACE FUNCTION create_api_key(
  p_app_id TEXT,
  p_name TEXT,
  p_key_hash TEXT,
  p_description TEXT DEFAULT NULL,
  p_role_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
DECLARE
  v_key_id UUID;
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can create api keys';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM access_broker_app.apps WHERE id = p_app_id) THEN
    RAISE EXCEPTION 'app not found';
  END IF;

  IF p_role_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM access_broker_app.roles
      WHERE id = p_role_id
      AND (app_id = p_app_id OR is_global = true)
    ) THEN
      RAISE EXCEPTION 'role not found or not valid for this app';
    END IF;
  END IF;

  INSERT INTO access_broker_app.api_keys (
    app_id, name, description, key_hash, role_id, expires_at, created_by
  )
  VALUES (
    p_app_id, p_name, p_description, p_key_hash, p_role_id, p_expires_at, p_created_by
  )
  RETURNING id INTO v_key_id;

  RETURN v_key_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'api key with this name already exists for this app';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'error: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION update_api_key(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_role_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE access_broker_app.api_keys
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    role_id = COALESCE(p_role_id, role_id),
    expires_at = COALESCE(p_expires_at, expires_at),
    enabled = COALESCE(p_enabled, enabled)
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: api key not found';
  END IF;

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION delete_api_key(p_id UUID)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM access_broker_app.api_keys WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: api key not found';
  END IF;

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE(
  key_id UUID,
  app_id TEXT,
  role_id UUID,
  role_name TEXT,
  permissions JSONB,
  is_valid BOOLEAN
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id as key_id,
    k.app_id,
    k.role_id,
    r.name as role_name,
    r.permissions,
    (
      k.enabled = true
      AND (k.expires_at IS NULL OR k.expires_at > NOW())
    ) as is_valid
  FROM access_broker_app.api_keys k
  LEFT JOIN access_broker_app.roles r ON k.role_id = r.id
  WHERE k.key_hash = p_key_hash;
END;
$$;

CREATE OR REPLACE FUNCTION record_api_key_usage(p_key_hash TEXT)
RETURNS VOID LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  UPDATE access_broker_app.api_keys
  SET last_used_at = NOW()
  WHERE key_hash = p_key_hash;
END;
$$;

-- ----------------------------------------------------------------------------
-- External Key Source Functions (from 004_external_key_sources.sql)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_external_sources(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  source_type TEXT,
  api_url TEXT,
  enabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view external sources';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.app_id,
    s.name,
    s.source_type,
    s.api_url,
    s.enabled,
    s.created_at,
    s.updated_at
  FROM access_broker_app.external_key_sources s
  WHERE s.app_id = p_app_id
  ORDER BY s.name;
END;
$$;

CREATE OR REPLACE FUNCTION get_enabled_external_sources(p_app_id TEXT)
RETURNS TABLE(
  id UUID,
  app_id TEXT,
  name TEXT,
  source_type TEXT,
  api_url TEXT,
  api_credentials TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view external sources';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.app_id,
    s.name,
    s.source_type,
    s.api_url,
    s.api_credentials,
    s.created_at
  FROM access_broker_app.external_key_sources s
  WHERE s.app_id = p_app_id AND s.enabled = true
  ORDER BY s.name;
END;
$$;

CREATE OR REPLACE FUNCTION create_external_source(
  p_app_id TEXT,
  p_name TEXT,
  p_source_type TEXT,
  p_api_url TEXT,
  p_api_credentials TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
DECLARE
  v_source_id UUID;
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can create external sources';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM access_broker_app.apps WHERE id = p_app_id) THEN
    RAISE EXCEPTION 'app not found';
  END IF;

  INSERT INTO access_broker_app.external_key_sources (
    app_id, name, source_type, api_url, api_credentials
  )
  VALUES (
    p_app_id, p_name, p_source_type, p_api_url, p_api_credentials
  )
  RETURNING id INTO v_source_id;

  RETURN v_source_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'external source with this name already exists for this app';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'error: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION update_external_source(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_api_url TEXT DEFAULT NULL,
  p_api_credentials TEXT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE access_broker_app.external_key_sources
  SET
    name = COALESCE(p_name, name),
    api_url = COALESCE(p_api_url, api_url),
    api_credentials = COALESCE(p_api_credentials, api_credentials),
    enabled = COALESCE(p_enabled, enabled),
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: external source not found';
  END IF;

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION delete_external_source(p_id UUID)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public, access_broker_app
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM access_broker_app.external_key_sources WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: external source not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- ----------------------------------------------------------------------------
-- Performance Functions (from 006_performance_optimizations.sql)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, access_broker_app
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
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view dashboard stats';
  END IF;

  SELECT COUNT(*) INTO total_users FROM auth.users;

  SELECT COUNT(*) INTO claims_admins
  FROM auth.users
  WHERE (raw_app_meta_data->>'claims_admin')::boolean = true;

  SELECT COUNT(*) INTO recent_signups
  FROM auth.users
  WHERE created_at > NOW() - INTERVAL '7 days';

  SELECT COUNT(*), COUNT(*) FILTER (WHERE enabled = true)
  INTO total_apps, enabled_apps
  FROM access_broker_app.apps;

  SELECT COUNT(*) INTO total_roles FROM access_broker_app.roles;

  SELECT COUNT(*) INTO total_api_keys FROM access_broker_app.api_keys WHERE enabled = true;

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

-- Note: get_recent_users, get_claim_distribution, and get_users_paginated
-- do not reference the moved tables, so they don't need to be updated

-- ----------------------------------------------------------------------------
-- SSO Audit Log Function (from 009_sso_audit_logs.sql)
-- Update the log_sso_event function to use the new schema reference
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_sso_event(
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_app_id TEXT DEFAULT NULL,
  p_redirect_uri_host TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, access_broker_app
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.sso_audit_logs (
    event_type,
    user_id,
    app_id,
    redirect_uri_host,
    error_code,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_event_type,
    p_user_id,
    p_app_id,
    p_redirect_uri_host,
    p_error_code,
    p_ip_address,
    p_user_agent,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- 6. Notify PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
