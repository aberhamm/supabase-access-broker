/**
 * Password policy: length floor + HIBP k-anonymity breach check.
 *
 * The HIBP check uses the public Pwned Passwords range API
 * (https://api.pwnedpasswords.com/range/{first5}) which receives only the
 * first 5 hex chars of the SHA-1 — the full hash never leaves this process.
 *
 * Network failures are non-blocking: if HIBP is unreachable we accept the
 * password (we don't want to lock people out because a third-party API is
 * down). The length/structure check is enforced unconditionally.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const HIBP_TIMEOUT_MS = 2500;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validatePasswordShape(password: string): PasswordValidationResult {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Password is required.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  return { ok: true };
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Returns true iff the password appears in the HIBP breach corpus.
 * Returns false on any error (fail-open) — caller decides whether to log.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

    let body: string;
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        signal: controller.signal,
        headers: { 'Add-Padding': 'true' },
      });
      if (!res.ok) return false;
      body = await res.text();
    } finally {
      clearTimeout(timer);
    }

    for (const line of body.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (!hashSuffix) continue;
      if (hashSuffix.toUpperCase() === suffix) {
        const count = Number.parseInt(countStr ?? '0', 10);
        return count > 0;
      }
    }
    return false;
  } catch {
    // Network/abort/parse error — fail open.
    return false;
  }
}

export async function validatePassword(password: string): Promise<PasswordValidationResult> {
  const shape = validatePasswordShape(password);
  if (!shape.ok) return shape;

  const breached = await isPasswordBreached(password);
  if (breached) {
    return {
      ok: false,
      error: 'This password has appeared in a public data breach. Please choose a different password.',
    };
  }

  return { ok: true };
}
