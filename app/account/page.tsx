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
import { PageHeader } from '@/components/layout/PageHeader';
import { validateReturnUrl } from '@/lib/return-url';
import { ReturnUrlBanner } from '@/components/account/ReturnUrlBanner';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ return_url?: string }>;
}) {
  const params = await searchParams;
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

  // Fetch passkeys, MFA factors, profile, and validate return URL in parallel
  const [passkeysResult, mfaResult, profileResult, returnUrlResult] = await Promise.all([
    supabase
      .schema('access_broker_app')
      .from('passkey_credentials')
      .select('id,name,created_at,last_used_at,device_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    listOwnMFAFactors(),
    supabase
      .schema('access_broker_app')
      .from('profiles')
      .select('display_name, first_name, last_name, avatar_url, timezone, locale')
      .eq('user_id', user.id)
      .single(),
    validateReturnUrl(params.return_url),
  ]);

  const profile = profileResult.data;

  const items: PasskeyItem[] = (passkeysResult.data || []) as PasskeyItem[];
  const mfaFactors = mfaResult.success ? mfaResult.factors || [] : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {returnUrlResult.valid && (
        <ReturnUrlBanner url={returnUrlResult.url} appName={returnUrlResult.appName} />
      )}
      <PageHeader
        title="Account"
        description="Manage your profile, security settings, and passkeys."
        actions={
          <Link
            href={returnUrlResult.valid
              ? `/auth/logout?next=${encodeURIComponent(returnUrlResult.url)}`
              : '/auth/logout'}
            prefetch={false}
          >
            <Button variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </Link>
        }
      />

      {/* User Info Card */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </div>
          <EditProfileDialog
            currentEmail={user.email || ''}
            currentPhone={user.phone || ''}
            currentDisplayName={profile?.display_name || ''}
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

          {profile?.display_name && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Display Name</p>
                <p className="text-sm text-muted-foreground">
                  {profile.display_name}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
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
