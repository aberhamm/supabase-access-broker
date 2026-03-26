import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the admin client
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
    })
  ),
}));

vi.mock('@/lib/auth-debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { consumeAuthCode } from '@/lib/sso-service';

beforeEach(() => {
  vi.clearAllMocks();
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
      p_code: 'valid-code',
      p_app_id: 'test-app',
      p_redirect_uri: 'https://app.com/callback',
    });
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
      p_code: 'valid-code',
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
