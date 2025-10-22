export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import Link from 'next/link';
import { Users, AppWindow } from 'lucide-react';
import { redirect } from 'next/navigation';
import { isClaimsAdmin } from '@/lib/claims';

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
  // Server-side auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const email = await getUserEmail();
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

        {/* Client component handles data fetching with loading states */}
        <DashboardStats />
      </main>
    </div>
  );
}
