'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isClaimsAdmin, getAppUsers } from '@/lib/claims';
import { toggleAppAccessAction, setAppRoleAction } from '@/app/actions/claims';
import { revalidatePath } from 'next/cache';
import type { AppUser } from '@/types/claims';

async function requireClaimsAdmin() {
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

  return createAdminClient();
}

export async function getAppUsersAction(
  appId: string
): Promise<{ data: AppUser[] | null; error: string | null }> {
  try {
    const supabase = await requireClaimsAdmin();
    const { data, error } = await getAppUsers(supabase, appId);

    if (error) {
      return { data: null, error: error.message || 'Failed to fetch app users' };
    }

    return { data: (data as AppUser[]) || [], error: null };
  } catch (error) {
    const err = error as Error;
    return { data: null, error: err.message };
  }
}

export async function grantAppAccessByEmailAction(
  appId: string,
  email: string,
  role?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await requireClaimsAdmin();

    // Look up user by email
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      return { success: false, error: listError.message };
    }

    const user = listData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return { success: false, error: `No user found with email: ${email}` };
    }

    // Grant access
    const toggleResult = await toggleAppAccessAction(user.id, appId, true);
    if (toggleResult.error) {
      return { success: false, error: toggleResult.error };
    }

    // Set role if provided
    if (role) {
      const roleResult = await setAppRoleAction(user.id, appId, role);
      if (roleResult.error) {
        return { success: false, error: roleResult.error };
      }
    }

    revalidatePath(`/apps/${appId}`);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}
