export const NON_RETRYABLE_SSO_ERROR_CODES = new Set(['access_denied', 'unauthorized_client']);

export interface SsoFlowParams {
  appId: string | null;
  redirectUri: string | null;
  state?: string | null;
}

export function buildSsoCompletePath({ appId, redirectUri, state }: SsoFlowParams): string | null {
  if (!appId || !redirectUri) return null;

  return `/sso/complete?app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
}

export function buildSsoLoginPath({
  appId,
  redirectUri,
  state,
  reauth = false,
}: SsoFlowParams & { reauth?: boolean }): string {
  if (!appId || !redirectUri) return '/login';

  return `/login?app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}${state ? `&state=${encodeURIComponent(state)}` : ''}${reauth ? '&reauth=1' : ''}`;
}

export function isRetryableSsoError(error: string | null): boolean {
  return !NON_RETRYABLE_SSO_ERROR_CODES.has(error ?? '');
}

export function getSsoContinueHeaderCopy({
  appName,
  email,
}: {
  appName: string | null;
  email: string | null;
}) {
  return {
    title: appName ? `Continue to ${appName}` : 'Continue',
    description: email ? `Signed in as ${email}` : 'Signed in with this account',
  };
}
