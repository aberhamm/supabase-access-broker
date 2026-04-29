import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

const WINDOW_MS = 60_000; // 1 minute

const RATE_LIMITS = {
  read: 60,
  write: 30,
} as const;

export type RateLimitTier = keyof typeof RATE_LIMITS;

/**
 * Enforce rate limiting for app-facing API requests.
 *
 * Call after authentication. Uses the auth method identifier
 * (API key hash or app_id for secret-based auth) as the rate limit key.
 *
 * @returns null if allowed, or a 429 NextResponse if rate limited.
 */
export async function enforceRateLimit(
  key: string,
  tier: RateLimitTier,
): Promise<NextResponse | null> {
  const maxRequests = RATE_LIMITS[tier];
  const { allowed, resetAt } = await checkRateLimit(
    `app-api:${tier}:${key}`,
    maxRequests,
    WINDOW_MS,
  );

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, retryAfter)),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        },
      },
    );
  }

  return null;
}
