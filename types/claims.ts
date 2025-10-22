export interface User {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  raw_app_meta_data?: Record<string, any>;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

export interface ClaimOperation {
  uid: string;
  claim: string;
  value?: any;
}

export interface ClaimValue {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
}

export interface UserStats {
  totalUsers: number;
  claimsAdmins: number;
  totalClaims: number;
  recentSignups: number;
}

export interface ClaimDistribution {
  claim: string;
  count: number;
}

// Multi-app support types
export interface AppClaim {
  enabled: boolean;
  role?: string;
  admin?: boolean;
  permissions?: string[];
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface AppMetadata {
  apps?: Record<string, AppClaim>;
  [key: string]: any; // Maintain backward compatibility
}

export interface AppInfo {
  id: string;
  name: string;
  description?: string;
  color?: string; // For UI display
}

export interface AppUser {
  user_id: string;
  user_email: string;
  app_data: AppClaim;
}

// Database-backed app configuration types
export interface AppConfig {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  app_id?: string | null;
  is_global: boolean;
  permissions: string[];
  created_at: string;
}

export interface CreateAppData {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  enabled?: boolean;
}

export interface UpdateAppData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  enabled?: boolean;
}

export interface CreateRoleData {
  name: string;
  label: string;
  description?: string;
  app_id?: string;
  is_global: boolean;
  permissions?: string[];
}

export interface UpdateRoleData {
  label?: string;
  description?: string;
  permissions?: string[];
}

// API Key types
export interface ApiKey {
  id: string;
  app_id: string;
  name: string;
  description?: string | null;
  key_hash: string;
  role_id?: string | null;
  role_name?: string | null;
  expires_at?: string | null;
  last_used_at?: string | null;
  created_by?: string | null;
  enabled: boolean;
  created_at: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  secret: string; // Only available on creation
}

export interface CreateApiKeyData {
  app_id: string;
  name: string;
  description?: string;
  role_id?: string;
  expires_at?: string; // ISO date string
}

export interface UpdateApiKeyData {
  name?: string;
  description?: string;
  role_id?: string;
  expires_at?: string;
  enabled?: boolean;
}

export interface ValidatedApiKey {
  key_id: string;
  app_id: string;
  role_id?: string | null;
  role_name?: string | null;
  permissions?: string[];
  is_valid: boolean;
}

// External API Key Source types
export interface ExternalKeySource {
  id: string;
  app_id: string;
  name: string;
  source_type: 'n8n' | 'django' | 'generic';
  api_url: string;
  api_credentials?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateExternalSourceData {
  app_id: string;
  name: string;
  source_type: 'n8n' | 'django' | 'generic';
  api_url: string;
  api_credentials?: string;
}

export interface UpdateExternalSourceData {
  name?: string;
  api_url?: string;
  api_credentials?: string;
  enabled?: boolean;
}

// External API Key (fetched from external systems)
export interface ExternalApiKey {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  enabled: boolean;
  role?: string | null;
  created_by?: string | null;
  source_id: string; // Which external source this came from
  source_name: string; // Display name of the source
  source_type: 'n8n' | 'django' | 'generic';
}

// Unified view combining local and external keys
export interface UnifiedApiKey {
  id: string;
  name: string;
  description?: string | null;
  key_hash?: string; // Only for local keys
  role_id?: string | null;
  role_name?: string | null;
  expires_at?: string | null;
  last_used_at?: string | null;
  enabled: boolean;
  created_at: string;
  source: 'local' | 'n8n' | 'django' | 'generic';
  source_id?: string; // For external keys
  source_name?: string; // For external keys
  is_local: boolean;
  remote_actions?: string[]; // Available actions for external keys (Phase 2)
}
