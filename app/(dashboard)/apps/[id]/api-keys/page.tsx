export const dynamic = 'force-dynamic';

import { getAppById } from '@/lib/apps-service';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ApiKeysTabContent } from '@/components/apps/ApiKeysTabContent';

export default async function AppApiKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) {
    notFound();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ApiKeysTabContent appId={id} />
      </CardContent>
    </Card>
  );
}
