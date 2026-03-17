-- Migration: Backfill auth_methods and add NOT NULL constraint
-- Description: Sets NULL auth_methods to all-false default and prevents future NULLs.
--   Previously NULL was ambiguous — the login page treated it as "allow all platform methods"
--   instead of "no methods configured." This migration makes the semantics explicit.
-- Safe to re-run: Yes (idempotent UPDATE, IF NOT EXISTS-style ALTER)

-- Step 1: Backfill existing NULL rows with all-false defaults
UPDATE access_broker_app.apps
SET auth_methods = '{"password":true,"magic_link":true,"email_otp":true,"passkeys":true,"google":false,"github":false}'::jsonb
WHERE auth_methods IS NULL;

-- Step 2: Set the column default to enable core methods (password, magic link, OTP, passkeys)
ALTER TABLE access_broker_app.apps
ALTER COLUMN auth_methods SET DEFAULT '{"password":true,"magic_link":true,"email_otp":true,"passkeys":true,"google":false,"github":false}'::jsonb;

-- Step 3: Add NOT NULL constraint
ALTER TABLE access_broker_app.apps
ALTER COLUMN auth_methods SET NOT NULL;

-- Update column comment to reflect new semantics
COMMENT ON COLUMN access_broker_app.apps.auth_methods IS
  'Per-app auth method configuration (NOT NULL). '
  'Structure: { password, magic_link, email_otp, passkeys, google, github } - all boolean. '
  'Each method defaults to false; must be explicitly enabled per app.';

NOTIFY pgrst, 'reload schema';
