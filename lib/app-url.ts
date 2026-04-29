/**
 * Get the application URL for auth redirects.
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (production/staging)
 * 2. window.location.origin (fallback for development)
 *
 * Set NEXT_PUBLIC_APP_URL in production to ensure correct redirects:
 * - Vercel: Set in environment variables
 * - Docker: Set in .env or docker-compose
 * - Other: Set in your deployment configuration
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3050';
}

/**
 * Server-side app URL resolver for route handlers / server actions.
 *
 * In production we require NEXT_PUBLIC_APP_URL — falling back to
 * `x-forwarded-host` / `host` headers means a misconfigured proxy or a
 * client-controlled `Host` header could redirect users to attacker-controlled
 * origins post-login. Throwing fail-fast forces ops to set the env var.
 *
 * In development/test we accept the headers fallback for ergonomics.
 */
export function getServerAppUrl(request?: { headers: Headers }): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is required in production but is not set. ' +
        'Falling back to request headers is unsafe (host-header injection).',
    );
  }

  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    if (forwardedHost) {
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      return `${protocol}://${forwardedHost}`;
    }
    const host = request.headers.get('host');
    if (host) {
      const protocol = host.includes('localhost') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }
  }

  return 'http://localhost:3050';
}
