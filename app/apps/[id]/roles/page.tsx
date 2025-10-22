export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { getAppById, getRoles } from '@/lib/apps-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { Badge } from '@/components/ui/badge';
import { Plus, Home } from 'lucide-react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isClaimsAdmin } from '@/lib/claims';
import { RolesManagementList } from '@/components/roles/RolesManagementList';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

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

export default async function AppRolesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAdmin();
  const { id } = await params;
  const email = await getUserEmail();

  // Get app details
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  // Get roles for this app (includes global roles)
  const roles = await getRoles(id);

  // Separate global and app-specific roles
  const globalRoles = roles.filter((role) => role.is_global);
  const appRoles = roles.filter((role) => !role.is_global && role.app_id === id);

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
              <BreadcrumbLink href={`/apps/${id}`}>{app.name}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Roles</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {app.color && (
              <div
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: app.color }}
              />
            )}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {app.name} - Roles
              </h2>
              <p className="text-muted-foreground">
                Manage roles and permissions for this application
              </p>
            </div>
          </div>
          <Link href={`/apps/${id}/roles/create`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>App-Specific Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{appRoles.length}</div>
              <p className="text-xs text-muted-foreground">
                Roles specific to {app.name}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{globalRoles.length}</div>
              <p className="text-xs text-muted-foreground">
                Available across all apps
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roles.length}</div>
              <p className="text-xs text-muted-foreground">
                Roles users can be assigned
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>App-Specific Roles</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Roles that only apply to {app.name}
                  </p>
                </div>
                <Badge variant="secondary">{appRoles.length} roles</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {appRoles.length > 0 ? (
                <RolesManagementList roles={appRoles} appId={id} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No app-specific roles yet</p>
                  <p className="text-sm mt-2">
                    Create roles tailored to this application
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Global Roles</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Roles available across all applications
                  </p>
                </div>
                <Badge variant="outline">{globalRoles.length} roles</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {globalRoles.length > 0 ? (
                <RolesManagementList roles={globalRoles} appId={id} isReadOnly />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No global roles defined</p>
                  <p className="text-sm mt-2">
                    Global roles can be created from the main apps page
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
