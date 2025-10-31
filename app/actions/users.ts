'use server';

import { createAdminClient } from '@/lib/supabase/server';

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
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
