import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { logSSOEvent } from '@/lib/audit-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

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

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null;
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  // Validate role
  if ('role' in body) {
    if (typeof body.role !== 'string' || body.role.length === 0 || body.role.length > 64) {
      return NextResponse.json({ error: 'role must be a non-empty string ≤ 64 characters' }, { status: 400 });
    }
  }

  // Validate permissions
  if ('permissions' in body) {
    const perms = body.permissions;
    if (
      !Array.isArray(perms) ||
      perms.length > 100 ||
      !perms.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 128)
    ) {
      return NextResponse.json(
        { error: 'permissions must be an array of ≤ 100 non-empty strings, each ≤ 128 characters' },
        { status: 400 }
      );
    }
  }

  const role = typeof body.role === 'string' ? body.role : undefined;
  const permissions = Array.isArray(body.permissions) ? (body.permissions as string[]) : undefined;
  const sendEmail = body.send_email !== false; // default true

  try {
    const supabase = await createAdminClient();

    // Look up existing user by email
    const { data: lookupData } = await supabase.rpc('lookup_user_by_identifier', {
      p_user_id: null,
      p_email: email,
      p_telegram_id: null,
    });

    let userId: string;
    let userCreated = false;

    const existingUser = Array.isArray(lookupData) ? lookupData[0] : null;

    if (existingUser?.id) {
      userId = existingUser.id as string;
    } else {
      // Create new user
      if (sendEmail) {
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
        if (inviteError) throw inviteError;
        userId = inviteData.user.id;
      } else {
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
        });
        if (createError) throw createError;
        userId = createData.user.id;
      }
      userCreated = true;
    }

    // Set app claims
    const claimsToSet: Array<{ claim: string; value: unknown }> = [
      { claim: 'enabled', value: true },
    ];
    if (role !== undefined) claimsToSet.push({ claim: 'role', value: role });
    if (permissions !== undefined) claimsToSet.push({ claim: 'permissions', value: permissions });

    for (const { claim, value } of claimsToSet) {
      const { data: result, error } = await supabase.rpc('set_app_claim', {
        uid: userId,
        app_id: appId,
        claim,
        value: JSON.stringify(value),
      });
      if (error) throw error;
      if (result !== 'OK') throw new Error(result as string);
    }

    // Fetch final claims
    const { data: userData, error: fetchError } = await supabase.auth.admin.getUserById(userId);
    if (fetchError) throw fetchError;

    const appMeta = userData.user?.app_metadata as { apps?: Record<string, unknown> } | undefined;
    const appClaims = appMeta?.apps?.[appId] ?? null;

    logSSOEvent({
      eventType: 'user_invite_success',
      appId,
      userId,
      ipAddress,
      userAgent,
      metadata: { created: userCreated, send_email: sendEmail },
    });

    return NextResponse.json({
      user_id: userId,
      email,
      created: userCreated,
      app_claims: appClaims,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logSSOEvent({
      eventType: 'user_invite_error',
      appId,
      ipAddress,
      userAgent,
      errorCode: 'server_error',
      metadata: { error_message: message },
    });
    // Return generic error — do not leak internal details to caller
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
