'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { BanDuration, MFAFactor, UpdateProfileData } from '@/types/claims';

export interface CreateUserParams {
  email: string;
  password?: string;
  isClaimsAdmin?: boolean;
}

export interface InviteUserParams {
  email: string;
  isClaimsAdmin?: boolean;
}

/**
 * Create a new user with password (admin only)
 */
export async function createUserWithPassword(params: CreateUserParams) {
  try {
    const supabase = await createAdminClient();

    // Create user with password
    const { data, error } = await supabase.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {},
      app_metadata: params.isClaimsAdmin ? { claims_admin: true } : {},
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Invite a user via email link (admin only)
 */
export async function inviteUserWithEmail(params: InviteUserParams) {
  try {
    const supabase = await createAdminClient();

    // Get the origin for the redirect URL
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3050';

    // Create user without password and send invite email
    const { data, error } = await supabase.auth.admin.createUser({
      email: params.email,
      email_confirm: false, // User needs to confirm via email
      user_metadata: {},
      app_metadata: params.isClaimsAdmin ? { claims_admin: true } : {},
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Send password recovery email which will allow them to set a password
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      params.email,
      {
        redirectTo: `${origin}/reset-password`,
      }
    );

    if (inviteError) {
      return { success: false, error: inviteError.message };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Trigger password reset for a user (admin only)
 */
export async function triggerPasswordReset(userEmail: string) {
  try {
    const supabase = await createAdminClient();

    // Get the origin for the redirect URL
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3050';

    // Generate and send password recovery email
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${origin}/reset-password`,
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

/**
 * Delete a user (admin only)
 */
export async function deleteUser(userId: string) {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.admin.deleteUser(userId);

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
// Profile Management (Admin)
// =============================================================================

/**
 * Update a user's profile (admin only)
 */
export async function updateUserProfileAdmin(
  userId: string,
  data: UpdateProfileData
) {
  try {
    const supabase = await createAdminClient();

    const updateData: {
      email?: string;
      phone?: string;
      user_metadata?: Record<string, unknown>;
    } = {};

    if (data.email) {
      updateData.email = data.email;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone || '';
    }

    // Update user_metadata for display_name and avatar_url
    if (data.display_name !== undefined || data.avatar_url !== undefined) {
      // First get current metadata
      const { data: userData, error: getUserError } =
        await supabase.auth.admin.getUserById(userId);

      if (getUserError) {
        return { success: false, error: getUserError.message };
      }

      updateData.user_metadata = {
        ...userData.user.user_metadata,
        ...(data.display_name !== undefined && { display_name: data.display_name }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      };
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, updateData);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

// =============================================================================
// MFA Management (Admin)
// =============================================================================

/**
 * List MFA factors for a user (admin only)
 */
export async function listUserMFAFactors(userId: string): Promise<{
  success: boolean;
  factors?: MFAFactor[];
  error?: string;
}> {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase.auth.admin.mfa.listFactors({
      userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Transform the factors to our type
    const factors: MFAFactor[] = (data.factors || []).map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name,
      factor_type: f.factor_type as 'totp' | 'phone',
      status: f.status as 'verified' | 'unverified',
      created_at: f.created_at,
      updated_at: f.updated_at,
      phone: (f as { phone?: string }).phone,
    }));

    return { success: true, factors };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Delete an MFA factor for a user (admin only)
 */
export async function deleteMFAFactorAdmin(
  userId: string,
  factorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.admin.mfa.deleteFactor({
      userId,
      id: factorId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

// =============================================================================
// User Status Management (Admin)
// =============================================================================

/**
 * Ban a user for a specified duration (admin only)
 */
export async function banUser(
  userId: string,
  duration: BanDuration
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: duration,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Unban a user (admin only)
 */
export async function unbanUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Manually confirm a user's email (admin only)
 */
export async function confirmUserEmail(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Resend confirmation email to a user (admin only)
 */
export async function resendConfirmationEmail(
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: userEmail,
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
