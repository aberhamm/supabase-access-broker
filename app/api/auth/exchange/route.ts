import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { consumeAuthCode } from '@/lib/sso-service';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code : null;
    const appId = typeof body?.app_id === 'string' ? body.app_id : null;
    const appSecret = typeof body?.app_secret === 'string' ? body.app_secret : null;

    if (!code || !appId) {
      return NextResponse.json({ error: 'Missing code or app_id' }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: appRow, error: appErr } = await supabase
      .from('apps')
      .select('id,enabled,sso_client_secret_hash')
      .eq('id', appId)
      .maybeSingle();
    if (appErr) throw appErr;
    if (!appRow?.id) return NextResponse.json({ error: 'Unknown app_id' }, { status: 400 });
    if (appRow.enabled === false) return NextResponse.json({ error: 'App is disabled' }, { status: 403 });

    // If a secret hash is configured, require and verify it.
    if (appRow.sso_client_secret_hash) {
      if (!appSecret) {
        return NextResponse.json({ error: 'Missing app_secret' }, { status: 401 });
      }
      const computed = sha256Hex(appSecret);
      const ok = timingSafeEqualHex(computed, appRow.sso_client_secret_hash);
      if (!ok) return NextResponse.json({ error: 'Invalid app_secret' }, { status: 401 });
    }

    const { userId } = await consumeAuthCode({ code, appId });

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr) throw userErr;

    const user = userData.user;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const appMetadata = user.app_metadata as unknown;
    const apps =
      appMetadata && typeof appMetadata === 'object' && 'apps' in (appMetadata as Record<string, unknown>)
        ? ((appMetadata as { apps?: unknown }).apps as unknown)
        : undefined;
    const appClaims =
      apps && typeof apps === 'object'
        ? ((apps as Record<string, unknown>)[appId] ?? null)
        : null;

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      app_id: appId,
      app_claims: appClaims,
      expires_in: 300,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
