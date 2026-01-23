import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logSSOEvent, extractClientIP } from '@/lib/audit-service';

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
  // Common audit context
  const auditContext = {
    ipAddress: extractClientIP(request) || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };

  try {
    const body = await request.json().catch(() => ({}));
    const appId = typeof body?.app_id === 'string' ? body.app_id : null;
    const appSecret = typeof body?.app_secret === 'string' ? body.app_secret : null;
    const userId = typeof body?.user_id === 'string' ? body.user_id : null;
    const email = typeof body?.email === 'string' ? body.email : null;
    const telegramId = typeof body?.telegram_id === 'number' ? body.telegram_id : null;

    if (!appId) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        errorCode: 'invalid_request',
        ...auditContext,
        metadata: { reason: 'missing_app_id' },
      });
      return NextResponse.json({ error: 'Missing app_id' }, { status: 400 });
    }

    const lookupCount = [userId, email, telegramId].filter((value) => value !== null).length;
    // At least one lookup identifier must be provided
    if (lookupCount === 0) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        appId,
        errorCode: 'invalid_request',
        ...auditContext,
        metadata: { reason: 'missing_lookup_identifier' },
      });
      return NextResponse.json(
        { error: 'Missing lookup identifier (user_id, email, or telegram_id)' },
        { status: 400 }
      );
    }
    if (lookupCount > 1) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        appId,
        errorCode: 'invalid_request',
        ...auditContext,
        metadata: { reason: 'multiple_lookup_identifiers' },
      });
      return NextResponse.json(
        { error: 'Provide only one lookup identifier' },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // Verify app credentials
    const { data: appRow, error: appErr } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('id,enabled,sso_client_secret_hash')
      .eq('id', appId)
      .maybeSingle();

    if (appErr) throw appErr;

    if (!appRow?.id) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        appId,
        errorCode: 'unknown_app',
        ...auditContext,
      });
      return NextResponse.json({ error: 'Unknown app_id' }, { status: 400 });
    }

    if (appRow.enabled === false) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        appId,
        errorCode: 'app_disabled',
        ...auditContext,
      });
      return NextResponse.json({ error: 'App is disabled' }, { status: 403 });
    }

    // If a secret hash is configured, require and verify it.
    if (appRow.sso_client_secret_hash) {
      if (!appSecret) {
        logSSOEvent({
          eventType: 'user_lookup_error',
          appId,
          errorCode: 'missing_secret',
          ...auditContext,
        });
        return NextResponse.json({ error: 'Missing app_secret' }, { status: 401 });
      }
      const computed = sha256Hex(appSecret);
      const ok = timingSafeEqualHex(computed, appRow.sso_client_secret_hash);
      if (!ok) {
        logSSOEvent({
          eventType: 'user_lookup_error',
          appId,
          errorCode: 'invalid_secret',
          ...auditContext,
          metadata: { reason: 'secret_mismatch' },
        });
        return NextResponse.json({ error: 'Invalid app_secret' }, { status: 401 });
      }
    }

    // Look up user by identifier
    let user: { id: string; email: string; raw_app_meta_data: Record<string, unknown> } | null =
      null;
    let lookupMethod = '';

    if (userId) {
      // Lookup by user_id (most efficient)
      const { data, error } = await supabase.rpc('lookup_user_by_identifier', {
        p_user_id: userId,
        p_email: null,
        p_telegram_id: null,
      });
      if (error) throw error;
      user = data?.[0] || null;
      lookupMethod = 'user_id';
    } else if (email) {
      // Lookup by email
      const { data, error } = await supabase.rpc('lookup_user_by_identifier', {
        p_user_id: null,
        p_email: email,
        p_telegram_id: null,
      });
      if (error) throw error;
      user = data?.[0] || null;
      lookupMethod = 'email';
    } else if (telegramId) {
      // Lookup by telegram_id
      const { data, error } = await supabase.rpc('lookup_user_by_identifier', {
        p_user_id: null,
        p_email: null,
        p_telegram_id: telegramId,
      });
      if (error) throw error;
      user = data?.[0] || null;
      lookupMethod = 'telegram_id';
    }

    if (!user) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        appId,
        errorCode: 'user_not_found',
        ...auditContext,
        metadata: { lookup_method: lookupMethod },
      });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract app claims and connected accounts
    const appMetadata = user.raw_app_meta_data as unknown;
    const apps =
      appMetadata && typeof appMetadata === 'object' && 'apps' in (appMetadata as Record<string, unknown>)
        ? ((appMetadata as { apps?: unknown }).apps as unknown)
        : undefined;
    const appClaims =
      apps && typeof apps === 'object'
        ? ((apps as Record<string, unknown>)[appId] ?? null)
        : null;
    const telegram =
      appMetadata &&
      typeof appMetadata === 'object' &&
      'telegram' in (appMetadata as Record<string, unknown>) &&
      typeof (appMetadata as Record<string, unknown>).telegram === 'object'
        ? ((appMetadata as Record<string, unknown>).telegram as Record<string, unknown>)
        : null;

    // Log successful lookup
    logSSOEvent({
      eventType: 'user_lookup_success',
      appId,
      userId: user.id,
      ...auditContext,
      metadata: { lookup_method: lookupMethod },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        connected_accounts: {
          telegram,
        },
      },
      app_claims: appClaims,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';

    logSSOEvent({
      eventType: 'user_lookup_error',
      errorCode: 'server_error',
      ...auditContext,
      metadata: { error_message: message },
    });

    // Return generic error to avoid leaking internal details
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
