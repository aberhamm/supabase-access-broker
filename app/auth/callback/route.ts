import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNextPath, isPortalPath } from '@/lib/safe-redirect';
import { debugLog, debugError } from '@/lib/auth-debug';
import { hasAnyAppAdmin } from '@/types/claims';

function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
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
  const baseUrl = getBaseUrl(request);

  debugLog('[auth/callback] Processing request:', { hasCode: !!code, type, next });

  if (!code) {
    debugLog('[auth/callback] No code, redirecting to login');
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    debugError('[auth/callback] exchangeCodeForSession failed:', error.message);
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('error', 'code_exchange_failed');
    return NextResponse.redirect(loginUrl);
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
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const isGlobalAdmin = user.app_metadata?.claims_admin === true;
  const apps = user.app_metadata?.apps;
  const isAppAdmin = hasAnyAppAdmin(apps);
  if (!isGlobalAdmin && !isAppAdmin) {
    return NextResponse.redirect(new URL('/access-denied', baseUrl));
  }

  return NextResponse.redirect(new URL(next, baseUrl));
}
