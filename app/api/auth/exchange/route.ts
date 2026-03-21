import { NextResponse } from 'next/server';
import { debugLog, debugWarn } from '@/lib/auth-debug';
import { createAdminClient } from '@/lib/supabase/server';
import { consumeAuthCode } from '@/lib/sso-service';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { logSSOEvent } from '@/lib/audit-service';
import { extractAppClaims } from '@/lib/app-api-validation';

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', error_code: 'invalid_request' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code : null;
  const appId = typeof body.app_id === 'string' ? body.app_id : null;

  if (!code || !appId) {
    logSSOEvent({
      eventType: 'token_exchange_error',
      appId: appId || undefined,
      errorCode: 'invalid_request',
      metadata: { reason: 'missing_code_or_app_id' },
    });
    return NextResponse.json({ error: 'Missing code or app_id', error_code: 'invalid_request' }, { status: 400 });
  }

  // Authenticate using shared auth helper (supports both API key and app_secret)
  const auth = await authenticateAppRequest(request, appId, body, {
    auditEventType: 'token_exchange_error',
  });
  if (!auth.ok) return auth.response;

  // app_secret already stripped by authenticateAppRequest

  const { ipAddress, userAgent, authMethod } = auth;

  try {
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
        ipAddress,
        userAgent,
      });
      return NextResponse.json({ error: 'User not found', error_code: 'user_not_found' }, { status: 404 });
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
        ipAddress,
        userAgent,
        metadata: {
          expected_user_id: userId,
          actual_user_id: user.id,
          email: user.email,
        },
      });
      return NextResponse.json({ error: 'Internal server error', error_code: 'server_error' }, { status: 500 });
    }

    const appClaims = extractAppClaims(user, appId);

    // Fetch profile from access_broker_app.profiles
    const { data: profileData } = await supabase
      .schema('access_broker_app')
      .from('profiles')
      .select('display_name, first_name, last_name, avatar_url, timezone, locale')
      .eq('user_id', user.id)
      .single();

    logSSOEvent({
      eventType: 'token_exchange_success',
      appId,
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { auth_method: authMethod },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profileData ? {
        display_name: profileData.display_name,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        avatar_url: profileData.avatar_url,
        timezone: profileData.timezone,
        locale: profileData.locale,
      } : null,
      app_id: appId,
      app_claims: appClaims,
      expires_in: 300,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';

    // Determine error code and HTTP status from message
    let errorCode = 'server_error';
    let status = 500;
    if (message.includes('expired') || message.includes('Invalid')) {
      errorCode = 'invalid_code';
      status = 400;
    }

    logSSOEvent({
      eventType: 'token_exchange_error',
      appId,
      errorCode,
      ipAddress,
      userAgent,
      metadata: { error_message: message },
    });

    const errorMessage = status === 400 ? 'Invalid or expired code' : 'Internal server error';
    return NextResponse.json({ error: errorMessage, error_code: errorCode }, { status });
  }
}
