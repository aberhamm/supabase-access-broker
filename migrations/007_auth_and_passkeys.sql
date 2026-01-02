-- Migration: Auth Portal (SSO codes) + Passkeys (WebAuthn)
-- Description: Adds tables needed for passkeys and cross-domain SSO code exchange
-- Safe to re-run: Yes (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ============================================================================
-- Apps: allowed callback URLs + optional client secret hash for SSO exchange
-- ============================================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS allowed_callback_urls TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS sso_client_secret_hash TEXT;

-- ============================================================================
-- Passkeys
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT false,
  transports TEXT[],
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT unique_user_credential UNIQUE (user_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON public.passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credential_id ON public.passkey_credentials(credential_id);

ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own passkeys" ON public.passkey_credentials;
DROP POLICY IF EXISTS "Users can insert own passkeys" ON public.passkey_credentials;
DROP POLICY IF EXISTS "Users can update own passkeys" ON public.passkey_credentials;
DROP POLICY IF EXISTS "Users can delete own passkeys" ON public.passkey_credentials;

CREATE POLICY "Users can view own passkeys"
  ON public.passkey_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own passkeys"
  ON public.passkey_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own passkeys"
  ON public.passkey_credentials
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own passkeys"
  ON public.passkey_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Challenges are short-lived and should only be accessed by server code (service role).
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenge_expires ON public.passkey_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_passkey_challenge_user_type ON public.passkey_challenges(user_id, type);

ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;

-- No policies: only service role can access

-- ============================================================================
-- SSO auth codes (short-lived, single-use)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_code_unused ON public.auth_codes(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON public.auth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_codes_app_id ON public.auth_codes(app_id);

ALTER TABLE public.auth_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service role can access

NOTIFY pgrst, 'reload schema';
