export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { EnhancedDashboardNav } from '@/components/layout/EnhancedDashboardNav';
import { DashboardFooter } from '@/components/layout/DashboardFooter';
import { createClient } from '@/lib/supabase/server';
import { isClaimsAdmin } from '@/lib/claims';
import { hasAnyAppAdmin } from '@/types/claims';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';

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
  const apps = user.app_metadata?.apps;
  const isAppAdmin = hasAnyAppAdmin(apps);

  if (isGlobalAdmin) {
    const { data: isClaimsAdminJwt } = await isClaimsAdmin(supabase);
    if (!isClaimsAdminJwt) {
      redirect('/refresh-session');
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EnhancedDashboardNav email={email} showApps={isGlobalAdmin || isAppAdmin} />
      <main className="container mx-auto space-y-8 p-4 py-8 flex-1">
        {children}
      </main>
      <DashboardFooter />
      <KeyboardShortcutsDialog />
    </div>
  );
}
