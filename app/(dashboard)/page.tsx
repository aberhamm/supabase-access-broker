export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { EnhancedDashboardStats } from '@/components/dashboard/EnhancedDashboardStats';
import Link from 'next/link';
import { Users, AppWindow } from 'lucide-react';
import { redirect } from 'next/navigation';
import { isClaimsAdmin } from '@/lib/claims';
import { hasAnyAppAdmin } from '@/types/claims';

// Logout is now handled by /auth/logout route for reliable cookie clearing

export default async function DashboardPage() {
  // Server-side auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isGlobalAdmin = user.app_metadata?.claims_admin === true;
  const apps = user.app_metadata?.apps;
  const isAppAdmin = hasAnyAppAdmin(apps);

  // JWT-based check (what the database RPCs use). This can lag behind user.app_metadata
  // if the admin flag was added after login.
  const { data: isClaimsAdminJwt } = await isClaimsAdmin(supabase);

  // If the user record says they're a claims admin but the JWT doesn't, force a refresh
  // so DB RPCs won't fail with "access denied".
  if (isGlobalAdmin && !isClaimsAdminJwt) {
    redirect('/refresh-session');
  }

  // Extra safety (middleware should already enforce this)
  if (!isGlobalAdmin && !isAppAdmin) {
    redirect('/access-denied');
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between animate-reveal">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Manage users and custom claims for your Supabase project
          </p>
        </div>
        <div className="flex gap-2">
          {(isGlobalAdmin || isAppAdmin) && (
            <Link href="/apps">
              <Button variant="outline" className="btn-press">
                <AppWindow className="mr-2 h-4 w-4" />
                Manage Apps
              </Button>
            </Link>
          )}
          <Link href="/users">
            <Button className="btn-press">
              <Users className="mr-2 h-4 w-4" />
              View All Users
            </Button>
          </Link>
        </div>
      </div>

      {/* Claims-admin-only stats (these rely on JWT claims for DB RPC access) */}
      {isClaimsAdminJwt ? (
        <EnhancedDashboardStats />
      ) : (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground animate-reveal">
          Dashboard stats are only available to{' '}
          <code className="rounded bg-muted px-1 py-0.5">claims_admin</code> users.
        </div>
      )}
    </div>
  );
}
