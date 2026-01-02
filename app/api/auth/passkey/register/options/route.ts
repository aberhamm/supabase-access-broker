import { NextResponse } from 'next/server';
import { generateRegistrationOptionsForCurrentUser } from '@/lib/passkey-service';

export async function GET() {
  try {
    const { options } = await generateRegistrationOptionsForCurrentUser();
    return NextResponse.json({ options });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
