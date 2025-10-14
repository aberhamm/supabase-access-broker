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
import { AlertCircle } from 'lucide-react';

export default function AccessDeniedPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
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
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              To gain access, please contact your system administrator to have
              the claims_admin claim added to your account.
            </p>
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, try logging out and back in to
              refresh your session.
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
