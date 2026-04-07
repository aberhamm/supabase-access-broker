import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { debugLog, debugWarn, debugTrace, isDebugAuthEnabled } from '@/lib/auth-debug';
import { PUBLIC_ROUTE_PREFIXES, PORTAL_ROUTE_PREFIXES } from '@/lib/auth-routes';
import { hasAnyAppAdmin } from '@/types/claims';

type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

function isDefinitiveAuthFailure(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code || '').toLowerCase();
  const message = (error.message || '').toLowerCase();
  const status = error.status ?? 0;

  if (status === 401 || status === 403) {
    return true;
  }

  return (
    code.includes('jwt') ||
    code.includes('token') ||
    code.includes('session') ||
    code === 'bad_jwt' ||
    code === 'session_not_found' ||
    code === 'refresh_token_not_found' ||
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('session') ||
    message.includes('auth session missing')
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const debugAuth = isDebugAuthEnabled();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Webhook routes handle their own auth inline (authenticateAppRequest)
  // — no middleware auth needed. Let them pass through to the route handler.
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    const webhookResponse = NextResponse.next();
    webhookResponse.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${supabaseUrl}; frame-ancestors 'self'`);
    return webhookResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        // Middleware checks existing sessions and auto-refreshes tokens
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // Detect and handle auth state in URLs
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Detect if request came over HTTPS (via proxy or direct)
          // Also check NEXT_PUBLIC_APP_URL as fallback for when proxy doesn't set headers
          const isSecure = request.headers.get('x-forwarded-proto') === 'https' ||
            request.nextUrl.protocol === 'https:' ||
            process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');

          debugLog('[MIDDLEWARE] setAll called with', cookiesToSet.length, 'cookies');
          const deleteIntents = cookiesToSet
            .filter(({ value, options }) =>
              (value === '' || value === undefined || value === null) ||
              options?.maxAge === 0 ||
              (options?.expires ? new Date(options.expires).getTime() <= Date.now() : false)
            )
            .map(({ name, value, options }) => ({
              name,
              valueLength: value?.length ?? 0,
              maxAge: options?.maxAge,
              expires: options?.expires ? new Date(options.expires).toISOString() : undefined,
              path: options?.path,
              sameSite: options?.sameSite,
            }));
          if (deleteIntents.length > 0) {
            debugWarn('[MIDDLEWARE] Delete-intent cookies detected:', deleteIntents);
            debugTrace('[MIDDLEWARE] Delete-intent stack:');
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            debugLog('[MIDDLEWARE] Setting cookie:', name, 'length:', value.length, 'maxAge:', options?.maxAge);
            response.cookies.set(name, value, {
              ...options,
              // Note: NOT using httpOnly so browser client can read auth cookies
              // This is the standard Supabase SSR pattern
              sameSite: options?.sameSite ?? 'lax',
              path: options?.path ?? '/',
              maxAge: options?.maxAge ?? 7 * 24 * 60 * 60, // 7 days
              secure: options?.secure ?? isSecure, // Required for HTTPS
              httpOnly: options?.httpOnly ?? false,
            });
          });
        },
      },
    }
  );

  // Try to get session first to see what's there
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('[MIDDLEWARE] getSession error:', sessionError.message);
  }

  // Refreshing the auth token
  const {
    data: { user: verifiedUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[MIDDLEWARE] getUser error:', userError.message, userError.code);
  }

  const hasDefinitiveAuthFailure = isDefinitiveAuthFailure(userError);

  // Only trust getSession() as a fallback for transient/non-auth getUser failures.
  // If getUser() reports an auth failure, treating the session as valid creates
  // redirect loops for /login SSO flows because middleware keeps auto-redirecting
  // with stale cookies that the server rejects.
  const fallbackUser = !verifiedUser && !hasDefinitiveAuthFailure
    ? (sessionData?.session?.user ?? null)
    : null;

  const user = verifiedUser || fallbackUser;

  if (!verifiedUser && fallbackUser) {
    console.warn('[MIDDLEWARE] Using session user as fallback (getUser failed but session exists)');
  }

  if (!verifiedUser && sessionData?.session?.user && hasDefinitiveAuthFailure) {
    console.warn('[MIDDLEWARE] Rejecting session fallback due to definitive auth failure', {
      status: userError?.status,
      code: userError?.code,
      message: userError?.message,
    });
  }

  // Debug: Log session vs user mismatch
  if (sessionData?.session && !user) {
    const session = sessionData.session;
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;

    console.warn('[MIDDLEWARE] Session exists but getUser() returned no user', {
      tokenExpiresAt: expiresAt?.toISOString(),
      userError: userError ? { message: userError.message, status: userError.status, code: userError.code } : null,
    });
  }

  // Clean up corrupted/invalid auth cookies if session is missing but cookies exist
  // Be careful not to clear cookies on transient errors - only clear if we got a definitive
  // "no session" response (not an error)
  const hasAuthCookies = request.cookies.getAll().some(c =>
    c.name.includes('sb-') && c.name.includes('-auth-token')
  );

  // Only clear cookies if:
  // 1. No user AND no session (both checks passed, not errored)
  // 2. No session error (if there was an error, the session might be valid but we couldn't verify)
  // 3. No user error (same reason)
  const shouldClearMissingSessionCookies = !user && !sessionData?.session && hasAuthCookies &&
    !sessionError && !userError;

  // Also clear cookies when getSession() still returns a session but getUser()
  // definitively rejects it. This recovers from stale/invalid auth cookies that
  // would otherwise keep bouncing SSO users back into /sso/complete.
  const shouldClearRejectedSessionCookies = !verifiedUser && !!sessionData?.session && hasAuthCookies &&
    hasDefinitiveAuthFailure;

  const shouldClearCookies = shouldClearMissingSessionCookies || shouldClearRejectedSessionCookies;

  if (shouldClearCookies) {
    if (debugAuth) {
      debugWarn('[MIDDLEWARE] Skipping cookie cleanup because DEBUG_AUTH is enabled');
    } else {
      debugWarn('[MIDDLEWARE] Clearing invalid auth cookies', {
        reason: shouldClearRejectedSessionCookies ? 'rejected_session' : 'missing_session',
      });
      const cookiesToClear = request.cookies.getAll()
        .filter(c => c.name.includes('sb-') && (c.name.includes('-auth-token') || c.name.includes('-code-verifier')));
      cookiesToClear.forEach(c => {
        response.cookies.delete(c.name);
      });
    }
  }

  const pathname = request.nextUrl.pathname;

  // Public (no session required)
  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Authenticated-but-not-admin routes (SSO portal features)
  const isPortalRoute = PORTAL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const authCookieCount = request.cookies.getAll()
    .filter(c => c.name.includes('supabase') || c.name.includes('sb-')).length;

  debugLog('[MIDDLEWARE] Request auth state', {
    pathname,
    isPublicRoute,
    hasUser: !!user,
    sessionExists: !!sessionData?.session,
    authCookieCount,
  });

  // If user is not signed in and the current path is not a public route, redirect to /login
  if (!user && !isPublicRoute) {
    debugLog('[MIDDLEWARE] No user and not public route, redirecting to /login');
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Optional: remember where to return after login
    url.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // If user is signed in and tries to access /login:
  // - if SSO params are present, show interstitial so user can confirm or switch accounts
  //   (unless reauth=1 is set, meaning user explicitly chose to re-login from the error page)
  // - otherwise, redirect admins to dashboard, non-admins can stay on /login (or go to /account)
  if (user && pathname.startsWith('/login')) {
    const appId = request.nextUrl.searchParams.get('app_id');
    const redirectUri = request.nextUrl.searchParams.get('redirect_uri');
    const state = request.nextUrl.searchParams.get('state');
    const reauth = request.nextUrl.searchParams.get('reauth');

    if (appId && redirectUri && reauth !== '1') {
      const url = request.nextUrl.clone();
      url.pathname = '/sso/continue';
      url.searchParams.delete('reauth');
      url.searchParams.set('app_id', appId);
      url.searchParams.set('redirect_uri', redirectUri);
      if (state) url.searchParams.set('state', state);
      return NextResponse.redirect(url);
    }

    // Determine admin access for redirect decision
    const isGlobalAdmin = user.app_metadata?.claims_admin === true;
    const apps = user.app_metadata?.apps;
    const isAppAdmin = hasAnyAppAdmin(apps);
    const hasAdminAccess = isGlobalAdmin || isAppAdmin;

    if (hasAdminAccess) {
      debugLog('[MIDDLEWARE] Admin user already logged in, redirecting to dashboard');
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Non-admins can use the portal routes (SSO/account); keep them on login by default.
  }

  // If user is signed in and tries to access /signup:
  // - if SSO params are present and user already has app access, show interstitial
  // - otherwise, let them through to the signup page (it handles existing user UX)
  if (user && pathname.startsWith('/signup')) {
    const appId = request.nextUrl.searchParams.get('app_id');
    const redirectUri = request.nextUrl.searchParams.get('redirect_uri');
    const state = request.nextUrl.searchParams.get('state');

    if (appId && redirectUri) {
      const appClaims = (user.app_metadata?.apps as Record<string, { enabled?: boolean }> | undefined)?.[appId];
      if (appClaims?.enabled) {
        // User already has access to this app — show interstitial instead of auto-completing
        const url = request.nextUrl.clone();
        url.pathname = '/sso/continue';
        url.searchParams.set('app_id', appId);
        url.searchParams.set('redirect_uri', redirectUri);
        if (state) url.searchParams.set('state', state);
        return NextResponse.redirect(url);
      }
    }
  }

  // Admin-gate everything except public + portal routes
  if (user && !isPublicRoute && !isPortalRoute) {
    const isGlobalAdmin = user.app_metadata?.claims_admin === true;

    // Check if user is admin for any app
    const apps = user.app_metadata?.apps;
    const isAppAdmin = hasAnyAppAdmin(apps);

    const hasAdminAccess = isGlobalAdmin || isAppAdmin;

    debugLog('[MIDDLEWARE] Admin check:', {
      isGlobalAdmin,
      isAppAdmin,
      hasAdminAccess,
    });

    if (!hasAdminAccess) {
      console.warn('[MIDDLEWARE] User lacks admin access, redirecting to /access-denied');
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }

    debugLog('[MIDDLEWARE] User has admin access, allowing request');
  }

  // CSP headers to mitigate XSS impact (auth cookies are not httpOnly per Supabase SSR requirement)
  response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${supabaseUrl}; frame-ancestors 'self'`);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
