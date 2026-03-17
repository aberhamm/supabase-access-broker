import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateAppRequest } from '@/lib/app-api-auth';
import { logSSOEvent } from '@/lib/audit-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  const auth = await authenticateAppRequest(request, appId);
  if (!auth.ok) return auth.response;

  const { ipAddress, userAgent, authMethod } = auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
    const search = searchParams.get('search') ?? '';
    const offset = (page - 1) * limit;

    const supabase = await createAdminClient();
    const { data, error } = await supabase.rpc('list_app_users_paginated', {
      app_id: appId,
      p_limit: limit,
      p_offset: offset,
      p_search: search,
    });

    if (error) throw error;

    const rows = (data ?? []) as { user_id: string; user_email: string; app_data: Record<string, unknown>; total_count: number }[];
    const total = rows.length > 0 ? rows[0].total_count : 0;

    logSSOEvent({
      eventType: 'user_list_success',
      appId,
      ipAddress,
      userAgent,
      metadata: { count: rows.length, total, auth_method: authMethod },
    });

    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.user_id,
        email: u.user_email,
        app_claims: u.app_data,
      })),
      total,
      page,
      limit,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    logSSOEvent({
      eventType: 'user_list_error',
      appId,
      ipAddress,
      userAgent,
      errorCode: 'server_error',
      metadata: { error_message: message, auth_method: authMethod },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
