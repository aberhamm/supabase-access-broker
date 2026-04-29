import { NextRequest, NextResponse } from 'next/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { enforceRateLimit } from '@/lib/app-api-rate-limit';
import { logSSOEvent } from '@/lib/audit-service';

/**
 * Placeholder webhook receiver for consuming apps.
 *
 * NOT a generic third-party webhook relay (e.g. Stripe → broker). Authentication
 * is by the consuming app's own API key / app secret via authenticateAppRequest.
 * The endpoint is a stub that customer apps fork to add their own logic — it
 * does not implement HMAC signature verification because the trust boundary is
 * the app credential, not a per-source signing key.
 *
 * If you need to accept signed third-party webhooks, do not extend this route;
 * add a new route that verifies HMAC + timestamp/replay window per source.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app_id: string }> }
) {
  const { app_id } = await params;

  // Authenticate inline — no middleware header passing
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await authenticateAppRequest(request, app_id, body, {
    auditEventType: 'webhook_error',
  });
  if (!auth.ok) return auth.response;

  const rateLimited = await enforceRateLimit(app_id, 'write');
  if (rateLimited) return rateLimited;

  const { ipAddress, userAgent, authMethod } = auth;

  try {
    // Log receipt metadata only — never log payload contents
    logSSOEvent({
      eventType: 'webhook_received',
      appId: app_id,
      ipAddress,
      userAgent,
      metadata: { auth_method: authMethod },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      received_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Webhook error:', error);
    logSSOEvent({
      eventType: 'webhook_error',
      appId: app_id,
      errorCode: 'server_error',
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ app_id: string }> }
) {
  const { app_id } = await params;

  const auth = await authenticateAppRequest(request, app_id, undefined, {
    auditEventType: 'webhook_error',
  });
  if (!auth.ok) return auth.response;

  const rateLimited = await enforceRateLimit(app_id, 'read');
  if (rateLimited) return rateLimited;

  return NextResponse.json({
    message: 'Webhook endpoint active',
  });
}
