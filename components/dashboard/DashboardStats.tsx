'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserStatsCards } from '@/components/users/UserStatsCards';
import { UserActivityList } from '@/components/users/UserActivityList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonStatsGrid } from '@/components/ui/skeleton-stats';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { User, UserStats, ClaimDistribution } from '@/types/claims';

function DashboardStatsContent() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [claimDistribution, setClaimDistribution] = useState<ClaimDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        // Fetch all data in parallel
        const [statsResult, recentUsersResult, claimDistResult] = await Promise.all([
          supabase.rpc('get_dashboard_stats'),
          supabase.rpc('get_recent_users', { limit_count: 5 }),
          supabase.rpc('get_claim_distribution', { limit_count: 10 }),
        ]);

        if (statsResult.error) throw statsResult.error;

        const statsData = statsResult.data as {
          totalUsers: number;
          claimsAdmins: number;
          recentSignups: number;
          totalApps: number;
          enabledApps: number;
          totalRoles: number;
          totalApiKeys: number;
        };
        const recentUsersData = (recentUsersResult.data || []) as User[];
        const claimDistData = (claimDistResult.data || []).map((item: { claim_key: string; user_count: number }) => ({
          claim: item.claim_key,
          count: Number(item.user_count),
        }));

        // Count total claims from distribution
        const totalClaims = claimDistData.reduce((sum: number, item: { claim: string; count: number }) => sum + item.count, 0);

        setStats({
          totalUsers: statsData.totalUsers || 0,
          claimsAdmins: statsData.claimsAdmins || 0,
          totalClaims,
          recentSignups: statsData.recentSignups || 0,
        });
        setRecentUsers(recentUsersData);
        setClaimDistribution(claimDistData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <>
        <SkeletonStatsGrid count={4} />
        <div className="grid gap-8 lg:grid-cols-2">
          <SkeletonCard showHeader={true} contentLines={5} />
          <SkeletonCard showHeader={true} contentLines={5} />
        </div>
      </>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error || 'Failed to load data'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
                            width: `${stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0}%`,
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
    </>
  );
}

export function DashboardStats() {
  return (
    <ErrorBoundary>
      <DashboardStatsContent />
    </ErrorBoundary>
  );
}
