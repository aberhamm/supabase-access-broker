import crypto from 'crypto';
import { debugLog } from '@/lib/auth-debug';
import { createAdminClient } from '@/lib/supabase/server';

export interface SsoAppSecretEntry {
  id: string;
  label: string;
  hash: string;
  created_at: string;
}

export interface SsoAppAuthConfig {
  id: string;
  enabled: boolean | null;
  ssoClientSecretHash: string | null;
  ssoClientSecrets: SsoAppSecretEntry[];
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export async function getSsoAppAuthConfig(appId: string): Promise<SsoAppAuthConfig | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .select('id,enabled,sso_client_secret_hash,sso_client_secrets')
    .eq('id', appId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return null;
  }

  return {
    id: data.id,
    enabled: data.enabled,
    ssoClientSecretHash: data.sso_client_secret_hash,
    ssoClientSecrets: (data.sso_client_secrets as SsoAppSecretEntry[] | null) ?? [],
  };
}

function isAllowedInsecureRedirect(url: URL): boolean {
  const host = url.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Check if a URL uses a custom scheme (e.g. exp://, lookbook://, myapp://).
 * Custom schemes are used by native mobile apps and Expo for deep linking.
 * These are allowed as redirect URIs when registered in an app's allowed_callback_urls.
 */
function isCustomScheme(url: URL): boolean {
  return url.protocol !== 'https:' && url.protocol !== 'http:';
}

/**
 * Result of validating a logout redirect URL
 */
export interface LogoutRedirectValidation {
  allowed: boolean;
  appId?: string;
  appName?: string;
}

/**
 * Check if a redirect URL is allowed for logout (Single Logout / SLO).
 * Unlike SSO auth flow which requires a specific app_id, SLO allows any
 * redirect URL that is registered in ANY enabled app's allowed_callback_urls.
 *
 * This supports the flow where an external app redirects users to:
 *   {portal}/auth/logout?next=https://app.example.com/logged-out
 *
 * Security checks:
 * - URL must be valid and parseable
 * - Must use HTTPS (except localhost for development)
 * - Must be in an enabled app's allowed_callback_urls
 *
 * Returns information about which app the URL belongs to for audit logging.
 */
export async function isLogoutRedirectAllowed(
  redirectUrl: string
): Promise<LogoutRedirectValidation> {
  // Parse and validate the URL
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return { allowed: false };
  }

  // Check protocol (https required, except localhost and custom schemes for native apps)
  if (url.protocol !== 'https:' && !isCustomScheme(url) && !(url.protocol === 'http:' && isAllowedInsecureRedirect(url))) {
    return { allowed: false };
  }

  try {
    const supabase = await createAdminClient();

    // Find any enabled app that has this URL in its allowed_callback_urls
    // We use a contains query since allowed_callback_urls is a JSONB array
    const { data, error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('id, name, allowed_callback_urls')
      .eq('enabled', true)
      .not('allowed_callback_urls', 'is', null);

    if (error) {
      console.error('[SLO] Error querying apps for logout redirect validation:', error);
      return { allowed: false };
    }

    if (!data || data.length === 0) {
      return { allowed: false };
    }

    // Match by origin (scheme + host + port) against registered callback URLs.
    // Apps register one callback per origin in allowed_callback_urls; any URL
    // on that origin is then a valid post-auth/post-logout return target.
    // The OAuth 2.0 redirect_uri contract (exact match) is enforced separately
    // in isRedirectUriAllowed for the auth code exchange itself.
    const targetOrigin = url.origin;
    for (const app of data) {
      const allowedUrls = (app.allowed_callback_urls || []) as string[];
      const originMatches = allowedUrls.some((entry) => {
        try {
          return new URL(entry).origin === targetOrigin;
        } catch {
          return false;
        }
      });
      if (originMatches) {
        return {
          allowed: true,
          appId: app.id,
          appName: app.name,
        };
      }
    }

    return { allowed: false };
  } catch (err) {
    console.error('[SLO] Exception validating logout redirect:', err);
    return { allowed: false };
  }
}

/**
 * Check if a redirect_uri is allowed for an app WITHOUT throwing errors.
 * Used to determine whether we can safely redirect back to the client on error.
 * Returns true only if the URI is valid, parseable, uses https (or localhost http),
 * and is in the app's allowed_callback_urls list.
 */
export async function isRedirectUriAllowed(params: {
  appId: string;
  redirectUri: string;
}): Promise<boolean> {
  const { appId, redirectUri } = params;

  // Check if redirect_uri is a valid URL
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }

  // Check protocol (https required, except localhost and custom schemes for native apps)
  if (url.protocol !== 'https:' && !isCustomScheme(url) && !(url.protocol === 'http:' && isAllowedInsecureRedirect(url))) {
    return false;
  }

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('id,enabled,allowed_callback_urls')
      .eq('id', appId)
      .maybeSingle();

    if (error || !data?.id || data.enabled === false) {
      return false;
    }

    const allowed = (data.allowed_callback_urls || []) as string[];
    return allowed.includes(redirectUri);
  } catch {
    return false;
  }
}

