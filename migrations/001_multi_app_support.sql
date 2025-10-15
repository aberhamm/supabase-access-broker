-- Migration: Multi-App Claims Support
-- Description: Adds RPC functions for managing app-scoped claims
-- Safe to re-run: Yes (uses CREATE OR REPLACE)

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

      -- Check if user is admin for the specific app
      IF coalesce((current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->'apps'->app_id->>'admin', 'false')::bool THEN
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

NOTIFY pgrst, 'reload schema';
