export const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/auth/callback',
  '/auth/confirm',
  '/auth/logout',
  '/reset-password',
  '/api/auth/',
  '/api/health',
  '/api/apps/',
  '/demo/',
] as const;

export const PORTAL_ROUTE_PREFIXES = [
  '/sso/',
  '/account',
  '/refresh-session',
  '/access-denied',
] as const;
