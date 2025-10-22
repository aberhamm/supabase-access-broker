import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        // Server checks for existing sessions and can refresh tokens
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // Extend cookie expiry to 7 days
                maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
                path: '/',
                sameSite: 'lax',
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Admin client with service role key for admin operations
// ⚠️ Only use this in server-side code (Server Components, Server Actions)
export async function createAdminClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        // Admin client - session handling
        persistSession: true,
        autoRefreshToken: true,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: 7 * 24 * 60 * 60, // 7 days
                path: '/',
                sameSite: 'lax',
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
