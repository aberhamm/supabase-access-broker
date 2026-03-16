import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/api-keys-service', () => ({
  validateApiKey: vi.fn(),
  recordApiKeyUsage: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/sso-service', () => ({
  getSsoAppAuthConfig: vi.fn(),
  sha256Hex: vi.fn((input: string) => `hashed_${input}`),
  timingSafeEqualHex: vi.fn((a: string, b: string) => a === b),
}));

vi.mock('@/lib/audit-service', () => ({
  extractClientIP: vi.fn(() => '127.0.0.1'),
  logSSOEvent: vi.fn(),
}));

import { authenticateAppRequest } from '@/lib/app-api-auth';
import { validateApiKey, recordApiKeyUsage } from '@/lib/api-keys-service';
import { getSsoAppAuthConfig } from '@/lib/sso-service';
import { logSSOEvent } from '@/lib/audit-service';

const APP_ID = 'test-app-id';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/apps/test-app-id/users', {
    headers: {
      'user-agent': 'test-agent',
      ...headers,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticateAppRequest', () => {
  describe('API key auth', () => {
    it('T1: authenticates with valid API key', async () => {
      vi.mocked(validateApiKey).mockResolvedValue({
        key_id: 'key-1',
        app_id: APP_ID,
        role_id: null,
        role_name: null,
        permissions: undefined,
        is_valid: true,
      });

      const result = await authenticateAppRequest(
        makeRequest({ authorization: 'Bearer sk_test123' }),
        APP_ID
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.authMethod).toBe('api_key');
        expect(result.appId).toBe(APP_ID);
        expect(result.ipAddress).toBe('127.0.0.1');
        expect(result.userAgent).toBe('test-agent');
      }
      expect(recordApiKeyUsage).toHaveBeenCalledWith('sk_test123');
    });

    it('T2: rejects invalid API key', async () => {
      vi.mocked(validateApiKey).mockResolvedValue(null);

      const result = await authenticateAppRequest(
        makeRequest({ authorization: 'Bearer sk_invalid' }),
        APP_ID
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const body = await result.response.json();
        expect(result.response.status).toBe(401);
        expect(body.error).toMatch(/Invalid or expired/);
      }
    });

    it('T3: rejects API key for wrong app', async () => {
      vi.mocked(validateApiKey).mockResolvedValue({
        key_id: 'key-1',
        app_id: 'other-app',
        role_id: null,
        role_name: null,
        permissions: undefined,
        is_valid: true,
      });

      const result = await authenticateAppRequest(
        makeRequest({ authorization: 'Bearer sk_wrong_app' }),
        APP_ID
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });
  });

  describe('app_secret auth', () => {
    it('T4: authenticates with valid app_secret', async () => {
      vi.mocked(getSsoAppAuthConfig).mockResolvedValue({
        id: APP_ID,
        enabled: true,
        ssoClientSecretHash: 'hashed_my-secret',
      });

      const body: Record<string, unknown> = { app_secret: 'my-secret' };
      const result = await authenticateAppRequest(
        makeRequest(),
        APP_ID,
        body
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.authMethod).toBe('app_secret');
      }
    });

    it('T5: rejects invalid app_secret', async () => {
      vi.mocked(getSsoAppAuthConfig).mockResolvedValue({
        id: APP_ID,
        enabled: true,
        ssoClientSecretHash: 'hashed_correct-secret',
      });

      const body: Record<string, unknown> = { app_secret: 'wrong-secret' };
      const result = await authenticateAppRequest(
        makeRequest(),
        APP_ID,
        body
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });

    it('T6: rejects disabled app', async () => {
      vi.mocked(getSsoAppAuthConfig).mockResolvedValue({
        id: APP_ID,
        enabled: false,
        ssoClientSecretHash: 'hashed_secret',
      });

      const body: Record<string, unknown> = { app_secret: 'secret' };
      const result = await authenticateAppRequest(
        makeRequest(),
        APP_ID,
        body
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        const json = await result.response.json();
        expect(json.error).toMatch(/disabled/);
      }
    });

    it('T7: rejects when no secret configured', async () => {
      vi.mocked(getSsoAppAuthConfig).mockResolvedValue({
        id: APP_ID,
        enabled: true,
        ssoClientSecretHash: null,
      });

      const body: Record<string, unknown> = { app_secret: 'secret' };
      const result = await authenticateAppRequest(
        makeRequest(),
        APP_ID,
        body
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });
  });

  describe('no credentials', () => {
    it('T8: returns 401 when no auth provided', async () => {
      const result = await authenticateAppRequest(
        makeRequest(),
        APP_ID
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const json = await result.response.json();
        expect(json.error).toMatch(/Authentication required/);
      }
    });
  });

  describe('auth failure logging', () => {
    it('T9: logs auth failures when auditEventType is provided', async () => {
      vi.mocked(validateApiKey).mockResolvedValue(null);

      await authenticateAppRequest(
        makeRequest({ authorization: 'Bearer sk_bad' }),
        APP_ID,
        undefined,
        { auditEventType: 'user_lookup_error' }
      );

      expect(logSSOEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user_lookup_error',
          appId: APP_ID,
          errorCode: 'invalid_api_key',
        })
      );
    });

    it('does not log auth failures when auditEventType is not set', async () => {
      vi.mocked(validateApiKey).mockResolvedValue(null);

      await authenticateAppRequest(
        makeRequest({ authorization: 'Bearer sk_bad' }),
        APP_ID
      );

      expect(logSSOEvent).not.toHaveBeenCalled();
    });
  });

  describe('credential stripping', () => {
    it('T10: strips app_secret from body after auth', async () => {
      vi.mocked(getSsoAppAuthConfig).mockResolvedValue({
        id: APP_ID,
        enabled: true,
        ssoClientSecretHash: 'hashed_secret',
      });

      const body: Record<string, unknown> = { app_secret: 'secret', other: 'data' };
      await authenticateAppRequest(makeRequest(), APP_ID, body);

      expect(body.app_secret).toBeUndefined();
      expect(body.other).toBe('data');
    });

    it('strips app_secret from body even when using API key auth', async () => {
      vi.mocked(validateApiKey).mockResolvedValue({
        key_id: 'key-1',
        app_id: APP_ID,
        role_id: null,
        role_name: null,
        permissions: undefined,
        is_valid: true,
      });

      const body: Record<string, unknown> = { app_secret: 'should-be-removed', data: 1 };
      await authenticateAppRequest(
        makeRequest({ authorization: 'Bearer sk_valid' }),
        APP_ID,
        body
      );

      expect(body.app_secret).toBeUndefined();
    });
  });
});
