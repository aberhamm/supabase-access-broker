export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { getAppById } from '@/lib/apps-service';
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
import { AppDetailHeader } from './AppDetailHeader';
import { AppDetailNav } from './AppDetailNav';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    redirect('/access-denied');
  }
}

export default async function AppDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  await checkAdmin();
  const { id } = await params;

  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return (
    <div className="space-y-6">
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
            <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-xs">{app.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <AppDetailHeader app={app} />

      {/* Tab Navigation */}
      <AppDetailNav appId={id} />

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}
