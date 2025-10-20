import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user to check claims_admin
      const { data: { user } } = await supabase.auth.getUser();

      // Check if user has claims_admin access
      const isClaimsAdmin = user?.app_metadata?.claims_admin === true;

      if (!isClaimsAdmin) {
        // Redirect to access denied if not a claims admin
        return NextResponse.redirect(new URL('/access-denied', requestUrl.origin));
      }

      // Redirect to the requested page or home
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
