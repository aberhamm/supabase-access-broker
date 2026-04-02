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

const SSO_SETTINGS_MISSING_ERROR =
  'SSO settings columns are missing in your database. Apply migrations/008_sso_app_columns.sql (or run `pnpm migrate`). If you already moved tables to access_broker_app, also apply migrations/010_move_to_access_broker_schema.sql.';

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
      .schema('access_broker_app')
      .from('apps')
      .update({ allowed_callback_urls })
      .eq('id', appId);

    if (error) {
      if (error.code === '42703') {
        return {
          data: null,
          error: SSO_SETTINGS_MISSING_ERROR,
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
  appId: string,
  label: string = 'default'
): Promise<{ data: { secret: string; secretId: string } | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) {
      return { data: null, error: 'Unauthorized: You must be a claims_admin' };
    }

    // Fetch existing secrets
    const { data: appData, error: fetchError } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('sso_client_secrets')
      .eq('id', appId)
      .single();

    if (fetchError) {
      if (fetchError.code === '42703') {
        return { data: null, error: SSO_SETTINGS_MISSING_ERROR };
      }
      return { data: null, error: fetchError.message || 'Failed to fetch app' };
    }

    const existingSecrets = (appData?.sso_client_secrets as { id: string; label: string; hash: string; created_at: string }[] | null) ?? [];

    // 32 bytes -> 64 hex chars; copy/paste friendly.
    const secret = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(secret, 'utf8').digest('hex');
    const secretId = crypto.randomUUID();

    const newEntry = {
      id: secretId,
      label: label.trim() || 'default',
      hash,
      created_at: new Date().toISOString(),
    };

    const updatedSecrets = [...existingSecrets, newEntry];

    const { error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .update({
        sso_client_secrets: updatedSecrets,
        // Also update legacy column for backwards compat
        sso_client_secret_hash: hash,
      })
      .eq('id', appId);

    if (error) {
      if (error.code === '42703') {
        return { data: null, error: SSO_SETTINGS_MISSING_ERROR };
      }
      return { data: null, error: error.message || 'Failed to generate app secret' };
    }

    refreshCache();
    revalidatePath('/apps');
    revalidatePath(`/apps/${appId}`);

    return { data: { secret, secretId }, error: null };
  } catch (e) {
    const err = e as Error;
    return { data: null, error: err.message || 'Failed to generate app secret' };
  }
}

export async function deleteAppSecretAction(
  appId: string,
  secretId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) {
      return { error: 'Unauthorized: You must be a claims_admin' };
    }

    const { data: appData, error: fetchError } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('sso_client_secrets')
      .eq('id', appId)
      .single();

    if (fetchError) {
      return { error: fetchError.message || 'Failed to fetch app' };
    }

    const existingSecrets = (appData?.sso_client_secrets as { id: string; label: string; hash: string; created_at: string }[] | null) ?? [];
    const updatedSecrets = existingSecrets.filter(s => s.id !== secretId);

    if (updatedSecrets.length === existingSecrets.length) {
      return { error: 'Secret not found' };
    }

    // Update legacy column to the most recent remaining secret, or null
    const latestHash = updatedSecrets.length > 0
      ? updatedSecrets[updatedSecrets.length - 1].hash
      : null;

    const { error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .update({
        sso_client_secrets: updatedSecrets,
        sso_client_secret_hash: latestHash,
      })
      .eq('id', appId);

    if (error) {
      return { error: error.message || 'Failed to delete secret' };
    }

    refreshCache();
    revalidatePath('/apps');
    revalidatePath(`/apps/${appId}`);

    return { error: null };
  } catch (e) {
    const err = e as Error;
    return { error: err.message || 'Failed to delete secret' };
  }
}

// ============================================================================
// Auth Methods Actions
// ============================================================================

export async function updateAppAuthMethodsAction(
  appId: string,
  authMethods: import('@/types/claims').AppAuthMethods
): Promise<{ data: { ok: true } | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) {
      return { data: null, error: 'Unauthorized: You must be a claims_admin' };
    }

    const { error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .update({ auth_methods: authMethods })
      .eq('id', appId);

    if (error) {
      return { data: null, error: error.message || 'Failed to update auth methods' };
    }

    refreshCache();
    revalidatePath('/apps');
    revalidatePath(`/apps/${appId}`);

    return { data: { ok: true }, error: null };
  } catch (e) {
    const err = e as Error;
    return { data: null, error: err.message || 'Failed to update auth methods' };
  }
}

// ============================================================================
// Self-Signup Actions
// ============================================================================

export async function updateAppSelfSignupAction(
  appId: string,
  settings: { allow_self_signup?: boolean; self_signup_default_role?: string }
): Promise<{ data: { ok: true } | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) {
      return { data: null, error: 'Unauthorized: You must be a claims_admin' };
    }

    const updateData: Record<string, unknown> = {};
    if (settings.allow_self_signup !== undefined) {
      updateData.allow_self_signup = settings.allow_self_signup;
    }
    if (settings.self_signup_default_role !== undefined) {
      updateData.self_signup_default_role = settings.self_signup_default_role;
    }

    const { error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .update(updateData)
      .eq('id', appId);

    if (error) {
      return { data: null, error: error.message || 'Failed to update self-signup settings' };
    }

    refreshCache();
    revalidatePath('/apps');
    revalidatePath(`/apps/${appId}`);

    return { data: { ok: true }, error: null };
  } catch (e) {
    const err = e as Error;
    return { data: null, error: err.message || 'Failed to update self-signup settings' };
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
