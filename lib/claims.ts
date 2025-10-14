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
