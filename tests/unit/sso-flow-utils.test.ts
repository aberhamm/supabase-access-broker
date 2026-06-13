import { describe, it, expect } from 'vitest';
import {
  buildSsoCompletePath,
  buildSsoLoginPath,
  getSsoContinueHeaderCopy,
  isRetryableSsoError,
} from '@/lib/sso-flow-utils';

describe('SSO flow URL helpers', () => {
  it('builds complete URLs with encoded SSO parameters', () => {
    const path = buildSsoCompletePath({
      appId: 'app/with spaces',
      redirectUri: 'https://client.test/callback?existing=1',
      state: 'state/value with spaces',
    });

    expect(path).toBe(
      '/sso/complete?app_id=app%2Fwith%20spaces&redirect_uri=https%3A%2F%2Fclient.test%2Fcallback%3Fexisting%3D1&state=state%2Fvalue%20with%20spaces'
    );
  });

  it('returns null for incomplete complete URLs', () => {
    expect(buildSsoCompletePath({ appId: 'app-1', redirectUri: null })).toBeNull();
    expect(buildSsoCompletePath({ appId: null, redirectUri: 'https://client.test/cb' })).toBeNull();
  });

  it('builds login URLs that preserve SSO parameters and optional reauth', () => {
    expect(buildSsoLoginPath({
      appId: 'app-1',
      redirectUri: 'https://client.test/callback',
      state: 'state-1',
      reauth: true,
    })).toBe(
      '/login?app_id=app-1&redirect_uri=https%3A%2F%2Fclient.test%2Fcallback&state=state-1&reauth=1'
    );
  });

  it('falls back to plain login when SSO context is incomplete', () => {
    expect(buildSsoLoginPath({ appId: 'app-1', redirectUri: null, reauth: true })).toBe('/login');
  });

  it('classifies only deterministic SSO errors as non-retryable', () => {
    expect(isRetryableSsoError('access_denied')).toBe(false);
    expect(isRetryableSsoError('unauthorized_client')).toBe(false);
    expect(isRetryableSsoError('server_error')).toBe(true);
    expect(isRetryableSsoError(null)).toBe(true);
  });
});

describe('SSO continue copy helper', () => {
  it('uses app and email when both are available', () => {
    expect(getSsoContinueHeaderCopy({
      appName: 'Demo App',
      email: 'user@example.com',
    })).toEqual({
      title: 'Continue to Demo App',
      description: 'Signed in as user@example.com',
    });
  });

  it('falls back without dangling copy when app name or email are unavailable', () => {
    expect(getSsoContinueHeaderCopy({ appName: null, email: null })).toEqual({
      title: 'Continue',
      description: 'Signed in with this account',
    });
  });
});
