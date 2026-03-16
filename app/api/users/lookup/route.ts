import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { logSSOEvent } from '@/lib/audit-service';
import { extractAppClaims } from '@/lib/app-api-validation';

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const appId = typeof body.app_id === 'string' ? body.app_id : null;

  if (!appId) {
    logSSOEvent({
      eventType: 'user_lookup_error',
      errorCode: 'invalid_request',
      metadata: { reason: 'missing_app_id' },
    });
    return NextResponse.json({ error: 'Missing app_id' }, { status: 400 });
  }

  // Authenticate using shared auth helper (supports both API key and app_secret)
  const auth = await authenticateAppRequest(request, appId, body, {
    auditEventType: 'user_lookup_error',
  });
  if (!auth.ok) return auth.response;

  // app_secret already stripped by authenticateAppRequest

  const { ipAddress, userAgent, authMethod } = auth;

  const userId = typeof body.user_id === 'string' ? body.user_id : null;
  const email = typeof body.email === 'string' ? body.email : null;
  const telegramId = typeof body.telegram_id === 'number' ? body.telegram_id : null;

  const lookupCount = [userId, email, telegramId].filter((value) => value !== null).length;
  if (lookupCount === 0) {
    logSSOEvent({
      eventType: 'user_lookup_error',
      appId,
      errorCode: 'invalid_request',
      ipAddress,
      userAgent,
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
      ipAddress,
      userAgent,
      metadata: { reason: 'multiple_lookup_identifiers' },
    });
    return NextResponse.json(
      { error: 'Provide only one lookup identifier' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createAdminClient();

    const lookupMethod = userId ? 'user_id' : email ? 'email' : 'telegram_id';

    const { data, error } = await supabase.rpc('lookup_user_by_identifier', {
      p_user_id: userId,
      p_email: email,
      p_telegram_id: telegramId,
    });
    if (error) throw error;

    const user = data?.[0] as { id: string; email: string; raw_app_meta_data: Record<string, unknown> } | undefined;

    if (!user) {
      logSSOEvent({
        eventType: 'user_lookup_error',
        appId,
        errorCode: 'user_not_found',
        ipAddress,
        userAgent,
        metadata: { lookup_method: lookupMethod },
      });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract app claims using raw_app_meta_data (RPC returns this, not app_metadata)
    const appMetadata = user.raw_app_meta_data as Record<string, unknown> | undefined;
    const apps = appMetadata?.apps as Record<string, unknown> | undefined;
    const appClaims = (apps?.[appId] ?? null) as Record<string, unknown> | null;

    logSSOEvent({
      eventType: 'user_lookup_success',
      appId,
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { lookup_method: lookupMethod, auth_method: authMethod },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      app_claims: appClaims,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';

    logSSOEvent({
      eventType: 'user_lookup_error',
      appId,
      errorCode: 'server_error',
      ipAddress,
      userAgent,
      metadata: { error_message: message },
    });

    // Return generic error to avoid leaking internal details
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
