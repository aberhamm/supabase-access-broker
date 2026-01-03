'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Copy, User, LogOut } from 'lucide-react';
import { toast } from 'sonner';

type RefreshStatus = 'idle' | 'refreshing' | 'success' | 'no_access' | 'error';

interface AppMetadata {
  claims_admin?: boolean;
  apps?: Record<string, { admin?: boolean; enabled?: boolean }>;
  [key: string]: unknown;
}

/** Check if user has admin access (global or per-app) */
function hasAdminAccess(appMetadata: AppMetadata | null): boolean {
  if (!appMetadata) return false;

  // Global admin
  if (appMetadata.claims_admin === true) return true;

  // Per-app admin
  const apps = appMetadata.apps || {};
  return Object.values(apps).some((app) => app?.admin === true);
}

export default function RefreshSessionPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RefreshStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [claims, setClaims] = useState<AppMetadata | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
        const appMetadata = (data.session.user.app_metadata || {}) as AppMetadata;
        setClaims(appMetadata);
        setUserId(data.session.user.id);
        setUserEmail(data.session.user.email || null);

        // Check if user now has admin access
        if (hasAdminAccess(appMetadata)) {
          setStatus('success');
          // Auto-redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push('/');
          }, 2000);
        } else {
          // User still doesn't have admin access
          setStatus('no_access');
        }
      } else {
        setStatus('error');
        setErrorMessage('No session found. Please log in again.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh session');
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const copyUserId = () => {
    if (userId) {
      navigator.clipboard.writeText(userId);
      toast.success('User ID copied to clipboard');
    }
  };

  const copySqlCommand = () => {
    if (userId) {
      const sql = `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"claims_admin": true}'::jsonb WHERE id = '${userId}'::uuid;`;
      navigator.clipboard.writeText(sql);
      toast.success('SQL command copied to clipboard');
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
          <CardTitle>
            {status === 'no_access' ? 'Still No Access' : 'Refreshing Session'}
          </CardTitle>
          <CardDescription>
            {status === 'no_access'
              ? 'Your session was refreshed, but you still lack admin access'
              : 'Updating your JWT token with the latest claims and permissions'}
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

          {status === 'no_access' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                  You still don&apos;t have admin access
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Your session was refreshed successfully, but your account still lacks the
                required <code className="bg-muted px-1 py-0.5 rounded">claims_admin</code>{' '}
                permission or app-level admin role.
              </p>

              {userId && (
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Your User ID:</p>
                    <Button onClick={copyUserId} variant="ghost" size="sm">
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <code className="text-xs block break-all">{userId}</code>
                  {userEmail && (
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  )}
                </div>
              )}

              {claims && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Your Current Claims:</p>
                  <pre className="text-xs overflow-auto max-h-32 bg-background p-2 rounded border">
                    {JSON.stringify(claims, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">What to do next:</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Contact your administrator to request access</li>
                  <li>Or, if you have database access, run the SQL below</li>
                  <li>Then click &quot;Try Again&quot; to refresh</li>
                </ol>
              </div>

              {userId && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">SQL Command:</p>
                    <Button onClick={copySqlCommand} variant="ghost" size="sm">
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="text-xs overflow-auto bg-background p-2 rounded border">
{`UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"claims_admin": true}'::jsonb
WHERE id = '${userId}'::uuid;`}
                  </pre>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={refreshSession} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={() => router.push('/account')} variant="outline" className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  Go to Account
                </Button>
                <Button onClick={handleLogout} variant="ghost" className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
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
