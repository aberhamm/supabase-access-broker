import { createAdminClient } from '@/lib/supabase/server';

/**
 * SSO Audit Event Types
 */
export type SSOEventType =
  | 'sso_complete_success'
  | 'sso_complete_error'
  | 'sso_complete_redirect_error'
  | 'sso_user_id_mismatch'
  | 'token_exchange_success'
  | 'token_exchange_error'
  | 'token_exchange_user_id_mismatch'
  | 'logout_success'
  | 'logout_external_redirect'
  | 'user_lookup_success'
  | 'user_lookup_error'
  | 'user_list_success'
  | 'user_list_error'
  | 'user_claims_get_success'
  | 'user_claims_get_error'
  | 'user_claims_set_success'
  | 'user_claims_set_error'
  | 'user_claims_delete_success'
  | 'user_claims_delete_error'
  | 'user_invite_success'
  | 'user_invite_error'
  | 'webhook_received'
  | 'webhook_error';

/**
 * Parameters for logging an SSO audit event
 */
export interface SSOAuditLogParams {
  eventType: SSOEventType;
  userId?: string;
  appId?: string;
  redirectUriHost?: string;
  errorCode?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extract hostname from a URL safely
 */
export function extractHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Extract client IP from request headers
 * Handles common proxy headers (X-Forwarded-For, X-Real-IP)
 */
export function extractClientIP(request: Request): string | null {
  // Check X-Forwarded-For first (may have multiple IPs if behind multiple proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  // Check X-Real-IP (set by nginx and other proxies)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();

  // Fallback: try CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP.trim();

  return null;
}

/**
 * Log an SSO audit event to the database.
 * This function is fire-and-forget - errors are logged but don't throw.
 */
export async function logSSOEvent(params: SSOAuditLogParams): Promise<void> {
  try {
    const supabase = await createAdminClient();

    const { error } = await supabase.rpc('log_sso_event', {
      p_event_type: params.eventType,
      p_user_id: params.userId || null,
      p_app_id: params.appId || null,
      p_redirect_uri_host: params.redirectUriHost || null,
      p_error_code: params.errorCode || null,
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
      p_metadata: params.metadata || {},
    });

    if (error) {
      console.error('[Audit] Failed to log SSO event:', error.message, params);
    }
  } catch (err) {
    // Fire-and-forget - don't let audit failures break the auth flow
    console.error('[Audit] Exception logging SSO event:', err, params);
  }
}

/**
 * Helper to build audit log params from a request
 */
export function buildAuditContext(
  request: Request,
  overrides?: Partial<SSOAuditLogParams>
): Pick<SSOAuditLogParams, 'ipAddress' | 'userAgent'> & Partial<SSOAuditLogParams> {
  return {
    ipAddress: extractClientIP(request) || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    ...overrides,
  };
}



