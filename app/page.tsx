export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAllUsers } from '@/lib/claims';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { UserActivityList } from '@/components/users/UserActivityList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardNav } from '@/components/layout/DashboardNav';
import Link from 'next/link';
import { Users, AppWindow } from 'lucide-react';
import { redirect } from 'next/navigation';
import { UserStats, User, ClaimDistribution } from '@/types/claims';
import { isClaimsAdmin } from '@/lib/claims';

async function getStats(): Promise<{
  stats: UserStats;
  recentUsers: User[];
  claimDistribution: ClaimDistribution[];
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use admin client to list all users
  const adminSupabase = await createAdminClient();
  const { data: users } = await getAllUsers(adminSupabase);

  if (!users) {
    return {
      stats: {
        totalUsers: 0,
        claimsAdmins: 0,
        totalClaims: 0,
        recentSignups: 0,
      },
      recentUsers: [],
      claimDistribution: [],
    };
  }

  // Calculate stats
  const totalUsers = users.length;
  const claimsAdmins = users.filter(
    (u) => u.app_metadata?.claims_admin === true
  ).length;

  // Count total claims (excluding provider/providers)
  let totalClaims = 0;
  const claimCounts: Record<string, number> = {};

  users.forEach((u) => {
    if (u.app_metadata) {
      Object.keys(u.app_metadata).forEach((key) => {
        if (key !== 'provider' && key !== 'providers') {
          totalClaims++;
          claimCounts[key] = (claimCounts[key] || 0) + 1;
        }
      });
    }
  });

  // Recent signups (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSignups = users.filter(
    (u) => new Date(u.created_at) > sevenDaysAgo
  ).length;

  // Get recent users (sorted by last sign in)
  const recentUsers = [...users]
    .filter((u) => u.last_sign_in_at)
    .sort(
      (a, b) =>
        new Date(b.last_sign_in_at!).getTime() -
        new Date(a.last_sign_in_at!).getTime()
    )
    .slice(0, 5);

  // Claim distribution (top 10)
  const claimDistribution = Object.entries(claimCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([claim, count]) => ({ claim, count }));

  return {
    stats: {
      totalUsers,
      claimsAdmins,
      totalClaims,
      recentSignups,
    },
    recentUsers,
    claimDistribution,
  };
}

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

export default async function DashboardPage() {
  const { stats, recentUsers, claimDistribution } = await getStats();
  const email = await getUserEmail();

  // Check if user is admin to show Apps link
  const supabase = await createClient();
  const { data: isAdmin } = await isClaimsAdmin(supabase);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        email={email}
        logoutAction={handleLogout}
        showApps={isAdmin || false}
      />

      <main className="container mx-auto space-y-8 p-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">
              Manage users and custom claims for your Supabase project
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link href="/apps">
                <Button variant="outline">
                  <AppWindow className="mr-2 h-4 w-4" />
                  Manage Apps
                </Button>
              </Link>
            )}
            <Link href="/users">
              <Button>
                <Users className="mr-2 h-4 w-4" />
                View All Users
              </Button>
            </Link>
          </div>
        </div>

        <UserStatsCards stats={stats} />

        <div className="grid gap-8 lg:grid-cols-2">
          <UserActivityList users={recentUsers} />

          <Card>
            <CardHeader>
              <CardTitle>Claims Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {claimDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No claims data available
                </p>
              ) : (
                <div className="space-y-4">
                  {claimDistribution.map(({ claim, count }) => (
                    <div key={claim} className="flex items-center">
                      <div className="flex-1">
                        <p className="font-mono text-sm font-medium">{claim}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(count / stats.totalUsers) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium tabular-nums w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
