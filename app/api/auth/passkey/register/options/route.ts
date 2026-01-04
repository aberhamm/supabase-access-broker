import { NextResponse } from 'next/server';
import { generateRegistrationOptionsForCurrentUser, getDefaultPasskeyRpIdDebug } from '@/lib/passkey-service';
import { createClient } from '@/lib/supabase/server';
import { debugLog } from '@/lib/auth-debug';

export async function GET() {
  try {
    // Debug: Check if we can get user in the route
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Passkey Register] Auth error:', authError);
      return NextResponse.json({ error: `Auth error: ${authError.message}` }, { status: 401 });
    }

    if (!user) {
      console.error('[Passkey Register] No user found in session');
      return NextResponse.json({ error: 'No user session found' }, { status: 401 });
    }

    debugLog('[Passkey Register] User authenticated');
    debugLog('[Passkey Register] WebAuthn config:', getDefaultPasskeyRpIdDebug());

    const { options } = await generateRegistrationOptionsForCurrentUser();
    debugLog('[Passkey Register] Generated options with rpId:', options.rp.id);
    return NextResponse.json({ options });
  } catch (e) {
    console.error('[Passkey Register] Full error:', e);
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
