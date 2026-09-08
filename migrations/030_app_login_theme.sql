-- Additive only. Existing apps RLS and grants continue to restrict writes to
-- claims_admin; no anonymous SELECT policy or SECURITY DEFINER RPC is added.
ALTER TABLE access_broker_app.apps ADD COLUMN IF NOT EXISTS login_theme jsonb;
ALTER TABLE access_broker_app.apps DROP CONSTRAINT IF EXISTS apps_login_theme_shape;
ALTER TABLE access_broker_app.apps ADD CONSTRAINT apps_login_theme_shape CHECK (
  login_theme IS NULL OR (
    jsonb_typeof(login_theme) = 'object'
    AND login_theme->>'version' = '1'
    AND octet_length(login_theme::text) <= 4096
  ) IS TRUE
);
COMMENT ON COLUMN access_broker_app.apps.login_theme IS
  'Approved versioned login palette. Application validates exact keys, hex colors and contrast on write and read. NULL uses existing color and shared defaults. Assets are fixed bundled IDs from apps.icon; no URLs or CSS.';
NOTIFY pgrst, 'reload schema';
