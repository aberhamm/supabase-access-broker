/**
 * In-memory sliding window rate limiter.
 *
 * Each key (e.g. API key hash) gets a window of timestamps.
 * Requests older than the window are pruned on each check.
 * Resets on process restart — acceptable for Next.js serverless.
 */

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

// Periodically clean up stale entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      windows.delete(key);
    }
  }
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g. API key hash or app_id)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Window size in milliseconds
 * @returns Object with `allowed`, `remaining`, and `resetAt` (epoch ms)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  cleanup(windowMs);

  let entry = windows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }

  // Prune old timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  const remaining = Math.max(0, maxRequests - entry.timestamps.length);
  const resetAt = entry.timestamps.length > 0 ? entry.timestamps[0] + windowMs : now + windowMs;

  if (entry.timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: remaining - 1, resetAt };
}
