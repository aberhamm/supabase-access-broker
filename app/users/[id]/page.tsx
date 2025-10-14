export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { redirect } from 'next/navigation';
import { ClaimsList } from '@/components/claims/ClaimsList';
import { AddClaimButton } from '@/components/claims/AddClaimButton';
import { ToggleAdminButton } from '@/components/users/ToggleAdminButton';
import { CopyButton } from '@/components/users/CopyButton';
import { format } from 'date-fns';

async function getUserEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email || '';
}

async function handleLogout() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

async function getUserDetails(userId: string) {
  const adminSupabase = await createAdminClient();

  // Get user from auth.users using admin client
  const { data: userData, error: userError } =
    await adminSupabase.auth.admin.listUsers();

  if (userError) {
    console.error('Error fetching user:', userError);
    return null;
  }

  const user = userData.users.find((u) => u.id === userId);
  return user;
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserDetails(id);
  const email = await getUserEmail();

  if (!user) {
    redirect('/users');
  }

  // Use the app_metadata directly from the user object
  // This is more reliable than calling the RPC function
  const claims = user.app_metadata || {};
  const isAdmin = user.app_metadata?.claims_admin === true;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-bold">Claims Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <form action={handleLogout}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </header>

      <main className="container mx-auto space-y-8 p-4 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/users">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                User Details
              </h2>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Email
                  </p>
                  <p className="text-sm">{user.email}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    User ID
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {user.id}
                    </code>
                    <CopyButton text={user.id} />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    {isAdmin ? (
                      <Badge variant="default">Claims Admin</Badge>
                    ) : (
                      <Badge variant="outline">Standard User</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Created
                  </p>
                  <p className="text-sm">
                    {format(new Date(user.created_at), 'PPP')}
                  </p>
                </div>

                {user.last_sign_in_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Last Sign In
                    </p>
                    <p className="text-sm">
                      {format(new Date(user.last_sign_in_at), 'PPP p')}
                    </p>
                  </div>
                )}

                {user.email_confirmed_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Email Confirmed
                    </p>
                    <p className="text-sm">
                      {format(new Date(user.email_confirmed_at), 'PPP')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleAdminButton userId={id} isAdmin={isAdmin} />

                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Session Refresh</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Users need to log out and back in (or call{' '}
                    <code className="rounded bg-muted px-1">
                      refreshSession()
                    </code>
                    ) to see updated claims.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Custom Claims</CardTitle>
                <AddClaimButton userId={id} />
              </CardHeader>
              <CardContent>
                <ClaimsList claims={claims} userId={id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
