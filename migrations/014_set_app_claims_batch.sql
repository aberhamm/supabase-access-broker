-- Migration: Batch App Claims Update
-- Description: Adds set_app_claims_batch() for atomic multi-claim updates.
-- Returns the updated app claims and a server-side timestamp.
-- Safe to re-run: Yes (uses CREATE OR REPLACE)

-- Set multiple claims for a specific app in a single atomic operation.
--
-- p_claims is a JSONB object whose keys are claim names and values are the
-- new claim values, e.g. {"enabled": true, "role": "admin", "permissions": ["read"]}
--
-- Transaction flow:
--   1. Read current app_metadata.apps[app_id] (or {} if absent)
--   2. Merge each key from p_claims into the app object
--   3. Write the updated app object back to raw_app_meta_data
--   4. Return { status, updated_at, app_claims }
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
      claim_key text;
      ts timestamptz;
    BEGIN
      IF NOT is_claims_admin() THEN
          RETURN json_build_object('status', 'error: access denied')::jsonb;
      END IF;

      -- Get current apps object
      SELECT coalesce(raw_app_meta_data->'apps', '{}'::jsonb)
        FROM auth.users INTO current_apps WHERE id = p_uid;

      IF NOT FOUND THEN
          RETURN json_build_object('status', 'error: user not found')::jsonb;
      END IF;

      -- Get current app object (or empty)
      current_app := coalesce(current_apps->p_app_id, '{}'::jsonb);

      -- Merge all claims from p_claims into the app object
      updated_app := current_app || p_claims;

      -- Update the apps object with the updated app
      current_apps := current_apps || json_build_object(p_app_id, updated_app)::jsonb;

      -- Write back to user metadata
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

NOTIFY pgrst, 'reload schema';
