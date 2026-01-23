import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isLogoutRedirectAllowed } from '@/lib/sso-service';
import {
  logSSOEvent,
  buildAuditContext,
  extractHostname,
} from '@/lib/audit-service';

/**
 * Centralized logout route handler with Single Logout (SLO) support.
 *
 * This route handler ensures reliable cookie clearing for sign-out,
 * avoiding issues with server actions in Server Components where
 * cookie modifications may be silently ignored.
 *
 * Usage:
 * - Redirect to `/auth/logout` to sign out (redirects to /login by default)
 * - Optional query param `next` for redirect after logout:
 *   - Relative paths (e.g., `/dashboard`) are always allowed
 *   - External URLs must be registered in an app's `allowed_callback_urls`
 *
 * Single Logout (SLO) Flow:
 * 1. External app redirects user to: {portal}/auth/logout?next=https://app.com/logged-out
 * 2. Portal validates the `next` URL against registered callback URLs
 * 3. Portal signs out the user and clears session cookies
 * 4. Portal redirects to the external app's URL
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const auditContext = buildAuditContext(request);

  // Get optional redirect destination
  const rawNext = url.searchParams.get('next');

  // Determine redirect URL and whether it's external
  const { redirectUrl, isExternal, appId, appName } =
    await resolveRedirectUrl(rawNext);

  // Get base URL for relative redirects
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

  // Get current user before signing out (for audit logging)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  // Sign out - this will clear the session cookies
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[Logout] Error signing out:', error);
  }

  // Create redirect response
  let finalRedirectUrl: URL;
  if (isExternal) {
    // External URL - use as-is (already validated)
    finalRedirectUrl = new URL(redirectUrl);
  } else {
    // Relative path - combine with base URL
    finalRedirectUrl = new URL(redirectUrl, baseUrl);
  }

  const response = NextResponse.redirect(finalRedirectUrl);

  // Explicitly clear auth cookies in the response headers as a fallback
  // Supabase uses cookies prefixed with 'sb-'
  const supabaseProjectRef = extractProjectRef(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  );
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

  // Log the logout event for audit purposes
  if (isExternal) {
    // Log external redirect (SLO flow)
    logSSOEvent({
      eventType: 'logout_external_redirect',
      userId: userId || undefined,
      appId: appId || undefined,
      redirectUriHost: extractHostname(redirectUrl) || undefined,
      ...auditContext,
      metadata: {
        appName: appName || undefined,
        redirectUrl: redirectUrl,
      },
    });
    console.log(
      `[Logout] User ${userId || 'unknown'} logged out with external redirect to ${appName || 'unknown app'} (${redirectUrl})`
    );
  } else if (userId) {
    // Log internal logout
    logSSOEvent({
      eventType: 'logout_success',
      userId: userId,
      ...auditContext,
      metadata: {
        redirectPath: redirectUrl,
      },
    });
  }

  return response;
}

// Also support POST for form-based logout
export async function POST(request: NextRequest) {
  return GET(request);
}

/**
 * Resolve the redirect URL from the `next` query parameter.
 * Supports both relative paths and validated external URLs.
 */
async function resolveRedirectUrl(next: string | null): Promise<{
  redirectUrl: string;
  isExternal: boolean;
  appId?: string;
  appName?: string;
}> {
  // Default to /login for missing or empty values
  if (!next || typeof next !== 'string') {
    return { redirectUrl: '/login', isExternal: false };
  }

  const trimmed = next.trim();

  // Check if it looks like an absolute URL (external redirect)
  if (isAbsoluteUrl(trimmed)) {
    // Validate external URL against registered apps
    const validation = await isLogoutRedirectAllowed(trimmed);

    if (validation.allowed) {
      console.log(
        `[Logout] External redirect allowed to ${validation.appName} (${trimmed})`
      );
      return {
        redirectUrl: trimmed,
        isExternal: true,
        appId: validation.appId,
        appName: validation.appName,
      };
    } else {
      // External URL not allowed - log warning and fall back to /login
      console.warn(
        `[Logout] External redirect rejected - URL not registered: ${trimmed}`
      );
      return { redirectUrl: '/login', isExternal: false };
    }
  }

  // Handle as relative path
  return {
    redirectUrl: sanitizeRelativePath(trimmed),
    isExternal: false,
  };
}

/**
 * Check if a string appears to be an absolute URL
 */
function isAbsoluteUrl(value: string): boolean {
  // Check for protocol prefix
  const lower = value.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    // Also catch protocol-relative URLs which should be rejected
    value.startsWith('//')
  );
}

/**
 * Sanitize a relative path to prevent open redirect vulnerabilities
 */
function sanitizeRelativePath(path: string): string {
  // Only allow paths starting with /
  if (!path.startsWith('/') || path.startsWith('//')) {
    return '/login';
  }

  // Decode and check for protocol attacks
  try {
    const decoded = decodeURIComponent(path);
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

  return path;
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
