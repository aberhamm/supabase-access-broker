-- Migration: SSO App Columns
-- Description: Adds SSO-related columns to the apps table for callback URL validation and client secrets
-- Safe to re-run: Yes (uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS)

-- ============================================================================
-- Add SSO columns to apps table
-- ============================================================================

-- Array of allowed callback URLs for SSO redirect validation
ALTER TABLE public.apps
ADD COLUMN IF NOT EXISTS allowed_callback_urls TEXT[] DEFAULT '{}';

-- Hashed client secret for secure SSO code exchange (bcrypt hash)
ALTER TABLE public.apps
ADD COLUMN IF NOT EXISTS sso_client_secret_hash TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.apps.allowed_callback_urls IS 'Allowlist of callback URLs for SSO redirect validation. Empty array means no URL validation (less secure).';
COMMENT ON COLUMN public.apps.sso_client_secret_hash IS 'Bcrypt-hashed client secret for SSO code exchange. NULL means no secret required.';

NOTIFY pgrst, 'reload schema';
