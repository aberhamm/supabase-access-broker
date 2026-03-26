import { NextRequest, NextResponse } from 'next/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { enforceRateLimit } from '@/lib/app-api-rate-limit';
import { logSSOEvent } from '@/lib/audit-service';

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

  const rateLimited = enforceRateLimit(app_id, 'write');
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

  const rateLimited = enforceRateLimit(app_id, 'read');
  if (rateLimited) return rateLimited;

  return NextResponse.json({
    message: 'Webhook endpoint active',
  });
}
