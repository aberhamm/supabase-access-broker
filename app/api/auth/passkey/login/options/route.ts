import { NextResponse } from 'next/server';
import { generateAuthenticationOptionsForLogin, getDefaultPasskeyRpIdDebug } from '@/lib/passkey-service';

export async function POST(request: Request) {
  try {
    await request.json().catch(() => ({}));
    const { options } = await generateAuthenticationOptionsForLogin();
    return NextResponse.json({ options, debug: getDefaultPasskeyRpIdDebug() });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
