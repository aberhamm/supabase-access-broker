export const dynamic = 'force-dynamic';

import { getAppById } from '@/lib/apps-service';
import { notFound } from 'next/navigation';
import { OverviewTabContent } from '@/components/apps/OverviewTabContent';

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return <OverviewTabContent app={app} />;
}
