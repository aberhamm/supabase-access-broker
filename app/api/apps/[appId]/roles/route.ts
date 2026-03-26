import { NextRequest, NextResponse } from 'next/server';
import { getRoles } from '@/lib/apps-service';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { appId } = await params;

    // Authorization: global admin OR app-specific admin for this appId
    const isGlobalAdmin = user.app_metadata?.claims_admin === true;
    const appClaims = (user.app_metadata?.apps as Record<string, { admin?: boolean }> | undefined)?.[appId];
    const isAppAdmin = appClaims?.admin === true;

    if (!isGlobalAdmin && !isAppAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const roles = await getRoles(appId);
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}
