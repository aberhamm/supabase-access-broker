export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { createClient } from '@/lib/supabase/server';
import { isClaimsAdmin } from '@/lib/claims';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const email = user.email || '';
  const isGlobalAdmin = user.app_metadata?.claims_admin === true;
  const apps = (user.app_metadata?.apps as Record<string, unknown>) || {};
  const isAppAdmin = Object.values(apps).some(
    (app) => (app as { admin?: boolean })?.admin === true
  );

  if (isGlobalAdmin) {
    const { data: isClaimsAdminJwt } = await isClaimsAdmin(supabase);
    if (!isClaimsAdminJwt) {
      redirect('/refresh-session');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav email={email} showApps={isGlobalAdmin || isAppAdmin} />
      <main className="container mx-auto space-y-8 p-4 py-8">
        {children}
      </main>
    </div>
  );
}
