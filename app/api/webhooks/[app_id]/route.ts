import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app_id: string }> }
) {
  try {
    const { app_id } = await params;

    // Get context from middleware headers
    const appId = request.headers.get('x-app-id');
    const keyId = request.headers.get('x-key-id');
    const roleName = request.headers.get('x-role-name');

    // Verify the app_id matches
    if (appId !== app_id) {
      return NextResponse.json(
        { error: 'API key not valid for this app' },
        { status: 403 }
      );
    }

    // Parse the webhook payload
    const body = await request.json();

    // Example: Process the webhook
    console.log('Webhook received:', {
      appId,
      keyId,
      roleName,
      payload: body,
    });

    // Return success with context information
    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      context: {
        app_id: appId,
        key_id: keyId,
        role: roleName || null,
      },
      received_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Webhook error:', error);
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

  // Get context from middleware headers
  const appId = request.headers.get('x-app-id');
  const keyId = request.headers.get('x-key-id');
  const roleName = request.headers.get('x-role-name');

  // Verify the app_id matches
  if (appId !== app_id) {
    return NextResponse.json(
      { error: 'API key not valid for this app' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'Webhook endpoint active',
    context: {
      app_id: appId,
      key_id: keyId,
      role: roleName || null,
    },
  });
}

