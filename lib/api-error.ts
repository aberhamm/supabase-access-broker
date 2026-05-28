import { NextResponse } from 'next/server';

/**
 * Create a consistent JSON error response with request-id correlation.
 *
 * All API routes should use this instead of bare `NextResponse.json({ error })`.
 * The `request_id` field lets callers correlate their request to server logs.
 */
export function apiError(
  status: number,
  message: string,
  requestId?: string | null,
  extra?: Record<string, unknown>,
): NextResponse {
  const body: Record<string, unknown> = {
    error: message,
    request_id: requestId ?? null,
    ...extra,
  };

  return NextResponse.json(body, { status });
}
