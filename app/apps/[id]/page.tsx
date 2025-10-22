export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { getAppById } from '@/lib/apps-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isClaimsAdmin } from '@/lib/claims';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Home, Key, Shield } from 'lucide-react';
import { RolesTabContent } from '@/components/apps/RolesTabContent';
import { ApiKeysTabContent } from '@/components/apps/ApiKeysTabContent';

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

async function checkAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    redirect('/access-denied');
  }
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAdmin();
  const { id } = await params;
  const email = await getUserEmail();

  // Get app details only (roles and API keys load lazily)
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        email={email}
        logoutAction={handleLogout}
        showApps={true}
      />

      <main className="container mx-auto space-y-8 p-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">
                <Home className="h-4 w-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/apps">Apps</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{app.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {app.color && (
              <div
                className="h-12 w-12 rounded-lg"
                style={{ backgroundColor: app.color }}
              />
            )}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{app.name}</h2>
              {app.description && (
                <p className="text-muted-foreground">{app.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Card - Basic info only */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {app.enabled ? (
                <span className="text-green-600 dark:text-green-400">
                  Active
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Application status</p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="roles">
              <Shield className="mr-2 h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="api-keys">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    App ID
                  </p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {app.id}
                  </code>
                </div>
                {app.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Description
                    </p>
                    <p className="text-sm">{app.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Created
                  </p>
                  <p className="text-sm">
                    {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </p>
                  <p className="text-sm">
                    {new Date(app.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Link href={`/apps/${id}/roles`}>
                  <Button variant="outline">
                    <Shield className="mr-2 h-4 w-4" />
                    Manage Roles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Roles</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage roles and permissions for this application
                </p>
              </CardHeader>
              <CardContent>
                <RolesTabContent appId={id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage API keys for webhooks and external integrations
                </p>
              </CardHeader>
              <CardContent>
                <ApiKeysTabContent appId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
