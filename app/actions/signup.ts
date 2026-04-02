'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Auto-grant app access for self-signup users.
 * Called from the signup page after password/OTP auth succeeds client-side.
 * Validates that the app allows self-signup before granting.
 */
export async function autoGrantAppAccess(appId: string): Promise<{ error: string | null }> {
  try {
    if (!appId || appId.length > 64) {
      return { error: 'Invalid app ID' };
    }

    // Get the current user from session
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Not authenticated' };
    }

    // Check if user already has access
    const existingClaims = (user.app_metadata?.apps as Record<string, { enabled?: boolean }> | undefined)?.[appId];
    if (existingClaims?.enabled) {
      return { error: null }; // Already has access, no-op
    }

    // Check if app exists and allows self-signup
    const adminClient = await createAdminClient();
    const { data: appData, error: appError } = await adminClient
      .schema('access_broker_app')
      .from('apps')
      .select('enabled,allow_self_signup,self_signup_default_role')
      .eq('id', appId)
      .single();

    if (appError || !appData) {
      return { error: 'App not found' };
    }

    if (!appData.enabled) {
      return { error: 'App is disabled' };
    }

    if (!appData.allow_self_signup) {
      return { error: 'Self-signup is not enabled for this app' };
    }

    const defaultRole = appData.self_signup_default_role || 'user';

    // Grant access via set_app_claims_batch RPC
    const { data: rpcResult, error: rpcError } = await adminClient.rpc('set_app_claims_batch', {
      p_uid: user.id,
      p_app_id: appId,
      p_claims: { enabled: true, role: defaultRole },
    });

    if (rpcError) {
      return { error: rpcError.message || 'Failed to grant access' };
    }

    const result = rpcResult as { status: string } | null;
    if (!result || result.status !== 'OK') {
      return { error: result?.status ?? 'Unexpected error granting access' };
    }

    return { error: null };
  } catch (e) {
    const err = e as Error;
    return { error: err.message || 'Failed to grant app access' };
  }
}
