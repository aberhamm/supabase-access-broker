export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserProfileHeaderServer } from '@/components/users/UserProfileHeaderServer';
import { EnhancedUserInfoCard } from '@/components/users/EnhancedUserInfoCard';
import { EnhancedMFACard } from '@/components/users/EnhancedMFACard';
import { EnhancedQuickActions } from '@/components/users/EnhancedQuickActions';
import { UserActivityTimeline } from '@/components/users/UserActivityTimeline';
import { UserInsightsPanelServer } from '@/components/users/UserInsightsPanelServer';
import { UserStatusCard } from '@/components/users/UserStatusCard';
import { TelegramLink } from '@/components/users/TelegramLink';
import { AppAccessCard } from '@/components/apps/AppAccessCard';
import { ClaimsList } from '@/components/claims/ClaimsList';
import { AddClaimButton } from '@/components/claims/AddClaimButton';
import { AppClaimsList } from '@/components/apps/AppClaimsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TelegramData } from '@/app/actions/telegram';
import { getApps } from '@/lib/apps-service';
import { listUserMFAFactors } from '@/app/actions/users';
import { getUserCustomClaimsCount } from '@/types/claims';

async function getUserDetails(userId: string) {
  const adminSupabase = await createAdminClient();
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

  if (!user) {
    redirect('/users');
  }

  const claims = user.app_metadata || {};
  const isAdmin = user.app_metadata?.claims_admin === true;
  const userApps = user.app_metadata?.apps || {};
  const telegramData = user.app_metadata?.telegram as TelegramData | undefined;

  const [availableApps, mfaResult] = await Promise.all([
    getApps(),
    listUserMFAFactors(id),
  ]);

  const mfaFactors = mfaResult.success ? mfaResult.factors || [] : [];
  const claimsCount = getUserCustomClaimsCount(claims);
  const appsCount = Object.keys(userApps).length;

  const lastSignInDays = user.last_sign_in_at
    ? Math.floor((Date.now() - new Date(user.last_sign_in_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <UserProfileHeaderServer
        userId={id}
        email={user.email || ''}
        isAdmin={isAdmin}
        emailConfirmed={!!user.email_confirmed_at}
        lastSignIn={user.last_sign_in_at}
      />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Sidebar - 4 columns */}
        <div className="space-y-6 lg:col-span-4">
          <EnhancedUserInfoCard
            email={user.email || ''}
            phone={user.phone}
            displayName={user.user_metadata?.display_name as string}
            userId={id}
            isAdmin={isAdmin}
            createdAt={user.created_at}
            lastSignIn={user.last_sign_in_at}
          />

          <UserStatusCard
            userId={id}
            userEmail={user.email || ''}
            emailConfirmedAt={user.email_confirmed_at}
            bannedUntil={(user as { banned_until?: string | null }).banned_until}
          />

          <EnhancedMFACard factors={mfaFactors} userId={id} />

          <EnhancedQuickActions
            userId={id}
            isAdmin={isAdmin}
          />

          <Card className="animate-reveal" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <TelegramLink userId={id} telegram={telegramData} />
            </CardContent>
          </Card>
        </div>

        {/* Main Content - 5 columns */}
        <div className="space-y-6 lg:col-span-5">
          <AppAccessCard
            userId={id}
            userApps={userApps}
            availableApps={availableApps}
            isGlobalAdmin={isAdmin}
          />

          <Card className="animate-reveal" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <CardTitle>Custom Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="global" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="global">Global Claims</TabsTrigger>
                  <TabsTrigger value="apps">
                    App Claims
                    {appsCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {appsCount}
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

          <UserActivityTimeline
            userId={id}
            createdAt={user.created_at}
            lastSignIn={user.last_sign_in_at}
            isAdmin={isAdmin}
          />
        </div>

        {/* Right Sidebar - 3 columns */}
        <div className="space-y-6 lg:col-span-3">
          <UserInsightsPanelServer
            userId={user.email || id}
            isAdmin={isAdmin}
            claimsCount={claimsCount}
            appsCount={appsCount}
            hasMFA={mfaFactors.length > 0}
            emailVerified={!!user.email_confirmed_at}
            lastSignInDays={lastSignInDays}
          />
        </div>
      </div>
    </div>
  );
}
