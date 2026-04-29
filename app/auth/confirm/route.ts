import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNextPath, isPortalPath } from '@/lib/safe-redirect';
import { debugLog } from '@/lib/auth-debug';
import { hasAnyAppAdmin } from '@/types/claims';
import { getServerAppUrl } from '@/lib/app-url';

const getBaseUrl = (request: Request) => getServerAppUrl(request);

/**
 * Handle email confirmation via token_hash (magic links, email OTP via link)
 * Supabase sends users here with: /auth/confirm?token_hash=xxx&type=email
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as 'email' | 'recovery' | 'invite' | 'signup';
  const rawNext = requestUrl.searchParams.get('next');

  const next = safeNextPath(rawNext, '/');
  const baseUrl = getBaseUrl(request);

  debugLog('[auth/confirm] Processing request:', {
    hasTokenHash: !!tokenHash,
    type,
    next,
    baseUrl
  });

  if (!tokenHash) {
    debugLog('[auth/confirm] No token_hash, redirecting to login');
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const supabase = await createClient();

  // Verify the token hash
  debugLog('[auth/confirm] Verifying token_hash...');
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type || 'email',
  });

  debugLog('[auth/confirm] verifyOtp result:', {
    hasSession: !!data?.session,
    hasUser: !!data?.user,
    error: error?.message
  });

  if (error) {
    console.error('[auth/confirm] Error verifying token:', error.message);
    // Redirect to login with a machine-readable error code
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('error', 'invalid_token');
    return NextResponse.redirect(loginUrl);
  }

  // Check if this is a password recovery flow
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', baseUrl));
  }

  // If this is an SSO/portal flow, redirect directly
  if (isPortalPath(next)) {
    return NextResponse.redirect(new URL(next, baseUrl));
  }

  // Get the user to check admin access
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Should not happen after successful verification, but handle it
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const isGlobalAdmin = user.app_metadata?.claims_admin === true;
  const apps = user.app_metadata?.apps;
  const isAppAdmin = hasAnyAppAdmin(apps);
  const hasAdminAccess = isGlobalAdmin || isAppAdmin;

  if (!hasAdminAccess) {
    // Redirect to access denied if not an admin
    return NextResponse.redirect(new URL('/access-denied', baseUrl));
  }

  // Redirect to the requested page or home
  return NextResponse.redirect(new URL(next, baseUrl));
}
