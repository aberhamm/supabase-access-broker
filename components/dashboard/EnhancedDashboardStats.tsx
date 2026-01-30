'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { User, UserStats, ClaimDistribution } from '@/types/claims';
import { TrendingUp, Users, Shield, Activity, Clock } from 'lucide-react';

interface EnhancedDashboardStatsContentProps {
  stats: UserStats;
  recentUsers: User[];
  claimDistribution: ClaimDistribution[];
}

function EnhancedDashboardStatsContent() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [claimDistribution, setClaimDistribution] = useState<ClaimDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

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

        if (statsResult.error) throw new Error(statsResult.error.message);
        if (recentUsersResult.error) throw new Error(recentUsersResult.error.message);
        if (claimDistResult.error) throw new Error(claimDistResult.error.message);

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
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : JSON.stringify(err);
        console.error('Failed to load dashboard data:', message);
        setError('Failed to load dashboard data');
        setErrorDetail(message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Primary metric skeleton - spans 2 columns */}
          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-12 w-12 rounded-xl shrink-0"></div>
                  <div className="space-y-2">
                    <div className="skeleton h-[14px] w-24"></div>
                    <div className="skeleton h-9 w-16"></div>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="skeleton h-[14px] w-12 ml-auto"></div>
                  <div className="skeleton h-3 w-16 ml-auto"></div>
                </div>
              </div>
              <div className="flex items-end gap-1 h-12">
                {[60, 80, 70, 95, 85, 100, 90].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 skeleton rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Secondary metric skeletons */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="skeleton h-9 w-9 rounded-lg shrink-0"></div>
                <div className="skeleton h-[14px] w-16"></div>
              </div>
              <div className="skeleton h-9 w-16 mb-1"></div>
              <div className="skeleton h-3 w-24"></div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="skeleton h-9 w-9 rounded-lg shrink-0"></div>
                <div className="skeleton h-[14px] w-16"></div>
              </div>
              <div className="skeleton h-9 w-16 mb-1"></div>
              <div className="flex items-center gap-1.5">
                <div className="skeleton h-2 w-2 rounded-full shrink-0"></div>
                <div className="skeleton h-3 w-16"></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="skeleton h-6 w-32"></div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                  <div className="skeleton h-10 w-10 rounded-full shrink-0"></div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="skeleton h-[14px] w-48"></div>
                    <div className="skeleton h-3 w-32"></div>
                  </div>
                  <div className="skeleton h-3 w-20"></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="skeleton h-6 w-40"></div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="skeleton h-[14px] w-24"></div>
                    <div className="skeleton h-[14px] w-8"></div>
                  </div>
                  <div className="skeleton h-2 w-full rounded-full"></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error || 'Failed to load data'}</p>
          {errorDetail && (
            <p className="mt-2 text-xs text-muted-foreground text-center break-words">
              {errorDetail}
            </p>
          )}
          {errorDetail?.includes('only claims admins') && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/refresh-session')}
              >
                Refresh session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Generate mock mini bar chart data
  const miniChartData = [40, 65, 55, 80, 70, 90, 75];

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Primary metric - larger, with gradient */}
        <Card className="relative overflow-hidden md:col-span-2 card-hover group animate-reveal">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/3 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-4xl font-bold tracking-tight">{stats.totalUsers}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-success text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  <span>+{stats.recentSignups}</span>
                </div>
                <p className="text-xs text-muted-foreground">this week</p>
              </div>
            </div>
            {/* Mini bar chart */}
            <div className="flex items-end gap-1 h-12">
              {miniChartData.map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/20 rounded-t transition-all duration-300 hover:bg-primary/40 cursor-pointer"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Secondary metrics */}
        <Card className="card-hover animate-reveal">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Admins</p>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.claimsAdmins}</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalUsers > 0 ? ((stats.claimsAdmins / stats.totalUsers) * 100).toFixed(1) : 0}% of users
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover animate-reveal">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-success/10 ring-1 ring-success/20">
                <Activity className="h-5 w-5 text-success" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Claims</p>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalClaims}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <p className="text-xs text-muted-foreground status-live">Active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="animate-reveal">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {user.last_sign_in_at && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(user.last_sign_in_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claims Distribution */}
        <Card className="animate-reveal">
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
                  <div key={claim} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-mono text-sm font-medium">{claim}</p>
                      <span className="text-sm font-medium tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
                        {count}
                      </span>
                    </div>
                    <div className="relative w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-500 group-hover:shadow-lg"
                        style={{
                          width: `${stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0}%`,
                        }}
                      />
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

export function EnhancedDashboardStats() {
  return (
    <ErrorBoundary>
      <EnhancedDashboardStatsContent />
    </ErrorBoundary>
  );
}
