'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { MFAFactor, TOTPEnrollment, UpdateProfileData } from '@/types/claims';

// =============================================================================
// Profile Management (Self-Service)
// =============================================================================

/**
 * Update the current user's own profile
 */
export async function updateOwnProfile(
  data: UpdateProfileData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const updateData: {
      email?: string;
      phone?: string;
      data?: Record<string, unknown>;
    } = {};

    if (data.email) {
      updateData.email = data.email;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone || '';
    }

    // Use the data field for user_metadata updates
    if (data.display_name !== undefined || data.avatar_url !== undefined) {
      updateData.data = {
        ...(data.display_name !== undefined && { display_name: data.display_name }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      };
    }

    const { error } = await supabase.auth.updateUser(updateData);

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

/**
 * Change the current user's password
 */
export async function changePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

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


