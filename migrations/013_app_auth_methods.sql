-- Migration: Per-App Auth Methods
-- Description: Adds auth_methods JSONB column to apps table for per-app login method control
-- Safe to re-run: Yes (uses ADD COLUMN IF NOT EXISTS)

ALTER TABLE access_broker_app.apps
ADD COLUMN IF NOT EXISTS auth_methods JSONB DEFAULT NULL;

COMMENT ON COLUMN access_broker_app.apps.auth_methods IS
  'Per-app auth method configuration. NULL = no methods configured (all off). '
  'Structure: { password, magic_link, email_otp, passkeys, google, github } - all boolean. '
  'Each method defaults to false; must be explicitly enabled per app.';

NOTIFY pgrst, 'reload schema';
