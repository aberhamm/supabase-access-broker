'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { debugError, debugLog } from '@/lib/auth-debug';
import { hasAnyAppAdmin } from '@/types/claims';
import { safeNextPath } from '@/lib/safe-redirect';

const STEPS = [
  'Authenticating...',
  'Setting up session...',
  'Checking permissions...',
  'Redirecting...',
] as const;

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const code = searchParams.get('code');
      const next = safeNextPath(searchParams.get('next'), '/');
      const type = searchParams.get('type');

      // Prefetch the destination page
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = next;
      link.as = 'document';
      document.head.appendChild(link);

      // Check for tokens in the URL hash (implicit flow from magic links)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        debugLog('[Auth Callback] Found tokens in hash, setting session...');
        setStepIndex(1);

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
            setError('Authentication failed');
            router.push(`/login?error=session_failed`);
            return;
          }

          debugLog('[Auth Callback] Session set successfully');
          setStepIndex(2);

          // Check admin access
          const user = data.user;
          const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
          const apps = user?.app_metadata?.apps;
          const isAppAdmin = hasAnyAppAdmin(apps);

          if (!isGlobalAdmin && !isAppAdmin) {
            router.push('/access-denied');
            return;
          }

          setStepIndex(3);
          // Redirect to the intended destination
          router.push(next);
          return;
        }
      }

      // Handle PKCE flow (code in query params)
      if (code) {
        debugLog('[Auth Callback] Found code, exchanging for session...');
        setStepIndex(1);

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          debugError('[Auth Callback] Error exchanging code:', error);
          setError('Authentication failed');
          router.push('/login?error=code_exchange_failed');
          return;
        }

        // Check if this is a password recovery flow
        if (type === 'recovery') {
          router.push('/reset-password');
          return;
        }

        setStepIndex(2);

        // Get user and check admin access
        const { data: { user } } = await supabase.auth.getUser();
        const isGlobalAdmin = user?.app_metadata?.claims_admin === true;
        const apps = user?.app_metadata?.apps;
        const isAppAdmin = hasAnyAppAdmin(apps);

        if (!isGlobalAdmin && !isAppAdmin) {
          router.push('/access-denied');
          return;
        }

        setStepIndex(3);
        router.push(next);
        return;
      }

      // No code or hash tokens - redirect to login
      debugLog('[Auth Callback] No code or tokens found');
      router.push('/login');
    };

    handleCallback();
  }, [router, searchParams]);

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-xs space-y-6 text-center animate-in fade-in-0 duration-300">
        {/* Spinner */}
        <div className="mx-auto h-10 w-10 relative">
          <svg className="animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {error || STEPS[stepIndex]}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex ? 'bg-primary scale-110' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="w-full max-w-xs space-y-6 text-center">
            <div className="mx-auto h-10 w-10">
              <svg className="animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full w-1/4 rounded-full bg-primary animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
