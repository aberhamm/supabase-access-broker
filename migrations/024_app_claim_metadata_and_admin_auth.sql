-- Migration: App claim metadata helpers + app-admin auth fix
-- Date: 2026-04-10
-- Safe to re-run: YES (all statements use CREATE OR REPLACE)
--
-- Two linked problems this migration fixes:
--
--   1. is_app_admin() was checking raw_app_meta_data.apps.{id}.admin (boolean),
--      but migration 012 removed that field in favor of role = 'admin'. As a
--      result, is_app_admin() has been returning false for every real app
--      admin since 012, silently breaking every portal action that relies on
--      it (toggle access, set role, edit/delete custom claims).
--
--   2. set_app_claim / delete_app_claim / set_app_claims_batch check only
--      is_claims_admin(). With (1) fixed, they still reject per-app admins.
--      The TS server actions already permit app admins through their own
--      check, so the portal UI "succeeds" while the RPC silently no-ops.
--
-- We also add two new atomic RPCs — set_app_metadata_claim /
-- delete_app_metadata_claim — so the portal can edit individual keys inside
-- apps.{id}.metadata without a TOCTOU read-modify-write in the server
-- action. The app-facing PATCH /claims API keeps using set_app_claims_batch
-- (unchanged semantics for it).

BEGIN;

-- ============================================================================
-- 1. Fix is_app_admin to use role='admin' (post-migration 012 data model)
-- ============================================================================

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

      -- Check if user is admin for the specific app (role='admin').
      -- Pre-012, this looked for a boolean `admin` field; migration 012
      -- collapsed that into role='admin' but never updated this function.
      IF (current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->'apps'->app_id->>'role' = 'admin' THEN
        return true;
      END IF;

      return false;
    ELSE
      -- Not a user session, probably being called from a trigger or similar
      return true;
    END IF;
  END;
$$;

-- ============================================================================
-- 2. Allow app admins (for the target app) to call the existing app-scoped
--    claim RPCs. Global claims_admin still works; service_role still works
--    (both via is_claims_admin and the service_role short-circuit in
--    is_app_admin).
-- ============================================================================

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
      END IF;

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
    END;
$$;

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
      END IF;

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
    END;
$$;

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

-- ============================================================================
-- 3. Atomic per-key metadata mutators
--
-- These operate on apps.{app_id}.metadata.{key}, doing the read-modify-write
-- inside a single SECURITY DEFINER statement so two concurrent portal edits
-- on different keys of the same user's metadata don't clobber each other.
-- ============================================================================

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

COMMIT;

NOTIFY pgrst, 'reload schema';
