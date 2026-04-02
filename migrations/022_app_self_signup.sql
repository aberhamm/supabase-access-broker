-- Migration: 022_app_self_signup
-- Description: Add self-signup configuration columns to apps table.
-- Safe to re-run: Yes (uses IF NOT EXISTS)

ALTER TABLE access_broker_app.apps
ADD COLUMN IF NOT EXISTS allow_self_signup BOOLEAN DEFAULT false;

ALTER TABLE access_broker_app.apps
ADD COLUMN IF NOT EXISTS self_signup_default_role TEXT DEFAULT 'user';

NOTIFY pgrst, 'reload schema';
