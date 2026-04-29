/**
 * Rate-limit helpers for unauthenticated auth-portal paths (login submit,
 * OTP send, password reset send, passkey challenge generation, signup
 * auto-grant).
 *
 * We compose two independent limits per action:
 *   - per-IP: defends against a single source spraying attempts
 *   - per-identifier (email/app_id): defends against a distributed sweep
 *     of one target
 *
 * Both limits are checked; the first to trip rate-limits the request.
 */

import { checkRateLimit } from '@/lib/rate-limit';

export type AuthLimitAction =
  | 'login'
  | 'otp-send'
  | 'password-reset'
  | 'passkey-options'
  | 'signup-grant';

const LIMITS: Record<AuthLimitAction, { ip: { max: number; windowMs: number }; id: { max: number; windowMs: number } }> = {
  login:           { ip: { max: 20,  windowMs: 60_000 },  id: { max: 10,  windowMs: 60_000 } },
  'otp-send':      { ip: { max: 10,  windowMs: 60_000 },  id: { max: 5,   windowMs: 60_000 } },
  'password-reset':{ ip: { max: 5,   windowMs: 300_000 }, id: { max: 3,   windowMs: 300_000 } },
  'passkey-options':{ ip: { max: 30, windowMs: 60_000 },  id: { max: 30,  windowMs: 60_000 } },
  'signup-grant':  { ip: { max: 10,  windowMs: 60_000 },  id: { max: 5,   windowMs: 60_000 } },
};

export type AuthLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

/**
 * Extract the client IP from request headers. Falls back to "unknown" if
 * the request did not pass through a proxy that sets x-forwarded-for.
 *
 * NOTE: trusts x-forwarded-for. Only meaningful behind a trusted reverse
 * proxy (the production deploy is behind one). In environments without a
 * trusted proxy a malicious client can spoof this — but the email-keyed
 * limit still applies.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export async function enforceAuthLimit(params: {
  action: AuthLimitAction;
  ip: string;
  identifier?: string | null;
}): Promise<AuthLimitResult> {
  const { action, ip, identifier } = params;
  const cfg = LIMITS[action];
  const now = Date.now();

  const ipResult = await checkRateLimit(
    `auth:${action}:ip:${ip}`,
    cfg.ip.max,
    cfg.ip.windowMs,
  );

  let earliestReset = ipResult.resetAt;
  let blocked = !ipResult.allowed;

  if (identifier) {
    const idResult = await checkRateLimit(
      `auth:${action}:id:${identifier.toLowerCase()}`,
      cfg.id.max,
      cfg.id.windowMs,
    );
    if (!idResult.allowed) {
      blocked = true;
      earliestReset = Math.min(earliestReset, idResult.resetAt);
    }
  }

  if (blocked) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((earliestReset - now) / 1000)),
    };
  }

  return { allowed: true };
}
