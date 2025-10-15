-- Migration: Database-Backed App Configuration
-- Description: Creates tables and functions for managing apps and roles dynamically
-- Safe to re-run: Yes (uses CREATE TABLE IF NOT EXISTS and CREATE OR REPLACE)

-- ============================================================================
-- Tables
-- ============================================================================

-- Apps table
CREATE TABLE IF NOT EXISTS public.apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles table (can be global or app-specific)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  app_id TEXT REFERENCES public.apps(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, app_id)
);

-- Enable RLS
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "claims_admin can manage apps" ON public.apps;
DROP POLICY IF EXISTS "claims_admin can manage roles" ON public.roles;

-- Policies (only admins can manage)
CREATE POLICY "claims_admin can manage apps"
  ON public.apps FOR ALL
  USING (is_claims_admin());

CREATE POLICY "claims_admin can manage roles"
  ON public.roles FOR ALL
  USING (is_claims_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_roles_app_id ON public.roles(app_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_global ON public.roles(is_global);
CREATE INDEX IF NOT EXISTS idx_apps_enabled ON public.apps(enabled);

-- ============================================================================
-- RPC Functions for Apps
-- ============================================================================

-- Get all apps (optionally filter by enabled status)
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
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view apps';
  END IF;

  RETURN QUERY
  SELECT a.id, a.name, a.description, a.color, a.icon, a.enabled, a.created_at, a.updated_at
  FROM public.apps a
  WHERE NOT enabled_only OR a.enabled = true
  ORDER BY a.name;
END;
$$;

-- Create a new app
CREATE OR REPLACE FUNCTION create_app(
  p_id TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT true
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  INSERT INTO public.apps (id, name, description, color, icon, enabled)
  VALUES (p_id, p_name, p_description, p_color, p_icon, p_enabled);

  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'error: app with this ID already exists';
  WHEN OTHERS THEN
    RETURN 'error: ' || SQLERRM;
END;
$$;

-- Update an existing app
CREATE OR REPLACE FUNCTION update_app(
  p_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE public.apps
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

-- Delete an app
CREATE OR REPLACE FUNCTION delete_app(p_id TEXT)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM public.apps WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: app not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- ============================================================================
-- RPC Functions for Roles
-- ============================================================================

-- Get all roles for a specific app (or global roles)
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
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view roles';
  END IF;

  IF p_app_id IS NULL THEN
    -- Return all roles
    RETURN QUERY
    SELECT r.id, r.name, r.label, r.description, r.app_id, r.is_global, r.permissions, r.created_at
    FROM public.roles r
    ORDER BY r.is_global DESC, r.label;
  ELSE
    -- Return roles for specific app plus global roles
    RETURN QUERY
    SELECT r.id, r.name, r.label, r.description, r.app_id, r.is_global, r.permissions, r.created_at
    FROM public.roles r
    WHERE r.app_id = p_app_id OR r.is_global = true
    ORDER BY r.is_global DESC, r.label;
  END IF;
END;
$$;

-- Get only global roles
CREATE OR REPLACE FUNCTION get_global_roles()
RETURNS TABLE(
  id UUID,
  name TEXT,
  label TEXT,
  description TEXT,
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RAISE EXCEPTION 'access denied: only claims admins can view roles';
  END IF;

  RETURN QUERY
  SELECT r.id, r.name, r.label, r.description, r.permissions, r.created_at
  FROM public.roles r
  WHERE r.is_global = true
  ORDER BY r.label;
END;
$$;

-- Create a new role
CREATE OR REPLACE FUNCTION create_role(
  p_name TEXT,
  p_label TEXT,
  p_description TEXT DEFAULT NULL,
  p_app_id TEXT DEFAULT NULL,
  p_is_global BOOLEAN DEFAULT false,
  p_permissions JSONB DEFAULT '[]'::jsonb
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  -- Validate: global roles cannot have app_id
  IF p_is_global AND p_app_id IS NOT NULL THEN
    RETURN 'error: global roles cannot be app-specific';
  END IF;

  -- Validate: non-global roles must have app_id
  IF NOT p_is_global AND p_app_id IS NULL THEN
    RETURN 'error: non-global roles must have an app_id';
  END IF;

  INSERT INTO public.roles (name, label, description, app_id, is_global, permissions)
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

-- Update an existing role
CREATE OR REPLACE FUNCTION update_role(
  p_id UUID,
  p_label TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_permissions JSONB DEFAULT NULL
) RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE public.roles
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

-- Delete a role
CREATE OR REPLACE FUNCTION delete_role(p_id UUID)
RETURNS TEXT LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_claims_admin() THEN
    RETURN 'error: access denied';
  END IF;

  DELETE FROM public.roles WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: role not found';
  END IF;

  RETURN 'OK';
END;
$$;

NOTIFY pgrst, 'reload schema';
