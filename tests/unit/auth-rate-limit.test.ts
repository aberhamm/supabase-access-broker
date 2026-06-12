import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { enforceAuthLimit, getClientIp } from '@/lib/auth-rate-limit';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 1,
    resetAt: Date.now() + 60_000,
    hits: 1,
  });
});

describe('auth rate limits', () => {
  it('checks sso-complete per IP and per authenticated user id', async () => {
    const result = await enforceAuthLimit({
      action: 'sso-complete',
      ip: '203.0.113.7',
      identifier: 'USER-123',
    });

    expect(result).toEqual({ allowed: true });
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      1,
      'auth:sso-complete:ip:203.0.113.7',
      30,
      60_000
    );
    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(
      2,
      'auth:sso-complete:id:user-123',
      10,
      60_000
    );
  });

  it('prefers Cloudflare client IP before x-forwarded-for', () => {
    const headers = new Headers({
      'cf-connecting-ip': '198.51.100.42',
      'x-forwarded-for': '203.0.113.7, 203.0.113.8',
      'x-real-ip': '192.0.2.9',
    });

    expect(getClientIp(headers)).toBe('198.51.100.42');
  });
});
