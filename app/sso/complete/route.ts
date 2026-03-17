import { NextResponse } from 'next/server';
import { debugLog, debugWarn } from '@/lib/auth-debug';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createAuthCode, validateRedirectUri, isRedirectUriAllowed, lookupUserByEmail } from '@/lib/sso-service';
import type { AppAuthMethods } from '@/types/claims';
import { logSSOEvent, extractHostname, extractClientIP } from '@/lib/audit-service';
import { getAppUrl } from '@/lib/app-url';

/** Standard OAuth-style error codes */
type SSOErrorCode =
  | 'invalid_request'
  | 'unauthorized_client'
  | 'access_denied'
  | 'invalid_redirect_uri'
  | 'temporarily_unavailable'
  | 'server_error';

/** Map internal error messages to standard error codes */
function mapErrorToCode(message: string): SSOErrorCode {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('missing') || lowerMessage.includes('invalid redirect_uri')) {
    return 'invalid_request';
  }
  if (lowerMessage.includes('unknown app') || lowerMessage.includes('app is disabled')) {
    return 'unauthorized_client';
  }
  if (lowerMessage.includes('not allowed')) {
    return 'invalid_redirect_uri';
  }
  if (lowerMessage.includes('access') || lowerMessage.includes('permission')) {
    return 'access_denied';
  }
  return 'server_error';
}

/** Build redirect URL to /sso/error page with safe params */
function buildErrorPageUrl(
  origin: string,
  params: {
    error: SSOErrorCode;
    errorDescription: string;
    appId?: string | null;
    redirectUri?: string | null;
    state?: string | null;
  }
): URL {
  const errorUrl = new URL('/sso/error', origin);
  errorUrl.searchParams.set('error', params.error);
  errorUrl.searchParams.set('error_description', params.errorDescription);
  if (params.appId) {
    errorUrl.searchParams.set('app_id', params.appId);
  }
  // Only include redirect_uri if it's a parseable URL (for "Try Again" functionality)
  if (params.redirectUri) {
    try {
      new URL(params.redirectUri);
      errorUrl.searchParams.set('redirect_uri', params.redirectUri);
    } catch {
      // Skip invalid redirect_uri
    }
  }
  if (params.state) {
    errorUrl.searchParams.set('state', params.state);
  }
  return errorUrl;
}

