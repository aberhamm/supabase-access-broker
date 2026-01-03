import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Centralized logout route handler.
 *
 * This route handler ensures reliable cookie clearing for sign-out,
 * avoiding issues with server actions in Server Components where
 * cookie modifications may be silently ignored.
 *
 * Usage:
 * - Redirect to `/auth/logout` to sign out
 * - Optional query param `next` to redirect after logout (sanitized to prevent open redirects)
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(request.url);

  // Get optional redirect destination (default to /login)
  const rawNext = url.searchParams.get('next');
  const next = sanitizeRedirect(rawNext);

  // Get base URL for redirect
  const baseUrl = getBaseUrl(request);

  // Create Supabase client that can set cookies in the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // Ensure cookies are cleared with proper settings
                path: '/',
                sameSite: 'lax',
              })
            );
          } catch {
            // Ignore errors from route handlers
          }
        },
      },
    }
  );

  // Sign out - this will clear the session cookies
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[Logout] Error signing out:', error);
  }

  // Create redirect response
  const redirectUrl = new URL(next, baseUrl);
  const response = NextResponse.redirect(redirectUrl);

  // Explicitly clear auth cookies in the response headers as a fallback
  // Supabase uses cookies prefixed with 'sb-'
  const supabaseProjectRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const authCookieNames = [
    `sb-${supabaseProjectRef}-auth-token`,
    `sb-${supabaseProjectRef}-auth-token.0`,
    `sb-${supabaseProjectRef}-auth-token.1`,
  ];

  for (const cookieName of authCookieNames) {
    response.cookies.set(cookieName, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
  }

  // Set cache headers to prevent caching of the logout response
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');

  return response;
}

// Also support POST for form-based logout
export async function POST(request: NextRequest) {
  return GET(request);
}

/**
 * Extract Supabase project reference from URL
 */
function extractProjectRef(supabaseUrl: string): string {
  try {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;
    // Format: <project-ref>.supabase.co
    const parts = hostname.split('.');
    if (parts.length >= 1) {
      return parts[0];
    }
  } catch {
    // Ignore parsing errors
  }
  return 'unknown';
}

/**
 * Sanitize redirect to prevent open redirect vulnerabilities
 */
function sanitizeRedirect(next: string | null): string {
  if (!next || typeof next !== 'string') {
    return '/login';
  }

  const trimmed = next.trim();

  // Only allow relative paths starting with /
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/login';
  }

  // Decode and check for protocol attacks
  try {
    const decoded = decodeURIComponent(trimmed);
    const lower = decoded.toLowerCase();
    if (
      lower.startsWith('//') ||
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('javascript:') ||
      lower.includes('\\')
    ) {
      return '/login';
    }
  } catch {
    return '/login';
  }

  return trimmed;
}

/**
 * Get the base URL for redirects
 */
function getBaseUrl(request: NextRequest): string {
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

