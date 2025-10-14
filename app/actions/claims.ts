'use server';

import { createClient } from '@/lib/supabase/server';
import { setClaim, deleteClaim, isClaimsAdmin } from '@/lib/claims';
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
