import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the admin client — .schema('access_broker_app').rpc()/from().insert() chain
// plus .from('apps').select(...).eq(...).maybeSingle() for redirect_uri validation.
const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ insert: mockInsert, select: mockSelect }));
const mockSchema = vi.fn(() => ({ rpc: mockRpc, from: mockFrom }));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() =>
    Promise.resolve({
      schema: mockSchema,
      rpc: mockRpc,
    })
  ),
}));

vi.mock('@/lib/auth-debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { consumeAuthCode, createAuthCode, sha256Hex, isRedirectUriAllowed, validateRedirectUri } from '@/lib/sso-service';

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
});

describe('createAuthCode', () => {
  it('stores only the SHA-256 hash while returning the plaintext code', async () => {
    const code = await createAuthCode({
      userId: 'user-123',
      appId: 'test-app',
      redirectUri: 'https://app.com/callback',
    });

    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(mockFrom).toHaveBeenCalledWith('auth_codes');
    expect(mockInsert).toHaveBeenCalledWith({
      code: sha256Hex(code),
      user_id: 'user-123',
      app_id: 'test-app',
      redirect_uri: 'https://app.com/callback',
    });
    expect(mockInsert).not.toHaveBeenCalledWith(expect.objectContaining({ code }));
  });
});

describe('consumeAuthCode (atomic RPC)', () => {
  it('returns userId and redirectUri on valid code', async () => {
    mockRpc.mockResolvedValue({
      data: [{ out_user_id: 'user-123', out_redirect_uri: 'https://app.com/callback' }],
      error: null,
    });

    const result = await consumeAuthCode({
      code: 'valid-code',
      appId: 'test-app',
      redirectUri: 'https://app.com/callback',
    });

    expect(result.userId).toBe('user-123');
    expect(result.redirectUri).toBe('https://app.com/callback');
    expect(mockRpc).toHaveBeenCalledWith('consume_auth_code', {
      p_code: sha256Hex('valid-code'),
      p_app_id: 'test-app',
      p_redirect_uri: 'https://app.com/callback',
    });
    expect(mockRpc).not.toHaveBeenCalledWith(
      'consume_auth_code',
      expect.objectContaining({ p_code: 'valid-code' })
    );
  });

  it('throws on invalid code', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Invalid or expired code', code: 'P0001' },
    });

    await expect(
      consumeAuthCode({ code: 'bad-code', appId: 'test-app' })
    ).rejects.toThrow('Invalid or expired code');
  });

  it('throws on already-used code', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Invalid or expired code', code: 'P0001' },
    });

    await expect(
      consumeAuthCode({ code: 'used-code', appId: 'test-app' })
    ).rejects.toThrow('Invalid or expired code');
  });

  it('throws when redirect_uri does not match', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Invalid or expired code', code: 'P0001' },
    });

    await expect(
      consumeAuthCode({
        code: 'valid-code',
        appId: 'test-app',
        redirectUri: 'https://evil.com/steal',
      })
    ).rejects.toThrow('Invalid or expired code');
  });

  it('passes null redirect_uri when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: [{ out_user_id: 'user-456', out_redirect_uri: 'https://app.com/cb' }],
      error: null,
    });

    const result = await consumeAuthCode({
      code: 'valid-code',
      appId: 'test-app',
    });

    expect(result.userId).toBe('user-456');
    expect(mockRpc).toHaveBeenCalledWith('consume_auth_code', {
      p_code: sha256Hex('valid-code'),
      p_app_id: 'test-app',
      p_redirect_uri: null,
    });
  });

  it('throws on empty result (no matching row)', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(
      consumeAuthCode({ code: 'expired-code', appId: 'test-app' })
    ).rejects.toThrow('Invalid or expired code');
  });
});

describe('redirect_uri validation — allow_loopback_redirects flag', () => {
  function mockApp(row: {
    enabled?: boolean;
    allowed_callback_urls?: string[];
    allow_loopback_redirects?: boolean;
  }) {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'lookbook-social',
        enabled: row.enabled ?? true,
        allowed_callback_urls: row.allowed_callback_urls ?? [],
        allow_loopback_redirects: row.allow_loopback_redirects ?? false,
      },
      error: null,
    });
  }

  it('accepts an un-allowlisted loopback redirect when the flag is ON', async () => {
    mockApp({ allow_loopback_redirects: true, allowed_callback_urls: [] });
    await expect(
      isRedirectUriAllowed({ appId: 'lookbook-social', redirectUri: 'http://localhost:3337/auth/mobile-callback' })
    ).resolves.toBe(true);

    mockApp({ allow_loopback_redirects: true, allowed_callback_urls: [] });
    await expect(
      // any port/path on loopback works, no registration needed
      isRedirectUriAllowed({ appId: 'lookbook-social', redirectUri: 'http://127.0.0.1:8081/cb' })
    ).resolves.toBe(true);

    mockApp({ allow_loopback_redirects: true, allowed_callback_urls: [] });
    await expect(
      validateRedirectUri({ appId: 'lookbook-social', redirectUri: 'http://localhost:9999/whatever' })
    ).resolves.toBeUndefined();
  });

  it('still requires an exact allowlist entry for loopback when the flag is OFF', async () => {
    mockApp({ allow_loopback_redirects: false, allowed_callback_urls: [] });
    await expect(
      isRedirectUriAllowed({ appId: 'lookbook-social', redirectUri: 'http://localhost:3337/auth/mobile-callback' })
    ).resolves.toBe(false);

    mockApp({ allow_loopback_redirects: false, allowed_callback_urls: [] });
    await expect(
      validateRedirectUri({ appId: 'lookbook-social', redirectUri: 'http://localhost:3337/auth/mobile-callback' })
    ).rejects.toThrow(/not allowed/);
  });

  it('the flag does NOT relax non-loopback redirects (exact match still required)', async () => {
    mockApp({ allow_loopback_redirects: true, allowed_callback_urls: ['https://lookbook.social/cb'] });
    await expect(
      isRedirectUriAllowed({ appId: 'lookbook-social', redirectUri: 'https://evil.example.com/cb' })
    ).resolves.toBe(false);
  });

  it('rejects a lookalike host (localhost.attacker.com) even with the flag ON', async () => {
    // http + non-loopback host is blocked by the protocol guard before any allowlist/flag check.
    mockApp({ allow_loopback_redirects: true, allowed_callback_urls: [] });
    await expect(
      isRedirectUriAllowed({ appId: 'lookbook-social', redirectUri: 'http://localhost.attacker.com/cb' })
    ).resolves.toBe(false);
  });

  it('still honors an exact https allowlist entry when the flag is ON', async () => {
    mockApp({ allow_loopback_redirects: true, allowed_callback_urls: ['https://lookbook.social/cb'] });
    await expect(
      isRedirectUriAllowed({ appId: 'lookbook-social', redirectUri: 'https://lookbook.social/cb' })
    ).resolves.toBe(true);
  });
});
