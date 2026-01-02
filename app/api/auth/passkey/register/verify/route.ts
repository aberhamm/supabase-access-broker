import { NextResponse } from 'next/server';
import { verifyRegistrationForCurrentUser } from '@/lib/passkey-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = body?.response;
    const name = body?.name ?? null;

    if (!response) {
      return NextResponse.json({ error: 'Missing response' }, { status: 400 });
    }

    const verification = await verifyRegistrationForCurrentUser({ response, name });
    return NextResponse.json({
      verified: verification.verified,
      registrationInfo: verification.registrationInfo ? { fmt: verification.registrationInfo.fmt } : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
