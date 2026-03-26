-- Migration: Security Hardening
-- Date: 2026-03-26
-- Addresses audit findings: Critical #2, #3, High #4, #5, #6, #10, Medium #17
-- Safe to re-run: YES (all statements are idempotent via IF EXISTS / CREATE OR REPLACE)

BEGIN;

-- ============================================================================
-- 1. Enable RLS on passkey_challenges (High #4)
-- Previously disabled; combined with schema-wide SELECT grant to authenticated,
-- any authenticated user could read unexpired passkey challenges.
-- ============================================================================

ALTER TABLE access_broker_app.passkey_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON access_broker_app.passkey_challenges;
CREATE POLICY "service_role_only" ON access_broker_app.passkey_challenges
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- ============================================================================
-- 2. Tighten function permissions (High #5)
-- validate_api_key() and record_api_key_usage() had PUBLIC execute (PostgreSQL
-- default). Only service_role should call these — the app uses createAdminClient().
-- ============================================================================

REVOKE ALL ON FUNCTION validate_api_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_api_key(text) FROM anon;
REVOKE ALL ON FUNCTION validate_api_key(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION validate_api_key(text) TO service_role;

REVOKE ALL ON FUNCTION record_api_key_usage(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_api_key_usage(text) FROM anon;
REVOKE ALL ON FUNCTION record_api_key_usage(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION record_api_key_usage(text) TO service_role;

-- ============================================================================
-- 3. Restrict log_sso_event to service_role only (High #6)
-- Was granted to authenticated, allowing any logged-in user to insert
-- fabricated audit log entries via the SECURITY DEFINER function.
-- ============================================================================

REVOKE ALL ON FUNCTION public.log_sso_event(text, uuid, text, text, text, inet, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_sso_event(text, uuid, text, text, text, inet, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_sso_event(text, uuid, text, text, text, inet, text, jsonb) TO service_role;

-- ============================================================================
-- 4. Remove anon role access to access_broker_app schema (High #10)
-- No public-facing query path needs anon access. The auth-methods endpoint
-- uses createAdminClient() (service_role) as of commit 2ae09ea.
-- ============================================================================

REVOKE USAGE ON SCHEMA access_broker_app FROM anon;

-- ============================================================================
-- 5. Fix SSO audit log RLS policy JWT path (Medium #17)
-- Policy checked top-level 'claims_admin' but the actual claim is nested at
-- app_metadata.claims_admin. This meant the SELECT policy never matched for
-- admin users via PostgREST.
-- ============================================================================

DROP POLICY IF EXISTS "Claims admins can read SSO audit logs" ON public.sso_audit_logs;
CREATE POLICY "Claims admins can read SSO audit logs"
  ON public.sso_audit_logs
  FOR SELECT
  USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb)->'app_metadata'->'claims_admin',
      'false'
    )::bool = true
  );

-- ============================================================================
-- 6. Atomic auth code consumption (Critical #2, Critical #3)
-- Replaces the non-atomic SELECT+UPDATE in consumeAuthCode() with an atomic
-- UPDATE...RETURNING INTO that prevents race conditions.
-- Optionally verifies redirect_uri against the stored value (Critical #3).
-- ============================================================================

CREATE OR REPLACE FUNCTION access_broker_app.consume_auth_code(
  p_code TEXT,
  p_app_id TEXT,
  p_redirect_uri TEXT DEFAULT NULL
)
RETURNS TABLE(out_user_id UUID, out_redirect_uri TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = access_broker_app
AS $$
DECLARE
  v_user_id UUID;
  v_redirect_uri TEXT;
BEGIN
  UPDATE access_broker_app.auth_codes ac
  SET used_at = NOW()
  WHERE ac.code = p_code
    AND ac.app_id = p_app_id
    AND ac.used_at IS NULL
    AND ac.expires_at > NOW()
    AND (p_redirect_uri IS NULL OR ac.redirect_uri = p_redirect_uri)
  RETURNING ac.user_id, ac.redirect_uri
  INTO v_user_id, v_redirect_uri;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired code';
  END IF;

  out_user_id := v_user_id;
  out_redirect_uri := v_redirect_uri;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION access_broker_app.consume_auth_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION access_broker_app.consume_auth_code(text, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
