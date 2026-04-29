-- Migration: Postgres-backed rate limiter
-- Replaces lib/rate-limit.ts in-process Map so limits survive process restarts
-- and are shared across replicas.
-- Safe to re-run: YES.

BEGIN;

-- ============================================================================
-- Table: access_broker_app.rate_limits
-- One row per (bucket) where `bucket` is an arbitrary string composed by the
-- caller (e.g. "login:ip:1.2.3.4", "passkey-options:ip:1.2.3.4",
-- "app-api:write:<api_key_hash>"). Window state is rolled atomically inside
-- consume_rate_limit() — old rows are reset, never deleted on the hot path.
-- ============================================================================

CREATE TABLE IF NOT EXISTS access_broker_app.rate_limits (
  bucket text PRIMARY KEY,
  hits int NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_reset_at_idx
  ON access_broker_app.rate_limits (reset_at);

ALTER TABLE access_broker_app.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON access_broker_app.rate_limits;
CREATE POLICY "service_role_only" ON access_broker_app.rate_limits
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- ============================================================================
-- Function: access_broker_app.consume_rate_limit
-- Atomically increments the bucket and returns whether the request is within
-- the configured limit. Window rolls when reset_at has passed.
--
-- Returns jsonb: { allowed, hits, remaining, reset_at }
--   reset_at is epoch seconds (number).
-- ============================================================================

CREATE OR REPLACE FUNCTION access_broker_app.consume_rate_limit(
  p_bucket text,
  p_max_requests int,
  p_window_seconds int
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := now();
  v_reset_at timestamptz;
  v_hits int;
BEGIN
  IF p_bucket IS NULL OR length(p_bucket) = 0 THEN
    RAISE EXCEPTION 'bucket must be non-empty';
  END IF;
  IF p_max_requests IS NULL OR p_max_requests <= 0 THEN
    RAISE EXCEPTION 'max_requests must be positive';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'window_seconds must be positive';
  END IF;

  INSERT INTO access_broker_app.rate_limits (bucket, hits, reset_at, updated_at)
  VALUES (p_bucket, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  ON CONFLICT (bucket) DO UPDATE SET
    hits = CASE
      WHEN access_broker_app.rate_limits.reset_at <= v_now THEN 1
      ELSE access_broker_app.rate_limits.hits + 1
    END,
    reset_at = CASE
      WHEN access_broker_app.rate_limits.reset_at <= v_now
        THEN v_now + make_interval(secs => p_window_seconds)
      ELSE access_broker_app.rate_limits.reset_at
    END,
    updated_at = v_now
  RETURNING hits, reset_at INTO v_hits, v_reset_at;

  RETURN jsonb_build_object(
    'allowed', v_hits <= p_max_requests,
    'hits', v_hits,
    'remaining', GREATEST(0, p_max_requests - v_hits),
    'reset_at', extract(epoch from v_reset_at)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION access_broker_app.consume_rate_limit(text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION access_broker_app.consume_rate_limit(text, int, int) FROM anon;
REVOKE ALL ON FUNCTION access_broker_app.consume_rate_limit(text, int, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION access_broker_app.consume_rate_limit(text, int, int) TO service_role;

-- ============================================================================
-- Function: access_broker_app.cleanup_rate_limits
-- Removes rows whose window expired more than the grace period ago. Safe to
-- run from a scheduled job (pg_cron, external cron, or on-demand) — the
-- consume function does not depend on cleanup for correctness.
-- ============================================================================

CREATE OR REPLACE FUNCTION access_broker_app.cleanup_rate_limits(
  p_grace_seconds int DEFAULT 3600
) RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM access_broker_app.rate_limits
  WHERE reset_at < now() - make_interval(secs => p_grace_seconds);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION access_broker_app.cleanup_rate_limits(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION access_broker_app.cleanup_rate_limits(int) FROM anon;
REVOKE ALL ON FUNCTION access_broker_app.cleanup_rate_limits(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION access_broker_app.cleanup_rate_limits(int) TO service_role;

COMMIT;
