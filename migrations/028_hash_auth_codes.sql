-- Migration: Hash SSO auth codes at rest.
--
-- Stores only SHA-256 hex digests in access_broker_app.auth_codes.code.
-- Plaintext auth codes are still returned to client applications through the
-- redirect URL, but the database no longer stores redeemable plaintext codes.
--
-- Safe to re-run: YES (idempotent; NOTE: re-running invalidates in-flight
-- logins for up to 5 minutes).

BEGIN;

-- Existing plaintext rows are short-lived but may have persisted indefinitely
-- if cleanup did not run. Wipe them instead of attempting a transition.
DELETE FROM access_broker_app.auth_codes;

COMMENT ON COLUMN access_broker_app.auth_codes.code IS
  'SHA-256 hex digest of the auth code (plaintext is never stored)';

ALTER TABLE access_broker_app.auth_codes
  DROP CONSTRAINT IF EXISTS auth_codes_code_is_sha256;

ALTER TABLE access_broker_app.auth_codes
  ADD CONSTRAINT auth_codes_code_is_sha256
  CHECK (code ~ '^[0-9a-f]{64}$');

COMMIT;
