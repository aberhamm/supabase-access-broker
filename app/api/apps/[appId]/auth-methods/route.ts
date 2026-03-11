import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('auth_methods')
      .eq('id', appId)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      return NextResponse.json({ auth_methods: null });
    }

    return NextResponse.json({ auth_methods: data.auth_methods ?? null });
  } catch {
    return NextResponse.json({ auth_methods: null });
  }
}