/** Build redirect URL back to client app with error params */
function buildClientErrorRedirect(
  redirectUri: string,
  params: {
    error: SSOErrorCode;
    errorDescription: string;
    state?: string | null;
  }
): URL {
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('error', params.error);
  callbackUrl.searchParams.set('error_description', params.errorDescription);
  if (params.state) {
    callbackUrl.searchParams.set('state', params.state);
  }
  return callbackUrl;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appId = url.searchParams.get('app_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');

  // Use canonical app URL for redirects (handles reverse proxy scenarios)
  const appOrigin = getAppUrl();

  // Common audit context
  const auditContext = {
    ipAddress: extractClientIP(request) || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    redirectUriHost: extractHostname(redirectUri) || undefined,
    appId: appId || undefined,
  };

  // Missing required parameters - redirect to error page
  if (!appId || !redirectUri) {
    // Log the error (fire-and-forget)
    logSSOEvent({
      eventType: 'sso_complete_error',
      errorCode: 'invalid_request',
      ...auditContext,
      metadata: { reason: 'missing_parameters' },
    });

    const errorUrl = buildErrorPageUrl(appOrigin, {
      error: 'invalid_request',
      errorDescription: 'Missing required parameters: app_id and redirect_uri are required.',
      appId,
      redirectUri,
      state,
    });
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // User not logged in - redirect to login preserving SSO params
  if (!user) {
    const loginUrl = new URL('/login', appOrigin);
    loginUrl.searchParams.set('app_id', appId);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    if (state) loginUrl.searchParams.set('state', state);
    return NextResponse.redirect(loginUrl);
  }

  const sessionUserId = user.id;
  const sessionEmail = user.email ?? null;

  debugLog('[SSO Complete] Session user resolved', {
    userId: sessionUserId,
    email: sessionEmail,
    appId,
    redirectUri,
  });

  // Check if redirect_uri is allowed BEFORE proceeding
  // This determines whether we can safely redirect back to the client on error
  const redirectAllowed = await isRedirectUriAllowed({ appId, redirectUri });

  try {
    // Full validation (will throw with specific error messages)
    await validateRedirectUri({ appId, redirectUri });

    let authUserId = sessionUserId;
    if (sessionEmail) {
      const lookup = await lookupUserByEmail(sessionEmail);
      if (lookup?.id && lookup.id !== sessionUserId) {
        debugWarn('[SSO Complete] Session user ID mismatch; using email lookup ID', {
          sessionUserId,
          lookupUserId: lookup.id,
          email: sessionEmail,
        });
        logSSOEvent({
          eventType: 'sso_user_id_mismatch',
          userId: lookup.id,
          ...auditContext,
          metadata: {
            session_user_id: sessionUserId,
            lookup_user_id: lookup.id,
            email: sessionEmail,
          },
        });
        authUserId = lookup.id;
      }
    } else {
      debugWarn('[SSO Complete] Session user missing email; using session ID', {
        userId: sessionUserId,
        appId,
      });
    }

    // Check if user has been granted access to this app
    const appMetadata = user.app_metadata as { apps?: Record<string, { enabled?: boolean }> } | null;
    const userAppClaims = appMetadata?.apps?.[appId];
    if (!userAppClaims || userAppClaims.enabled === false) {
      logSSOEvent({
        eventType: 'sso_complete_error',
        userId: authUserId,
        errorCode: 'access_denied',
        ...auditContext,
        metadata: { reason: 'no_app_claims' },
      });
      return NextResponse.redirect(
        buildErrorPageUrl(appOrigin, {
          error: 'access_denied',
          errorDescription: `Your account has not been granted access to this application. Contact your administrator to request access.`,
          appId,
          redirectUri,
          state,
        })
      );
    }

    // Check that the app has at least one auth method enabled (server-side enforcement)
    const supabaseAdmin = await createAdminClient();
    const { data: appData } = await supabaseAdmin
      .schema('access_broker_app')
      .from('apps')
      .select('auth_methods')
      .eq('id', appId)
      .single();

    const authMethods = appData?.auth_methods as AppAuthMethods | null;
    const hasAnyMethodEnabled = authMethods && Object.values(authMethods).some(Boolean);

    if (!hasAnyMethodEnabled) {
      logSSOEvent({
        eventType: 'sso_complete_error',
        userId: authUserId,
        errorCode: 'access_denied',
        ...auditContext,
        metadata: { reason: 'no_auth_methods_configured' },
      });
      return NextResponse.redirect(
        buildErrorPageUrl(appOrigin, {
          error: 'unauthorized_client',
          errorDescription: 'No sign-in methods have been configured for this application. Contact your administrator.',
          appId,
          redirectUri,
          state,
        })
      );
    }

    // Create auth code and redirect to client
    const code = await createAuthCode({ userId: authUserId, appId, redirectUri });
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);

    // Log success (fire-and-forget)
    logSSOEvent({
      eventType: 'sso_complete_success',
      userId: authUserId,
      ...auditContext,
    });

    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SSO authorization failed';
    const errorCode = mapErrorToCode(message);

    console.error('[SSO Complete] Error:', message, { appId, redirectUri, errorCode });

    // If redirect_uri is valid and allowed, redirect back to client with error
    if (redirectAllowed) {
      // Log error with redirect to client
      logSSOEvent({
        eventType: 'sso_complete_redirect_error',
        userId: user.id,
        errorCode,
        ...auditContext,
        metadata: { error_message: message, redirected_to_client: true },
      });

      const clientErrorUrl = buildClientErrorRedirect(redirectUri, {
        error: errorCode,
        errorDescription: message,
        state,
      });
      return NextResponse.redirect(clientErrorUrl);
    }

    // Log error shown on portal error page
    logSSOEvent({
      eventType: 'sso_complete_error',
      userId: user.id,
      errorCode,
      ...auditContext,
      metadata: { error_message: message, redirected_to_client: false },
    });

    // Otherwise, show portal error page
    const errorUrl = buildErrorPageUrl(appOrigin, {
      error: errorCode,
      errorDescription: message,
      appId,
      redirectUri,
      state,
    });
    return NextResponse.redirect(errorUrl);
  }
}
