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
    // redirectTo is required by admin.generateLink (it bakes it into the
    // action_link), but we don't actually follow the action_link anymore —
    // we verify the hashed_token server-side via /auth/confirm.
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;
    const { hashedToken } = await generateSupabaseMagicLinkForUser({
      userId: verification.userId,
      redirectTo,
    });

    // Store a same-origin /auth/confirm URL in an httpOnly cookie. The client
    // navigates to /auth/passkey-complete which reads the cookie and
    // redirects. /auth/confirm verifies the token server-side via verifyOtp,
    // sets session cookies on the redirect response, and forwards to next —
    // avoiding the implicit-flow hash-fragment path that admin-generated
    // magic links would otherwise return through Supabase.
    const confirmUrl = new URL('/auth/confirm', baseUrl);
    confirmUrl.searchParams.set('token_hash', hashedToken);
    confirmUrl.searchParams.set('type', 'email');
    confirmUrl.searchParams.set('next', next);

    const isSecure = baseUrl.startsWith('https://');
    const res = NextResponse.json({ verified: true });
    res.cookies.set(PASSKEY_COOKIE_NAME, confirmUrl.toString(), {
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
