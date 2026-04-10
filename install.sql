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

-- Set a claim for a specific app (claims_admin OR admin for this app)
CREATE OR REPLACE FUNCTION set_app_claim(uid uuid, app_id text, claim text, value jsonb) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      updated_app jsonb;
    BEGIN
      IF NOT (is_claims_admin() OR is_app_admin(app_id)) THEN
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

-- Delete a claim from a specific app (claims_admin OR admin for this app)
CREATE OR REPLACE FUNCTION delete_app_claim(uid uuid, app_id text, claim text) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      updated_app jsonb;
    BEGIN
      IF NOT (is_claims_admin() OR is_app_admin(app_id)) THEN
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

-- Paginated version of list_app_users with server-side search and incremental sync (migrations 016-017)
CREATE OR REPLACE FUNCTION list_app_users_paginated(
  app_id text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT '',
  p_since timestamptz DEFAULT NULL
)
 RETURNS TABLE(user_id uuid, user_email text, app_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    DECLARE
      v_total bigint;
    BEGIN
      IF NOT is_app_admin(app_id) THEN
          RAISE EXCEPTION 'access denied';
      END IF;

      SELECT count(*) INTO v_total
      FROM auth.users
      WHERE raw_app_meta_data->'apps' ? app_id
        AND (raw_app_meta_data->'apps'->app_id->>'enabled')::boolean = true
        AND (p_search = '' OR email::text ILIKE '%' || p_search || '%')
        AND (p_since IS NULL OR updated_at > p_since);

      RETURN QUERY
      SELECT
        id,
        email::text,
        coalesce(raw_app_meta_data->'apps'->app_id, '{}'::jsonb),
        v_total
      FROM auth.users
      WHERE raw_app_meta_data->'apps' ? app_id
        AND (raw_app_meta_data->'apps'->app_id->>'enabled')::boolean = true
        AND (p_search = '' OR email::text ILIKE '%' || p_search || '%')
        AND (p_since IS NULL OR updated_at > p_since)
      ORDER BY email
      LIMIT p_limit
      OFFSET p_offset;
    END;
$$;

-- Atomic batch update of multiple app claims (migration 014_set_app_claims_batch.sql,
-- 024_app_claim_metadata_and_admin_auth.sql).
-- Accepts any subset of { enabled, role, permissions, metadata } in p_claims;
-- merges them into apps[p_app_id] in a single statement. Authorized for
-- claims_admin OR admin for the target app.
CREATE OR REPLACE FUNCTION set_app_claims_batch(
  p_uid uuid,
  p_app_id text,
  p_claims jsonb
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      updated_app jsonb;
      ts timestamptz;
    BEGIN
      IF NOT (is_claims_admin() OR is_app_admin(p_app_id)) THEN
          RETURN json_build_object('status', 'error: access denied')::jsonb;
      END IF;

      SELECT coalesce(raw_app_meta_data->'apps', '{}'::jsonb)
        FROM auth.users INTO current_apps WHERE id = p_uid;

      IF NOT FOUND THEN
          RETURN json_build_object('status', 'error: user not found')::jsonb;
      END IF;

      current_app := coalesce(current_apps->p_app_id, '{}'::jsonb);
      updated_app := current_app || p_claims;
      current_apps := current_apps || json_build_object(p_app_id, updated_app)::jsonb;

      UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data || json_build_object('apps', current_apps)::jsonb
        WHERE id = p_uid;

      ts := now();

      RETURN json_build_object(
        'status', 'OK',
        'updated_at', ts,
        'app_claims', updated_app
      )::jsonb;
    END;
$$;

-- Per-key metadata mutators (migration 024_app_claim_metadata_and_admin_auth.sql).
-- The portal admin UI writes custom app claims through apps[app_id].metadata[key]
-- so they remain addressable via the PATCH /claims API's `metadata` field.
-- These RPCs do atomic read-modify-write so concurrent edits on different keys
-- of the same user/app don't clobber each other.
CREATE OR REPLACE FUNCTION set_app_metadata_claim(
  p_uid uuid,
  p_app_id text,
  p_key text,
  p_value jsonb
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      current_metadata jsonb;
      updated_metadata jsonb;
      updated_app jsonb;
      ts timestamptz;
    BEGIN
      IF NOT (is_claims_admin() OR is_app_admin(p_app_id)) THEN
          RETURN json_build_object('status', 'error: access denied')::jsonb;
      END IF;

      IF p_key IS NULL OR length(p_key) = 0 THEN
          RETURN json_build_object('status', 'error: empty metadata key')::jsonb;
      END IF;

      SELECT coalesce(raw_app_meta_data->'apps', '{}'::jsonb)
        FROM auth.users INTO current_apps WHERE id = p_uid;

      IF NOT FOUND THEN
          RETURN json_build_object('status', 'error: user not found')::jsonb;
      END IF;

      current_app := coalesce(current_apps->p_app_id, '{}'::jsonb);
      current_metadata := coalesce(current_app->'metadata', '{}'::jsonb);
      updated_metadata := current_metadata || json_build_object(p_key, p_value)::jsonb;
      updated_app := current_app || json_build_object('metadata', updated_metadata)::jsonb;
      current_apps := current_apps || json_build_object(p_app_id, updated_app)::jsonb;

      UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data || json_build_object('apps', current_apps)::jsonb
        WHERE id = p_uid;

      ts := now();

      RETURN json_build_object(
        'status', 'OK',
        'updated_at', ts,
        'app_claims', updated_app
      )::jsonb;
    END;
$$;

CREATE OR REPLACE FUNCTION delete_app_metadata_claim(
  p_uid uuid,
  p_app_id text,
  p_key text
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path = public
    AS $$
    DECLARE
      current_apps jsonb;
      current_app jsonb;
      current_metadata jsonb;
      updated_metadata jsonb;
      updated_app jsonb;
      ts timestamptz;
    BEGIN
      IF NOT (is_claims_admin() OR is_app_admin(p_app_id)) THEN
          RETURN json_build_object('status', 'error: access denied')::jsonb;
      END IF;

      IF p_key IS NULL OR length(p_key) = 0 THEN
          RETURN json_build_object('status', 'error: empty metadata key')::jsonb;
      END IF;

      SELECT coalesce(raw_app_meta_data->'apps', '{}'::jsonb)
        FROM auth.users INTO current_apps WHERE id = p_uid;

      IF NOT FOUND THEN
          RETURN json_build_object('status', 'error: user not found')::jsonb;
      END IF;

      current_app := coalesce(current_apps->p_app_id, '{}'::jsonb);
      current_metadata := coalesce(current_app->'metadata', '{}'::jsonb);
      updated_metadata := current_metadata - p_key;
      updated_app := current_app || json_build_object('metadata', updated_metadata)::jsonb;
      current_apps := current_apps || json_build_object(p_app_id, updated_app)::jsonb;

      UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data || json_build_object('apps', current_apps)::jsonb
        WHERE id = p_uid;

      ts := now();

      RETURN json_build_object(
        'status', 'OK',
        'updated_at', ts,
        'app_claims', updated_app
      )::jsonb;
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

-- ============================================================================
-- Profiles Table (Migration 019)
-- Canonical user identity data, owned by the access broker.
-- ============================================================================

CREATE TABLE IF NOT EXISTS access_broker_app.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  email TEXT,
  timezone TEXT,
  locale TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grants
GRANT ALL ON access_broker_app.profiles TO service_role;
GRANT SELECT, UPDATE ON access_broker_app.profiles TO authenticated;

-- RLS
ALTER TABLE access_broker_app.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON access_broker_app.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON access_broker_app.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON access_broker_app.profiles FOR SELECT
  USING (is_claims_admin());

CREATE POLICY "Admins can update all profiles"
  ON access_broker_app.profiles FOR UPDATE
  USING (is_claims_admin());

CREATE POLICY "Service role full access"
  ON access_broker_app.profiles FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
    OR session_user != 'authenticator'
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION access_broker_app.set_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON access_broker_app.profiles
  FOR EACH ROW
  EXECUTE FUNCTION access_broker_app.set_profiles_updated_at();

-- profiles → auth.users sync (write-back, fails hard)
CREATE OR REPLACE FUNCTION access_broker_app.sync_profile_to_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, access_broker_app AS $$
BEGIN
  IF current_setting('access_broker.syncing', true) = 'true' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('access_broker.syncing', 'true', true);
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('display_name', NEW.display_name, 'avatar_url', NEW.avatar_url)
  WHERE id = NEW.user_id;
  PERFORM set_config('access_broker.syncing', 'false', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_profile_to_auth
  AFTER UPDATE OF display_name, avatar_url ON access_broker_app.profiles
  FOR EACH ROW
  WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url)
  EXECUTE FUNCTION access_broker_app.sync_profile_to_auth();

-- auth.users → profiles sync (ingest, fail-safe)
CREATE OR REPLACE FUNCTION access_broker_app.sync_auth_to_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, access_broker_app AS $$
DECLARE
  v_display_name TEXT;
  v_avatar_url TEXT;
BEGIN
  IF current_setting('access_broker.syncing', true) = 'true' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('access_broker.syncing', 'true', true);
  v_display_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), '');
  v_avatar_url := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')), '');
  IF TG_OP = 'INSERT' THEN
    INSERT INTO access_broker_app.profiles (user_id, display_name, avatar_url, email, created_at)
    VALUES (NEW.id, v_display_name, v_avatar_url, NEW.email, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE access_broker_app.profiles
    SET display_name = CASE WHEN display_name IS NULL THEN v_display_name ELSE display_name END,
        avatar_url = CASE WHEN avatar_url IS NULL THEN v_avatar_url ELSE avatar_url END,
        email = COALESCE(NEW.email, email)
    WHERE user_id = NEW.id;
  END IF;
  PERFORM set_config('access_broker.syncing', 'false', true);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'access_broker_app.sync_auth_to_profile failed for user %: %', NEW.id, SQLERRM;
    PERFORM set_config('access_broker.syncing', 'false', true);
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_auth_to_profile
  AFTER INSERT OR UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION access_broker_app.sync_auth_to_profile();

-- Profile CRUD RPC
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE(
  user_id UUID, display_name TEXT, first_name TEXT, last_name TEXT,
  avatar_url TEXT, email TEXT, timezone TEXT, locale TEXT,
  metadata JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, access_broker_app AS $$
BEGIN
  IF NOT is_claims_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  RETURN QUERY SELECT p.user_id, p.display_name, p.first_name, p.last_name,
    p.avatar_url, p.email, p.timezone, p.locale, p.metadata, p.created_at, p.updated_at
  FROM access_broker_app.profiles p WHERE p.user_id = get_user_profile.p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID, p_display_name TEXT DEFAULT NULL, p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL, p_locale TEXT DEFAULT NULL, p_metadata JSONB DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, access_broker_app AS $$
BEGIN
  IF NOT is_claims_admin() AND auth.uid() != p_user_id THEN
    RETURN 'error: access denied';
  END IF;
  UPDATE access_broker_app.profiles SET
    display_name = COALESCE(p_display_name, display_name),
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    timezone = COALESCE(p_timezone, timezone),
    locale = COALESCE(p_locale, locale),
    metadata = COALESCE(p_metadata, metadata)
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN 'error: profile not found'; END IF;
  RETURN 'OK';
END;
$$;

NOTIFY pgrst, 'reload schema';
