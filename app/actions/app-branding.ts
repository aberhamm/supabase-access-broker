'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isClaimsAdmin } from '@/lib/claims';
import { validateTheme } from '@/lib/app-branding';
import { refreshCache } from '@/lib/apps-service';

export async function updateAppBrandingAction(appId: string, theme: unknown): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { data: isAdmin } = await isClaimsAdmin(supabase);
    if (!isAdmin) return { error: 'Unauthorized: You must be a claims_admin' };
    if (theme !== null) {
      const error = validateTheme(theme);
      if (error) return { error };
    }
    const { data, error } = await supabase.schema('access_broker_app').from('apps')
      .update({ login_theme: theme }).eq('id', appId).select('id').maybeSingle();
    if (error) return { error: error.code === '42703' || error.code === 'PGRST204'
      ? 'Apply migration 030 before saving branding.' : 'Unable to save branding.' };
    if (!data) return { error: 'Application is unavailable or you do not have permission.' };
    refreshCache();
    revalidatePath(`/apps/${appId}`);
    return { error: null };
  } catch {
    return { error: 'Unable to save branding.' };
  }
}
