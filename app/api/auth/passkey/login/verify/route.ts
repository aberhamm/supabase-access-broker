import { NextResponse } from 'next/server';
import { generateSupabaseMagicLinkForUser, verifyAuthentication } from '@/lib/passkey-service';

function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

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

    const baseUrl = getBaseUrl(request);
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;
    const action_link = await generateSupabaseMagicLinkForUser({
      userId: verification.userId,
      redirectTo,
    });

    return NextResponse.json({ verified: true, action_link });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
