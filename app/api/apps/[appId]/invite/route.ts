import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { enforceRateLimit } from '@/lib/app-api-rate-limit';
import { logSSOEvent } from '@/lib/audit-service';
import { isValidEmail, validateClaimValues, extractAppClaims } from '@/lib/app-api-validation';

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

  const rateLimited = await enforceRateLimit(appId, 'write');
  if (rateLimited) return rateLimited;

  // app_secret already stripped by authenticateAppRequest

  const { ipAddress, userAgent, authMethod } = auth;

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null;
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Validate role and permissions using shared validator
  const validationError = validateClaimValues(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
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
      // Create new user — handle race condition where another request
      // creates the same user concurrently
      try {
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
      } catch (createErr) {
        // If user was created by a concurrent request, retry lookup
        const msg = createErr instanceof Error ? createErr.message : '';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists') || msg.toLowerCase().includes('registered')) {
          const { data: retryData } = await supabase.rpc('lookup_user_by_identifier', {
            p_user_id: null,
            p_email: email,
            p_telegram_id: null,
          });
          const retryUser = Array.isArray(retryData) ? retryData[0] : null;
          if (!retryUser?.id) throw createErr; // re-throw if still not found
          userId = retryUser.id as string;
        } else {
          throw createErr;
        }
      }
    }

    // Set app claims atomically
    const claimsToSet: Record<string, unknown> = { enabled: true };
    if (role !== undefined) claimsToSet.role = role;
    if (permissions !== undefined) claimsToSet.permissions = permissions;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_app_claims_batch', {
      p_uid: userId,
      p_app_id: appId,
      p_claims: claimsToSet,
    });
    if (rpcError) throw rpcError;

    const result = rpcResult as { status: string; app_claims: Record<string, unknown> } | null;
    if (!result || result.status !== 'OK') {
      throw new Error(result?.status ?? 'Unexpected RPC result');
    }

    logSSOEvent({
      eventType: 'user_invite_success',
      appId,
      userId,
      ipAddress,
      userAgent,
      metadata: { created: userCreated, send_email: sendEmail, auth_method: authMethod },
    });

    return NextResponse.json({
      user_id: userId,
      email,
      created: userCreated,
      app_claims: result.app_claims,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logSSOEvent({
      eventType: 'user_invite_error',
      appId,
      ipAddress,
      userAgent,
      errorCode: 'server_error',
      metadata: { error_message: message, auth_method: authMethod },
    });
    // Return generic error — do not leak internal details to caller
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
