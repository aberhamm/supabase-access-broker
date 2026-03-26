import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/app-url';

const PASSKEY_COOKIE_NAME = '__passkey_action';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(PASSKEY_COOKIE_NAME);
  const appOrigin = getAppUrl();

  if (!cookie?.value) {
    // Cookie missing or expired — redirect to login with error
    const loginUrl = new URL('/login', appOrigin);
    loginUrl.searchParams.set('error', 'session_failed');
    const response = NextResponse.redirect(loginUrl);
    // Clear the cookie in case it's malformed
    response.cookies.delete(PASSKEY_COOKIE_NAME);
    return response;
  }

  const actionLink = cookie.value;

  // Validate the action_link is a URL pointing to our Supabase instance
  try {
    const url = new URL(actionLink);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (supabaseUrl && !actionLink.startsWith(supabaseUrl)) {
      throw new Error('Invalid action link origin');
    }
    void url; // used for validation
  } catch {
    const loginUrl = new URL('/login', appOrigin);
    loginUrl.searchParams.set('error', 'invalid_token');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(PASSKEY_COOKIE_NAME);
    return response;
  }

  // Clear the cookie and redirect to the Supabase magic link
  const response = NextResponse.redirect(actionLink);
  response.cookies.delete(PASSKEY_COOKIE_NAME);
  return response;
}
