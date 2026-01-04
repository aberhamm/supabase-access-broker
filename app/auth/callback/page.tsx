'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { debugError, debugLog } from '@/lib/auth-debug';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get('code');
      const next = searchParams.get('next') || '/';
      const type = searchParams.get('type');

      // Check for tokens in the URL hash (implicit flow from magic links)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        debugLog('[Auth Callback] Found tokens in hash, setting session...');
        setStatus('Setting up session...');

        // Parse the hash to get the access token and refresh token
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            debugError('[Auth Callback] Error setting session:', error);
            setStatus('Authentication failed');
            router.push('/login?error=session_failed');
            return;
          }

          debugLog('[Auth Callback] Session set successfully');

          // Check admin access
          const user = data.user;
          const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
          const apps = (user?.app_metadata?.apps as Record<string, { admin?: boolean }>) || {};
          const isAppAdmin = Object.values(apps).some((app) => app?.admin === true);

          if (!isGlobalAdmin && !isAppAdmin) {
            router.push('/access-denied');
            return;
          }

          // Redirect to the intended destination
          router.push(next);
          return;
        }
      }

      // Handle PKCE flow (code in query params)
      if (code) {
        debugLog('[Auth Callback] Found code, exchanging for session...');
        setStatus('Exchanging code for session...');

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          debugError('[Auth Callback] Error exchanging code:', error);
          setStatus('Authentication failed');
          router.push('/login?error=code_exchange_failed');
          return;
        }

        // Check if this is a password recovery flow
        if (type === 'recovery') {
          router.push('/reset-password');
          return;
        }

        // Get user and check admin access
        const { data: { user } } = await supabase.auth.getUser();
        const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
        const apps = (user?.app_metadata?.apps as Record<string, { admin?: boolean }>) || {};
        const isAppAdmin = Object.values(apps).some((app) => app?.admin === true);

        if (!isGlobalAdmin && !isAppAdmin) {
          router.push('/access-denied');
          return;
        }

        router.push(next);
        return;
      }

      // No code or hash tokens - redirect to login
      debugLog('[Auth Callback] No code or tokens found');
      router.push('/login');
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
