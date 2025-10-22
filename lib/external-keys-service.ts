import { createClient } from '@/lib/supabase/server';
import {
  ExternalKeySource,
  ExternalApiKey,
  UnifiedApiKey,
  ApiKey,
} from '@/types/claims';
import { getSourceAdapter } from './external-sources-config';

/**
 * Fetch external key sources for an app
 */
export async function getExternalSources(
  appId: string
): Promise<ExternalKeySource[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_external_sources', {
      p_app_id: appId,
    });

    if (error) {
      console.error('Error fetching external sources:', error);
      return [];
    }

    return (data as ExternalKeySource[]) || [];
  } catch (error) {
    console.error('Failed to fetch external sources:', error);
    return [];
  }
}

/**
 * Fetch enabled external key sources for an app
 */
export async function getEnabledExternalSources(
  appId: string
): Promise<ExternalKeySource[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_enabled_external_sources', {
      p_app_id: appId,
    });

    if (error) {
      console.error('Error fetching enabled external sources:', error);
      return [];
    }

    return (data as ExternalKeySource[]) || [];
  } catch (error) {
    console.error('Failed to fetch enabled external sources:', error);
    return [];
  }
}

/**
 * Fetch keys from a single external source
 */
export async function fetchExternalKeys(
  source: ExternalKeySource,
  appId: string
): Promise<ExternalApiKey[]> {
  try {
    const adapter = getSourceAdapter(source.source_type);
    return await adapter.fetchKeys(source, appId);
  } catch (error) {
    console.error(`Failed to fetch keys from ${source.name}:`, error);
    // Return empty array instead of throwing - partial failure is ok
    return [];
  }
}

/**
 * Fetch keys from all enabled external sources for an app
 */
export async function fetchAllExternalKeys(
  appId: string
): Promise<ExternalApiKey[]> {
  const sources = await getEnabledExternalSources(appId);

  if (sources.length === 0) {
    return [];
  }

  // Fetch from all sources in parallel
  const results = await Promise.allSettled(
    sources.map((source) => fetchExternalKeys(source, appId))
  );

  // Combine successful results, log failures
  const allKeys: ExternalApiKey[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allKeys.push(...result.value);
    } else {
      console.error(
        `Failed to fetch from ${sources[index].name}:`,
        result.reason
      );
    }
  });

  return allKeys;
}

/**
 * Convert local API key to unified format
 */
function localToUnified(key: ApiKey): UnifiedApiKey {
  return {
    id: key.id,
    name: key.name,
    description: key.description,
    key_hash: key.key_hash,
    role_id: key.role_id,
    role_name: key.role_name,
    expires_at: key.expires_at,
    last_used_at: key.last_used_at,
    enabled: key.enabled,
    created_at: key.created_at,
    source: 'local',
    is_local: true,
  };
}

/**
 * Convert external API key to unified format
 */
function externalToUnified(key: ExternalApiKey): UnifiedApiKey {
  return {
    id: key.id,
    name: key.name,
    description: key.description,
    role_name: key.role,
    expires_at: key.expires_at,
    last_used_at: key.last_used_at,
    enabled: key.enabled,
    created_at: key.created_at,
    source: key.source_type,
    source_id: key.source_id,
    source_name: key.source_name,
    is_local: false,
    // Phase 2: remote_actions: ['view'] // Add 'revoke', 'toggle' when implemented
  };
}

/**
 * Get unified view of all API keys (local + external)
 */
export async function getUnifiedApiKeys(
  appId: string,
  localKeys: ApiKey[]
): Promise<UnifiedApiKey[]> {
  try {
    // Convert local keys
    const unifiedLocal = localKeys.map(localToUnified);

    // Fetch external keys
    const externalKeys = await fetchAllExternalKeys(appId);
    const unifiedExternal = externalKeys.map(externalToUnified);

    // Combine and sort by created_at (newest first)
    const combined = [...unifiedLocal, ...unifiedExternal];
    combined.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return combined;
  } catch (error) {
    console.error('Failed to get unified API keys:', error);
    // Fallback to local keys only
    return localKeys.map(localToUnified);
  }
}

/**
 * Get statistics about keys by source
 */
export function getKeyStatsBySource(keys: UnifiedApiKey[]): {
  total: number;
  local: number;
  external: number;
  bySource: Record<string, number>;
} {
  const stats = {
    total: keys.length,
    local: 0,
    external: 0,
    bySource: {} as Record<string, number>,
  };

  keys.forEach((key) => {
    if (key.is_local) {
      stats.local++;
      stats.bySource['local'] = (stats.bySource['local'] || 0) + 1;
    } else {
      stats.external++;
      const sourceName = key.source_name || key.source;
      stats.bySource[sourceName] = (stats.bySource[sourceName] || 0) + 1;
    }
  });

  return stats;
}

