'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { debugError, debugLog } from '@/lib/auth-debug';
import { hasAnyAppAdmin } from '@/types/claims';
import { safeNextPath } from '@/lib/safe-redirect';
import { Spinner } from '@/components/ui/spinner';

/**
 * Minimal callback page — Apple style.
 *
 * A single breathing spinner on a clean background. No progress bars,
 * no step text, no numbered dots. The animation absorbs the wait;
 * by the time the user notices, the redirect has already fired.
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get('code');
      const next = safeNextPath(searchParams.get('next'), '/');
      const type = searchParams.get('type');

      // Prefetch the destination page so the transition feels instant
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = next;
      link.as = 'document';
      document.head.appendChild(link);

      // Check for tokens in the URL hash (implicit flow from magic links)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        debugLog('[Auth Callback] Found tokens in hash, setting session...');

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
            router.push(`/login?error=session_failed`);
            return;
          }

          debugLog('[Auth Callback] Session set successfully');

          const user = data.user;
          const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
          const apps = user?.app_metadata?.apps;
          const isAppAdmin = hasAnyAppAdmin(apps);

          if (!isGlobalAdmin && !isAppAdmin) {
            router.push('/access-denied');
            return;
          }

          router.push(next);
          return;
        }
      }

      // Handle PKCE flow (code in query params)
      if (code) {
        debugLog('[Auth Callback] Found code, exchanging for session...');

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          debugError('[Auth Callback] Error exchanging code:', error);
          router.push('/login?error=code_exchange_failed');
          return;
        }

        if (type === 'recovery') {
          router.push('/reset-password');
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
        const apps = user?.app_metadata?.apps;
        const isAppAdmin = hasAnyAppAdmin(apps);

        if (!isGlobalAdmin && !isAppAdmin) {
          router.push('/access-denied');
          return;
        }

        router.push(next);
        return;
      }

      // No code or hash tokens
      debugLog('[Auth Callback] No code or tokens found');
      router.push('/login');
    };

    handleCallback();
  }, [router, searchParams]);

  return <CallbackSpinner />;
}

function CallbackSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="relative auth-transition-in">
        <div className="absolute inset-0 -m-4 rounded-full bg-primary/10 auth-breathe" />
        <Spinner size="lg" className="text-primary" />
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackSpinner />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
