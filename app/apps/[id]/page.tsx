export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { getAppById } from '@/lib/apps-service';
import { DashboardNav } from '@/components/layout/DashboardNav';
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
import { Home } from 'lucide-react';
import { AppDetailClient } from './AppDetailClient';

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

      <main className="container mx-auto space-y-6 p-4 py-8">
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

        {/* Client-side interactive component */}
        <AppDetailClient app={app} />
      </main>
    </div>
  );
}
