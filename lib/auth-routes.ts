export const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/auth/confirm',
  '/auth/logout',
  '/auth/passkey-complete',
  '/reset-password',
  '/api/auth/',
  '/api/health',
  // Bypasses middleware session auth for all /api/apps/* routes.
  // These endpoints handle their own auth:
  //   - auth-methods: intentionally public (used by login page)
  //   - users, claims, invite: API key / app_secret via authenticateAppRequest()
  //   - roles: session auth via getUser() (dashboard endpoint)
  // WARNING: Any new route under /api/apps/ MUST implement its own auth check.
  '/api/apps/',
  // Bypasses middleware session auth for /api/users/* routes.
  // These endpoints handle their own auth via authenticateAppRequest().
  '/api/users/',
  '/demo/',
] as const;

export const PORTAL_ROUTE_PREFIXES = [
  '/sso/',
  '/account',
  '/refresh-session',
  '/access-denied',
] as const;
