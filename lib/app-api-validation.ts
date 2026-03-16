/**
 * Shared validation and extraction helpers for app-facing API endpoints.
 */

/**
 * Basic email format check.
 * Not a full RFC 5322 validator — catches obvious garbage before hitting Supabase.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Validate the values for allowed claim keys.
 * Returns an error message string if invalid, null if valid.
 */
export function validateClaimValues(body: Record<string, unknown>): string | null {
  if ('enabled' in body && typeof body.enabled !== 'boolean') {
    return 'enabled must be a boolean';
  }
  if ('role' in body) {
    if (typeof body.role !== 'string' || body.role.length === 0 || body.role.length > 64) {
      return 'role must be a non-empty string ≤ 64 characters';
    }
  }
  if ('permissions' in body) {
    const perms = body.permissions;
    if (
      !Array.isArray(perms) ||
      perms.length > 100 ||
      !perms.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 128)
    ) {
      return 'permissions must be an array of ≤ 100 non-empty strings, each ≤ 128 characters';
    }
  }
  if ('metadata' in body) {
    if (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata)) {
      return 'metadata must be a JSON object';
    }
    const serialized = JSON.stringify(body.metadata);
    if (serialized.length > 8192) {
      return 'metadata must not exceed 8 KB';
    }
  }
  return null;
}

/**
 * Extract app-specific claims from a Supabase user object.
 * Returns null if the user has no claims for the given app.
 */
export function extractAppClaims(
  user: { app_metadata: Record<string, unknown> },
  appId: string
): Record<string, unknown> | null {
  const apps = user.app_metadata?.apps as Record<string, unknown> | undefined;
  return (apps?.[appId] ?? null) as Record<string, unknown> | null;
}
