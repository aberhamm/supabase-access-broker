'use server';

import { createClient } from '@/lib/supabase/server';
import {
  getApiKeys as getApiKeysService,
  createApiKey as createApiKeyService,
  updateApiKey as updateApiKeyService,
  deleteApiKey as deleteApiKeyService,
} from '@/lib/api-keys-service';
import {
  getUnifiedApiKeys as getUnifiedApiKeysService,
  getExternalSources as getExternalSourcesService,
} from '@/lib/external-keys-service';
import { isClaimsAdmin, isAppAdmin } from '@/lib/claims';
import { assertStepUp, rethrowWithCode } from '@/lib/mfa-gate';
import {
  CreateApiKeyData,
  UpdateApiKeyData,
  ApiKey,
  UnifiedApiKey,
  ExternalKeySource,
  CreateExternalSourceData,
  UpdateExternalSourceData,
} from '@/types/claims';
import { revalidatePath } from 'next/cache';

async function requireAppAccess(appId: string, opts?: { stepUp?: boolean }): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: isAdmin } = await isClaimsAdmin(supabase);
  const { data: isAppAdminUser } = await isAppAdmin(supabase, appId);
  if (!isAdmin && !isAppAdminUser) throw new Error('Unauthorized');

  // Sensitive write actions require AAL2 (or, in soft mode, that the user has
  // not yet enrolled MFA). Read actions skip the gate to keep dashboards
  // snappy.
  if (opts?.stepUp) {
    await assertStepUp(supabase);
  }

  return user.id;
}

/**
 * Get all API keys for an app
 */
export async function getApiKeys(appId: string): Promise<ApiKey[]> {
  try {
    await requireAppAccess(appId);
    return await getApiKeysService(appId);
  } catch (error) {
    console.error('Error in getApiKeys action:', error);
    throw new Error('Failed to fetch API keys');
  }
}

/**
 * Create a new API key
 * Returns the full secret (only available once!)
 */
export async function createApiKey(
  data: CreateApiKeyData
): Promise<{ id: string; secret: string }> {
  try {
    const userId = await requireAppAccess(data.app_id, { stepUp: true });

    const result = await createApiKeyService(data, userId);

    // Revalidate the app page
    revalidatePath(`/apps/${data.app_id}`);

    return result;
  } catch (error) {
    console.error('Error in createApiKey action:', error);
    rethrowWithCode(error, 'Failed to create API key');
  }
}

/**
 * Update an API key
 */
export async function updateApiKey(
  id: string,
  appId: string,
  data: UpdateApiKeyData
): Promise<void> {
  try {
    await requireAppAccess(appId, { stepUp: true });
    await updateApiKeyService(id, data);

    // Revalidate the app page
    revalidatePath(`/apps/${appId}`);
  } catch (error) {
    console.error('Error in updateApiKey action:', error);
    rethrowWithCode(error, 'Failed to update API key');
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(id: string, appId: string): Promise<void> {
  try {
    await requireAppAccess(appId, { stepUp: true });
    await deleteApiKeyService(id);

    // Revalidate the app page
    revalidatePath(`/apps/${appId}`);
  } catch (error) {
    console.error('Error in deleteApiKey action:', error);
    rethrowWithCode(error, 'Failed to delete API key');
  }
}

/**
 * Toggle API key enabled status
 */
export async function toggleApiKey(
  id: string,
  appId: string,
  enabled: boolean
): Promise<void> {
  try {
    await requireAppAccess(appId, { stepUp: true });
    await updateApiKeyService(id, { enabled });

    // Revalidate the app page
    revalidatePath(`/apps/${appId}`);
  } catch (error) {
    console.error('Error in toggleApiKey action:', error);
    rethrowWithCode(error, 'Failed to toggle API key');
  }
}

/**
 * Get unified API keys (local + external)
 */
export async function getUnifiedApiKeys(
  appId: string
): Promise<UnifiedApiKey[]> {
  try {
    await requireAppAccess(appId);
    const localKeys = await getApiKeysService(appId);
    return await getUnifiedApiKeysService(appId, localKeys);
  } catch (error) {
    console.error('Error in getUnifiedApiKeys action:', error);
    throw new Error('Failed to fetch unified API keys');
  }
}

/**
 * Get external key sources for an app
 */
export async function getExternalSources(
  appId: string
): Promise<ExternalKeySource[]> {
  try {
    await requireAppAccess(appId);
    return await getExternalSourcesService(appId);
  } catch (error) {
    console.error('Error in getExternalSources action:', error);
    throw new Error('Failed to fetch external sources');
  }
}

/**
 * Create a new external key source
 */
export async function createExternalSource(
  data: CreateExternalSourceData
): Promise<string> {
  try {
    await requireAppAccess(data.app_id, { stepUp: true });
    const supabase = await createClient();

    const { data: sourceId, error } = await supabase.rpc(
      'create_external_source',
      {
        p_app_id: data.app_id,
        p_name: data.name,
        p_source_type: data.source_type,
        p_api_url: data.api_url,
        p_api_credentials: data.api_credentials || null,
      }
    );

    if (error) {
      throw error;
    }

    revalidatePath(`/apps/${data.app_id}`);
    return sourceId as string;
  } catch (error) {
    console.error('Error in createExternalSource action:', error);
    rethrowWithCode(error, 'Failed to create external source');
  }
}

/**
 * Update an external key source
 */
export async function updateExternalSource(
  id: string,
  appId: string,
  data: UpdateExternalSourceData
): Promise<void> {
  try {
    await requireAppAccess(appId, { stepUp: true });
    const supabase = await createClient();

    const { data: result, error } = await supabase.rpc(
      'update_external_source',
      {
        p_id: id,
        p_name: data.name || null,
        p_api_url: data.api_url || null,
        p_api_credentials: data.api_credentials || null,
        p_enabled: data.enabled ?? null,
      }
    );

    if (error) {
      throw error;
    }

    if (result !== 'OK') {
      throw new Error(result as string);
    }

    revalidatePath(`/apps/${appId}`);
  } catch (error) {
    console.error('Error in updateExternalSource action:', error);
    rethrowWithCode(error, 'Failed to update external source');
  }
}

/**
 * Delete an external key source
 */
export async function deleteExternalSource(
  id: string,
  appId: string
): Promise<void> {
  try {
    await requireAppAccess(appId, { stepUp: true });
    const supabase = await createClient();

    const { data: result, error } = await supabase.rpc(
      'delete_external_source',
      {
        p_id: id,
      }
    );

    if (error) {
      throw error;
    }

    if (result !== 'OK') {
      throw new Error(result as string);
    }

    revalidatePath(`/apps/${appId}`);
  } catch (error) {
    console.error('Error in deleteExternalSource action:', error);
    rethrowWithCode(error, 'Failed to delete external source');
  }
}

/**
 * Toggle external source enabled status
 */
export async function toggleExternalSource(
  id: string,
  appId: string,
  enabled: boolean
): Promise<void> {
  try {
    await updateExternalSource(id, appId, { enabled });
  } catch (error) {
    console.error('Error in toggleExternalSource action:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to toggle external source'
    );
  }
}
