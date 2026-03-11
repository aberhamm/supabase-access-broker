export const dynamic = 'force-dynamic';

import { getAppById } from '@/lib/apps-service';
import { notFound } from 'next/navigation';
import { AuthMethodsCard } from '@/components/apps/AuthMethodsCard';

export default async function AppAuthMethodsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return <AuthMethodsCard app={app} />;
}
