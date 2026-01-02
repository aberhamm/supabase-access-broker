'use server';

import { createHash, randomBytes } from 'crypto';
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
import { refreshCache, getApps } from '@/lib/apps-service';
import { revalidatePath } from 'next/cache';
import type { CreateAppData, UpdateAppData, CreateRoleData, UpdateRoleData, AppConfig } from '@/types/claims';

// ============================================================================
// App Query Actions
// ============================================================================

export async function getAppsAction(): Promise<{ data: AppConfig[] | null; error: string | null }> {
  try {
    const apps = await getApps();
    return { data: apps, error: null };
  } catch (error) {
    const err = error as Error;
    return { data: null, error: err.message || 'Failed to fetch apps' };
  }
}

export async function getUsedColorsAction(): Promise<{ data: string[] | null; error: string | null }> {
  try {
    const apps = await getApps();
    const usedColors = apps
      .map((app) => app.color)
      .filter((color): color is string => color !== null && color !== undefined);
    return { data: usedColors, error: null };
  } catch (error) {
    const err = error as Error;
    return { data: null, error: err.message || 'Failed to fetch used colors' };
  }
}

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
// SSO Management Actions
// ============================================================================

function normalizeCallbackUrls(urls: string[]): string[] {
  const cleaned = urls
    .map((u) => u.trim())
    .filter(Boolean);

  // Validate by parsing; also normalizes (e.g. removes trailing spaces)
  const normalized = cleaned.map((u) => new URL(u).toString());

  // De-dupe while preserving order
  return Array.from(new Set(normalized));
}

export async function updateAppSSOSettingsAction(
  appId: string,
  data: { allowed_callback_urls: string[] }
): Promise<{ data: { ok: true } | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) {
      return { data: null, error: 'Unauthorized: You must be a claims_admin' };
    }

    const allowed_callback_urls = normalizeCallbackUrls(data.allowed_callback_urls);

    const { error } = await supabase
      .from('apps')
      .update({ allowed_callback_urls })
      .eq('id', appId);

    if (error) {
      if (error.code === '42703') {
        return {
          data: null,
          error:
            'SSO settings columns are missing in your database. Apply migrations/007_auth_and_passkeys.sql (or run `pnpm migrate`) to add allowed_callback_urls and sso_client_secret_hash.',
        };
      }
      return { data: null, error: error.message || 'Failed to update SSO settings' };
    }

    refreshCache();
    revalidatePath('/apps');
    revalidatePath(`/apps/${appId}`);

    return { data: { ok: true }, error: null };
  } catch (e) {
    const err = e as Error;
    return { data: null, error: err.message || 'Failed to update SSO settings' };
  }
}

export async function generateAppSecretAction(
  appId: string
): Promise<{ data: { secret: string } | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) {
      return { data: null, error: 'Unauthorized: You must be a claims_admin' };
    }

    // 32 bytes -> 64 hex chars; copy/paste friendly.
    const secret = randomBytes(32).toString('hex');
    const sso_client_secret_hash = createHash('sha256').update(secret, 'utf8').digest('hex');

    const { error } = await supabase
      .from('apps')
      .update({ sso_client_secret_hash })
      .eq('id', appId);

    if (error) {
      if (error.code === '42703') {
        return {
          data: null,
          error:
            'SSO settings columns are missing in your database. Apply migrations/007_auth_and_passkeys.sql (or run `pnpm migrate`) to add allowed_callback_urls and sso_client_secret_hash.',
        };
      }
      return { data: null, error: error.message || 'Failed to generate app secret' };
    }

    refreshCache();
    revalidatePath('/apps');
    revalidatePath(`/apps/${appId}`);

    return { data: { secret }, error: null };
  } catch (e) {
    const err = e as Error;
    return { data: null, error: err.message || 'Failed to generate app secret' };
  }
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
