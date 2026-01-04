'use server';

import { createClient } from '@/lib/supabase/server';

export async function deletePasskeyAction(passkeyId: string) {
  const supabase = await createClient();

  // RLS ensures the user can only delete their own passkeys
  const { error } = await supabase.schema('access_broker_app').from('passkey_credentials').delete().eq('id', passkeyId);
  if (error) throw error;
}
