import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  createAdminClient: vi.fn(),
  consumeAuthCode: vi.fn(),
  authenticateAppRequest: vi.fn(),
  logSSOEvent: vi.fn(),
  extractAppClaims: vi.fn(),
  getUserById: vi.fn(),
  profileSingle: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/sso-service', () => ({
  consumeAuthCode: mocks.consumeAuthCode,
}));

vi.mock('@/lib/app-api-auth', () => ({
  authenticateAppRequest: mocks.authenticateAppRequest,
}));

vi.mock('@/lib/audit-service', () => ({
  logSSOEvent: mocks.logSSOEvent,
}));

vi.mock('@/lib/app-api-validation', () => ({
  extractAppClaims: mocks.extractAppClaims,
}));

vi.mock('@/lib/auth-debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { POST } from '@/app/api/auth/exchange/route';

const APP_ID = 'demo-app';
const REDIRECT_URI = 'https://client.test/callback';

function makeRequest(body: unknown): Request {
  return new Request('https://broker.test/api/auth/exchange', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vitest',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.headers.mockResolvedValue(new Headers({ 'x-request-id': 'req-123' }));
  mocks.authenticateAppRequest.mockResolvedValue({
    ok: true,
    appId: APP_ID,
    authMethod: 'app_secret',
    ipAddress: '203.0.113.10',
    userAgent: 'vitest',
  });
  mocks.consumeAuthCode.mockResolvedValue({ userId: 'user-1', redirectUri: REDIRECT_URI });
  mocks.getUserById.mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        app_metadata: { apps: { [APP_ID]: { enabled: true, role: 'member' } } },
      },
    },
    error: null,
  });
  mocks.extractAppClaims.mockReturnValue({ enabled: true, role: 'member' });
  mocks.profileSingle.mockResolvedValue({
    data: {
      display_name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
      avatar_url: null,
      timezone: 'UTC',
      locale: 'en',
    },
  });
  mocks.createAdminClient.mockResolvedValue({
    auth: {
      admin: {
        getUserById: mocks.getUserById,
      },
    },
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mocks.profileSingle,
          })),
        })),
      })),
    })),
  });
});

describe('/api/auth/exchange', () => {
  it('rejects missing redirect_uri before authenticating or consuming a code', async () => {
    const response = await POST(makeRequest({
      code: 'plain-code',
      app_id: APP_ID,
      app_secret: 'secret',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Missing required parameters: code, app_id, and redirect_uri',
      request_id: 'req-123',
      error_code: 'invalid_request',
    });
    expect(mocks.authenticateAppRequest).not.toHaveBeenCalled();
    expect(mocks.consumeAuthCode).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.logSSOEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'token_exchange_error',
      appId: APP_ID,
      errorCode: 'invalid_request',
      metadata: {
        reason: 'missing_required_params',
        has_code: true,
        has_app_id: true,
        has_redirect_uri: false,
      },
    }));
  });

  it('authenticates the app, consumes the code with redirect_uri, and returns user claims', async () => {
    const response = await POST(makeRequest({
      code: 'plain-code',
      app_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      app_secret: 'secret',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.authenticateAppRequest).toHaveBeenCalledWith(
      expect.any(Request),
      APP_ID,
      expect.objectContaining({
        code: 'plain-code',
        app_id: APP_ID,
        redirect_uri: REDIRECT_URI,
      }),
      { auditEventType: 'token_exchange_error' }
    );
    expect(mocks.consumeAuthCode).toHaveBeenCalledWith({
      code: 'plain-code',
      appId: APP_ID,
      redirectUri: REDIRECT_URI,
    });
    expect(body).toEqual({
      user: {
        id: 'user-1',
        email: 'user@example.com',
      },
      profile: {
        display_name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        avatar_url: null,
        timezone: 'UTC',
        locale: 'en',
      },
      app_id: APP_ID,
      app_claims: { enabled: true, role: 'member' },
      expires_in: 300,
    });
    expect(mocks.logSSOEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'token_exchange_success',
      appId: APP_ID,
      userId: 'user-1',
      metadata: { auth_method: 'app_secret' },
    }));
  });

  it('returns auth failures directly without consuming the code', async () => {
    mocks.authenticateAppRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Invalid app_secret' }, { status: 401 }),
    });

    const response = await POST(makeRequest({
      code: 'plain-code',
      app_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      app_secret: 'wrong',
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid app_secret' });
    expect(mocks.consumeAuthCode).not.toHaveBeenCalled();
  });

  it('returns a generic invalid-code response without exposing raw consume errors', async () => {
    mocks.consumeAuthCode.mockRejectedValue(new Error('Invalid or expired code: SECRET_CODE_VALUE'));

    const response = await POST(makeRequest({
      code: 'SECRET_CODE_VALUE',
      app_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      app_secret: 'secret',
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Invalid or expired code',
      request_id: 'req-123',
      error_code: 'invalid_code',
    });
    expect(JSON.stringify(body)).not.toContain('SECRET_CODE_VALUE');
    expect(mocks.logSSOEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'token_exchange_error',
      appId: APP_ID,
      errorCode: 'invalid_code',
      metadata: { error_message: 'Invalid or expired code: SECRET_CODE_VALUE' },
    }));
  });

  it('rejects a resolved user id mismatch with a generic server error', async () => {
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'other-user',
          email: 'other@example.com',
          app_metadata: {},
        },
      },
      error: null,
    });

    const response = await POST(makeRequest({
      code: 'plain-code',
      app_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      app_secret: 'secret',
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Internal server error',
      request_id: 'req-123',
      error_code: 'server_error',
    });
    expect(mocks.logSSOEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'token_exchange_user_id_mismatch',
      appId: APP_ID,
      userId: 'user-1',
      errorCode: 'user_id_mismatch',
      metadata: {
        expected_user_id: 'user-1',
        actual_user_id: 'other-user',
        email: 'other@example.com',
      },
    }));
  });
});
