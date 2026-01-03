import { createClient } from '@/lib/supabase/server';
import { AppConfig, RoleConfig } from '@/types/claims';
import { APPS as FALLBACK_APPS, COMMON_ROLES } from '@/lib/apps-config';

// Cache configuration
const CACHE_TTL = parseInt(process.env.APP_CACHE_TTL || '305000'); // 5 minutes default
const USE_FALLBACK = process.env.USE_FALLBACK_CONFIG !== 'false'; // true by default

// In-memory cache
// Note: This cache is instance-local and works best with long-running server instances.
// In serverless environments, each request may get a new instance, so the cache helps
// primarily within a request lifecycle or when the same instance handles multiple requests.
// This is acceptable because the underlying database queries are optimized with proper indexes.
let appsCache: AppConfig[] | null = null;
let rolesCache: RoleConfig[] | null = null;
let lastFetch: number = 0;

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  return appsCache !== null && Date.now() - lastFetch < CACHE_TTL;
}

/**
 * Convert fallback apps to AppConfig format
 */
function convertFallbackApps(): AppConfig[] {
  const now = new Date().toISOString();
  return FALLBACK_APPS.map((app) => ({
    id: app.id,
    name: app.name,
    description: app.description || null,
    color: app.color || null,
    icon: null,
    enabled: true,
    created_at: now,
    updated_at: now,
  }));
}

/**
 * Convert fallback roles to RoleConfig format
 */
function convertFallbackRoles(): RoleConfig[] {
  const now = new Date().toISOString();
  return COMMON_ROLES.map((role, index) => ({
    id: `fallback-${index}`,
    name: role.value,
    label: role.label,
    description: role.description || null,
    app_id: null,
    is_global: true,
    permissions: [],
    created_at: now,
  }));
}

/**
 * Fetch apps from database with fallback
 */
async function fetchAppsFromDb(forceRefresh = false): Promise<AppConfig[]> {
  // Check cache first
  if (!forceRefresh && isCacheValid() && appsCache) {
    return appsCache;
  }

  try {
    const supabase = await createClient();
    // Prefer direct table select so we can include SSO columns without requiring RPC signature changes.
    const { data, error } = await supabase
      .from('access_broker_app.apps')
      .select(
        'id,name,description,color,icon,enabled,allowed_callback_urls,sso_client_secret_hash,created_at,updated_at'
      )
      .order('name', { ascending: true });

    if (error) {
      // If SSO columns are missing (older DB), fall back to the base app columns so the dashboard still works.
      // Postgres undefined_column is 42703.
      if (error.code === '42703') {
        const { data: baseData, error: baseError } = await supabase
          .from('access_broker_app.apps')
          .select('id,name,description,color,icon,enabled,created_at,updated_at')
          .order('name', { ascending: true });

        if (!baseError) {
          appsCache = baseData as AppConfig[];
          lastFetch = Date.now();
          return appsCache;
        }
      }

      console.error('Error fetching apps from database:', error);
      // Fall back to TypeScript config
      if (USE_FALLBACK) {
        console.log('Falling back to TypeScript config for apps');
        return convertFallbackApps();
      }
      throw error;
    }

    // If database is empty and fallback is enabled
    if ((!data || data.length === 0) && USE_FALLBACK) {
      console.log('Database empty, using fallback apps config');
      return convertFallbackApps();
    }

    // Update cache
    appsCache = data as AppConfig[];
    lastFetch = Date.now();

    return appsCache;
  } catch (error) {
    console.error('Failed to fetch apps:', error);
    if (USE_FALLBACK) {
      return convertFallbackApps();
    }
    throw error;
  }
}

/**
 * Fetch roles from database with fallback
 */
async function fetchRolesFromDb(
  appId?: string,
  forceRefresh = false
): Promise<RoleConfig[]> {
  // Check cache first (only for global roles or all roles without app filter)
  if (!forceRefresh && isCacheValid() && rolesCache && !appId) {
    return rolesCache;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_app_roles', {
      p_app_id: appId || null,
    });

    if (error) {
      console.error('Error fetching roles from database:', error);
      // Fall back to TypeScript config
      if (USE_FALLBACK) {
        console.log('Falling back to TypeScript config for roles');
        return convertFallbackRoles();
      }
      throw error;
    }

    // If database is empty and fallback is enabled
    if ((!data || data.length === 0) && USE_FALLBACK && !appId) {
      console.log('Database empty, using fallback roles config');
      return convertFallbackRoles();
    }

    const roles = (data as RoleConfig[]) || [];

    // Update cache if fetching all roles
    if (!appId) {
      rolesCache = roles;
      lastFetch = Date.now();
    }

    return roles;
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    if (USE_FALLBACK) {
      return convertFallbackRoles();
    }
    throw error;
  }
}

/**
 * Public API: Get all apps
 */
export async function getApps(forceRefresh = false): Promise<AppConfig[]> {
  return await fetchAppsFromDb(forceRefresh);
}

/**
 * Public API: Get app by ID
 */
export async function getAppById(id: string): Promise<AppConfig | undefined> {
  const apps = await getApps();
  return apps.find((app) => app.id === id);
}

/**
 * Public API: Get all roles (optionally filtered by app)
 */
export async function getRoles(
  appId?: string,
  forceRefresh = false
): Promise<RoleConfig[]> {
  return await fetchRolesFromDb(appId, forceRefresh);
}

/**
 * Public API: Get only global roles
 */
export async function getGlobalRoles(
  forceRefresh = false
): Promise<RoleConfig[]> {
  const roles = await getRoles(undefined, forceRefresh);
  return roles.filter((role) => role.is_global);
}

/**
 * Public API: Get app-specific roles
 */
export async function getAppRoles(
  appId: string,
  forceRefresh = false
): Promise<RoleConfig[]> {
  return await getRoles(appId, forceRefresh);
}

/**
 * Public API: Clear cache and force refetch
 */
export function refreshCache(): void {
  appsCache = null;
  rolesCache = null;
  lastFetch = 0;
  console.log('Cache cleared');
}

/**
 * Public API: Get cache status
 */
export function getCacheStatus(): {
  isValid: boolean;
  lastFetch: number;
  ttl: number;
} {
  return {
    isValid: isCacheValid(),
    lastFetch,
    ttl: CACHE_TTL,
  };
}
