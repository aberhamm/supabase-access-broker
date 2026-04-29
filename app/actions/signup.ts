'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Auto-grant app access for self-signup users.
 * Called from the signup page after password/OTP auth succeeds client-side.
 * Validates that the app allows self-signup before granting.
 */
// Single non-disclosive error string for any "you can't sign up to this app" condition.
// Avoids enumeration of which apps exist / are enabled / allow self-signup.
const SELF_SIGNUP_DENIED = 'This app is not available for self-signup.';

export async function autoGrantAppAccess(appId: string): Promise<{ error: string | null }> {
  try {
    if (!appId || appId.length > 64) {
      return { error: SELF_SIGNUP_DENIED };
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Not authenticated' };
    }

    const existingClaims = (user.app_metadata?.apps as Record<string, { enabled?: boolean }> | undefined)?.[appId];
    if (existingClaims?.enabled) {
      return { error: null };
    }

    const adminClient = await createAdminClient();
    const { data: appData, error: appError } = await adminClient
      .schema('access_broker_app')
      .from('apps')
      .select('enabled,allow_self_signup,self_signup_default_role')
      .eq('id', appId)
      .single();

    if (appError || !appData || !appData.enabled || !appData.allow_self_signup) {
      return { error: SELF_SIGNUP_DENIED };
    }

    const defaultRole = appData.self_signup_default_role || 'user';

    const { data: rpcResult, error: rpcError } = await adminClient.rpc('set_app_claims_batch', {
      p_uid: user.id,
      p_app_id: appId,
      p_claims: { enabled: true, role: defaultRole },
    });

    if (rpcError) {
      return { error: 'Failed to grant access. Please try again.' };
    }

    const result = rpcResult as { status: string } | null;
    if (!result || result.status !== 'OK') {
      return { error: 'Failed to grant access. Please try again.' };
    }

    return { error: null };
  } catch {
    return { error: 'Failed to grant access. Please try again.' };
  }
}
