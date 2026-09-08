import { createAdminClient } from '@/lib/supabase/server';
import { isRedirectUriAllowed } from '@/lib/sso-service';
import { publicBranding, type LoginBranding } from '@/lib/app-branding';

/** Request-scoped only: no registry fallback or cross-tenant/shared cache. */
export async function getLoginBranding(params: Record<string, string | string[] | undefined>): Promise<LoginBranding | null> {
  const appId = params.app_id, redirectUri = params.redirect_uri;
  if (typeof appId !== 'string' || !appId || appId.length > 128 || typeof redirectUri !== 'string' || redirectUri.length > 2048) return null;
  try {
    if (!await isRedirectUriAllowed({ appId, redirectUri })) return null;
    const supabase = await createAdminClient();
    const read = (columns: string) => supabase.schema('access_broker_app').from('apps')
      .select(columns).eq('id', appId).eq('enabled', true).maybeSingle();
    let result = await read('name,color,icon,login_theme');
    // Rolling deployment: retain legacy branding when the new column is absent.
    if (result.error?.code === '42703' || result.error?.code === 'PGRST204') result = await read('name,color,icon');
    if (result.error || !result.data) return null;
    return publicBranding(result.data);
  } catch {
    return null;
  }
}
