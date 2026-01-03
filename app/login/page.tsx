'use client';

import React, { useMemo, useState } from 'react';
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
import { getAppUrl } from '@/lib/app-url';
import { AUTH_FEATURES } from '@/lib/auth-config';
import { PasskeyButton } from '@/components/auth/PasskeyButton';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { OTPInput } from '@/components/auth/OTPInput';
import { safeNextPath } from '@/lib/safe-redirect';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'magic' | 'otp' | 'password'>(() => {
    if (AUTH_FEATURES.PASSWORD_LOGIN) return 'password';
    if (AUTH_FEATURES.EMAIL_OTP) return 'otp';
    return 'magic';
  });
  const supabase = createClient();
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    const rawNext = params.get('next');
    const appId = params.get('app_id');
    const redirectUri = params.get('redirect_uri');
    const state = params.get('state');

    // SSO flow takes priority - build the SSO complete URL
    if (appId && redirectUri) {
      const sso = new URLSearchParams();
      sso.set('app_id', appId);
      sso.set('redirect_uri', redirectUri);
      if (state) sso.set('state', state);
      return `/sso/complete?${sso.toString()}`;
    }

    // Sanitize the next parameter to prevent open redirects
    return safeNextPath(rawNext, '/');
  }, []);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      toast.success('Check your email for the magic link!');
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      const errorMessage = err.error_description || err.message || '';

      // Provide helpful error messages
      if (errorMessage.toLowerCase().includes('user not found') ||
          errorMessage.toLowerCase().includes('invalid email')) {
        toast.error('This email is not registered. Contact an administrator to get access.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.href = nextPath;
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      toast.error(err.error_description || err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          // For email OTP code flow, we verify via supabase.auth.verifyOtp()
        },
      });
      if (error) throw error;

      setOtpStep('code');
      toast.success('Check your email for the 6-digit code');
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      const errorMessage = err.error_description || err.message || '';
      toast.error(errorMessage || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, '');
    if (token.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (error) throw error;

      window.location.href = nextPath;
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      toast.error(err.error_description || err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>
            Sign in to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(AUTH_FEATURES.GOOGLE_LOGIN || AUTH_FEATURES.GITHUB_LOGIN) && (
            <div className="mb-4">
              <SocialButtons
                next={nextPath}
                enableGoogle={AUTH_FEATURES.GOOGLE_LOGIN}
                enableGitHub={AUTH_FEATURES.GITHUB_LOGIN}
              />
            </div>
          )}

          {AUTH_FEATURES.PASSKEYS && (
            <div className="mb-4">
              <PasskeyButton className="w-full" next={nextPath} />
            </div>
          )}

          <form
            onSubmit={
              mode === 'password'
                ? handlePasswordLogin
                : mode === 'otp'
                  ? otpStep === 'email'
                    ? handleSendOtp
                    : handleVerifyOtp
                  : handleMagicLinkLogin
            }
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailInputRef}
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

            {mode === 'password' && AUTH_FEATURES.PASSWORD_LOGIN && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
                <div className="text-right">
                  <a href="/reset-password" className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </a>
                </div>
              </div>
            )}

            {mode === 'otp' && AUTH_FEATURES.EMAIL_OTP && otpStep === 'code' && (
              <div className="space-y-2">
                <Label>Code</Label>
                <OTPInput value={otpCode} onChange={setOtpCode} disabled={loading} />
                <Button
                  type="button"
                  variant="ghost"
                  className="px-0 text-sm"
                  onClick={() => {
                    setOtpStep('email');
                    setOtpCode('');
                  }}
                  disabled={loading}
                >
                  Use a different email
                </Button>
              </div>
            )}

            {mode === 'magic' && AUTH_FEATURES.MAGIC_LINK && (
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending magic link...' : 'Send magic link'}
            </Button>
            )}

            {mode === 'otp' && AUTH_FEATURES.EMAIL_OTP && (
              <Button type="submit" className="w-full" disabled={loading}>
                {otpStep === 'email'
                  ? loading
                    ? 'Sending code...'
                    : 'Send code'
                  : loading
                    ? 'Verifying...'
                    : 'Verify code'}
              </Button>
            )}

            {mode === 'password' && AUTH_FEATURES.PASSWORD_LOGIN && (
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            )}
          </form>

          {(AUTH_FEATURES.EMAIL_OTP || AUTH_FEATURES.MAGIC_LINK || AUTH_FEATURES.PASSWORD_LOGIN) && (
            <div className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground">
              {AUTH_FEATURES.PASSWORD_LOGIN && (
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() => {
                    setMode('password');
                    setOtpStep('email');
                    setOtpCode('');
                  }}
                  disabled={loading}
                >
                  Use password
                </button>
              )}
              {AUTH_FEATURES.EMAIL_OTP && (
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() => {
                    setMode('otp');
                    setOtpStep('email');
                    setOtpCode('');
                  }}
                  disabled={loading}
                >
                  Use code
                </button>
              )}
              {AUTH_FEATURES.MAGIC_LINK && (
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() => {
                    setMode('magic');
                    setOtpStep('email');
                    setOtpCode('');
                  }}
                  disabled={loading}
                >
                  Use magic link
                </button>
              )}
            </div>
          )}

          <div className="mt-6 space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              Your account works across all apps managed by this system. One login, access everywhere.
            </p>
            <p className="text-center text-xs text-muted-foreground">
              New users must be created by an administrator
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
