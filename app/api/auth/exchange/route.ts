import { NextResponse } from 'next/server';
import { debugLog, debugWarn } from '@/lib/auth-debug';
import { createAdminClient } from '@/lib/supabase/server';
import { consumeAuthCode, getSsoAppAuthConfig, sha256Hex, timingSafeEqualHex } from '@/lib/sso-service';
import { logSSOEvent, extractClientIP } from '@/lib/audit-service';

export async function POST(request: Request) {
  // Common audit context
  const auditContext = {
    ipAddress: extractClientIP(request) || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };

  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code : null;
    const appId = typeof body?.app_id === 'string' ? body.app_id : null;
    const appSecret = typeof body?.app_secret === 'string' ? body.app_secret : null;

    if (!code || !appId) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId: appId || undefined,
        errorCode: 'invalid_request',
        ...auditContext,
        metadata: { reason: 'missing_code_or_app_id' },
      });
      return NextResponse.json({ error: 'Missing code or app_id' }, { status: 400 });
    }

    const appConfig = await getSsoAppAuthConfig(appId);

    if (!appConfig?.id) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId,
        errorCode: 'unknown_app',
        ...auditContext,
      });
      return NextResponse.json({ error: 'Unknown app_id' }, { status: 400 });
    }

    if (appConfig.enabled === false) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId,
        errorCode: 'app_disabled',
        ...auditContext,
      });
      return NextResponse.json({ error: 'App is disabled' }, { status: 403 });
    }

    if (!appConfig.ssoClientSecretHash) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId,
        errorCode: 'secret_not_configured',
        ...auditContext,
      });
      return NextResponse.json({ error: 'App secret is not configured' }, { status: 403 });
    }

    if (!appSecret) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId,
        errorCode: 'missing_secret',
        ...auditContext,
      });
      return NextResponse.json({ error: 'Missing app_secret' }, { status: 401 });
    }

    const computed = sha256Hex(appSecret);
    const ok = timingSafeEqualHex(computed, appConfig.ssoClientSecretHash);
    if (!ok) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId,
        errorCode: 'invalid_secret',
        ...auditContext,
        metadata: { reason: 'secret_mismatch' },
      });
      return NextResponse.json({ error: 'Invalid app_secret' }, { status: 401 });
    }

    const supabase = await createAdminClient();
    const { userId } = await consumeAuthCode({ code, appId });

    debugLog('[SSO Exchange] Auth code consumed', {
      appId,
      userId,
    });

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr) throw userErr;

    const user = userData.user;
    if (!user) {
      logSSOEvent({
        eventType: 'token_exchange_error',
        appId,
        userId,
        errorCode: 'user_not_found',
        ...auditContext,
      });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    debugLog('[SSO Exchange] User resolved', {
      appId,
      userId: user.id,
      email: user.email,
    });

    if (user.id !== userId) {
      debugWarn('[SSO Exchange] User ID mismatch after lookup', {
        appId,
        expectedUserId: userId,
        actualUserId: user.id,
        email: user.email,
      });
      logSSOEvent({
        eventType: 'token_exchange_user_id_mismatch',
        appId,
        userId,
        errorCode: 'user_id_mismatch',
        ...auditContext,
        metadata: {
          expected_user_id: userId,
          actual_user_id: user.id,
          email: user.email,
        },
      });
      return NextResponse.json({ error: 'User ID validation failed' }, { status: 500 });
    }

    const appMetadata = user.app_metadata as unknown;
    const apps =
      appMetadata && typeof appMetadata === 'object' && 'apps' in (appMetadata as Record<string, unknown>)
        ? ((appMetadata as { apps?: unknown }).apps as unknown)
        : undefined;
    const appClaims =
      apps && typeof apps === 'object'
        ? ((apps as Record<string, unknown>)[appId] ?? null)
        : null;
    // Log successful exchange
    logSSOEvent({
      eventType: 'token_exchange_success',
      appId,
      userId: user.id,
      ...auditContext,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      app_id: appId,
      app_claims: appClaims,
      expires_in: 300,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';

    // Determine error code from message
    let errorCode = 'server_error';
    if (message.includes('expired') || message.includes('Invalid')) {
      errorCode = 'invalid_code';
    }

    logSSOEvent({
      eventType: 'token_exchange_error',
      errorCode,
      ...auditContext,
      metadata: { error_message: message },
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
