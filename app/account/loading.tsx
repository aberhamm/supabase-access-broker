import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { User, ShieldCheck, Key } from 'lucide-react';

export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </div>
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div>
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
          {/* Display Name */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
          {/* Created */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
          {/* Last Sign In */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
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
              <Skeleton className="h-8 w-36" />
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
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-4 w-48" />
          </div>
        </CardContent>
      </Card>

      {/* Passkeys Card */}
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-4 w-44" />
        </CardContent>
      </Card>
    </div>
  );
}
