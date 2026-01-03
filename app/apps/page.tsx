export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { getApps } from '@/lib/apps-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isClaimsAdmin } from '@/lib/claims';
import { AppManagementGrid } from '@/components/apps/AppManagementGrid';

async function getUserEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email || '';
}

// Logout is now handled by /auth/logout route for reliable cookie clearing

async function checkAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    redirect('/access-denied');
  }
}

export default async function AppsPage() {
  await checkAdmin();
  const email = await getUserEmail();
  const apps = await getApps();

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        email={email}
        showApps={true}
      />

      <main className="container mx-auto space-y-8 p-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              App Management
            </h2>
            <p className="text-muted-foreground">
              Manage applications, roles, and permissions
            </p>
          </div>
          <Link href="/apps/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create App
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Apps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{apps.length}</div>
              <p className="text-xs text-muted-foreground">
                Configured applications
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enabled Apps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {apps.filter((app) => app.enabled).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Active applications
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {apps.length === 0 ? (
                  <span className="text-muted-foreground">
                    Using fallback config
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    Database configured
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Data source status
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <AppManagementGrid apps={apps} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
