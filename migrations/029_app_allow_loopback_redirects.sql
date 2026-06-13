-- Migration: 029_app_allow_loopback_redirects
-- Description: Per-app opt-in to accept any loopback redirect_uri
--   (http://localhost or http://127.0.0.1, any port/path) WITHOUT an exact
--   allowed_callback_urls match. The loopback host is still strictly enforced
--   (host === 'localhost' || '127.0.0.1'); only the exact-path/port allowlist
--   step is bypassed. Intended for native / public PKCE clients during local
--   development (RFC 8252 loopback flow). Do NOT enable for confidential
--   clients that exchange codes with a client secret.
-- Safe to re-run: Yes (uses IF NOT EXISTS)

ALTER TABLE access_broker_app.apps
ADD COLUMN IF NOT EXISTS allow_loopback_redirects BOOLEAN DEFAULT false;

COMMENT ON COLUMN access_broker_app.apps.allow_loopback_redirects IS
  'When true, any http://localhost or http://127.0.0.1 redirect_uri (any port/path) is accepted for this app without an exact allowed_callback_urls match. The loopback host is still strictly enforced. For native/public PKCE clients in local dev only — do NOT enable for confidential clients.';

NOTIFY pgrst, 'reload schema';
