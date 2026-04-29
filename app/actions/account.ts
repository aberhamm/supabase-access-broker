'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { MFAFactor, TOTPEnrollment, UpdateProfileData } from '@/types/claims';
import { validateReturnUrl, type ReturnUrlValidation } from '@/lib/return-url';
import { validatePassword } from '@/lib/password-policy';
import { requireStepUp } from '@/lib/mfa-gate';

// =============================================================================
// Profile Management (Self-Service)
// =============================================================================

/**
 * Update the current user's own profile.
 * Profile fields (display_name, avatar_url, etc.) write to access_broker_app.profiles.
 * The profiles→auth trigger syncs display_name/avatar_url back to user_metadata.
 * Auth fields (email, phone) still go through supabase.auth.updateUser.
 */
export async function updateOwnProfile(
  data: UpdateProfileData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Update auth fields (email, phone) via Supabase Auth
    if (data.email || data.phone !== undefined) {
      const authUpdate: { email?: string; phone?: string } = {};
      if (data.email) authUpdate.email = data.email;
      if (data.phone !== undefined) authUpdate.phone = data.phone || '';

      const { error } = await supabase.auth.updateUser(authUpdate);
      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Update profile fields via profiles table RPC
    const hasProfileFields = data.display_name !== undefined
      || data.avatar_url !== undefined
      || data.timezone !== undefined
      || data.locale !== undefined;

    if (hasProfileFields) {
      const { data: result, error } = await supabase.rpc('update_user_profile', {
        p_user_id: user.id,
        ...(data.display_name !== undefined && { p_display_name: data.display_name }),
        ...(data.avatar_url !== undefined && { p_avatar_url: data.avatar_url }),
        ...(data.timezone !== undefined && { p_timezone: data.timezone }),
        ...(data.locale !== undefined && { p_locale: data.locale }),
      });

      if (error) {
        return { success: false, error: error.message };
      }
      if (typeof result === 'string' && result.startsWith('error:')) {
        return { success: false, error: result };
      }
    }

    revalidatePath('/account');
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Change the current user's password
 */
export async function changePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const policy = await validatePassword(newPassword);
    if (!policy.ok) {
      return { success: false, error: policy.error };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

// =============================================================================
// MFA Management (Self-Service)
// =============================================================================

/**
 * List the current user's MFA factors
 */
export async function listOwnMFAFactors(): Promise<{
  success: boolean;
  factors?: MFAFactor[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      return { success: false, error: error.message };
    }

    // Combine TOTP and phone factors
    const allFactors = [...(data.totp || []), ...(data.phone || [])];

    const factors: MFAFactor[] = allFactors.map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name,
      factor_type: f.factor_type as 'totp' | 'phone',
      status: f.status as 'verified' | 'unverified',
      created_at: f.created_at,
      updated_at: f.updated_at,
    }));

    return { success: true, factors };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Start TOTP enrollment for the current user
 * Returns QR code and secret for the user to scan
 */
export async function enrollTOTP(
  friendlyName?: string
): Promise<{
  success: boolean;
  enrollment?: TOTPEnrollment;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: friendlyName || 'Authenticator App',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const enrollment: TOTPEnrollment = {
      id: data.id,
      type: 'totp',
      totp: {
        qr_code: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    };

    return { success: true, enrollment };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Verify TOTP enrollment with a code from the authenticator app
 */
export async function verifyTOTP(
  factorId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      return { success: false, error: challengeError.message };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      return { success: false, error: verifyError.message };
    }

    revalidatePath('/account');
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Remove an MFA factor for the current user
 */
export async function unenrollMFAFactor(
  factorId: string
): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const supabase = await createClient();

    // Step-up: removing an MFA factor must require the *current* MFA factor
    // to be presented in this session. Otherwise a stolen-cookie attacker
    // can disable MFA entirely.
    const stepUp = await requireStepUp(supabase);
    if (!stepUp.ok) {
      return { success: false, error: stepUp.message, code: stepUp.code };
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/account');
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

// =============================================================================
// Return URL Validation (for external app redirects)
// =============================================================================

/**
 * Validate a return_url from a client component.
 * Wraps the server-side validation so client components can check
 * return URLs without direct access to the admin client.
 */
export async function getValidatedReturnUrl(
  returnUrl: string
): Promise<ReturnUrlValidation> {
  return validateReturnUrl(returnUrl);
}
