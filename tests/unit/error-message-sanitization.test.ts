import { describe, it, expect } from 'vitest';
import { getErrorMessage, getLoginErrorMessage, resolveLoginUrlError } from '@/lib/auth-error-messages';
import { PUBLIC_ROUTE_PREFIXES } from '@/lib/auth-routes';

describe('SSO error message sanitization', () => {
  it('maps SSO error codes without using attacker-controlled descriptions', () => {
    expect(getErrorMessage('access_denied')).toBe('You do not have permission to access this application.');
    expect(getErrorMessage('unknown_error')).toBe('An error occurred during the SSO process.');
  });

  it('maps login error codes without using raw provider descriptions', () => {
    expect(getLoginErrorMessage('otp_expired')).toBe('Your verification code has expired. Please request a new one.');
    expect(getLoginErrorMessage('access_denied')).toBe(
      "Sign-in was cancelled or this account doesn't have access. Try again or contact your administrator."
    );
    expect(getLoginErrorMessage('provider_sent_INJECTED_TEXT')).toBe(
      'An unexpected error occurred. Please try signing in again.'
    );
  });

  it('prefers Supabase error_code over generic access_denied hash errors', () => {
    const resolved = resolveLoginUrlError(
      '',
      '#error=access_denied&error_code=otp_expired&error_description=INJECTED_TEXT'
    );

    expect(resolved).toEqual({
      errorCode: 'otp_expired',
      errorDescription: 'INJECTED_TEXT',
    });
    expect(getLoginErrorMessage(resolved?.errorCode ?? null)).toBe(
      'Your verification code has expired. Please request a new one.'
    );
  });

  it('keeps the SSO error page public so unsafe descriptions are not preserved through login next URLs', () => {
    expect(PUBLIC_ROUTE_PREFIXES).toContain('/sso/error');
  });
});
