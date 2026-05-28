import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getRoles } from '@/lib/apps-service';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const requestId = (await headers()).get('x-request-id') ?? undefined;

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError(401, 'Unauthorized', requestId);
    }

    const { appId } = await params;

    // Authorization: global admin OR app-specific admin for this appId
    const isGlobalAdmin = user.app_metadata?.claims_admin === true;
    const appClaims = (user.app_metadata?.apps as Record<string, { admin?: boolean }> | undefined)?.[appId];
    const isAppAdmin = appClaims?.admin === true;

    if (!isGlobalAdmin && !isAppAdmin) {
      return apiError(403, 'Forbidden', requestId);
    }

    const roles = await getRoles(appId);
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return apiError(500, 'Failed to fetch roles', requestId);
  }
}
