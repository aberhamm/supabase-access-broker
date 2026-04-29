import { NextResponse } from 'next/server';
import { generateAuthenticationOptionsForLogin, getDefaultPasskeyRpIdDebug } from '@/lib/passkey-service';
import { enforceAuthLimit, getClientIp } from '@/lib/auth-rate-limit';

export async function POST(request: Request) {
  try {
    const limit = await enforceAuthLimit({
      action: 'passkey-options',
      ip: getClientIp(request.headers),
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSec) },
        },
      );
    }

    await request.json().catch(() => ({}));
    const { options } = await generateAuthenticationOptionsForLogin();
    return NextResponse.json({ options, debug: getDefaultPasskeyRpIdDebug() });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
