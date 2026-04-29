'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAppUrl } from '@/lib/app-url';
import { getValidatedReturnUrl, changePassword } from '@/app/actions/account';
import { ReturnUrlBanner } from '@/components/account/ReturnUrlBanner';
import { PASSWORD_MIN_LENGTH } from '@/lib/password-policy';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [returnUrl, setReturnUrl] = useState<{ url: string; appName: string } | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if we have a recovery token in the URL
    const checkRecoveryMode = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // If there's a session and we came from a recovery link, we're in recovery mode
      if (session?.user) {
        setIsRecoveryMode(true);
      }
    };

    checkRecoveryMode();
  }, [supabase.auth]);

  // Validate return_url parameter
  useEffect(() => {
    const rawReturnUrl = searchParams.get('return_url');
    if (!rawReturnUrl) return;

    getValidatedReturnUrl(rawReturnUrl).then((result) => {
      if (result.valid) {
        setReturnUrl({ url: result.url, appName: result.appName });
      }
    });
  }, [searchParams]);

  // Focus password field when in recovery mode
  useEffect(() => {
    if (isRecoveryMode && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [isRecoveryMode]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);

      const redirectTo = returnUrl
        ? `${getAppUrl()}/reset-password?return_url=${encodeURIComponent(returnUrl.url)}`
        : `${getAppUrl()}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      toast.success('Password reset link sent! Check your email.');
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      toast.error(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error('Please enter a new password');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      // Server action enforces length + HIBP breach check server-side.
      const result = await changePassword(password);

      if (!result.success) {
        toast.error(result.error || 'Failed to update password');
        return;
      }

      toast.success('Password updated successfully!');

      // Redirect back to the app or home page
      setTimeout(() => {
        if (returnUrl) {
          window.location.href = returnUrl.url;
        } else {
          router.push('/');
        }
      }, 1000);
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      toast.error(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
      {returnUrl && (
        <ReturnUrlBanner url={returnUrl.url} appName={returnUrl.appName} />
      )}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {isRecoveryMode ? 'Set New Password' : 'Reset Password'}
          </CardTitle>
          <CardDescription>
            {isRecoveryMode
              ? 'Enter your new password below'
              : 'Enter your email to receive a password reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isRecoveryMode ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending reset link...' : 'Send reset link'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  ref={passwordInputRef}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-describedby="password-hint"
                />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least {PASSWORD_MIN_LENGTH} characters. Avoid common or breached passwords.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-describedby="confirm-hint"
                />
                <p id="confirm-hint" className="text-xs text-muted-foreground">
                  Must match the password above
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating password...' : 'Update password'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary"
              tabIndex={loading ? -1 : 0}
            >
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
