import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createAuthCode: vi.fn(),
  validateRedirectUri: vi.fn(),
  isRedirectUriAllowed: vi.fn(),
  logSSOEvent: vi.fn(),
  enforceRateLimit: vi.fn(),
  enforceAuthLimit: vi.fn(),
  getClientIp: vi.fn(),
  adminRpc: vi.fn(),
  adminSingle: vi.fn(),
  adminGetUserById: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/sso-service', () => ({
  createAuthCode: mocks.createAuthCode,
  validateRedirectUri: mocks.validateRedirectUri,
  isRedirectUriAllowed: mocks.isRedirectUriAllowed,
}));

vi.mock('@/lib/audit-service', () => ({
  logSSOEvent: mocks.logSSOEvent,
  extractHostname: (url: string | null | undefined) => {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  },
  extractClientIP: (request: Request) => request.headers.get('x-forwarded-for'),
}));

vi.mock('@/lib/app-url', () => ({
  getAppUrl: () => 'https://broker.test',
}));

vi.mock('@/lib/app-api-rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/auth-rate-limit', () => ({
  enforceAuthLimit: mocks.enforceAuthLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock('@/lib/auth-debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { GET } from '@/app/sso/complete/route';

const APP_ID = 'app-1';
const REDIRECT_URI = 'https://client.test/callback';
const SESSION_USER_ID = 'session-user-123';

function makeRequest(path = `/sso/complete?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=state-1`) {
  return new Request(`https://broker.test${path}`, {
    headers: {
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'vitest',
    },
  });
}

function setSessionUser(appMetadata: Record<string, unknown> = {}) {
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: SESSION_USER_ID,
        email: 'shared@example.com',
        app_metadata: appMetadata,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
  });

  mocks.createAdminClient.mockResolvedValue({
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mocks.adminSingle,
          })),
        })),
      })),
    })),
    rpc: mocks.adminRpc,
    auth: {
      admin: {
        getUserById: mocks.adminGetUserById,
      },
    },
  });

  mocks.createAuthCode.mockResolvedValue('auth-code-123');
  mocks.validateRedirectUri.mockResolvedValue(undefined);
  mocks.isRedirectUriAllowed.mockResolvedValue(true);
  mocks.enforceRateLimit.mockResolvedValue(false);
  mocks.enforceAuthLimit.mockResolvedValue({ allowed: true });
  mocks.getClientIp.mockReturnValue('203.0.113.10');
  setSessionUser({ apps: { [APP_ID]: { enabled: true } } });
});

describe('/sso/complete', () => {
  it('binds self-signup grant and auth code creation to the session user id', async () => {
    setSessionUser({});
    mocks.adminSingle
      .mockResolvedValueOnce({
        data: {
          allow_self_signup: true,
          self_signup_default_role: 'member',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          auth_methods: { password: true },
        },
        error: null,
      });
    mocks.adminRpc.mockResolvedValue({ data: { status: 'OK' }, error: null });
    mocks.adminGetUserById.mockResolvedValue({
      data: {
        user: {
          id: SESSION_USER_ID,
          email: 'shared@example.com',
          app_metadata: { apps: { [APP_ID]: { enabled: true, role: 'member' } } },
        },
      },
    });

    const response = await GET(makeRequest(`/sso/complete?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=state-1&signup=1`));
    const location = new URL(response.headers.get('location')!);

    expect(mocks.adminRpc).toHaveBeenCalledWith('set_app_claims_batch', {
      p_uid: SESSION_USER_ID,
      p_app_id: APP_ID,
      p_claims: { enabled: true, role: 'member' },
    });
    expect(mocks.adminGetUserById).toHaveBeenCalledWith(SESSION_USER_ID);
    expect(mocks.createAuthCode).toHaveBeenCalledWith({
      userId: SESSION_USER_ID,
      appId: APP_ID,
      redirectUri: REDIRECT_URI,
    });
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    expect(location.searchParams.get('code')).toBe('auth-code-123');
    expect(location.searchParams.get('state')).toBe('state-1');
  });

  it('redirects to temporarily_unavailable when the sso-complete limiter denies the request', async () => {
    mocks.enforceAuthLimit.mockResolvedValue({ allowed: false, retryAfterSec: 30 });

    const response = await GET(makeRequest());
    const location = new URL(response.headers.get('location')!);

    expect(mocks.enforceAuthLimit).toHaveBeenCalledWith({
      action: 'sso-complete',
      ip: '203.0.113.10',
      identifier: SESSION_USER_ID,
    });
    expect(mocks.logSSOEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'sso_complete_error',
      userId: SESSION_USER_ID,
      errorCode: 'temporarily_unavailable',
      metadata: { reason: 'rate_limited' },
    }));
    expect(mocks.createAuthCode).not.toHaveBeenCalled();
    expect(location.origin + location.pathname).toBe('https://broker.test/sso/error');
    expect(location.searchParams.get('error')).toBe('temporarily_unavailable');
  });

  it('redirects missing params to invalid_request without consuming the limiter', async () => {
    const response = await GET(makeRequest('/sso/complete?app_id=app-1'));
    const location = new URL(response.headers.get('location')!);

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.enforceAuthLimit).not.toHaveBeenCalled();
    expect(location.origin + location.pathname).toBe('https://broker.test/sso/error');
    expect(location.searchParams.get('error')).toBe('invalid_request');
  });

  it('does not consume the limiter when redirect validation rejects the request', async () => {
    mocks.isRedirectUriAllowed.mockResolvedValue(false);
    mocks.validateRedirectUri.mockRejectedValue(new Error('Invalid redirect_uri'));

    const response = await GET(makeRequest('/sso/complete?app_id=app-1&redirect_uri=not-a-url'));
    const location = new URL(response.headers.get('location')!);

    expect(mocks.validateRedirectUri).toHaveBeenCalledWith({
      appId: APP_ID,
      redirectUri: 'not-a-url',
    });
    expect(mocks.enforceAuthLimit).not.toHaveBeenCalled();
    expect(location.origin + location.pathname).toBe('https://broker.test/sso/error');
    expect(location.searchParams.get('error')).toBe('invalid_request');
  });

  it('redirects users without app claims to access_denied', async () => {
    setSessionUser({});
    mocks.adminSingle.mockResolvedValueOnce({
      data: {
        allow_self_signup: false,
        self_signup_default_role: 'user',
      },
      error: null,
    });

    const response = await GET(makeRequest());
    const location = new URL(response.headers.get('location')!);

    expect(mocks.createAuthCode).not.toHaveBeenCalled();
    expect(location.origin + location.pathname).toBe('https://broker.test/sso/error');
    expect(location.searchParams.get('error')).toBe('access_denied');
  });
});
