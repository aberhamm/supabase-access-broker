import { NextRequest, NextResponse } from 'next/server';
import { getAppById } from '@/lib/apps-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;
    const app = await getAppById(appId);

    if (!app) {
      return NextResponse.json({ auth_methods: null, status: 'app_not_found' });
    }

    if (!app.enabled) {
      return NextResponse.json({ auth_methods: null, status: 'app_disabled' });
    }

    return NextResponse.json({ auth_methods: app.auth_methods ?? null, status: 'ok' });
  } catch {
    return NextResponse.json({ auth_methods: null, status: 'error' });
  }
}
