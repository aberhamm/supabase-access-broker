'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { debugLog } from '@/lib/auth-debug';

export default function AccessDeniedPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      debugLog('[AccessDenied] Loaded user info', { hasUser: !!user });
      setUserInfo(user);
      setLoading(false);
    }
    loadUserInfo();
  }, [supabase.auth]);

  const handleLogout = () => {
    debugLog('[AccessDenied] Logging out via /auth/logout');
    // Use the centralized logout route for reliable cookie clearing
    router.push('/auth/logout');
  };

  const copyUserId = () => {
    if (userInfo?.id) {
      navigator.clipboard.writeText(userInfo.id);
      toast.success('User ID copied to clipboard');
    }
  };

  const copySqlCommand = () => {
    if (userInfo?.id) {
      const sql = `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"claims_admin": true}'::jsonb WHERE id = '${userInfo.id}'::uuid;`;
      navigator.clipboard.writeText(sql);
      toast.success('SQL command copied to clipboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-destructive">
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to access this application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This application requires the <code className="rounded bg-muted px-1 py-0.5">claims_admin</code> claim to be set to <code className="rounded bg-muted px-1 py-0.5">true</code> in your user profile.
              </AlertDescription>
            </Alert>

            {!loading && userInfo && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Your User ID:</p>
                    <Button onClick={copyUserId} variant="ghost" size="sm">
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <code className="text-xs block break-all">{userInfo.id}</code>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Your Email:</p>
                  <code className="text-xs block">{userInfo.email}</code>
                </div>

                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Your Current Claims:</p>
                  <pre className="text-xs overflow-auto max-h-32 bg-background p-2 rounded border">
                    {JSON.stringify(userInfo.app_metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">How to fix this:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Go to your Supabase dashboard → SQL Editor</li>
                <li>Run the SQL command below (or click to copy)</li>
                <li>Come back here and click &quot;Refresh Session&quot;</li>
              </ol>
            </div>

            {userInfo && (
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
WHERE id = '${userInfo.id}'::uuid;`}
                </pre>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => router.push('/refresh-session')} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Session
              </Button>
              <Button onClick={handleLogout} variant="outline" className="flex-1">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
