export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAllUsers, isClaimsAdmin } from '@/lib/claims';
import { UserTable } from '@/components/users/UserTable';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { redirect } from 'next/navigation';

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

export default async function UsersPage() {
  const adminSupabase = await createAdminClient();
  const { data: users } = await getAllUsers(adminSupabase);
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
            <h2 className="text-3xl font-bold tracking-tight">Users</h2>
            <p className="text-muted-foreground">
              {users?.length || 0} users registered
            </p>
          </div>
        </div>

        <UserTable users={users || []} />
      </main>
    </div>
  );
}
