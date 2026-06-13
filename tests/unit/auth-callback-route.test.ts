import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/app-url', () => ({
  getServerAppUrl: () => 'https://broker.test',
}));

vi.mock('@/lib/auth-debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

import { GET } from '@/app/auth/callback/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  });
});

describe('/auth/callback error redirects', () => {
  it('forwards provider error codes without raw provider descriptions', async () => {
    const next = encodeURIComponent(
      '/sso/complete?app_id=app-1&redirect_uri=https%3A%2F%2Fclient.test%2Fcallback&state=state-1'
    );
    const response = await GET(
      new Request(
        `https://broker.test/auth/callback?error=access_denied&error_code=otp_expired&error_description=INJECTED_TEXT&next=${next}`
      )
    );
    const location = new URL(response.headers.get('location')!);

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(location.origin + location.pathname).toBe('https://broker.test/login');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('error_code')).toBe('otp_expired');
    expect(location.searchParams.get('error_description')).toBeNull();
    expect(location.searchParams.toString()).not.toContain('INJECTED_TEXT');
    expect(location.searchParams.get('app_id')).toBe('app-1');
    expect(location.searchParams.get('redirect_uri')).toBe('https://client.test/callback');
  });

  it('does not forward exchange failure messages to login redirects', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: 'INJECTED_INTERNAL_PROVIDER_DETAIL' },
    });

    const response = await GET(new Request('https://broker.test/auth/callback?code=bad-code&next=/account'));
    const location = new URL(response.headers.get('location')!);

    expect(location.origin + location.pathname).toBe('https://broker.test/login');
    expect(location.searchParams.get('error')).toBe('code_exchange_failed');
    expect(location.searchParams.get('error_description')).toBeNull();
    expect(location.searchParams.toString()).not.toContain('INJECTED_INTERNAL_PROVIDER_DETAIL');
  });
});
