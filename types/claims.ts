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
