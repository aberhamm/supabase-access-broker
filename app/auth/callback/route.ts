import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNextPath, isPortalPath } from '@/lib/safe-redirect';
import { debugLog, debugError } from '@/lib/auth-debug';
import { hasAnyAppAdmin } from '@/types/claims';
import { getServerAppUrl } from '@/lib/app-url';

const getBaseUrl = (request: Request) => getServerAppUrl(request);

/**
 * Build a /login redirect that preserves the SSO context embedded in `next`.
 * If `next` points at /sso/complete?app_id=…&redirect_uri=…&state=…, those
 * params are lifted onto /login so the login page rebuilds the same nextPath
 * and the user stays scoped to the originating app instead of falling through
 * to the broker's own admin gate.
 */
function buildLoginRedirect(
  baseUrl: string,
  next: string,
  errorCode: string | null,
  errorDescription?: string | null,
): URL {
  const loginUrl = new URL('/login', baseUrl);
  if (errorCode) loginUrl.searchParams.set('error', errorCode);
  if (errorDescription) loginUrl.searchParams.set('error_description', errorDescription);

  if (next.startsWith('/sso/complete')) {
    try {
      const ssoUrl = new URL(next, baseUrl);
      const appId = ssoUrl.searchParams.get('app_id');
      const redirectUri = ssoUrl.searchParams.get('redirect_uri');
      const state = ssoUrl.searchParams.get('state');
      if (appId) loginUrl.searchParams.set('app_id', appId);
      if (redirectUri) loginUrl.searchParams.set('redirect_uri', redirectUri);
      if (state) loginUrl.searchParams.set('state', state);
    } catch {
      // ignore — fall back to bare /login
    }
  }
  return loginUrl;
}

/**
 * OAuth + PKCE magic-link callback.
 *
 * Supabase redirects here with ?code=… after the provider hop. We exchange
 * the code for a session exactly once on the server, set cookies on the
 * redirect response, and forward to `next`. Doing this in a server route
 * (vs. a client page running exchangeCodeForSession in useEffect) avoids
 * double-exchange races on re-render, refresh, or back-navigation.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = safeNextPath(requestUrl.searchParams.get('next'), '/');
  const oauthError = requestUrl.searchParams.get('error');
  const oauthErrorDescription = requestUrl.searchParams.get('error_description');
  const baseUrl = getBaseUrl(request);

  debugLog('[auth/callback] Processing request:', {
    hasCode: !!code,
    type,
    next,
    oauthError,
  });

  if (!code) {
    // Provider returned without a code — usually because OAuth itself failed
    // (e.g. Apple → Supabase rejected the user). Forward any error params from
    // the provider so the login page can surface a useful message, and preserve
    // SSO context so the user can retry without losing their app scope.
    debugLog('[auth/callback] No code, redirecting to login', { oauthError });
    return NextResponse.redirect(
      buildLoginRedirect(baseUrl, next, oauthError, oauthErrorDescription),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    debugError('[auth/callback] exchangeCodeForSession failed:', error.message);
    return NextResponse.redirect(
      buildLoginRedirect(baseUrl, next, 'code_exchange_failed', error.message),
    );
  }

  // Password recovery: skip admin gate, send to reset-password
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', baseUrl));
  }

  // Portal/SSO routes (e.g. /sso/complete) handle their own auth gate
  if (isPortalPath(next)) {
    return NextResponse.redirect(new URL(next, baseUrl));
  }

  // Admin gate for everything else
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(buildLoginRedirect(baseUrl, next, null));
  }

  const isGlobalAdmin = user.app_metadata?.claims_admin === true;
  const apps = user.app_metadata?.apps;
  const isAppAdmin = hasAnyAppAdmin(apps);
  if (!isGlobalAdmin && !isAppAdmin) {
    return NextResponse.redirect(new URL('/access-denied', baseUrl));
  }

  return NextResponse.redirect(new URL(next, baseUrl));
}
