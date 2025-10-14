export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAllUsers } from '@/lib/claims';
import { UserTable } from '@/components/users/UserTable';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
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
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Users</h2>
              <p className="text-muted-foreground">
                {users?.length || 0} users registered
              </p>
            </div>
          </div>
        </div>

        <UserTable users={users || []} />
      </main>
    </div>
  );
}
