import { createClient } from '@/lib/supabase/server';
import { PasskeyManager, type PasskeyItem } from '@/components/auth/PasskeyManager';
import { deletePasskeyAction } from '@/app/actions/passkeys';
import { listOwnMFAFactors } from '@/app/actions/account';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, User, Mail, Calendar, Phone, ShieldCheck, Key } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { EditProfileDialog } from '@/components/users/EditProfileDialog';
import { MFAFactorsList } from '@/components/users/MFAFactorsList';
import { MFAEnrollDialog } from '@/components/account/MFAEnrollDialog';
import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';

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

  // Fetch passkeys and MFA factors in parallel
  const [passkeysResult, mfaResult] = await Promise.all([
    supabase
      .from('access_broker_app.passkey_credentials')
      .select('id,name,created_at,last_used_at,device_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    listOwnMFAFactors(),
  ]);

  const items: PasskeyItem[] = (passkeysResult.data || []) as PasskeyItem[];
  const mfaFactors = mfaResult.success ? mfaResult.factors || [] : [];

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </div>
          <EditProfileDialog
            currentEmail={user.email || ''}
            currentPhone={user.phone || ''}
            currentDisplayName={user.user_metadata?.display_name as string}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {user.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{user.phone}</p>
              </div>
            </div>
          )}

          {user.user_metadata?.display_name && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Display Name</p>
                <p className="text-sm text-muted-foreground">
                  {user.user_metadata.display_name as string}
                </p>
              </div>
            </div>
          )}

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

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Manage your password and two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Password</span>
              </div>
              <ChangePasswordDialog />
            </div>
            <p className="text-xs text-muted-foreground">
              Choose a strong password that you don&apos;t use elsewhere.
            </p>
          </div>

          <div className="border-t pt-4">
            {/* MFA Section */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">
                  Add extra security to your account with an authenticator app.
                </p>
              </div>
              <MFAEnrollDialog />
            </div>

            <MFAFactorsList factors={mfaFactors} />
          </div>
        </CardContent>
      </Card>

      {/* Passkeys Section */}
      <PasskeyManager initialPasskeys={items} onDelete={onDelete} />
    </div>
  );
}
