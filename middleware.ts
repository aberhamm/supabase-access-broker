import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { validateApiKey, recordApiKeyUsage } from '@/lib/api-keys-service';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Check if this is a webhook route that should use API key authentication
  const isWebhookRoute = request.nextUrl.pathname.startsWith('/api/webhooks/');

  if (isWebhookRoute) {
    // Try to authenticate with API key
    const apiKey =
      request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const validatedKey = await validateApiKey(apiKey);

    if (!validatedKey || !validatedKey.is_valid) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 }
      );
    }

    // Record usage (non-blocking)
    recordApiKeyUsage(apiKey).catch(console.error);

    // Add app context to response headers for the API route to use
    const webhookResponse = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    webhookResponse.headers.set('x-app-id', validatedKey.app_id);
    webhookResponse.headers.set('x-key-id', validatedKey.key_id);
    if (validatedKey.role_name) {
      webhookResponse.headers.set('x-role-name', validatedKey.role_name);
    }

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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              maxAge: 7 * 24 * 60 * 60, // 7 days
            })
          );
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
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[MIDDLEWARE] getUser error:', userError.message, userError.code);
  }

  // Debug: Log session vs user mismatch
  if (sessionData?.session && !user) {
    console.warn('[MIDDLEWARE] Session exists but getUser() returned no user!', {
      sessionUserId: sessionData.session.user?.id,
      sessionUserEmail: sessionData.session.user?.email,
    });
  }

  // Clean up corrupted/invalid auth cookies if session is missing but cookies exist
  const hasAuthCookies = request.cookies.getAll().some(c =>
    c.name.includes('sb-') && c.name.includes('-auth-token')
  );

  if (!user && !sessionData?.session && hasAuthCookies) {
    console.warn('[MIDDLEWARE] Clearing invalid auth cookies');
    // Clear the corrupted cookies
    const cookiesToClear = request.cookies.getAll()
      .filter(c => c.name.includes('sb-') && (c.name.includes('-auth-token') || c.name.includes('-code-verifier')));

    cookiesToClear.forEach(c => {
      response.cookies.delete(c.name);
    });
  }

  const pathname = request.nextUrl.pathname;

  // Public (no session required)
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/confirm') || // Handle magic link token_hash
    pathname.startsWith('/auth/logout') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/demo/'); // Demo pages for SSO testing

  // Authenticated-but-not-admin routes (SSO portal features)
  const isPortalRoute =
    pathname.startsWith('/sso/') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/refresh-session') ||
    pathname.startsWith('/access-denied');

  // Log auth cookies for debugging (names and value lengths, not actual values)
  const authCookies = request.cookies.getAll()
    .filter(c => c.name.includes('supabase') || c.name.includes('sb-'))
    .map(c => ({ name: c.name, valueLength: c.value?.length || 0 }));

  console.log('🛡️ [MIDDLEWARE]', {
    pathname,
    isPublicRoute,
    hasUser: !!user,
    userEmail: user?.email,
    authCookies: authCookies.length > 0 ? authCookies : 'none',
    sessionExists: !!sessionData?.session,
  });

  // If user is not signed in and the current path is not a public route, redirect to /login
  if (!user && !isPublicRoute) {
    console.log('🔒 [MIDDLEWARE] No user and not public route, redirecting to /login');
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Optional: remember where to return after login
    url.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // If user is signed in and tries to access /login:
  // - if SSO params are present, redirect to /sso/complete
  // - otherwise, redirect admins to dashboard, non-admins can stay on /login (or go to /account)
  if (user && pathname.startsWith('/login')) {
    const appId = request.nextUrl.searchParams.get('app_id');
    const redirectUri = request.nextUrl.searchParams.get('redirect_uri');
    const state = request.nextUrl.searchParams.get('state');

    if (appId && redirectUri) {
      const url = request.nextUrl.clone();
      url.pathname = '/sso/complete';
      url.searchParams.set('app_id', appId);
      url.searchParams.set('redirect_uri', redirectUri);
      if (state) url.searchParams.set('state', state);
      return NextResponse.redirect(url);
    }

    // Determine admin access for redirect decision
    const isGlobalAdmin = user.app_metadata?.claims_admin === true;
    const apps = user.app_metadata?.apps || {};
    const isAppAdmin = Object.values(apps).some(
      (app) => (app as { admin?: boolean })?.admin === true
    );
    const hasAdminAccess = isGlobalAdmin || isAppAdmin;

    if (hasAdminAccess) {
      console.log('🔓 [MIDDLEWARE] Admin user already logged in, redirecting to dashboard');
    const url = request.nextUrl.clone();
    url.pathname = '/';
      url.search = '';
    return NextResponse.redirect(url);
  }

    // Non-admins can use the portal routes (SSO/account); keep them on login by default.
  }

  // Admin-gate everything except public + portal routes
  if (user && !isPublicRoute && !isPortalRoute) {
    const isGlobalAdmin = user.app_metadata?.claims_admin === true;

    // Check if user is admin for any app
    const apps = user.app_metadata?.apps || {};
    const isAppAdmin = Object.values(apps).some(
      (app) => (app as { admin?: boolean })?.admin === true
    );

    const hasAdminAccess = isGlobalAdmin || isAppAdmin;

    console.log('🔐 [MIDDLEWARE] Admin check:', {
      isGlobalAdmin,
      isAppAdmin,
      hasAdminAccess,
      appMetadata: user.app_metadata,
    });

    if (!hasAdminAccess) {
      console.warn('⚠️ [MIDDLEWARE] User lacks admin access, redirecting to /access-denied');
      console.warn('⚠️ [MIDDLEWARE] User ID:', user.id);
      console.warn('⚠️ [MIDDLEWARE] User metadata:', JSON.stringify(user.app_metadata, null, 2));
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }

    console.log('✅ [MIDDLEWARE] User has admin access, allowing request');
  }

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
