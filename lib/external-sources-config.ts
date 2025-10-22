import { ExternalKeySource, ExternalApiKey } from '@/types/claims';

/**
 * Response format from external API
 */
interface ExternalApiResponse {
  keys: Array<{
    id: string;
    name: string;
    description?: string;
    created_at: string;
    expires_at?: string;
    last_used_at?: string;
    enabled: boolean;
    role?: string;
    created_by?: string;
  }>;
  source: string;
  total?: number;
}

/**
 * Source adapter interface
 */
export interface SourceAdapter {
  fetchKeys: (source: ExternalKeySource, appId: string) => Promise<ExternalApiKey[]>;
  // Phase 2: Add remote actions
  // revokeKey?: (source: ExternalKeySource, keyId: string) => Promise<void>;
  // toggleKey?: (source: ExternalKeySource, keyId: string, enabled: boolean) => Promise<void>;
}

/**
 * Build headers for external API request
 */
function buildHeaders(source: ExternalKeySource): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (source.api_credentials) {
    // Try to parse credentials as JSON first
    try {
      const creds = JSON.parse(source.api_credentials);

      if (creds.type === 'bearer') {
        headers['Authorization'] = `Bearer ${creds.token}`;
      } else if (creds.type === 'apikey') {
        headers['X-API-Key'] = creds.key;
      } else if (creds.type === 'basic') {
        const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
    } catch {
      // If not JSON, assume it's a simple token
      headers['Authorization'] = `Bearer ${source.api_credentials}`;
    }
  }

  return headers;
}

/**
 * Generic adapter - works with any API following the contract
 */
const genericAdapter: SourceAdapter = {
  fetchKeys: async (source, appId) => {
    const url = new URL(source.api_url);
    url.searchParams.append('app_id', appId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildHeaders(source),
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch keys from ${source.name}: ${response.statusText}`);
    }

    const data: ExternalApiResponse = await response.json();

    return data.keys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description || null,
      created_at: key.created_at,
      expires_at: key.expires_at || null,
      last_used_at: key.last_used_at || null,
      enabled: key.enabled,
      role: key.role || null,
      created_by: key.created_by || null,
      source_id: source.id,
      source_name: source.name,
      source_type: source.source_type,
    }));
  },
};

/**
 * n8n-specific adapter
 * Handles n8n's API format (if different from generic)
 */
const n8nAdapter: SourceAdapter = {
  fetchKeys: async (source, appId) => {
    // For now, n8n follows the generic contract
    // Add n8n-specific logic here if needed
    return genericAdapter.fetchKeys(source, appId);
  },
};

/**
 * Django-specific adapter
 * Handles Django's API format (if different from generic)
 */
const djangoAdapter: SourceAdapter = {
  fetchKeys: async (source, appId) => {
    // For now, Django follows the generic contract
    // Add Django-specific logic here if needed
    return genericAdapter.fetchKeys(source, appId);
  },
};

/**
 * Get the appropriate adapter for a source type
 */
export function getSourceAdapter(sourceType: string): SourceAdapter {
  switch (sourceType) {
    case 'n8n':
      return n8nAdapter;
    case 'django':
      return djangoAdapter;
    case 'generic':
    default:
      return genericAdapter;
  }
}

/**
 * Credentials helper for UI
 */
export interface CredentialsConfig {
  type: 'bearer' | 'apikey' | 'basic' | 'none';
  token?: string;
  key?: string;
  username?: string;
  password?: string;
}

export function encodeCredentials(config: CredentialsConfig): string | null {
  if (config.type === 'none') {
    return null;
  }
  return JSON.stringify(config);
}

export function decodeCredentials(encoded: string | null): CredentialsConfig {
  if (!encoded) {
    return { type: 'none' };
  }

  try {
    return JSON.parse(encoded);
  } catch {
    // Legacy format - assume bearer token
    return { type: 'bearer', token: encoded };
  }
}

