import { NextResponse } from 'next/server';
import { generateSupabaseMagicLinkForUser, verifyAuthentication } from '@/lib/passkey-service';
import { getAppUrl } from '@/lib/app-url';

const PASSKEY_COOKIE_NAME = '__passkey_action';
const PASSKEY_COOKIE_MAX_AGE = 60; // 60 seconds

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = body?.response;
    const next = typeof body?.next === 'string' ? body.next : '/';

    if (!response) {
      return NextResponse.json({ error: 'Missing response' }, { status: 400 });
    }

    const verification = await verifyAuthentication({ response });
    if (!verification.verified) {
      return NextResponse.json({ verified: false }, { status: 401 });
    }

    const baseUrl = getAppUrl();
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;
    const action_link = await generateSupabaseMagicLinkForUser({
      userId: verification.userId,
      redirectTo,
    });

    // Store the magic link in an httpOnly cookie instead of exposing it in the
    // response body. The client navigates to /auth/passkey-complete which reads
    // the cookie and redirects. This prevents XSS from stealing the magic link.
    const isSecure = baseUrl.startsWith('https://');
    const res = NextResponse.json({ verified: true });
    res.cookies.set(PASSKEY_COOKIE_NAME, action_link, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/auth/passkey-complete',
      maxAge: PASSKEY_COOKIE_MAX_AGE,
    });

    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
