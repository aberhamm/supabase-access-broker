/**
 * Utilities for safe redirect handling to prevent open redirect vulnerabilities.
 */

/**
 * Sanitize a `next` parameter to prevent open redirect attacks.
 * Only allows:
 * - Relative paths starting with a single `/`
 * - Paths that don't start with `//`, `http://`, `https://`
 * - Properly handles URL-encoded variants
 *
 * @param next - The next path from query params
 * @param fallback - Fallback path if next is invalid (default: '/')
 * @returns Safe path to redirect to
 */
export function safeNextPath(next: string | null | undefined, fallback: string = '/'): string {
  if (!next || typeof next !== 'string') {
    return fallback;
  }

  // Trim whitespace
  const trimmed = next.trim();
  if (!trimmed) {
    return fallback;
  }

  // Decode URL-encoded characters to check for hidden attacks
  let decoded: string;
  try {
    // Decode multiple times to catch double-encoding attacks
    decoded = trimmed;
    for (let i = 0; i < 3; i++) {
      const newDecoded = decodeURIComponent(decoded);
      if (newDecoded === decoded) break;
      decoded = newDecoded;
    }
  } catch {
    // If decoding fails, treat as suspicious
    return fallback;
  }

  // Normalize the decoded path
  const normalized = decoded.toLowerCase();

  // Block absolute URLs (protocol-relative or with protocol)
  if (
    normalized.startsWith('//') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:')
  ) {
    return fallback;
  }

  // Block backslashes (can be interpreted as forward slashes in some contexts)
  if (decoded.includes('\\')) {
    return fallback;
  }

  // Must start with a single forward slash (relative path)
  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  // Ensure it doesn't start with // after the first character check
  if (trimmed.startsWith('//')) {
    return fallback;
  }

  // The path is safe - return the original (not decoded) to preserve encoding
  return trimmed;
}

/**
 * List of allowed internal paths for portal flows.
 * Used to identify SSO/account portal routes that don't require admin access.
 */
export const PORTAL_PATHS = ['/sso/', '/account', '/refresh-session', '/access-denied'] as const;

/**
 * Check if a path is a portal route (SSO, account, etc.)
 */
export function isPortalPath(path: string): boolean {
  const safePath = safeNextPath(path);
  return PORTAL_PATHS.some((prefix) => safePath.startsWith(prefix));
}

