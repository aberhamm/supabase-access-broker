-- Migration: Add Apple to per-app auth methods
-- Description: Extends apps.auth_methods with an `apple` boolean so apps can
--   allow Sign in with Apple. Backfills existing rows with apple=false and
--   updates the column default to include it.
-- Safe to re-run: Yes (idempotent UPDATE + ALTER DEFAULT).

UPDATE access_broker_app.apps
SET auth_methods = auth_methods || jsonb_build_object('apple', false)
WHERE NOT (auth_methods ? 'apple');

ALTER TABLE access_broker_app.apps
ALTER COLUMN auth_methods SET DEFAULT
  '{"password":true,"magic_link":true,"email_otp":true,"passkeys":true,"google":false,"github":false,"apple":false}'::jsonb;

COMMENT ON COLUMN access_broker_app.apps.auth_methods IS
  'Per-app auth method configuration (NOT NULL). '
  'Structure: { password, magic_link, email_otp, passkeys, google, github, apple } - all boolean. '
  'Each method defaults to false; must be explicitly enabled per app.';

NOTIFY pgrst, 'reload schema';
