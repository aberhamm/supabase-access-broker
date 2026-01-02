import { createClient } from '@/lib/supabase/server';
import { PasskeyManager, type PasskeyItem } from '@/components/auth/PasskeyManager';
import { deletePasskeyAction } from '@/app/actions/passkeys';

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function onDelete(id: string) {
    'use server';
    await deletePasskeyAction(id);
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-muted-foreground">Please sign in.</p>
      </div>
    );
  }

  const { data: passkeys } = await supabase
    .from('passkey_credentials')
    .select('id,name,created_at,last_used_at,device_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const items: PasskeyItem[] = (passkeys || []) as PasskeyItem[];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <PasskeyManager
        initialPasskeys={items}
        onDelete={onDelete}
      />
    </div>
  );
}
