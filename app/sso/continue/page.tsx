'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogIn, UserCircle, ArrowRightLeft } from 'lucide-react';

function SSOContinueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const appId = searchParams.get('app_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');

  const [email, setEmail] = useState<string | null>(null);
  const [appName, setAppName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (!appId) return;
    fetch(`/api/apps/${appId}/auth-methods`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.app_name) setAppName(data.app_name);
      })
      .catch(() => {});
  }, [appId]);

  const ssoCompleteUrl = `/sso/complete?app_id=${encodeURIComponent(appId ?? '')}&redirect_uri=${encodeURIComponent(redirectUri ?? '')}${state ? `&state=${encodeURIComponent(state)}` : ''}`;

  function handleContinue() {
    setLoading(true);
    router.push(ssoCompleteUrl);
  }

  async function handleSwitchAccount() {
    setLoading(true);
    await supabase.auth.signOut();
    const loginUrl = `/login?app_id=${encodeURIComponent(appId ?? '')}&redirect_uri=${encodeURIComponent(redirectUri ?? '')}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
    router.push(loginUrl);
  }

  if (!appId || !redirectUri) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserCircle className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Continue to {appName || 'application'}
            </CardTitle>
            <CardDescription>
              You&apos;re already signed in{email ? ` as` : ''}
            </CardDescription>
            {email && (
              <p className="text-sm font-medium mt-1">{email}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              disabled={loading}
              onClick={handleContinue}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? 'Continuing...' : 'Continue with this account'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={handleSwitchAccount}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Use a different account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SSOContinuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <SSOContinueContent />
    </Suspense>
  );
}
