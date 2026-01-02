import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuthCode, validateRedirectUri } from '@/lib/sso-service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appId = url.searchParams.get('app_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');

  if (!appId || !redirectUri) {
    return NextResponse.json({ error: 'Missing app_id or redirect_uri' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  await validateRedirectUri({ appId, redirectUri });
  const code = await createAuthCode({ userId: user.id, appId, redirectUri });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl);
}
