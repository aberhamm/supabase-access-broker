export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { isClaimsAdmin } from '@/lib/claims';
import { UserTable } from '@/components/users/UserTable';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { redirect } from 'next/navigation';

async function getUserEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email || '';
}

// Logout is now handled by /auth/logout route for reliable cookie clearing

export default async function UsersPage() {
  const supabase = await createClient();
  const email = await getUserEmail();

  // Check if user is admin to show Apps link
  const { data: isAdmin } = await isClaimsAdmin(supabase);

  // Use paginated query to prevent memory issues
  // Default: load first 100 users
  const { data: paginatedData, error } = await supabase.rpc('get_users_paginated', {
    page_size: 100,
    page_offset: 0,
    search_email: null,
  });

  if (error) {
    console.error('Error fetching users:', error);
  }

  const users = paginatedData || [];
  const totalCount = users.length > 0 ? users[0].total_count : 0;

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
    <div className="min-h-screen bg-background">
      <DashboardNav
        email={email}
        showApps={isAdmin || false}
      />

      <main className="container mx-auto space-y-8 p-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Users</h2>
            <p className="text-muted-foreground">
              {totalCount} users registered {users.length < totalCount && `(showing first ${users.length})`}
            </p>
          </div>
          <CreateUserDialog />
        </div>

        <UserTable users={transformedUsers} />
      </main>
    </div>
  );
}
