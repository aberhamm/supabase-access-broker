'use server';

import { createClient } from '@/lib/supabase/server';
import {
  setClaim,
  deleteClaim,
  isClaimsAdmin,
  setAppClaim,
  setAppMetadataClaim,
  deleteAppMetadataClaim,
  isAppAdmin,
} from '@/lib/claims';
import { revalidatePath } from 'next/cache';

// Input validation constants
const MAX_UID_LENGTH = 36; // UUID length
const MAX_CLAIM_NAME_LENGTH = 64;
const MAX_CLAIM_VALUE_LENGTH = 10000;
const MAX_APP_ID_LENGTH = 64;

function validateInput(
  uid: string,
  claim?: string,
  value?: string,
  appId?: string
): { error: string } | null {
  if (!uid || uid.length > MAX_UID_LENGTH) {
    return { error: 'Invalid user ID' };
  }
  if (claim !== undefined && (claim.length === 0 || claim.length > MAX_CLAIM_NAME_LENGTH)) {
    return { error: `Claim name must be between 1 and ${MAX_CLAIM_NAME_LENGTH} characters` };
  }
  if (value !== undefined && value.length > MAX_CLAIM_VALUE_LENGTH) {
    return { error: `Claim value exceeds maximum length of ${MAX_CLAIM_VALUE_LENGTH} characters` };
  }
  if (appId !== undefined && (appId.length === 0 || appId.length > MAX_APP_ID_LENGTH)) {
    return { error: `App ID must be between 1 and ${MAX_APP_ID_LENGTH} characters` };
  }
  return null;
}

export async function setClaimAction(
  uid: string,
  claim: string,
  value: string
) {
  // Validate input lengths
  const validationError = validateInput(uid, claim, value);
  if (validationError) {
    return validationError;
  }

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
  // Validate input lengths
  const validationError = validateInput(uid, claim);
  if (validationError) {
    return validationError;
  }

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
  // Validate input lengths
  const validationError = validateInput(uid);
  if (validationError) {
    return validationError;
  }

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
 * Set a custom claim for a specific app.
 *
 * Custom claims are stored under apps[appId].metadata[key] to match the
 * layout the app-facing PATCH /api/apps/{appId}/users/{userId}/claims
 * endpoint uses, so manual operator edits and programmatic billing-webhook
 * writes share the same storage location.
 */
export async function setAppClaimAction(
  uid: string,
  appId: string,
  claim: string,
  value: string
) {
  // Validate input lengths
  const validationError = validateInput(uid, claim, value, appId);
  if (validationError) {
    return validationError;
  }

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

  const { data, error } = await setAppMetadataClaim(
    supabase,
    uid,
    appId,
    claim,
    parsedValue
  );

  if (error) {
    return { error: error.message || 'Failed to set app claim' };
  }
  if (data?.status && data.status !== 'OK') {
    return { error: data.status.replace(/^error:\s*/, '') || 'Failed to set app claim' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');
  revalidatePath('/');

  return { data, error: null };
}

/**
 * Delete a custom claim from a specific app (i.e., remove a single key under
 * apps[appId].metadata).
 */
export async function deleteAppClaimAction(
  uid: string,
  appId: string,
  claim: string
) {
  // Validate input lengths
  const validationError = validateInput(uid, claim, undefined, appId);
  if (validationError) {
    return validationError;
  }

  const supabase = await createClient();

  // Verify user is app admin or global admin
  const { data: isGlobalAdmin } = await isClaimsAdmin(supabase);
  const { data: isAppAdminUser } = await isAppAdmin(supabase, appId);

  if (!isGlobalAdmin && !isAppAdminUser) {
    return {
      error: `Unauthorized: You must be a claims_admin or ${appId} admin`,
    };
  }

  const { data, error } = await deleteAppMetadataClaim(
    supabase,
    uid,
    appId,
    claim
  );

  if (error) {
    return { error: error.message || 'Failed to delete app claim' };
  }
  if (data?.status && data.status !== 'OK') {
    return { error: data.status.replace(/^error:\s*/, '') || 'Failed to delete app claim' };
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
  // Validate input lengths
  const validationError = validateInput(uid, undefined, undefined, appId);
  if (validationError) {
    return validationError;
  }

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
  // Validate input lengths (role uses claim validation)
  const validationError = validateInput(uid, role, undefined, appId);
  if (validationError) {
    return validationError;
  }

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
