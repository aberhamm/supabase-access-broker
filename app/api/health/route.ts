import { NextResponse } from 'next/server';
import pkg from '@/package.json';

export async function GET() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Guard: if the service role key is missing, skip the DB check entirely
  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        status: 'degraded' as const,
        db: 'misconfigured' as const,
        timestamp: new Date().toISOString(),
        version: pkg.version,
      },
      { status: 200 }
    );
  }

  let db: 'ok' | 'unreachable' = 'ok';

  try {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabase = await createAdminClient();

    // Lightweight DB round-trip with a 2-second timeout
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        supabase.from('apps').select('id').limit(1),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Health check DB timeout')), 2000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    db = 'unreachable';
  }

  const status = db === 'ok' ? 'healthy' : 'degraded';

  return NextResponse.json(
    {
      status,
      db,
      timestamp: new Date().toISOString(),
      version: pkg.version,
    },
    { status: 200 }
  );
}
