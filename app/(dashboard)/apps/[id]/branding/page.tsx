import { createClient } from '@/lib/supabase/server';
import { isClaimsAdmin } from '@/lib/claims';
import { notFound, redirect } from 'next/navigation';
import { getAppById } from '@/lib/apps-service';
import { BrandingEditor } from '@/components/apps/BrandingEditor';

export const dynamic = 'force-dynamic';
export default async function BrandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: admin } = await isClaimsAdmin(await createClient());
  if (!admin) redirect('/access-denied');
  const app = await getAppById((await params).id);
  if (!app) notFound();
  return <BrandingEditor key={`${app.id}-${app.updated_at}`} app={app} />;
}
