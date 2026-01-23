export const dynamic = 'force-dynamic';

import { getAppById } from '@/lib/apps-service';
import { notFound } from 'next/navigation';
import { SSOSettingsCard } from '@/components/apps/SSOSettingsCard';

export default async function AppSSOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return <SSOSettingsCard app={app} />;
}
