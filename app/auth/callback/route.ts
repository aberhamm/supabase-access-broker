import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNextPath, isPortalPath } from '@/lib/safe-redirect';

// Get the base URL for redirects
// Prioritizes: NEXT_PUBLIC_APP_URL > X-Forwarded-Host > Host header > request URL
function getBaseUrl(request: Request): string {
  // First, check for NEXT_PUBLIC_APP_URL (production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Check for X-Forwarded-Host header (nginx/proxy)
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  // Check for Host header
  const host = request.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  // Fallback to request URL origin
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const rawNext = requestUrl.searchParams.get('next');
  const type = requestUrl.searchParams.get('type');

  // Sanitize the next parameter to prevent open redirects
  const next = safeNextPath(rawNext, '/');

  // Get the proper base URL for redirects
  const baseUrl = getBaseUrl(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is a password recovery flow
      if (type === 'recovery') {
        // Redirect to reset password page to set new password
        return NextResponse.redirect(new URL('/reset-password', baseUrl));
      }

      // If this is an SSO/portal flow, do NOT enforce claims_admin.
      // These routes are for all authenticated users.
      if (isPortalPath(next)) {
        return NextResponse.redirect(new URL(next, baseUrl));
      }

      // Get the user to check admin access
      const { data: { user } } = await supabase.auth.getUser();

      const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
      const apps = user?.app_metadata?.apps || {};
      const isAppAdmin = Object.values(apps).some(
        (app) => (app as { admin?: boolean })?.admin === true
      );
      const hasAdminAccess = isGlobalAdmin || isAppAdmin;

      if (!hasAdminAccess) {
        // Redirect to access denied if not a claims admin
        return NextResponse.redirect(new URL('/access-denied', baseUrl));
      }

      // Redirect to the requested page or home
      return NextResponse.redirect(new URL(next, baseUrl));
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(new URL('/login', baseUrl));
}
