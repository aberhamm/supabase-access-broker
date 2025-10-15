'use server';

import { createClient } from '@/lib/supabase/server';
import {
  setClaim,
  deleteClaim,
  isClaimsAdmin,
  setAppClaim,
  deleteAppClaim,
  isAppAdmin,
} from '@/lib/claims';
import { revalidatePath } from 'next/cache';

export async function setClaimAction(
  uid: string,
  claim: string,
  value: string
) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  // Parse the value as JSON
  let parsedValue;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    return { error: 'Invalid JSON value' };
  }

  const { data, error } = await setClaim(supabase, uid, claim, parsedValue);

  if (error) {
    return { error: error.message || 'Failed to set claim' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

export async function deleteClaimAction(uid: string, claim: string) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data, error } = await deleteClaim(supabase, uid, claim);

  if (error) {
    return { error: error.message || 'Failed to delete claim' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

export async function toggleClaimsAdminAction(uid: string, isAdmin: boolean) {
  const supabase = await createClient();

  // Verify current user is claims_admin
  const { data: currentIsAdmin } = await isClaimsAdmin(supabase);
  if (!currentIsAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data, error } = await setClaim(
    supabase,
    uid,
    'claims_admin',
    isAdmin
  );

  if (error) {
    return { error: error.message || 'Failed to update claims_admin status' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

// ============================================================================
// Multi-App Server Actions
// ============================================================================

/**
 * Set a claim for a specific app
 */
export async function setAppClaimAction(
  uid: string,
  appId: string,
  claim: string,
  value: string
) {
  const supabase = await createClient();

  // Verify user is app admin or global admin
  const { data: isGlobalAdmin } = await isClaimsAdmin(supabase);
  const { data: isAppAdminUser } = await isAppAdmin(supabase, appId);

  if (!isGlobalAdmin && !isAppAdminUser) {
    return {
      error: `Unauthorized: You must be a claims_admin or ${appId} admin`,
    };
  }

  // Parse the value as JSON
  let parsedValue;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    return { error: 'Invalid JSON value' };
  }

  const { data, error } = await setAppClaim(
    supabase,
    uid,
    appId,
    claim,
    parsedValue
  );

  if (error) {
    return { error: error.message || 'Failed to set app claim' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

/**
 * Delete a claim from a specific app
 */
export async function deleteAppClaimAction(
  uid: string,
  appId: string,
  claim: string
) {
  const supabase = await createClient();

  // Verify user is app admin or global admin
  const { data: isGlobalAdmin } = await isClaimsAdmin(supabase);
  const { data: isAppAdminUser } = await isAppAdmin(supabase, appId);

  if (!isGlobalAdmin && !isAppAdminUser) {
    return {
      error: `Unauthorized: You must be a claims_admin or ${appId} admin`,
    };
  }

  const { data, error } = await deleteAppClaim(supabase, uid, appId, claim);

  if (error) {
    return { error: error.message || 'Failed to delete app claim' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

/**
 * Toggle app access for a user (enable/disable)
 */
export async function toggleAppAccessAction(
  uid: string,
  appId: string,
  enabled: boolean
) {
  const supabase = await createClient();

  // Verify user is app admin or global admin
  const { data: isGlobalAdmin } = await isClaimsAdmin(supabase);
  const { data: isAppAdminUser } = await isAppAdmin(supabase, appId);

  if (!isGlobalAdmin && !isAppAdminUser) {
    return {
      error: `Unauthorized: You must be a claims_admin or ${appId} admin`,
    };
  }

  const { data, error } = await setAppClaim(
    supabase,
    uid,
    appId,
    'enabled',
    enabled
  );

  if (error) {
    return { error: error.message || 'Failed to toggle app access' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

/**
 * Set user role for a specific app
 */
export async function setAppRoleAction(
  uid: string,
  appId: string,
  role: string
) {
  const supabase = await createClient();

  // Verify user is app admin or global admin
  const { data: isGlobalAdmin } = await isClaimsAdmin(supabase);
  const { data: isAppAdminUser } = await isAppAdmin(supabase, appId);

  if (!isGlobalAdmin && !isAppAdminUser) {
    return {
      error: `Unauthorized: You must be a claims_admin or ${appId} admin`,
    };
  }

  const { data, error } = await setAppClaim(supabase, uid, appId, 'role', role);

  if (error) {
    return { error: error.message || 'Failed to set app role' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

/**
 * Toggle app admin status for a user (grant/revoke app-specific admin rights)
 */
export async function toggleAppAdminAction(
  uid: string,
  appId: string,
  isAdmin: boolean
) {
  const supabase = await createClient();

  // Only global admins can grant app admin rights
  const { data: isGlobalAdmin } = await isClaimsAdmin(supabase);

  if (!isGlobalAdmin) {
    return {
      error: 'Unauthorized: Only global claims_admin can grant app admin rights',
    };
  }

  const { data, error } = await setAppClaim(
    supabase,
    uid,
    appId,
    'admin',
    isAdmin
  );

  if (error) {
    return { error: error.message || 'Failed to update app admin status' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}
