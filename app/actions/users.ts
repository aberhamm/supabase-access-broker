'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isClaimsAdmin, setAppClaim } from '@/lib/claims';
import { getAppUrl } from '@/lib/app-url';
import { revalidatePath } from 'next/cache';
import type { BanDuration, MFAFactor, UpdateProfileData } from '@/types/claims';
import { validatePassword } from '@/lib/password-policy';
import { assertStepUp, MFA_STEP_UP_REQUIRED, MFA_ENROLLMENT_REQUIRED } from '@/lib/mfa-gate';

function withCode(error: unknown, fallback: string): { success: false; error: string; code?: string } {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    if (code === MFA_STEP_UP_REQUIRED || code === MFA_ENROLLMENT_REQUIRED) {
      return { success: false, error: error.message, code };
    }
    return { success: false, error: error.message || fallback };
  }
  return { success: false, error: fallback };
}

export interface CreateUserParams {
  email: string;
  password?: string;
  isClaimsAdmin?: boolean;
}

export interface InviteUserParams {
  email: string;
  isClaimsAdmin?: boolean;
}

async function requireClaimsAdmin(opts?: { stepUp?: boolean }) {
  const sessionClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized: You must be signed in');
  }

  const { data: isAdmin, error: adminError } = await isClaimsAdmin(sessionClient);

  if (adminError) {
    throw new Error(adminError.message || 'Failed to verify admin access');
  }

  if (!isAdmin) {
    throw new Error('Unauthorized: You must be a claims_admin');
  }

  // Step-up: user-management writes (create, invite, delete, password reset
  // for another user) require MFA when enrolled.
  if (opts?.stepUp) {
    await assertStepUp(sessionClient);
  }

  return createAdminClient();
}

/**
 * Create a new user with password (admin only)
 */
export async function createUserWithPassword(params: CreateUserParams) {
  try {
    if (params.password) {
      const policy = await validatePassword(params.password);
      if (!policy.ok) {
        return { success: false, error: policy.error };
      }
    }

    const supabase = await requireClaimsAdmin({ stepUp: true });

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
    return withCode(error, 'Failed to create user');
  }
}

/**
 * Invite a user via email link (admin only)
 */
export async function inviteUserWithEmail(params: InviteUserParams) {
  try {
    const supabase = await requireClaimsAdmin({ stepUp: true });

    // Get the origin for the redirect URL
    const origin = getAppUrl();

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
    return withCode(error, 'Failed to invite user');
  }
}

/**
 * Trigger password reset for a user (admin only)
 */
export async function triggerPasswordReset(userEmail: string) {
  try {
    const supabase = await requireClaimsAdmin();

    // Get the origin for the redirect URL
    const origin = getAppUrl();

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
    const supabase = await requireClaimsAdmin({ stepUp: true });

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return withCode(error, 'Failed to delete user');
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
    const supabase = await requireClaimsAdmin();

    // Update auth fields (email, phone) via Supabase Auth admin API
    if (data.email || data.phone !== undefined) {
      const authUpdate: { email?: string; phone?: string } = {};
      if (data.email) authUpdate.email = data.email;
      if (data.phone !== undefined) authUpdate.phone = data.phone || '';

      const { error } = await supabase.auth.admin.updateUserById(userId, authUpdate);
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
        p_user_id: userId,
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
    const supabase = await requireClaimsAdmin();

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
): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const supabase = await requireClaimsAdmin({ stepUp: true });

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
    return withCode(error, 'Failed to delete MFA factor');
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
    const supabase = await requireClaimsAdmin();

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
    const supabase = await requireClaimsAdmin();

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
    const supabase = await requireClaimsAdmin();

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
/**
 * Grant access to multiple apps with roles in a single call (admin only)
 */
export async function grantMultiAppAccess(
  userId: string,
  appAccess: Array<{ appId: string; role: string }>
): Promise<{ success: boolean; errors: string[]; code?: string }> {
  try {
    const supabase = await requireClaimsAdmin({ stepUp: true });
    const errors: string[] = [];

    for (const { appId, role } of appAccess) {
      const { error: enableError } = await setAppClaim(supabase, userId, appId, 'enabled', true);

      if (enableError) {
        errors.push(`Failed to enable ${appId}: ${enableError.message}`);
        continue;
      }

      const { error: roleError } = await setAppClaim(supabase, userId, appId, 'role', role);

      if (roleError) {
        errors.push(`Failed to set role for ${appId}: ${roleError.message}`);
      }
    }

    revalidatePath(`/users/${userId}`);
    revalidatePath('/users');

    return { success: errors.length === 0, errors };
  } catch (error) {
    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code;
      if (code === MFA_STEP_UP_REQUIRED || code === MFA_ENROLLMENT_REQUIRED) {
        return { success: false, errors: [error.message], code };
      }
      return { success: false, errors: [error.message] };
    }
    return { success: false, errors: ['Failed to grant app access'] };
  }
}

export async function resendConfirmationEmail(
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await requireClaimsAdmin();

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
