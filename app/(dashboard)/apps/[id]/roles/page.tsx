export const dynamic = 'force-dynamic';

import { getAppById } from '@/lib/apps-service';
import { notFound } from 'next/navigation';
import { RolesTabContent } from '@/components/apps/RolesTabContent';

export default async function AppRolesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return <RolesTabContent appId={id} />;
}