export async function validateRedirectUri(params: {
  appId: string;
  redirectUri: string;
}): Promise<void> {
  const { appId, redirectUri } = params;

  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error('Invalid redirect_uri');
  }

  if (url.protocol !== 'https:' && !isCustomScheme(url) && !(url.protocol === 'http:' && isAllowedInsecureRedirect(url))) {
    throw new Error('redirect_uri must be https, a custom scheme, or http for localhost');
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .select('id,enabled,allowed_callback_urls')
    .eq('id', appId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('Unknown app_id');
  if (data.enabled === false) throw new Error('App is disabled');

  const allowed = (data.allowed_callback_urls || []) as string[];
  if (!allowed.includes(redirectUri)) {
    console.error('[SSO] redirect_uri not allowed:', { redirectUri, allowed, appId });
    throw new Error(`redirect_uri not allowed for this app: ${redirectUri}`);
  }
}

export async function lookupUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('lookup_user_by_identifier', {
    p_user_id: null,
    p_email: email,
    p_telegram_id: null,
  });

  if (error) {
    console.error('[SSO] Error looking up user by email:', error);
    return null;
  }

  const user = Array.isArray(data) ? data[0] : null;
  if (!user?.id || !user?.email) {
    return null;
  }

  return { id: user.id as string, email: user.email as string };
}

export async function createAuthCode(params: {
  userId: string;
  appId: string;
  redirectUri: string;
}): Promise<string> {
  const code = crypto.randomBytes(32).toString('base64url');

  debugLog('[SSO] Creating auth code', {
    userId: params.userId,
    appId: params.appId,
    redirectUri: params.redirectUri,
  });

  const supabase = await createAdminClient();
  const { error } = await supabase
    .schema('access_broker_app')
    .from('auth_codes')
    .insert({
      code,
      user_id: params.userId,
      app_id: params.appId,
      redirect_uri: params.redirectUri,
    });

  if (error) throw error;
  return code;
}

export async function consumeAuthCode(params: {
  code: string;
  appId: string;
  redirectUri?: string;
}): Promise<{ userId: string; redirectUri: string }> {
  const supabase = await createAdminClient();

  // Atomic consumption via RPC — prevents race conditions (Critical #2)
  // Also verifies redirect_uri matches stored value when provided (Critical #3)
  const { data, error } = await supabase.schema('access_broker_app').rpc('consume_auth_code', {
    p_code: params.code,
    p_app_id: params.appId,
    p_redirect_uri: params.redirectUri ?? null,
  });

  if (error) {
    if (error.message?.includes('Invalid or expired code')) {
      throw new Error('Invalid or expired code');
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.out_user_id) throw new Error('Invalid or expired code');

  debugLog('[SSO] Auth code consumed', {
    appId: params.appId,
    userId: row.out_user_id,
  });

  return { userId: row.out_user_id as string, redirectUri: row.out_redirect_uri as string };
}
