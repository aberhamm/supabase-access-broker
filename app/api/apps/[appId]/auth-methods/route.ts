import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    // Use admin client to bypass RLS — this endpoint is called by
    // unauthenticated users during the SSO login flow, and the apps
    // table RLS policy only allows claims_admin access.
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('name,enabled,auth_methods,allow_self_signup,self_signup_default_role')
      .eq('id', appId)
      .maybeSingle();

    if (error) {
      console.error('[auth-methods] Error fetching app:', error);
      return NextResponse.json({ auth_methods: null, status: 'error' });
    }

    if (!data) {
      return NextResponse.json({ auth_methods: null, status: 'app_not_found' });
    }

    if (!data.enabled) {
      return NextResponse.json({ auth_methods: null, status: 'app_disabled' });
    }

    return NextResponse.json({
      app_name: data.name ?? null,
      auth_methods: data.auth_methods ?? null,
      allow_self_signup: data.allow_self_signup ?? false,
      self_signup_default_role: data.self_signup_default_role ?? 'user',
      status: 'ok',
    });
  } catch {
    return NextResponse.json({ auth_methods: null, status: 'error' });
  }
}
