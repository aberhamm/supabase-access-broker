/**
 * Postgres-backed rate limiter.
 *
 * Limits are stored in access_broker_app.rate_limits and consumed atomically
 * via the consume_rate_limit RPC. Survives process restarts and is shared
 * across replicas.
 *
 * Bucket key is composed by the caller — typical patterns:
 *   - "login:ip:1.2.3.4"
 *   - "login:email:user@example.com"
 *   - "passkey-options:ip:1.2.3.4"
 *   - "app-api:write:<api_key_hash>"
 *
 * On RPC failure (DB unavailable) we fail OPEN — refusing requests when the
 * DB is down would create a self-inflicted DoS. Failures are logged so they
 * surface in monitoring.
 */

import { createAdminClient } from '@/lib/supabase/server';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
  hits: number;
};

export async function checkRateLimit(
  bucket: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .schema('access_broker_app')
      .rpc('consume_rate_limit', {
        p_bucket: bucket,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds,
      });

    if (error) {
      console.error('[rate-limit] consume_rate_limit RPC error — failing open:', {
        bucket,
        error: error.message,
      });
      return failOpen(maxRequests, windowMs);
    }

    const row = (data ?? null) as
      | { allowed: boolean; hits: number; remaining: number; reset_at: number }
      | null;

    if (!row) {
      console.error('[rate-limit] consume_rate_limit returned no row — failing open:', { bucket });
      return failOpen(maxRequests, windowMs);
    }

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: row.reset_at * 1000,
      hits: row.hits,
    };
  } catch (e) {
    console.error('[rate-limit] consume_rate_limit threw — failing open:', {
      bucket,
      error: e instanceof Error ? e.message : String(e),
    });
    return failOpen(maxRequests, windowMs);
  }
}

function failOpen(maxRequests: number, windowMs: number): RateLimitResult {
  return {
    allowed: true,
    remaining: maxRequests,
    resetAt: Date.now() + windowMs,
    hits: 0,
  };
}
