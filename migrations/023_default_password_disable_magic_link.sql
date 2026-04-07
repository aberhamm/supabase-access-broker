-- Migration: Default to password sign-in, disable magic link
-- Description: Updates the auth_methods column default and existing apps to enable
--   password sign-in and disable magic link as the standard configuration.
-- Safe to re-run: Yes (idempotent)

-- Step 1: Update existing apps — enable password, disable magic link
UPDATE access_broker_app.apps
SET auth_methods = auth_methods
  || '{"password": true}'::jsonb
  || '{"magic_link": false}'::jsonb;

-- Step 2: Update column default for new apps
ALTER TABLE access_broker_app.apps
ALTER COLUMN auth_methods SET DEFAULT '{"password":true,"magic_link":false,"email_otp":true,"passkeys":true,"google":false,"github":false}'::jsonb;

NOTIFY pgrst, 'reload schema';
