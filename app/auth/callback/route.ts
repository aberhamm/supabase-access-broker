import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
  const next = requestUrl.searchParams.get('next') ?? '/';
  const type = requestUrl.searchParams.get('type');

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

      // Get the user to check claims_admin
      const { data: { user } } = await supabase.auth.getUser();

      // Check if user has claims_admin access
      const isClaimsAdmin = user?.app_metadata?.claims_admin === true;

      if (!isClaimsAdmin) {
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
