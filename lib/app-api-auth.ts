import { NextResponse } from 'next/server';
import { validateApiKey, recordApiKeyUsage } from '@/lib/api-keys-service';
import { getSsoAppAuthConfig, sha256Hex, timingSafeEqualHex } from '@/lib/sso-service';
import { extractClientIP } from '@/lib/audit-service';

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
 * Authenticate an app-facing API request.
 *
 * Supports two auth methods:
 * 1. API key — `Authorization: Bearer sk_...` (recommended for production)
 * 2. App secret — `app_secret` field in request body (for POST/PATCH/DELETE)
 *
 * The `urlAppId` must match whichever credential is provided.
 */
export async function authenticateAppRequest(
  request: Request,
  urlAppId: string,
  body?: Record<string, unknown>
): Promise<AppAuthResult> {
  const ipAddress = extractClientIP(request) || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const authHeader = request.headers.get('authorization');

  // API key: Authorization: Bearer <key>
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const apiKey = authHeader.slice(7);
    const validated = await validateApiKey(apiKey);

    if (!validated) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 }),
      };
    }

    if (validated.app_id !== urlAppId) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'API key does not belong to this app' }, { status: 403 }),
      };
    }

    // Fire-and-forget
    recordApiKeyUsage(apiKey).catch(() => {});

    return { ok: true, appId: urlAppId, authMethod: 'api_key', ipAddress, userAgent };
  }

  // App secret: app_secret in body (POST/PATCH/DELETE only)
  if (body && typeof body.app_secret === 'string' && body.app_secret) {
    const appSecret = body.app_secret;
    const appConfig = await getSsoAppAuthConfig(urlAppId);

    if (!appConfig?.id) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unknown app_id' }, { status: 400 }),
      };
    }

    if (appConfig.enabled === false) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'App is disabled' }, { status: 403 }),
      };
    }

    if (!appConfig.ssoClientSecretHash) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'App secret is not configured' }, { status: 403 }),
      };
    }

    const computed = sha256Hex(appSecret);
    const ok = timingSafeEqualHex(computed, appConfig.ssoClientSecretHash);

    if (!ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid app_secret' }, { status: 401 }),
      };
    }

    return { ok: true, appId: urlAppId, authMethod: 'app_secret', ipAddress, userAgent };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Authentication required. Provide Bearer API key or app_secret in body.' },
      { status: 401 }
    ),
  };
}
