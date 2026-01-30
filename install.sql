CREATE OR REPLACE FUNCTION is_claims_admin() RETURNS "bool"
  LANGUAGE "plpgsql"
  AS $$
  BEGIN
    IF session_user = 'authenticator' THEN
      --------------------------------------------
      -- To disallow any authenticated app users
      -- from editing claims, delete the following
      -- block of code and replace it with:
      -- RETURN FALSE;
      --------------------------------------------
      IF extract(epoch from now()) > coalesce((current_setting('request.jwt.claims', true)::jsonb)->>'exp', '0')::numeric THEN
        return false; -- jwt expired
      END IF;
      If current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
        RETURN true; -- service role users have admin rights
      END IF;
      IF coalesce((current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->'claims_admin', 'false')::bool THEN
        return true; -- user has claims_admin set to true
      ELSE
        return false; -- user does NOT have claims_admin set to true
      END IF;
      --------------------------------------------
      -- End of block
      --------------------------------------------
    ELSE -- not a user session, probably being called from a trigger or something
      return true;
    END IF;
  END;
$$;

CREATE OR REPLACE FUNCTION get_my_claims() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select
  	coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata', '{}'::jsonb)::jsonb
$$;
CREATE OR REPLACE FUNCTION get_my_claim(claim TEXT) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select
  	coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' -> claim, null)
$$;

CREATE OR REPLACE FUNCTION get_claims(uid uuid) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE retval jsonb;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN '{"error":"access denied"}'::jsonb;
      ELSE
        select raw_app_meta_data from auth.users into retval where id = uid::uuid;
        return retval;
      END IF;
    END;
$$;

CREATE OR REPLACE FUNCTION get_claim(uid uuid, claim text) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE retval jsonb;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN '{"error":"access denied"}'::jsonb;
      ELSE
        select coalesce(raw_app_meta_data->claim, null) from auth.users into retval where id = uid::uuid;
        return retval;
      END IF;
    END;
$$;

CREATE OR REPLACE FUNCTION set_claim(uid uuid, claim text, value jsonb) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN 'error: access denied';
      ELSE
        update auth.users set raw_app_meta_data =
          raw_app_meta_data ||
            json_build_object(claim, value)::jsonb where id = uid;
        return 'OK';
      END IF;
    END;
$$;

CREATE OR REPLACE FUNCTION delete_claim(uid uuid, claim text) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN 'error: access denied';
      ELSE
        update auth.users set raw_app_meta_data =
          raw_app_meta_data - claim where id = uid;
        return 'OK';
      END IF;
    END;
$$;

-- ============================================================================
-- Multi-App Support Functions (Added in migration 001_multi_app_support.sql)
-- ============================================================================

-- Get all apps a user has access to
CREATE OR REPLACE FUNCTION get_user_apps(uid uuid) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE retval jsonb;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN '{"error":"access denied"}'::jsonb;
      ELSE
        select coalesce(raw_app_meta_data->'apps', '{}'::jsonb) from auth.users into retval where id = uid::uuid;
        return retval;
      END IF;
    END;
$$;

-- Get a specific claim for a specific app
CREATE OR REPLACE FUNCTION get_app_claim(uid uuid, app_id text, claim text) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE retval jsonb;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN '{"error":"access denied"}'::jsonb;
      ELSE
        select coalesce(raw_app_meta_data->'apps'->app_id->claim, null) from auth.users into retval where id = uid::uuid;
        return retval;
      END IF;
    END;
$$;

-- Set a claim for a specific app
CREATE OR REPLACE FUNCTION set_app_claim(uid uuid, app_id text, claim text, value jsonb) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      updated_app jsonb;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN 'error: access denied';
      ELSE
        -- Get current apps object
        select coalesce(raw_app_meta_data->'apps', '{}'::jsonb) from auth.users into current_apps where id = uid;

        -- Get current app object
        current_app := coalesce(current_apps->app_id, '{}'::jsonb);

        -- Update the specific claim in the app
        updated_app := current_app || json_build_object(claim, value)::jsonb;

        -- Update the apps object with the updated app
        current_apps := current_apps || json_build_object(app_id, updated_app)::jsonb;

        -- Update the user's raw_app_meta_data
        update auth.users set raw_app_meta_data =
          raw_app_meta_data ||
            json_build_object('apps', current_apps)::jsonb where id = uid;
        return 'OK';
      END IF;
    END;
$$;

-- Delete a claim from a specific app
CREATE OR REPLACE FUNCTION delete_app_claim(uid uuid, app_id text, claim text) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      updated_app jsonb;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN 'error: access denied';
      ELSE
        -- Get current apps object
        select coalesce(raw_app_meta_data->'apps', '{}'::jsonb) from auth.users into current_apps where id = uid;

        -- Get current app object
        current_app := coalesce(current_apps->app_id, '{}'::jsonb);

        -- Remove the specific claim from the app
        updated_app := current_app - claim;

        -- Update the apps object with the updated app
        current_apps := current_apps || json_build_object(app_id, updated_app)::jsonb;

        -- Update the user's raw_app_meta_data
        update auth.users set raw_app_meta_data =
          raw_app_meta_data ||
            json_build_object('apps', current_apps)::jsonb where id = uid;
        return 'OK';
      END IF;
    END;
$$;

-- Check if current user is admin for a specific app
CREATE OR REPLACE FUNCTION is_app_admin(app_id text) RETURNS "bool"
  LANGUAGE "plpgsql"
  AS $$
  BEGIN
    IF session_user = 'authenticator' THEN
      -- Check JWT expiration
      IF extract(epoch from now()) > coalesce((current_setting('request.jwt.claims', true)::jsonb)->>'exp', '0')::numeric THEN
        return false; -- jwt expired
      END IF;

      -- Service role users have admin rights
      IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
        RETURN true;
      END IF;

      -- Check if user is global claims_admin
      IF coalesce((current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->'claims_admin', 'false')::bool THEN
        return true;
      END IF;

      -- Check if user is admin for the specific app (role='admin')
      IF (current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->'apps'->app_id->>'role' = 'admin' THEN
        return true;
      END IF;

      return false;
    ELSE
      -- Not a user session, probably being called from a trigger or something
      return true;
    END IF;
  END;
$$;

-- List all users who have access to a specific app (app admins only)
CREATE OR REPLACE FUNCTION list_app_users(app_id text) RETURNS TABLE(
  user_id uuid,
  user_email text,
  app_data jsonb
)
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    BEGIN
      -- Check if user is admin for this app (or global admin)
      IF NOT is_app_admin(app_id) THEN
          RAISE EXCEPTION 'access denied';
      ELSE
        RETURN QUERY
        select
          id,
          email,
          coalesce(raw_app_meta_data->'apps'->app_id, '{}'::jsonb) as app_data
        from auth.users
        where raw_app_meta_data->'apps' ? app_id
        order by email;
      END IF;
    END;
$$;

-- ============================================================================
-- App Configuration Tables (Added in migration 002_app_configuration_tables.sql)
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

-- Get all apps
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

-- Create app
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

-- Update app
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

-- Delete app
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

-- Get app roles
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
    RETURN QUERY
    SELECT r.id, r.name, r.label, r.description, r.app_id, r.is_global, r.permissions, r.created_at
    FROM public.roles r
    ORDER BY r.is_global DESC, r.label;
  ELSE
    RETURN QUERY
    SELECT r.id, r.name, r.label, r.description, r.app_id, r.is_global, r.permissions, r.created_at
    FROM public.roles r
    WHERE r.app_id = p_app_id OR r.is_global = true
    ORDER BY r.is_global DESC, r.label;
  END IF;
END;
$$;

-- Get global roles
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

-- Create role
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

  IF p_is_global AND p_app_id IS NOT NULL THEN
    RETURN 'error: global roles cannot be app-specific';
  END IF;

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

-- Update role
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

-- Delete role
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

-- Paginated user listing for performance
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

-- User Lookup Function (Migration 011)
-- Allows looking up users by ID, email, or telegram_id for SSO client apps
CREATE OR REPLACE FUNCTION lookup_user_by_identifier(
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_telegram_id BIGINT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  email TEXT,
  raw_app_meta_data JSONB
) SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Lookup user by one of the provided identifiers
  -- The API endpoint ensures only one identifier is passed
  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.raw_app_meta_data
  FROM auth.users u
  WHERE
    (p_user_id IS NOT NULL AND u.id = p_user_id)
    OR (p_email IS NOT NULL AND lower(u.email) = lower(p_email))
    OR (p_telegram_id IS NOT NULL AND
        (u.raw_app_meta_data->'telegram'->>'id') IS NOT NULL AND
        (u.raw_app_meta_data->'telegram'->>'id') ~ '^[0-9]+$' AND
        (u.raw_app_meta_data->'telegram'->>'id')::BIGINT = p_telegram_id)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION lookup_user_by_identifier TO service_role;

COMMENT ON FUNCTION lookup_user_by_identifier IS
  'Looks up a user by user_id, email, or telegram_id. Used by /api/users/lookup endpoint for SSO client apps.';

NOTIFY pgrst, 'reload schema';
