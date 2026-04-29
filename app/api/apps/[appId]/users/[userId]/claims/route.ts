import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { enforceRateLimit } from '@/lib/app-api-rate-limit';
import { logSSOEvent } from '@/lib/audit-service';
import { validateClaimValues, extractAppClaims } from '@/lib/app-api-validation';

type RouteContext = { params: Promise<{ appId: string; userId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { appId, userId } = await params;

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const auth = await authenticateAppRequest(request, appId);
  if (!auth.ok) return auth.response;

  const rateLimited = await enforceRateLimit(appId, 'read');
  if (rateLimited) return rateLimited;

  const { ipAddress, userAgent, authMethod } = auth;

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const appClaims = extractAppClaims(data.user, appId);

    logSSOEvent({
      eventType: 'user_claims_get_success',
      appId,
      userId,
      ipAddress,
      userAgent,
      metadata: { auth_method: authMethod },
    });

    return NextResponse.json({
      user_id: userId,
      email: data.user.email,
      app_claims: appClaims,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logSSOEvent({
      eventType: 'user_claims_get_error',
      appId,
      userId,
      ipAddress,
      userAgent,
      errorCode: 'server_error',
      metadata: { error_message: message, auth_method: authMethod },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { appId, userId } = await params;

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await authenticateAppRequest(request, appId, body);
  if (!auth.ok) return auth.response;

  const rateLimited = await enforceRateLimit(appId, 'write');
  if (rateLimited) return rateLimited;

  // app_secret already stripped by authenticateAppRequest

  const { ipAddress, userAgent, authMethod } = auth;

  // Allowed claim keys — cannot set claims_admin or another app's claims
  const ALLOWED_KEYS = ['enabled', 'role', 'permissions', 'metadata'] as const;
  type AllowedKey = (typeof ALLOWED_KEYS)[number];

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: `No valid fields provided. Allowed: ${ALLOWED_KEYS.join(', ')}` },
      { status: 400 }
    );
  }

  const validationError = validateClaimValues(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const supabase = await createAdminClient();

    // Verify user exists
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Deep-merge metadata rather than clobbering it. set_app_claims_batch
    // uses a shallow JSONB merge (current_app || p_claims), so a PATCH with
    // { metadata: { tier: "pro" } } would wipe out sibling keys like
    // plan_features. Merge incoming metadata with the existing object (using
    // the user record we already fetched above — no extra round-trip).
    if (
      updates.metadata &&
      typeof updates.metadata === 'object' &&
      !Array.isArray(updates.metadata)
    ) {
      const existingApps = (userData.user.app_metadata?.apps ?? {}) as Record<
        string,
        Record<string, unknown> | undefined
      >;
      const existingMetadata =
        (existingApps[appId]?.metadata as Record<string, unknown> | undefined) ??
        {};
      updates.metadata = {
        ...existingMetadata,
        ...(updates.metadata as Record<string, unknown>),
      };
    }

    // Apply claim updates atomically via batch RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_app_claims_batch', {
      p_uid: userId,
      p_app_id: appId,
      p_claims: updates,
    });
    if (rpcError) throw rpcError;

    const result = rpcResult as { status: string; updated_at: string; app_claims: Record<string, unknown> } | null;
    if (!result || result.status !== 'OK') {
      throw new Error(result?.status ?? 'Unexpected RPC result');
    }

    logSSOEvent({
      eventType: 'user_claims_set_success',
      appId,
      userId,
      ipAddress,
      userAgent,
      metadata: { updated_fields: Object.keys(updates), auth_method: authMethod },
    });

    return NextResponse.json({
      user_id: userId,
      app_claims: result.app_claims,
      updated_at: result.updated_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logSSOEvent({
      eventType: 'user_claims_set_error',
      appId,
      userId,
      ipAddress,
      userAgent,
      errorCode: 'server_error',
      metadata: { error_message: message, auth_method: authMethod },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { appId, userId } = await params;

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // Empty body is fine for DELETE
  }

  const auth = await authenticateAppRequest(request, appId, body);
  if (!auth.ok) return auth.response;

  const rateLimitedDel = await enforceRateLimit(appId, 'write');
  if (rateLimitedDel) return rateLimitedDel;

  // app_secret already stripped by authenticateAppRequest

  const { ipAddress, userAgent, authMethod } = auth;

  try {
    const supabase = await createAdminClient();

    // Verify user exists
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) throw userError;
    if (!userData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Set enabled: false and clear role/permissions atomically
    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_app_claims_batch', {
      p_uid: userId,
      p_app_id: appId,
      p_claims: { enabled: false },
    });
    if (rpcError) throw rpcError;

    const result = rpcResult as { status: string; updated_at: string } | null;
    if (!result || result.status !== 'OK') {
      throw new Error(result?.status ?? 'Unexpected RPC result');
    }

    // Clear role and permissions — defensive: ignore errors if claims don't exist
    for (const claim of ['role', 'permissions']) {
      try {
        await supabase.rpc('delete_app_claim', {
          uid: userId,
          app_id: appId,
          claim,
        });
      } catch {
        // Claim may not exist — safe to ignore
      }
    }

    logSSOEvent({
      eventType: 'user_claims_delete_success',
      appId,
      userId,
      ipAddress,
      userAgent,
      metadata: { auth_method: authMethod },
    });

    return NextResponse.json({
      user_id: userId,
      app_id: appId,
      revoked: true,
      revoked_at: result.updated_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logSSOEvent({
      eventType: 'user_claims_delete_error',
      appId,
      userId,
      ipAddress,
      userAgent,
      errorCode: 'server_error',
      metadata: { error_message: message, auth_method: authMethod },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
