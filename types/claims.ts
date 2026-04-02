export interface User {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
  raw_app_meta_data?: Record<string, unknown>;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

// =============================================================================
// Connected Accounts Types
// =============================================================================

/**
 * Telegram account data stored in user's app_metadata.telegram
 *
 * @example
 * ```json
 * {
 *   "telegram": {
 *     "id": 123456789,
 *     "username": "johndoe",
 *     "first_name": "John",
 *     "last_name": "Doe",
 *     "linked_at": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 * ```
 *
 * @see linkTelegramAction - Server action to link Telegram
 * @see unlinkTelegramAction - Server action to unlink Telegram
 */
export interface TelegramData {
  /** Unique Telegram user ID (permanent numeric identifier) */
  id: number;
  /** Telegram username without @ (optional, not all users have one) */
  username?: string;
  /** User's first name on Telegram */
  first_name?: string;
  /** User's last name on Telegram */
  last_name?: string;
  /** ISO 8601 timestamp when the account was linked */
  linked_at: string;
}

export interface ClaimOperation {
  uid: string;
  claim: string;
  value?: unknown;
}

export interface ClaimValue {
  key: string;
  value: unknown;
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
  permissions?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AppMetadata {
  apps?: Record<string, AppClaim>;
  [key: string]: unknown; // Maintain backward compatibility
}

// Helper functions for admin checks
export function isAppAdmin(app: AppClaim | undefined): boolean {
  return app?.role === 'admin';
}

export function hasAnyAppAdmin(apps: Record<string, AppClaim> | Record<string, unknown> | undefined): boolean {
  if (!apps) return false;
  return Object.values(apps).some((app) => (app as AppClaim)?.role === 'admin');
}

// Helper functions for claims counting/display
const SYSTEM_APP_METADATA_KEYS_FOR_CLAIMS_COUNT = new Set([
  // Supabase auth provider bookkeeping
  'provider',
  'providers',
  // This app's reserved/system fields
  'telegram',
  'apps',
  'claims_admin',
]);

/**
 * Count "custom claims" stored in `user.app_metadata`, excluding system/reserved fields.
 *
 * Note: This is a UI-level helper used to keep claims count consistent across pages.
 */
export function getUserCustomClaimsCount(
  appMetadata: Record<string, unknown> | null | undefined
): number {
  if (!appMetadata) return 0;
  return Object.keys(appMetadata).filter(
    (key) => !SYSTEM_APP_METADATA_KEYS_FOR_CLAIMS_COUNT.has(key)
  ).length;
}

export interface AppAuthMethods {
  password: boolean;
  magic_link: boolean;
  email_otp: boolean;
  passkeys: boolean;
  google: boolean;
  github: boolean;
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

export interface SsoClientSecret {
  id: string;
  label: string;
  hash: string;
  created_at: string;
}

// Database-backed app configuration types
export interface AppConfig {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  enabled: boolean;
  // SSO settings (Auth Portal)
  allowed_callback_urls?: string[] | null;
  sso_client_secret_hash?: string | null;
  sso_client_secrets?: SsoClientSecret[] | null;
  auth_methods?: AppAuthMethods | null;
  allow_self_signup?: boolean;
  self_signup_default_role?: string;
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
  allow_self_signup?: boolean;
  self_signup_default_role?: string;
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

// =============================================================================
// MFA Types
// =============================================================================

export type MFAFactorType = 'totp' | 'phone';
export type MFAFactorStatus = 'verified' | 'unverified';

export interface MFAFactor {
  id: string;
  friendly_name?: string | null;
  factor_type: MFAFactorType;
  status: MFAFactorStatus;
  created_at: string;
  updated_at: string;
  phone?: string; // For phone factors
}

export interface TOTPEnrollment {
  id: string;
  type: 'totp';
  totp: {
    qr_code: string; // Data URL for QR code
    secret: string; // Base32 encoded secret
    uri: string; // otpauth:// URI
  };
}

// =============================================================================
// User Status Types
// =============================================================================

export type BanDuration = 'none' | '24h' | '168h' | '720h' | '8766h';

export const BAN_DURATION_LABELS: Record<BanDuration, string> = {
  none: 'No ban',
  '24h': '24 hours',
  '168h': '7 days',
  '720h': '30 days',
  '8766h': '1 year',
};

export interface UserStatus {
  is_banned: boolean;
  banned_until?: string | null;
  email_confirmed: boolean;
  email_confirmed_at?: string | null;
  phone?: string | null;
  phone_confirmed_at?: string | null;
}

export interface UpdateProfileData {
  email?: string;
  phone?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  timezone?: string;
  locale?: string;
}

export interface Profile {
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  timezone?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
}
