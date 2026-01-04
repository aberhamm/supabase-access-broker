import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

function isAllowedInsecureRedirect(url: URL): boolean {
  const host = url.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Check if a redirect_uri is allowed for an app WITHOUT throwing errors.
 * Used to determine whether we can safely redirect back to the client on error.
 * Returns true only if the URI is valid, parseable, uses https (or localhost http),
 * and is in the app's allowed_callback_urls list.
 */
export async function isRedirectUriAllowed(params: {
  appId: string;
  redirectUri: string;
}): Promise<boolean> {
  const { appId, redirectUri } = params;

  // Check if redirect_uri is a valid URL
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }

  // Check protocol (https required, except localhost)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isAllowedInsecureRedirect(url))) {
    return false;
  }

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .schema('access_broker_app')
      .from('apps')
      .select('id,enabled,allowed_callback_urls')
      .eq('id', appId)
      .maybeSingle();

    if (error || !data?.id || data.enabled === false) {
      return false;
    }

    const allowed = (data.allowed_callback_urls || []) as string[];
    return allowed.includes(redirectUri);
  } catch {
    return false;
  }
}

export async function validateRedirectUri(params: {
  appId: string;
  redirectUri: string;
}): Promise<void> {
  const { appId, redirectUri } = params;

  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error('Invalid redirect_uri');
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isAllowedInsecureRedirect(url))) {
    throw new Error('redirect_uri must be https (or http for localhost)');
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .select('id,enabled,allowed_callback_urls')
    .eq('id', appId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('Unknown app_id');
  if (data.enabled === false) throw new Error('App is disabled');

  const allowed = (data.allowed_callback_urls || []) as string[];
  if (!allowed.includes(redirectUri)) {
    throw new Error('redirect_uri not allowed for this app');
  }
}

export async function createAuthCode(params: {
  userId: string;
  appId: string;
  redirectUri: string;
}): Promise<string> {
  const code = crypto.randomBytes(32).toString('base64url');

  const supabase = await createAdminClient();
  const { error } = await supabase
    .schema('access_broker_app')
    .from('auth_codes')
    .insert({
      code,
      user_id: params.userId,
      app_id: params.appId,
      redirect_uri: params.redirectUri,
    });

  if (error) throw error;
  return code;
}

export async function consumeAuthCode(params: {
  code: string;
  appId: string;
}): Promise<{ userId: string; redirectUri: string }> {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .schema('access_broker_app')
    .from('auth_codes')
    .select('id,code,user_id,app_id,redirect_uri,expires_at,used_at')
    .eq('code', params.code)
    .eq('app_id', params.appId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('Invalid or expired code');

  const { error: updateError } = await supabase
    .schema('access_broker_app')
    .from('auth_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', data.id);
  if (updateError) throw updateError;

  return { userId: data.user_id as string, redirectUri: data.redirect_uri as string };
}
