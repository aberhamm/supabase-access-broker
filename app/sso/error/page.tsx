'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, ArrowLeft, RefreshCw, User } from 'lucide-react';
import { getErrorMessage } from '@/lib/auth-error-messages';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { buildSsoCompletePath, buildSsoLoginPath, isRetryableSsoError } from '@/lib/sso-flow-utils';

function SSOErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const error = searchParams.get('error');
  const appId = searchParams.get('app_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');

  const userMessage = getErrorMessage(error);

  // Build "Try Again" URL if we have enough context
  const hasRetryContext = !!appId && !!redirectUri;
  const retryUrl = hasRetryContext && isRetryableSsoError(error)
    ? buildSsoCompletePath({ appId, redirectUri, state })
    : null;

  // Build "Back to Login" URL preserving SSO params if present
  const loginUrl = buildSsoLoginPath({ appId, redirectUri, state, reauth: hasRetryContext });

  return (
    <AuthShell>
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-bold">Couldn&apos;t sign you in</CardTitle>
          <CardDescription className="text-base">{userMessage}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-2">
          {retryUrl && (
            <Button onClick={() => router.push(retryUrl)} className="w-full h-11">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button
            onClick={() => router.push(loginUrl)}
            variant={retryUrl ? 'outline' : 'default'}
            className="w-full h-11"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {hasRetryContext ? 'Sign in with a different account' : 'Back to Login'}
          </Button>
          {!hasRetryContext && (
            <Button
              onClick={() => router.push('/account')}
              variant="ghost"
              className="w-full h-11"
            >
              <User className="h-4 w-4 mr-2" />
              Go to Account
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">What you can do:</p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Check that you have access to this application</li>
            <li>Try signing in again</li>
            <li>Contact your administrator if the problem persists</li>
          </ul>
        </div>

        {error && (
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Technical details</p>
            <div className="text-xs space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Error code:</span>
                <code className="bg-background px-1 rounded break-all">{error}</code>
              </div>
              {appId && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Application:</span>
                  <code className="bg-background px-1 rounded break-all">{appId}</code>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </AuthShell>
  );
}

export default function SSOErrorPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <CardContent>
            <AuthSpinner label="Loading SSO error page" />
          </CardContent>
        </AuthShell>
      }
    >
      <SSOErrorContent />
    </Suspense>
  );
}
