'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export default function RefreshSessionPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'refreshing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);

  const refreshSession = async () => {
    setStatus('refreshing');
    setErrorMessage('');

    try {
      const supabase = createClient();

      // Force refresh the session to get updated JWT with latest claims
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      if (data.session?.user) {
        setClaims(data.session.user.app_metadata);
        setStatus('success');

        // Auto-redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh session');
    }
  };

  useEffect(() => {
    // Auto-refresh on page load
    refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Refreshing Session</CardTitle>
          <CardDescription>
            Updating your JWT token with the latest claims and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'refreshing' && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Refreshing your session...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Session refreshed successfully!</span>
              </div>

              {claims && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Your Current Claims:</p>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(claims, null, 2)}
                  </pre>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard in 2 seconds...
              </p>

              <Button onClick={() => router.push('/')} className="w-full">
                Go to Dashboard Now
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Failed to refresh session</span>
              </div>

              {errorMessage && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={refreshSession} variant="outline" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={() => router.push('/login')} variant="default" className="flex-1">
                  Re-login
                </Button>
              </div>
            </div>
          )}

          {status === 'idle' && (
            <Button onClick={refreshSession} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Session
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Why do I need to refresh?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Your JWT token is created when you log in and contains a snapshot of your permissions.
          </p>
          <p>
            If your <code className="bg-muted px-1 py-0.5 rounded">claims_admin</code> flag was added
            after you logged in, your current JWT won&apos;t have it.
          </p>
          <p>
            Refreshing your session updates the JWT with your latest permissions from the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
