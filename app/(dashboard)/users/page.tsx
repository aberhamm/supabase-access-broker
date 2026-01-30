export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { EnhancedUserTable } from '@/components/users/EnhancedUserTable';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { UserStatsHeaderServer } from '@/components/users/UserStatsHeaderServer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Users } from 'lucide-react';

// Logout is now handled by /auth/logout route for reliable cookie clearing

export default async function UsersPage() {
  const supabase = await createClient();

  // Fetch stats and users in parallel
  const [statsResult, paginatedData] = await Promise.all([
    supabase.rpc('get_dashboard_stats'),
    supabase.rpc('get_users_paginated', {
      page_size: 100,
      page_offset: 0,
      search_email: null,
    }),
  ]);

  if (paginatedData.error) {
    console.error('Error fetching users:', paginatedData.error);
  }

  const users = paginatedData.data || [];
  const totalCount = users.length > 0 ? users[0].total_count : 0;

  // Parse stats
  const statsData = statsResult.data as {
    totalUsers: number;
    claimsAdmins: number;
    recentSignups: number;
  } | null;

  const stats = {
    totalUsers: statsData?.totalUsers || 0,
    activeUsers: Math.floor((statsData?.totalUsers || 0) * 0.7), // Approximation
    newSignups: statsData?.recentSignups || 0,
    admins: statsData?.claimsAdmins || 0,
  };

  // Transform the data to match User type
  const transformedUsers = users.map((u: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at?: string;
    app_metadata: Record<string, unknown>;
    total_count: number;
  }) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.app_metadata,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Manage user accounts, permissions, and access"
        breadcrumbs={[{ label: 'Users', icon: Users }]}
        actions={<CreateUserDialog />}
      />

      <UserStatsHeaderServer
        totalUsers={stats.totalUsers}
        activeUsers={stats.activeUsers}
        newSignups={stats.newSignups}
        admins={stats.admins}
      />

      <div className="animate-reveal" style={{ animationDelay: '0.2s' }}>
        <EnhancedUserTable users={transformedUsers} />
      </div>
    </div>
  );
}
