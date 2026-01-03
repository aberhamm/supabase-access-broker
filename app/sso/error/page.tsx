'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, RefreshCw, User } from 'lucide-react';

/** Map of machine-readable error codes to user-friendly messages */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: 'The request was missing required parameters or was malformed.',
  unauthorized_client: 'This application is not authorized to use SSO.',
  invalid_redirect_uri: 'The redirect URL provided is not allowed for this application.',
  temporarily_unavailable: 'The SSO service is temporarily unavailable. Please try again later.',
  app_disabled: 'This application has been disabled by an administrator.',
  unknown_app: 'The application ID provided was not recognized.',
  access_denied: 'You do not have permission to access this application.',
  server_error: 'An unexpected error occurred. Please try again.',
};

function getErrorMessage(error: string | null, errorDescription: string | null): string {
  if (errorDescription) {
    return errorDescription;
  }
  if (error && ERROR_MESSAGES[error]) {
    return ERROR_MESSAGES[error];
  }
  return 'An error occurred during the SSO process.';
}

function SSOErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const appId = searchParams.get('app_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');

  const userMessage = getErrorMessage(error, errorDescription);

  // Build "Try Again" URL if we have enough context
  const canRetry = appId && redirectUri;
  const retryUrl = canRetry
    ? `/sso/complete?app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}${state ? `&state=${encodeURIComponent(state)}` : ''}`
    : null;

  // Build "Back to Login" URL preserving SSO params if present
  const loginUrl = canRetry
    ? `/login?app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}${state ? `&state=${encodeURIComponent(state)}` : ''}`
    : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-6 w-6" />
              SSO Error
            </CardTitle>
            <CardDescription>
              Something went wrong during authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{userMessage}</AlertDescription>
            </Alert>

            {error && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Error Details</p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Error Code:</span>
                    <code className="bg-background px-1 rounded">{error}</code>
                  </div>
                  {appId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Application:</span>
                      <code className="bg-background px-1 rounded">{appId}</code>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">What you can do:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Check that you have access to this application</li>
                <li>Try signing in again</li>
                <li>Contact your administrator if the problem persists</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              {retryUrl && (
                <Button onClick={() => router.push(retryUrl)} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              <Button
                onClick={() => router.push(loginUrl)}
                variant={retryUrl ? 'outline' : 'default'}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
              <Button
                onClick={() => router.push('/account')}
                variant="ghost"
                className="w-full"
              >
                <User className="h-4 w-4 mr-2" />
                Go to Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SSOErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <SSOErrorContent />
    </Suspense>
  );
}
