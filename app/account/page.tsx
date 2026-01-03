import { createClient } from '@/lib/supabase/server';
import { PasskeyManager, type PasskeyItem } from '@/components/auth/PasskeyManager';
import { deletePasskeyAction } from '@/app/actions/passkeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, User, Mail, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Link href="/auth/logout">
          <Button variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </Link>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Account Created</p>
              <p className="text-sm text-muted-foreground">
                {user.created_at
                  ? format(new Date(user.created_at), 'PPP')
                  : 'Unknown'}
              </p>
            </div>
          </div>
          {user.last_sign_in_at && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Sign In</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(user.last_sign_in_at), 'PPP p')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passkeys Section */}
      <PasskeyManager initialPasskeys={items} onDelete={onDelete} />
    </div>
  );
}
