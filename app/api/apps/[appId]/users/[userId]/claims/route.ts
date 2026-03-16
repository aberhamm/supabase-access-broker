import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { logSSOEvent } from '@/lib/audit-service';

type RouteContext = { params: Promise<{ appId: string; userId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractAppClaims(user: { app_metadata: Record<string, unknown> }, appId: string) {
  const apps = user.app_metadata?.apps as Record<string, unknown> | undefined;
  return (apps?.[appId] ?? null) as Record<string, unknown> | null;
}

/**
 * Validate the values for allowed claim keys.
 * Returns an error message string if invalid, null if valid.
 */
function validateClaimValues(body: Record<string, unknown>): string | null {
  if ('enabled' in body && typeof body.enabled !== 'boolean') {
    return 'enabled must be a boolean';
  }
  if ('role' in body) {
    if (typeof body.role !== 'string' || body.role.length === 0 || body.role.length > 64) {
      return 'role must be a non-empty string ≤ 64 characters';
    }
  }
  if ('permissions' in body) {
    const perms = body.permissions;
    if (
      !Array.isArray(perms) ||
      perms.length > 100 ||
      !perms.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 128)
    ) {
      return 'permissions must be an array of ≤ 100 non-empty strings, each ≤ 128 characters';
    }
  }
  if ('metadata' in body) {
    if (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata)) {
      return 'metadata must be a JSON object';
    }
    const serialized = JSON.stringify(body.metadata);
    if (serialized.length > 8192) {
      return 'metadata must not exceed 8 KB';
    }
  }
  return null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { appId, userId } = await params;

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const auth = await authenticateAppRequest(request, appId);
  if (!auth.ok) return auth.response;

  const { ipAddress, userAgent } = auth;

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    if (!data.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const appClaims = extractAppClaims(data.user, appId);

    logSSOEvent({
      eventType: 'user_claims_get_success',
      appId,
      userId,
      ipAddress,
      userAgent,
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
      metadata: { error_message: message },
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

  // Strip credential from body to prevent accidental logging downstream
  delete body.app_secret;

  const { ipAddress, userAgent } = auth;

  // Allowed claim keys — cannot set claims_admin or another app's claims
  const ALLOWED_KEYS = ['enabled', 'role', 'permissions', 'metadata'] as const;
  type AllowedKey = (typeof ALLOWED_KEYS)[number];

  const updates: Array<{ claim: AllowedKey; value: unknown }> = [];
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      updates.push({ claim: key, value: body[key] });
    }
  }

  if (updates.length === 0) {
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
    if (userError) throw userError;
    if (!userData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Apply each claim update
    for (const { claim, value } of updates) {
      const { data: result, error } = await supabase.rpc('set_app_claim', {
        uid: userId,
        app_id: appId,
        claim,
        value: JSON.stringify(value),
      });
      if (error) throw error;
      if (result !== 'OK') throw new Error(result as string);
    }

    // Fetch updated claims
    const { data: updatedUser, error: fetchError } = await supabase.auth.admin.getUserById(userId);
    if (fetchError) throw fetchError;

    const updatedClaims = updatedUser.user
      ? extractAppClaims(updatedUser.user, appId)
      : null;

    logSSOEvent({
      eventType: 'user_claims_set_success',
      appId,
      userId,
      ipAddress,
      userAgent,
      metadata: { updated_fields: updates.map((u) => u.claim) },
    });

    return NextResponse.json({
      user_id: userId,
      app_claims: updatedClaims,
      updated_at: new Date().toISOString(),
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
      metadata: { error_message: message },
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

  // Strip credential from body to prevent accidental logging downstream
  delete body.app_secret;

  const { ipAddress, userAgent } = auth;

  try {
    const supabase = await createAdminClient();

    // Verify user exists
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) throw userError;
    if (!userData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Set enabled: false
    const { data: disableResult, error: disableError } = await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: appId,
      claim: 'enabled',
      value: JSON.stringify(false),
    });
    if (disableError) throw disableError;
    if (disableResult !== 'OK') throw new Error(disableResult as string);

    // Clear role and permissions
    for (const claim of ['role', 'permissions']) {
      const { error } = await supabase.rpc('delete_app_claim', {
        uid: userId,
        app_id: appId,
        claim,
      });
      if (error) throw error;
    }

    const revokedAt = new Date().toISOString();

    logSSOEvent({
      eventType: 'user_claims_delete_success',
      appId,
      userId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      user_id: userId,
      app_id: appId,
      revoked: true,
      revoked_at: revokedAt,
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
      metadata: { error_message: message },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
