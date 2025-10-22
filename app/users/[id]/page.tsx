export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { ClaimsList } from '@/components/claims/ClaimsList';
import { AddClaimButton } from '@/components/claims/AddClaimButton';
import { ToggleAdminButton } from '@/components/users/ToggleAdminButton';
import { CopyButton } from '@/components/users/CopyButton';
import { AppAccessCard } from '@/components/apps/AppAccessCard';
import { AppClaimsList } from '@/components/apps/AppClaimsList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { getApps } from '@/lib/apps-service';
import { isClaimsAdmin } from '@/lib/claims';
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

  // Get specific user by ID (efficient, doesn't load all users)
  const { data: userData, error: userError } =
    await adminSupabase.auth.admin.getUserById(userId);

  if (userError) {
    console.error('Error fetching user:', userError);
    return null;
  }

  return userData.user;
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
  const userApps = user.app_metadata?.apps || {};
  const isGlobalAdmin = user.app_metadata?.claims_admin === true;

  // Fetch available apps from service
  const availableApps = await getApps();

  // Check if user is admin to show Apps link
  const supabaseClient = await createClient();
  const { data: isAdminCheck } = await isClaimsAdmin(supabaseClient);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        email={email}
        logoutAction={handleLogout}
        showApps={isAdminCheck || false}
      />

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
          <div className="space-y-6 lg:col-span-1">
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
            <div className="space-y-6">
              <AppAccessCard
                userId={id}
                userApps={userApps}
                availableApps={availableApps}
                isGlobalAdmin={isGlobalAdmin}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Custom Claims</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="global" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="global">Global Claims</TabsTrigger>
                      <TabsTrigger value="apps">
                        App Claims
                        {Object.keys(userApps).length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {Object.keys(userApps).length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="mt-6">
                      <div className="flex justify-end mb-4">
                        <AddClaimButton userId={id} />
                      </div>
                      <ClaimsList claims={claims} userId={id} />
                    </TabsContent>

                    <TabsContent value="apps" className="mt-6">
                      <AppClaimsList userId={id} apps={userApps} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
