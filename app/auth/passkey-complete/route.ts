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

  const cookieValue = cookie.value;

  // Validate the cookie holds a same-origin /auth/confirm URL. The verify
  // route writes only that exact shape; anything else is treated as
  // malformed and discarded.
  try {
    const url = new URL(cookieValue);
    const expectedOrigin = new URL(appOrigin).origin;
    if (url.origin !== expectedOrigin || url.pathname !== '/auth/confirm') {
      throw new Error('Invalid passkey redirect target');
    }
  } catch {
    const loginUrl = new URL('/login', appOrigin);
    loginUrl.searchParams.set('error', 'invalid_token');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(PASSKEY_COOKIE_NAME);
    return response;
  }

  // Clear the cookie and redirect to the same-origin confirm endpoint.
  const response = NextResponse.redirect(cookieValue);
  response.cookies.delete(PASSKEY_COOKIE_NAME);
  return response;
}
