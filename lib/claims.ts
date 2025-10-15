import { User } from '@/types/claims';
import { SupabaseClient } from '@supabase/supabase-js';

// Claims functions for current user
export async function getMyClaims(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_my_claims');
  return { data, error };
}

export async function getMyClaim(supabase: SupabaseClient, claim: string) {
  const { data, error } = await supabase.rpc('get_my_claim', { claim });
  return { data, error };
}

export async function isClaimsAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('is_claims_admin');
  return { data: data as boolean, error };
}

// Claims functions for any user (admin only)
export async function getClaims(supabase: SupabaseClient, uid: string) {
  const { data, error } = await supabase.rpc('get_claims', { uid });
  return { data, error };
}

export async function getClaim(
  supabase: SupabaseClient,
  uid: string,
  claim: string
) {
  const { data, error } = await supabase.rpc('get_claim', { uid, claim });
  return { data, error };
}

export async function setClaim(
  supabase: SupabaseClient,
  uid: string,
  claim: string,
  value: unknown
) {
  const { data, error } = await supabase.rpc('set_claim', {
    uid,
    claim,
    value,
  });
  return { data, error };
}

export async function deleteClaim(
  supabase: SupabaseClient,
  uid: string,
  claim: string
) {
  const { data, error } = await supabase.rpc('delete_claim', { uid, claim });
  return { data, error };
}

// Get all users (requires admin client with service role key)
export async function getAllUsers(supabase: SupabaseClient): Promise<{
  data: User[] | null;
  error: Error | null;
}> {
  // This requires the service role key to work
  // Make sure you're passing an admin client, not a regular client
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error listing users:', error);
    return { data: null, error: error as Error };
  }

  return { data: data.users as User[], error: null };
}

// Helper function to determine the type of a claim value
export function getClaimType(
  value: unknown
): 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

// Helper to format claim value for RPC call (handle JSON stringification)
export function formatClaimValue(value: string): unknown {
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // If it fails, treat as a string and wrap in quotes for JSON
    return `"${value}"`;
  }
}

// ============================================================================
// Multi-App Claims Functions
// ============================================================================

/**
 * Get all apps a user has access to
 */
export async function getUserApps(supabase: SupabaseClient, uid: string) {
  const { data, error } = await supabase.rpc('get_user_apps', { uid });
  return { data, error };
}

/**
 * Get a specific claim from a specific app
 */
export async function getAppClaim(
  supabase: SupabaseClient,
  uid: string,
  appId: string,
  claim: string
) {
  const { data, error } = await supabase.rpc('get_app_claim', {
    uid,
    app_id: appId,
    claim,
  });
  return { data, error };
}

/**
 * Set a claim for a specific app
 */
export async function setAppClaim(
  supabase: SupabaseClient,
  uid: string,
  appId: string,
  claim: string,
  value: unknown
) {
  const { data, error } = await supabase.rpc('set_app_claim', {
    uid,
    app_id: appId,
    claim,
    value,
  });
  return { data, error };
}

/**
 * Delete a claim from a specific app
 */
export async function deleteAppClaim(
  supabase: SupabaseClient,
  uid: string,
  appId: string,
  claim: string
) {
  const { data, error } = await supabase.rpc('delete_app_claim', {
    uid,
    app_id: appId,
    claim,
  });
  return { data, error };
}

/**
 * Check if current user is admin for a specific app
 */
export async function isAppAdmin(supabase: SupabaseClient, appId: string) {
  const { data, error } = await supabase.rpc('is_app_admin', {
    app_id: appId,
  });
  return { data: data as boolean, error };
}

/**
 * List all users who have access to a specific app
 */
export async function getAppUsers(supabase: SupabaseClient, appId: string) {
  const { data, error } = await supabase.rpc('list_app_users', {
    app_id: appId,
  });
  return { data, error };
}

// ============================================================================
// Database App Configuration Functions
// ============================================================================

/**
 * Get all apps from database
 */
export async function getAllAppsFromDb(
  supabase: SupabaseClient,
  enabledOnly = true
) {
  const { data, error } = await supabase.rpc('get_all_apps', {
    enabled_only: enabledOnly,
  });
  return { data, error };
}

/**
 * Create a new app in database
 */
export async function createAppInDb(
  supabase: SupabaseClient,
  appData: {
    id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    enabled?: boolean;
  }
) {
  const { data, error } = await supabase.rpc('create_app', {
    p_id: appData.id,
    p_name: appData.name,
    p_description: appData.description || null,
    p_color: appData.color || null,
    p_icon: appData.icon || null,
    p_enabled: appData.enabled ?? true,
  });
  return { data, error };
}

/**
 * Update an existing app
 */
export async function updateAppInDb(
  supabase: SupabaseClient,
  appId: string,
  appData: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    enabled?: boolean;
  }
) {
  const { data, error } = await supabase.rpc('update_app', {
    p_id: appId,
    p_name: appData.name || null,
    p_description: appData.description || null,
    p_color: appData.color || null,
    p_icon: appData.icon || null,
    p_enabled: appData.enabled ?? null,
  });
  return { data, error };
}

/**
 * Delete an app from database
 */
export async function deleteAppFromDb(supabase: SupabaseClient, appId: string) {
  const { data, error } = await supabase.rpc('delete_app', {
    p_id: appId,
  });
  return { data, error };
}

/**
 * Get roles from database (all or for specific app)
 */
export async function getRolesFromDb(
  supabase: SupabaseClient,
  appId?: string
) {
  const { data, error } = await supabase.rpc('get_app_roles', {
    p_app_id: appId || null,
  });
  return { data, error };
}

/**
 * Get only global roles from database
 */
export async function getGlobalRolesFromDb(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_global_roles');
  return { data, error };
}

/**
 * Create a new role in database
 */
export async function createRoleInDb(
  supabase: SupabaseClient,
  roleData: {
    name: string;
    label: string;
    description?: string;
    app_id?: string;
    is_global: boolean;
    permissions?: string[];
  }
) {
  const { data, error } = await supabase.rpc('create_role', {
    p_name: roleData.name,
    p_label: roleData.label,
    p_description: roleData.description || null,
    p_app_id: roleData.app_id || null,
    p_is_global: roleData.is_global,
    p_permissions: JSON.stringify(roleData.permissions || []),
  });
  return { data, error };
}

/**
 * Update an existing role
 */
export async function updateRoleInDb(
  supabase: SupabaseClient,
  roleId: string,
  roleData: {
    label?: string;
    description?: string;
    permissions?: string[];
  }
) {
  const { data, error } = await supabase.rpc('update_role', {
    p_id: roleId,
    p_label: roleData.label || null,
    p_description: roleData.description || null,
    p_permissions: roleData.permissions
      ? JSON.stringify(roleData.permissions)
      : null,
  });
  return { data, error };
}

/**
 * Delete a role from database
 */
export async function deleteRoleFromDb(
  supabase: SupabaseClient,
  roleId: string
) {
  const { data, error } = await supabase.rpc('delete_role', {
    p_id: roleId,
  });
  return { data, error };
}
