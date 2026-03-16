import { NextResponse } from 'next/server';
import { validateApiKey, recordApiKeyUsage } from '@/lib/api-keys-service';
import { getSsoAppAuthConfig, sha256Hex, timingSafeEqualHex } from '@/lib/sso-service';
import { extractClientIP, logSSOEvent, SSOEventType } from '@/lib/audit-service';

export interface AppAuthContext {
  appId: string;
  authMethod: 'api_key' | 'app_secret';
  ipAddress?: string;
  userAgent?: string;
}

type AuthSuccess = AppAuthContext & { ok: true };
type AuthFailure = { ok: false; response: NextResponse };
export type AppAuthResult = AuthSuccess | AuthFailure;

/**
 * Options for authenticateAppRequest.
 */
export interface AppAuthOptions {
  /**
   * If set, auth failures are logged via logSSOEvent with this event type.
   * The errorCode in the log will describe the specific failure reason.
   */
  auditEventType?: SSOEventType;
}

/**
 * Authenticate an app-facing API request.
 *
 * Auth flow decision tree:
 *
 *   Request
 *     │
 *     ├─ Authorization: Bearer sk_... ?
 *     │   ├─ validateApiKey() → null       → 401 "Invalid or expired API key"
 *     │   ├─ key.app_id ≠ urlAppId         → 403 "API key does not belong to this app"
 *     │   └─ valid                         → ✓ authMethod: 'api_key'
 *     │
 *     ├─ body.app_secret present?
 *     │   ├─ getSsoAppAuthConfig() → null  → 400 "Unknown app_id"
 *     │   ├─ app disabled                  → 403 "App is disabled"
 *     │   ├─ no secret hash configured     → 403 "App secret is not configured"
 *     │   ├─ hash mismatch                 → 401 "Invalid app_secret"
 *     │   └─ valid                         → ✓ authMethod: 'app_secret'
 *     │
 *     └─ neither present                   → 401 "Authentication required"
 *
 * Supports two auth methods:
 * 1. API key — `Authorization: Bearer sk_...` (recommended for production)
 * 2. App secret — `app_secret` field in request body (for POST/PATCH/DELETE)
 *
 * The `urlAppId` must match whichever credential is provided.
 * If `body` is provided and contains `app_secret`, it will be stripped after auth.
 */
export async function authenticateAppRequest(
  request: Request,
  urlAppId: string,
  body?: Record<string, unknown>,
  options?: AppAuthOptions
): Promise<AppAuthResult> {
  const ipAddress = extractClientIP(request) || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const logFailure = (errorCode: string) => {
    if (options?.auditEventType) {
      logSSOEvent({
        eventType: options.auditEventType,
        appId: urlAppId,
        errorCode,
        ipAddress,
        userAgent,
      });
    }
  };

  const authHeader = request.headers.get('authorization');

  // API key: Authorization: Bearer <key>
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const apiKey = authHeader.slice(7);
    const validated = await validateApiKey(apiKey);

    if (!validated) {
      logFailure('invalid_api_key');
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 }),
      };
    }

    if (validated.app_id !== urlAppId) {
      logFailure('api_key_app_mismatch');
      return {
        ok: false,
        response: NextResponse.json({ error: 'API key does not belong to this app' }, { status: 403 }),
      };
    }

    // Fire-and-forget
    recordApiKeyUsage(apiKey).catch(() => {});

    // Strip credential from body if present
    if (body) delete body.app_secret;

    return { ok: true, appId: urlAppId, authMethod: 'api_key', ipAddress, userAgent };
  }

  // App secret: app_secret in body (POST/PATCH/DELETE only)
  if (body && typeof body.app_secret === 'string' && body.app_secret) {
    const appSecret = body.app_secret;

    // Strip credential immediately after reading
    delete body.app_secret;

    const appConfig = await getSsoAppAuthConfig(urlAppId);

    if (!appConfig?.id) {
      logFailure('unknown_app');
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unknown app_id' }, { status: 400 }),
      };
    }

    if (appConfig.enabled === false) {
      logFailure('app_disabled');
      return {
        ok: false,
        response: NextResponse.json({ error: 'App is disabled' }, { status: 403 }),
      };
    }

    if (!appConfig.ssoClientSecretHash) {
      logFailure('secret_not_configured');
      return {
        ok: false,
        response: NextResponse.json({ error: 'App secret is not configured' }, { status: 403 }),
      };
    }

    const computed = sha256Hex(appSecret);
    const ok = timingSafeEqualHex(computed, appConfig.ssoClientSecretHash);

    if (!ok) {
      logFailure('invalid_secret');
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid app_secret' }, { status: 401 }),
      };
    }

    return { ok: true, appId: urlAppId, authMethod: 'app_secret', ipAddress, userAgent };
  }

  logFailure('missing_credentials');
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Authentication required. Provide Bearer API key or app_secret in body.' },
      { status: 401 }
    ),
  };
}
