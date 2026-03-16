export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { getApps } from '@/lib/apps-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { Plus, AppWindow } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isClaimsAdmin } from '@/lib/claims';
import { AppManagementGrid } from '@/components/apps/AppManagementGrid';

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
  const apps = await getApps(true);

  return (
    <div className="space-y-8">
      <PageHeader
        title="App Management"
        description="Manage applications, roles, and permissions"
        actions={
          <Link href="/apps/create">
            <Button className="btn-press">
              <Plus className="mr-2 h-4 w-4" />
              Create App
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="card-hover animate-reveal">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AppWindow className="h-5 w-5 text-primary" />
              Total Apps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{apps.length}</div>
            <p className="text-xs text-muted-foreground">
              Configured applications
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover animate-reveal">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Enabled Apps
            </CardTitle>
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

        <Card className="card-hover animate-reveal">
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
                <span className="flex items-center gap-1.5 text-success">
                  <div className="w-2 h-2 rounded-full bg-success" />
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
    </div>
  );
}
