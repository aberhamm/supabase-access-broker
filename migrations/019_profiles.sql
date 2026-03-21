-- Migration: Profiles Table
-- Description: Moves public.profiles into access_broker_app schema, extends it,
-- adds bidirectional sync triggers with auth.users.raw_user_meta_data,
-- and backfills missing users.
--
-- Design decisions (from eng review 2026-03-20):
--   1. Profiles table is source of truth for identity data
--   2. Bidirectional triggers sync display_name/avatar_url with auth.users.raw_user_meta_data
--   3. Guard flag (SET LOCAL) prevents trigger recursion
--   4. Eager profile creation on auth.users INSERT
--   5. Fill-not-overwrite: auth→profiles trigger only populates NULL fields
--   6. Split fail model: auth→profiles (ingest) = fail-safe; profiles→auth (write-back) = fail-hard
--   7. FK constraints from other schemas (wine, chatbot) are dropped entirely
--
-- Safe to re-run: NO - this migration should only be run once

-- ============================================================================
-- 1. Drop FK constraints from other schemas that reference public.profiles
-- ============================================================================

ALTER TABLE IF EXISTS chatbot.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_user_id_fkey;

ALTER TABLE IF EXISTS chatbot.organization_users
  DROP CONSTRAINT IF EXISTS fk_org_users_user;

ALTER TABLE IF EXISTS wine.geometry_import_jobs
  DROP CONSTRAINT IF EXISTS geometry_import_jobs_created_by_fkey;

ALTER TABLE IF EXISTS wine.region_map_geometry_versions
  DROP CONSTRAINT IF EXISTS region_map_geometry_versions_created_by_fkey;

ALTER TABLE IF EXISTS wine.region_map_geometry_versions
  DROP CONSTRAINT IF EXISTS region_map_geometry_versions_published_by_fkey;

ALTER TABLE IF EXISTS wine.geometry_import_review_items
  DROP CONSTRAINT IF EXISTS geometry_import_review_items_resolved_by_fkey;

ALTER TABLE IF EXISTS wine.region_name_aliases
  DROP CONSTRAINT IF EXISTS region_name_aliases_created_by_fkey;

ALTER TABLE IF EXISTS wine.region_match_suppressions
  DROP CONSTRAINT IF EXISTS region_match_suppressions_created_by_fkey;

-- ============================================================================
-- 2. Drop any existing triggers on public.profiles (cleanup old app triggers)
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS sync_user_from_profile ON public.profiles;

-- Drop the old trigger functions if they exist
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.sync_user_from_profile() CASCADE;

-- ============================================================================
-- 3. Move public.profiles to access_broker_app schema
-- ============================================================================

ALTER TABLE public.profiles SET SCHEMA access_broker_app;

-- ============================================================================
-- 4. Rename full_name → display_name (broker convention)
-- ============================================================================

ALTER TABLE access_broker_app.profiles
  RENAME COLUMN full_name TO display_name;

-- ============================================================================
-- 5. Extend the table with new columns
-- ============================================================================

-- Add created_at if it doesn't exist
ALTER TABLE access_broker_app.profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add new profile fields
ALTER TABLE access_broker_app.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Rename 'id' to 'user_id' for clarity (it's a FK to auth.users.id)
ALTER TABLE access_broker_app.profiles
  RENAME COLUMN id TO user_id;

-- Rename the PK constraint if it exists
ALTER INDEX IF EXISTS profiles_pkey RENAME TO profiles_user_id_pkey;

-- ============================================================================
-- 6. Grants and RLS
-- ============================================================================

-- Grants (match pattern from migration 010)
GRANT ALL ON access_broker_app.profiles TO service_role;
GRANT SELECT, UPDATE ON access_broker_app.profiles TO authenticated;

-- Enable RLS (may already be enabled from original table)
ALTER TABLE access_broker_app.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any old RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON access_broker_app.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON access_broker_app.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON access_broker_app.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON access_broker_app.profiles;
DROP POLICY IF EXISTS "Service role full access" ON access_broker_app.profiles;
-- Drop any policies that might have existed on the old public.profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON access_broker_app.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON access_broker_app.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON access_broker_app.profiles;

-- Self-service: users can read and update their own profile
CREATE POLICY "Users can view own profile"
  ON access_broker_app.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON access_broker_app.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins: can view and update any profile
CREATE POLICY "Admins can view all profiles"
  ON access_broker_app.profiles FOR SELECT
  USING (is_claims_admin());

CREATE POLICY "Admins can update all profiles"
  ON access_broker_app.profiles FOR UPDATE
  USING (is_claims_admin());

-- Service role needs INSERT for triggers and backfill
CREATE POLICY "Service role full access"
  ON access_broker_app.profiles FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
    OR session_user != 'authenticator'
  );

-- ============================================================================
-- 7. updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION access_broker_app.set_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON access_broker_app.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON access_broker_app.profiles
  FOR EACH ROW
  EXECUTE FUNCTION access_broker_app.set_profiles_updated_at();

