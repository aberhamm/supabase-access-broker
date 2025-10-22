import { createClient } from '@/lib/supabase/server';
import { ApiKey, CreateApiKeyData, ValidatedApiKey } from '@/types/claims';

/**
 * Generate a secure API key with a prefix
 * Format: sk_[32 random hex characters]
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `sk_${randomPart}`;
}

/**
 * Hash an API key for storage
 * Uses SHA-256 for consistent, one-way hashing
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key and return context if valid
 */
export async function validateApiKey(
  apiKey: string
): Promise<ValidatedApiKey | null> {
  try {
    const keyHash = await hashApiKey(apiKey);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('validate_api_key', {
      p_key_hash: keyHash,
    });

    if (error) {
      console.error('Error validating API key:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0] as ValidatedApiKey;

    // Check if key is valid
    if (!result.is_valid) {
      return null;
    }

    return result;
  } catch (error) {
    console.error('Failed to validate API key:', error);
    return null;
  }
}

/**
 * Record that an API key was used (updates last_used_at)
 */
export async function recordApiKeyUsage(apiKey: string): Promise<void> {
  try {
    const keyHash = await hashApiKey(apiKey);
    const supabase = await createClient();

    await supabase.rpc('record_api_key_usage', {
      p_key_hash: keyHash,
    });
  } catch (error) {
    console.error('Failed to record API key usage:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Get all API keys for a specific app
 */
export async function getApiKeys(appId: string): Promise<ApiKey[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_app_api_keys', {
      p_app_id: appId,
    });

    if (error) {
      console.error('Error fetching API keys:', error);
      throw error;
    }

    return (data as ApiKey[]) || [];
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    throw error;
  }
}

/**
 * Create a new API key
 * Returns the full key (only time it's available in plaintext)
 */
export async function createApiKey(
  data: CreateApiKeyData,
  createdBy?: string
): Promise<{ id: string; secret: string }> {
  try {
    const supabase = await createClient();

    // Generate the key
    const secret = generateApiKey();
    const keyHash = await hashApiKey(secret);

    // Create in database
    const { data: keyId, error } = await supabase.rpc('create_api_key', {
      p_app_id: data.app_id,
      p_name: data.name,
      p_key_hash: keyHash,
      p_description: data.description || null,
      p_role_id: data.role_id || null,
      p_expires_at: data.expires_at || null,
      p_created_by: createdBy || null,
    });

    if (error) {
      console.error('Error creating API key:', error);
      throw error;
    }

    return {
      id: keyId as string,
      secret,
    };
  } catch (error) {
    console.error('Failed to create API key:', error);
    throw error;
  }
}

/**
 * Update an existing API key
 */
export async function updateApiKey(
  id: string,
  updates: {
    name?: string;
    description?: string;
    role_id?: string;
    expires_at?: string;
    enabled?: boolean;
  }
): Promise<void> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('update_api_key', {
      p_id: id,
      p_name: updates.name || null,
      p_description: updates.description || null,
      p_role_id: updates.role_id || null,
      p_expires_at: updates.expires_at || null,
      p_enabled: updates.enabled ?? null,
    });

    if (error) {
      console.error('Error updating API key:', error);
      throw error;
    }

    if (data !== 'OK') {
      throw new Error(data as string);
    }
  } catch (error) {
    console.error('Failed to update API key:', error);
    throw error;
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(id: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('delete_api_key', {
      p_id: id,
    });

    if (error) {
      console.error('Error deleting API key:', error);
      throw error;
    }

    if (data !== 'OK') {
      throw new Error(data as string);
    }
  } catch (error) {
    console.error('Failed to delete API key:', error);
    throw error;
  }
}
