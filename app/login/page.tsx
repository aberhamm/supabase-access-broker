'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { debugError, debugLog, debugWarn } from '@/lib/auth-debug';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

function getInitial(email: string): string {
  return email.charAt(0).toUpperCase();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return email;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 4))}@${domain}`;
}

function readRememberedEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY);
  } catch {
    return null;
  }
}

function persistRememberedEmail(value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, value);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch (error) {
    // Some browsers block storage access in private or hardened modes.
    debugWarn('[Login] Unable to access localStorage for remembered email', error);
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(true);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const [showRemembered, setShowRemembered] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'magic' | 'otp' | 'password'>(() => {
    if (AUTH_FEATURES.PASSWORD_LOGIN) return 'password';
    if (AUTH_FEATURES.EMAIL_OTP) return 'otp';
    return 'magic';
  });
  const supabase = createClient();
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  // Load remembered email on mount
  useEffect(() => {
    setMounted(true);
    const stored = readRememberedEmail();
    if (stored) {
      setRememberedEmail(stored);
      setEmail(stored);
      setShowRemembered(true);
    }
  }, []);

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

  const shouldForceReauth = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('reauth') === '1';
  }, []);

  const clearExistingSession = useCallback(async (reason: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      debugLog('[Login] Clearing existing session before auth action', {
        reason,
        currentEmail: session.user?.email,
      });

      const { error } = await supabase.auth.signOut();
      if (error) {
        debugWarn('[Login] Failed to clear existing session before auth action', {
          reason,
          error: error.message,
        });
      }
    } catch (error) {
      debugWarn('[Login] Unable to inspect existing session before auth action', {
        reason,
        error,
      });
    }
  }, [supabase]);

  // Handle token_hash in URL (from magic links that got redirected here)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as 'email' | 'recovery' | null;

    if (tokenHash && type) {
      // Redirect to /auth/confirm to properly handle the token
      const confirmUrl = new URL('/auth/confirm', window.location.origin);
      confirmUrl.searchParams.set('token_hash', tokenHash);
      confirmUrl.searchParams.set('type', type);
      confirmUrl.searchParams.set('next', nextPath);
      window.location.href = confirmUrl.toString();
    }
  }, [nextPath]);

  useEffect(() => {
    if (!shouldForceReauth) return;
    void clearExistingSession('reauth_param');
  }, [clearExistingSession, shouldForceReauth]);

  const handleSwitchAccount = useCallback(async () => {
    await clearExistingSession('switch_account');
    setShowRemembered(false);
    setEmail('');
    setPassword('');
    setOtpCode('');
    setOtpStep('email');
    // Focus email input after animation
    setTimeout(() => emailInputRef.current?.focus(), 150);
  }, [clearExistingSession]);

  const handleUseRemembered = useCallback(() => {
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setShowRemembered(true);
    }
  }, [rememberedEmail]);

  const saveEmailIfRemembered = useCallback((emailToSave: string) => {
    if (rememberEmail && emailToSave) {
      setRememberedEmail(emailToSave);
      persistRememberedEmail(emailToSave);
    } else if (!rememberEmail) {
      setRememberedEmail(null);
      persistRememberedEmail(null);
    }
  }, [rememberEmail]);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);
      await clearExistingSession('magic_link');

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      saveEmailIfRemembered(email);
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
      await clearExistingSession('password');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      saveEmailIfRemembered(email);
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
      await clearExistingSession('otp_request');
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
      debugLog('[Login] Verifying OTP for email:', email);

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      debugLog('[Login] verifyOtp result:', {
        hasSession: !!data.session,
        hasUser: !!data.user,
        error: error?.message
      });

      if (error) throw error;

      saveEmailIfRemembered(email);

      // Ensure session is properly set before redirecting
      if (data.session) {
        debugLog('[Login] Session established, user:', data.user?.email);
        // Wait for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify session was actually set
        const { data: checkData } = await supabase.auth.getSession();
        debugLog('[Login] Session check after verify:', {
          hasSession: !!checkData.session,
          userEmail: checkData.session?.user?.email
        });
      } else {
        debugWarn('[Login] No session returned from verifyOtp');
      }

      debugLog('[Login] Redirecting to:', nextPath);
      window.location.href = nextPath;
    } catch (error) {
      const err = error as { error_description?: string; message?: string };
      debugError('[Login] OTP verification error:', err);
      toast.error(err.error_description || err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  // Determine if we should show the welcome back state
  const showWelcomeBack = mounted && rememberedEmail && showRemembered;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-primary/3" />

        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-float-slower" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, var(--foreground) 1px, transparent 1px),
              linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px'
          }}
        />
      </div>

      <Card className="w-full max-w-md overflow-hidden shadow-2xl glass glass-border">
        <CardHeader className="space-y-1 pb-6">
          {showWelcomeBack ? (
            // Welcome back state with avatar
            <div className="flex flex-col items-center space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-semibold shadow-md ring-4 ring-primary/10"
                aria-hidden="true"
              >
                {getInitial(rememberedEmail)}
              </div>
              <div className="text-center space-y-1">
                <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                <CardDescription className="text-base">
                  {maskEmail(rememberedEmail)}
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                Not you? Sign in with a different account
              </button>
            </div>
          ) : (
            // Normal header
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
              <CardDescription>
                Sign in to continue
              </CardDescription>
              {rememberedEmail && !showRemembered && (
                <button
                  type="button"
                  onClick={handleUseRemembered}
                  className="mt-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Sign in as {maskEmail(rememberedEmail)}
                </button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick sign-in options */}
          {(AUTH_FEATURES.GOOGLE_LOGIN || AUTH_FEATURES.GITHUB_LOGIN || AUTH_FEATURES.PASSKEYS) && (
            <div className="space-y-3">
              {(AUTH_FEATURES.GOOGLE_LOGIN || AUTH_FEATURES.GITHUB_LOGIN) && (
                <SocialButtons
                  next={nextPath}
                  enableGoogle={AUTH_FEATURES.GOOGLE_LOGIN}
                  enableGitHub={AUTH_FEATURES.GITHUB_LOGIN}
                />
              )}
              {AUTH_FEATURES.PASSKEYS && (
                <PasskeyButton className="w-full" next={nextPath} />
              )}
            </div>
          )}

          {/* Divider between quick options and email form */}
          {(AUTH_FEATURES.GOOGLE_LOGIN || AUTH_FEATURES.GITHUB_LOGIN || AUTH_FEATURES.PASSKEYS) &&
           (AUTH_FEATURES.PASSWORD_LOGIN || AUTH_FEATURES.EMAIL_OTP || AUTH_FEATURES.MAGIC_LINK) && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
              </div>
            </div>
          )}

          {/* Email form */}
          {(AUTH_FEATURES.PASSWORD_LOGIN || AUTH_FEATURES.EMAIL_OTP || AUTH_FEATURES.MAGIC_LINK) && (
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
              {/* Email field - hidden when welcome back is shown */}
              {!showWelcomeBack && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    ref={emailInputRef}
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="username email"
                    autoFocus={!rememberedEmail}
                    className="h-11"
                  />
                </div>
              )}

              {mode === 'password' && AUTH_FEATURES.PASSWORD_LOGIN && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 delay-75">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="/reset-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    required
                    autoFocus={!!showWelcomeBack}
                    className="h-11"
                  />
                </div>
              )}

              {mode === 'otp' && AUTH_FEATURES.EMAIL_OTP && otpStep === 'code' && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <Label>Verification code</Label>
                  <OTPInput value={otpCode} onChange={setOtpCode} disabled={loading} />
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setOtpStep('email');
                      setOtpCode('');
                    }}
                    disabled={loading}
                  >
                    ← Use a different email
                  </button>
                </div>
              )}

              {/* Remember email checkbox */}
              {!showWelcomeBack && (
                <div className="flex items-center space-x-2 animate-in fade-in-0 duration-200 delay-100">
                  <Checkbox
                    id="remember-email"
                    checked={rememberEmail}
                    onCheckedChange={(checked) => setRememberEmail(checked === true)}
                    disabled={loading}
                  />
                  <label
                    htmlFor="remember-email"
                    className="text-sm text-muted-foreground cursor-pointer select-none leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember my email on this device
                  </label>
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                {mode === 'magic' && (loading ? 'Sending magic link...' : 'Send magic link')}
                {mode === 'otp' && (
                  otpStep === 'email'
                    ? (loading ? 'Sending code...' : 'Send code')
                    : (loading ? 'Verifying...' : 'Verify code')
                )}
                {mode === 'password' && (loading ? 'Signing in...' : 'Sign in')}
              </Button>

              {/* Mode switcher */}
              {[AUTH_FEATURES.PASSWORD_LOGIN, AUTH_FEATURES.EMAIL_OTP, AUTH_FEATURES.MAGIC_LINK].filter(Boolean).length > 1 && (
                <div className="flex justify-center gap-1 text-sm text-muted-foreground">
                  <span>Or sign in with</span>
                  {[
                    AUTH_FEATURES.PASSWORD_LOGIN && mode !== 'password' && (
                      <button
                        key="password"
                        type="button"
                        className="font-medium text-foreground hover:underline underline-offset-4 transition-colors"
                        onClick={() => { setMode('password'); setOtpStep('email'); setOtpCode(''); }}
                        disabled={loading}
                      >
                        password
                      </button>
                    ),
                    AUTH_FEATURES.EMAIL_OTP && mode !== 'otp' && (
                      <button
                        key="otp"
                        type="button"
                        className="font-medium text-foreground hover:underline underline-offset-4 transition-colors"
                        onClick={() => { setMode('otp'); setOtpStep('email'); setOtpCode(''); }}
                        disabled={loading}
                      >
                        email code
                      </button>
                    ),
                    AUTH_FEATURES.MAGIC_LINK && mode !== 'magic' && (
                      <button
                        key="magic"
                        type="button"
                        className="font-medium text-foreground hover:underline underline-offset-4 transition-colors"
                        onClick={() => { setMode('magic'); setOtpStep('email'); setOtpCode(''); }}
                        disabled={loading}
                      >
                        magic link
                      </button>
                    ),
                  ].filter(Boolean).reduce((acc: React.ReactNode[], curr, idx, arr) => {
                    if (idx > 0 && idx < arr.length) acc.push(<span key={`sep-${idx}`}> or </span>);
                    acc.push(curr);
                    return acc;
                  }, [])}
                </div>
              )}
            </form>
          )}

          {/* Footer */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <p className="text-center text-sm text-muted-foreground">
              Your account works across all apps managed by this system.
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