-- ============================================================================
-- 8. Bidirectional sync triggers with guard flag
-- ============================================================================

-- 8a. profiles → auth.users sync (write-back)
-- FAILS HARD — this is our write path, we control it
CREATE OR REPLACE FUNCTION access_broker_app.sync_profile_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, access_broker_app
AS $$
BEGIN
  -- Guard flag: skip if we're already syncing (prevents recursion)
  IF current_setting('access_broker.syncing', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Set guard flag before writing to auth.users
  PERFORM set_config('access_broker.syncing', 'true', true);

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'display_name', NEW.display_name,
      'avatar_url', NEW.avatar_url
    )
  WHERE id = NEW.user_id;

  -- Reset guard flag
  PERFORM set_config('access_broker.syncing', 'false', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_to_auth ON access_broker_app.profiles;
CREATE TRIGGER sync_profile_to_auth
  AFTER UPDATE OF display_name, avatar_url ON access_broker_app.profiles
  FOR EACH ROW
  WHEN (
    OLD.display_name IS DISTINCT FROM NEW.display_name
    OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
  )
  EXECUTE FUNCTION access_broker_app.sync_profile_to_auth();


-- 8b. auth.users → profiles sync (ingest from OAuth / sign-up)
-- FAIL-SAFE on sign-up path — never block registration
-- Fill-not-overwrite: only populate NULL fields
CREATE OR REPLACE FUNCTION access_broker_app.sync_auth_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, access_broker_app
AS $$
DECLARE
  v_display_name TEXT;
  v_avatar_url TEXT;
  v_email TEXT;
BEGIN
  -- Guard flag: skip if we're already syncing (prevents recursion)
  IF current_setting('access_broker.syncing', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Set guard flag
  PERFORM set_config('access_broker.syncing', 'true', true);

  -- Extract profile fields from user_metadata
  v_display_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  )), '');
  v_avatar_url := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  )), '');
  v_email := NEW.email;

  IF TG_OP = 'INSERT' THEN
    -- New user: create profile row (eager creation)
    INSERT INTO access_broker_app.profiles (user_id, display_name, avatar_url, email, created_at)
    VALUES (NEW.id, v_display_name, v_avatar_url, v_email, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Existing user: fill-not-overwrite (only populate NULL fields)
    UPDATE access_broker_app.profiles
    SET
      display_name = CASE WHEN display_name IS NULL THEN v_display_name ELSE display_name END,
      avatar_url = CASE WHEN avatar_url IS NULL THEN v_avatar_url ELSE avatar_url END,
      email = COALESCE(v_email, email)
    WHERE user_id = NEW.id;
  END IF;

  -- Reset guard flag
  PERFORM set_config('access_broker.syncing', 'false', true);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Fail-safe: log warning but never block auth operations
    RAISE WARNING 'access_broker_app.sync_auth_to_profile failed for user %: %', NEW.id, SQLERRM;
    PERFORM set_config('access_broker.syncing', 'false', true);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_auth_to_profile ON auth.users;
CREATE TRIGGER sync_auth_to_profile
  AFTER INSERT OR UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION access_broker_app.sync_auth_to_profile();

-- ============================================================================
-- 9. RPC functions for profile CRUD
-- ============================================================================

-- Get a user's profile (admin or self)
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  email TEXT,
  timezone TEXT,
  locale TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, access_broker_app
AS $$
BEGIN
  -- Allow self-access or admin access
  IF NOT is_claims_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id, p.display_name, p.first_name, p.last_name,
    p.avatar_url, p.email, p.timezone, p.locale,
    p.metadata, p.created_at, p.updated_at
  FROM access_broker_app.profiles p
  WHERE p.user_id = p_user_id;
END;
$$;

-- Update a user's profile (admin or self)
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_display_name TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_locale TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, access_broker_app
AS $$
BEGIN
  -- Allow self-access or admin access
  IF NOT is_claims_admin() AND auth.uid() != p_user_id THEN
    RETURN 'error: access denied';
  END IF;

  UPDATE access_broker_app.profiles
  SET
    display_name = COALESCE(p_display_name, display_name),
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    timezone = COALESCE(p_timezone, timezone),
    locale = COALESCE(p_locale, locale),
    metadata = COALESCE(p_metadata, metadata)
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'error: profile not found';
  END IF;

  RETURN 'OK';
END;
$$;

-- ============================================================================
-- 10. Backfill: create profiles for all existing users who don't have one
-- ============================================================================

INSERT INTO access_broker_app.profiles (user_id, display_name, avatar_url, email, created_at)
SELECT
  u.id,
  NULLIF(TRIM(COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    ''
  )), ''),
  NULLIF(TRIM(COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    ''
  )), ''),
  u.email,
  COALESCE(u.created_at, NOW())
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM access_broker_app.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 11. Notify PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
