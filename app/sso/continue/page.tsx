'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogIn, UserCircle, ArrowRightLeft } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { buildSsoCompletePath, buildSsoLoginPath, getSsoContinueHeaderCopy } from '@/lib/sso-flow-utils';

function SSOContinueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const appId = searchParams.get('app_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const hasRequiredParams = !!appId && !!redirectUri;

  const [email, setEmail] = useState<string | null>(null);
  const [appName, setAppName] = useState<string | null>(null);
  const [userSettled, setUserSettled] = useState(false);
  const [appSettled, setAppSettled] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const ssoCompleteUrl = buildSsoCompletePath({ appId, redirectUri, state }) ?? '/sso/complete';
  const loginUrl = buildSsoLoginPath({ appId, redirectUri, state });

  useEffect(() => {
    if (!hasRequiredParams) {
      router.replace('/login');
    }
  }, [hasRequiredParams, router]);

  useEffect(() => {
    if (!hasRequiredParams) return;

    let cancelled = false;
    setUserSettled(false);
    supabase.auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.user) {
          router.replace(loginUrl);
          return;
        }
        setEmail(data.user.email ?? null);
        setUserSettled(true);
      })
      .catch(() => {
        if (!cancelled) router.replace(loginUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [hasRequiredParams, loginUrl, router, supabase]);

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    setAppName(null);
    setAppSettled(false);
    fetch(`/api/apps/${encodeURIComponent(appId)}/auth-methods`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.app_name) setAppName(data.app_name);
        setAppSettled(true);
      })
      .catch(() => {
        if (!cancelled) setAppSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  const headerReady = userSettled && appSettled;
  const headerCopy = getSsoContinueHeaderCopy({ appName, email });

  function handleContinue() {
    setLoading(true);
    router.push(ssoCompleteUrl);
  }

  async function handleSwitchAccount() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push(loginUrl);
  }

  if (!appId || !redirectUri) {
    return null;
  }

  return (
    <AuthShell>
      <CardHeader className="text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <UserCircle className="h-7 w-7 text-primary" />
        </div>
        {!headerReady ? (
          <AuthSpinner label="Loading account chooser" />
        ) : (
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">
              {headerCopy.title}
            </CardTitle>
            <CardDescription>
              {headerCopy.description}
            </CardDescription>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full h-11"
          disabled={loading || !headerReady}
          onClick={handleContinue}
        >
          <LogIn className="h-4 w-4 mr-2" />
          {loading ? 'Continuing...' : 'Continue with this account'}
        </Button>
        <Button
          variant="outline"
          className="w-full h-11"
          disabled={loading || !headerReady}
          onClick={handleSwitchAccount}
        >
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Use a different account
        </Button>
      </CardContent>
    </AuthShell>
  );
}

export default function SSOContinuePage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <CardContent>
            <AuthSpinner label="Loading account chooser" />
          </CardContent>
        </AuthShell>
      }
    >
      <SSOContinueContent />
    </Suspense>
  );
}
