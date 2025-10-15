'use server';

import { createClient } from '@/lib/supabase/server';
import {
  createAppInDb,
  updateAppInDb,
  deleteAppFromDb,
  createRoleInDb,
  updateRoleInDb,
  deleteRoleFromDb,
  isClaimsAdmin,
} from '@/lib/claims';
import { refreshCache } from '@/lib/apps-service';
import { revalidatePath } from 'next/cache';
import type { CreateAppData, UpdateAppData, CreateRoleData, UpdateRoleData } from '@/types/claims';

// ============================================================================
// App Management Actions
// ============================================================================

export async function createAppAction(data: CreateAppData) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data: result, error } = await createAppInDb(supabase, data);

  if (error || result === 'error: access denied' || (typeof result === 'string' && result.startsWith('error:'))) {
    return { error: typeof result === 'string' ? result : error?.message || 'Failed to create app' };
  }

  // Clear cache and revalidate
  refreshCache();
  revalidatePath('/apps');
  revalidatePath('/users');

  return { data: result, error: null };
}

export async function updateAppAction(id: string, data: UpdateAppData) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data: result, error } = await updateAppInDb(supabase, id, data);

  if (error || result === 'error: access denied' || (typeof result === 'string' && result.startsWith('error:'))) {
    return { error: typeof result === 'string' ? result : error?.message || 'Failed to update app' };
  }

  // Clear cache and revalidate
  refreshCache();
  revalidatePath('/apps');
  revalidatePath('/users');

  return { data: result, error: null };
}

export async function deleteAppAction(id: string) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data: result, error } = await deleteAppFromDb(supabase, id);

  if (error || result === 'error: access denied' || (typeof result === 'string' && result.startsWith('error:'))) {
    return { error: typeof result === 'string' ? result : error?.message || 'Failed to delete app' };
  }

  // Clear cache and revalidate
  refreshCache();
  revalidatePath('/apps');
  revalidatePath('/users');

  return { data: result, error: null };
}

// ============================================================================
// Role Management Actions
// ============================================================================

export async function createRoleAction(data: CreateRoleData) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data: result, error } = await createRoleInDb(supabase, data);

  if (error || result === 'error: access denied' || (typeof result === 'string' && result.startsWith('error:'))) {
    return { error: typeof result === 'string' ? result : error?.message || 'Failed to create role' };
  }

  // Clear cache and revalidate
  refreshCache();
  revalidatePath('/apps');

  return { data: result, error: null };
}

export async function updateRoleAction(id: string, data: UpdateRoleData) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data: result, error } = await updateRoleInDb(supabase, id, data);

  if (error || result === 'error: access denied' || (typeof result === 'string' && result.startsWith('error:'))) {
    return { error: typeof result === 'string' ? result : error?.message || 'Failed to update role' };
  }

  // Clear cache and revalidate
  refreshCache();
  revalidatePath('/apps');

  return { data: result, error: null };
}

export async function deleteRoleAction(id: string) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { data: result, error } = await deleteRoleFromDb(supabase, id);

  if (error || result === 'error: access denied' || (typeof result === 'string' && result.startsWith('error:'))) {
    return { error: typeof result === 'string' ? result : error?.message || 'Failed to delete role' };
  }

  // Clear cache and revalidate
  refreshCache();
  revalidatePath('/apps');

  return { data: result, error: null };
}

// ============================================================================
// Cache Management Action
// ============================================================================

export async function refreshCacheAction() {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  refreshCache();
  revalidatePath('/apps');
  revalidatePath('/users');

  return { data: 'Cache refreshed successfully', error: null };
}
