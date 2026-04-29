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
import { useAppAuthMethods } from '@/lib/use-app-auth-methods';
import { PasskeyButton } from '@/components/auth/PasskeyButton';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { OTPInput } from '@/components/auth/OTPInput';
import { safeNextPath } from '@/lib/safe-redirect';
import { debugError, debugLog, debugWarn } from '@/lib/auth-debug';

const REMEMBERED_EMAIL_KEY = 'remembered_email';
const PREFERRED_AUTH_KEY = 'preferred_auth_method';

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

type AuthCategory = 'passkey' | 'credentials';

function readPreferredAuth(): AuthCategory | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(PREFERRED_AUTH_KEY);
    return v === 'passkey' || v === 'credentials' ? v : null;
  } catch {
    return null;
  }
}

function persistPreferredAuth(value: AuthCategory) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERRED_AUTH_KEY, value);
  } catch {
    // ignore
  }
}

/** Map machine-readable error codes to user-friendly messages */
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  session_failed: 'We were unable to create your session. Please try signing in again.',
  code_exchange_failed: 'The authentication code could not be verified. It may have expired — please try signing in again.',
  auth_failed: 'Authentication failed. Please try signing in again.',
  access_denied: 'You do not have permission to access this application. Contact your administrator.',
  invalid_token: 'The sign-in link is invalid or has expired. Please request a new one.',
  otp_expired: 'Your verification code has expired. Please request a new one.',
};

function getLoginErrorMessage(error: string | null): string | null {
  if (!error) return null;
  return LOGIN_ERROR_MESSAGES[error] || 'An unexpected error occurred. Please try signing in again.';
}

/** Extract a user-friendly message from auth errors, including network failures */
function friendlyAuthError(error: unknown, fallback: string): string {
  const err = error as { error_description?: string; message?: string; name?: string };
  const message = (err.error_description || err.message || '').toLowerCase();

  // Network / connectivity errors
  if (err.name === 'TypeError' && message.includes('fetch')) {
    return 'Unable to reach the authentication server. Check your network connection and verify the app URL is configured correctly.';
  }
  if (message.includes('networkerror') || message.includes('network request failed')) {
    return 'Network error — please check your connection and try again.';
  }

  // Supabase-specific errors. Note: we deliberately collapse "user not found",
  // "invalid email", and "invalid credentials" into a single non-disclosive
  // message to prevent account enumeration via login probing.
  if (
    message.includes('user not found') ||
    message.includes('invalid email') ||
    message.includes('invalid login') ||
    message.includes('invalid credentials')
  ) {
    return 'Invalid email or password.';
  }

  return err.error_description || err.message || fallback;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(true);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const [showRemembered, setShowRemembered] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [authCategory, setAuthCategory] = useState<AuthCategory>('credentials');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const supabase = createClient();
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  // Load remembered email and preferred auth method on mount
  useEffect(() => {
    setMounted(true);
    const stored = readRememberedEmail();
    if (stored) {
      setRememberedEmail(stored);
      setEmail(stored);
      setShowRemembered(true);
    }
    const preferredAuth = readPreferredAuth();
    if (preferredAuth) {
      setAuthCategory(preferredAuth);
    }

    // Read error from URL query params (from auth callback/confirm redirects)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');

    // Also check URL hash for Supabase-generated errors (e.g. #error=...&error_description=...)
    const hash = window.location.hash;
    let hashError: string | null = null;
    if (hash && hash.includes('error')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      hashError = hashParams.get('error_description') || hashParams.get('error');
    }

    const errorToShow = errorParam || hashError;
    if (errorToShow) {
      setUrlError(errorToShow);
      // Clean the error from the URL so refreshing/retrying doesn't re-show it
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('error');
      cleanUrl.hash = '';
      window.history.replaceState({}, '', cleanUrl.toString());
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

  const appId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('app_id');
  }, []);

  const shouldForceReauth = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('reauth') === '1';
  }, []);

  const { effectiveFeatures, appStatus, appMethodsReady, mode, setMode } = useAppAuthMethods(appId);

  // If passkeys are disabled, ensure we fall back to credentials
  useEffect(() => {
    if (!appMethodsReady || !appId) return;
    if (!effectiveFeatures.PASSKEYS && authCategory === 'passkey') {
      setAuthCategory('credentials');
    }
  }, [appMethodsReady, appId, effectiveFeatures, authCategory]);

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

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

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
    setUrlError(null);
    setFormError(null);

    if (!email) {
      setFormError('Please enter your email');
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
      persistPreferredAuth('credentials');
      toast.success('Check your email for the magic link!');
    } catch (error) {
      setFormError(friendlyAuthError(error, 'Failed to send magic link'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    setFormError(null);
    if (!email) {
      setFormError('Please enter your email');
      return;
    }
    if (!password) {
      setFormError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      await clearExistingSession('password');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      saveEmailIfRemembered(email);
      persistPreferredAuth('credentials');
      window.location.href = nextPath;
    } catch (error) {
      setFormError(friendlyAuthError(error, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = useCallback(async () => {
    setUrlError(null);
    setFormError(null);
    if (!email) {
      setFormError('Please enter your email');
      return;
    }

    try {
      setLoading(true);
      await clearExistingSession('otp_request');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;

      setOtpStep('code');
      setCodeSentTo(email);
      setResendCountdown(30);
      toast.success('Check your email for the 6-digit code');
    } catch (error) {
      setFormError(friendlyAuthError(error, 'Failed to send code'));
    } finally {
      setLoading(false);
    }
  }, [email, clearExistingSession, supabase]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    setFormError(null);
    const token = otpCode.replace(/\D/g, '');
    if (token.length !== 6) {
      setFormError('Enter the 6-digit code');
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
      persistPreferredAuth('credentials');

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
      debugError('[Login] OTP verification error:', error);
      setFormError(friendlyAuthError(error, 'Invalid code'));
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
          {/* Error banner (auth redirects + form errors) */}
          {(urlError || formError) && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="flex items-start justify-between gap-3">
                <p className="text-destructive font-medium">
                  {urlError ? getLoginErrorMessage(urlError) : formError}
                </p>
                <button
                  type="button"
                  onClick={() => { setUrlError(null); setFormError(null); }}
                  className="shrink-0 text-destructive/60 hover:text-destructive transition-colors"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {!appMethodsReady ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : (
            <>
              {/* App-level error states */}
              {appId && appStatus && appStatus !== 'ok' && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {appStatus === 'app_not_found' && 'This application is not recognized. Please check the link you used to get here.'}
                  {appStatus === 'app_disabled' && 'This application has been disabled. Contact your administrator.'}
                  {appStatus === 'error' && 'Unable to load sign-in options for this application. Please try again.'}
                </div>
              )}

              {/* No methods configured for this app */}
              {appId && appStatus === 'ok' && !Object.values(effectiveFeatures).some(Boolean) && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No sign-in methods have been configured for this application.
                  Contact your administrator.
                </div>
              )}

              {/* Social login buttons (always visible when enabled) */}
              {(effectiveFeatures.GOOGLE_LOGIN || effectiveFeatures.GITHUB_LOGIN || effectiveFeatures.APPLE_LOGIN) && (
                <div className="space-y-3">
                  <SocialButtons
                    next={nextPath}
                    enableGoogle={effectiveFeatures.GOOGLE_LOGIN}
                    enableGitHub={effectiveFeatures.GITHUB_LOGIN}
                    enableApple={effectiveFeatures.APPLE_LOGIN}
                  />
                </div>
              )}

              {/* Divider between social and passkey/email section */}
              {(effectiveFeatures.GOOGLE_LOGIN || effectiveFeatures.GITHUB_LOGIN || effectiveFeatures.APPLE_LOGIN) &&
               (effectiveFeatures.PASSKEYS || effectiveFeatures.PASSWORD_LOGIN || effectiveFeatures.EMAIL_OTP || effectiveFeatures.MAGIC_LINK) && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
              )}

              {/* Passkey section (shown when authCategory is 'passkey' and passkeys are enabled) */}
              {effectiveFeatures.PASSKEYS && authCategory === 'passkey' && (
                <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <PasskeyButton
                    className="w-full h-11 text-sm font-medium"
                    next={nextPath}
                    onBeforeRedirect={() => persistPreferredAuth('passkey')}
                  />
                  {(effectiveFeatures.PASSWORD_LOGIN || effectiveFeatures.EMAIL_OTP || effectiveFeatures.MAGIC_LINK) && (
                    <button
                      type="button"
                      onClick={() => setAuthCategory('credentials')}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Sign in with password instead
                    </button>
                  )}
                </div>
              )}

              {/* Email form (shown when authCategory is 'credentials' or passkeys are not enabled) */}
              {(authCategory === 'credentials' || !effectiveFeatures.PASSKEYS) &&
               (effectiveFeatures.PASSWORD_LOGIN || effectiveFeatures.EMAIL_OTP || effectiveFeatures.MAGIC_LINK) && (
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
                        autoComplete="username webauthn"
                        autoFocus={!rememberedEmail}
                        className="h-11"
                      />
                    </div>
                  )}

                  {mode === 'password' && effectiveFeatures.PASSWORD_LOGIN && (
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

                  {mode === 'otp' && effectiveFeatures.EMAIL_OTP && otpStep === 'code' && (
                    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                      {codeSentTo && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          Code sent to {maskEmail(codeSentTo)}
                        </p>
                      )}
                      <div className="space-y-2">
                        <Label>Verification code</Label>
                        <OTPInput value={otpCode} onChange={setOtpCode} disabled={loading} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {
                            setOtpStep('email');
                            setOtpCode('');
                          }}
                          disabled={loading}
                        >
                          ← Use a different email
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => void sendOtp()}
                          disabled={loading || resendCountdown > 0}
                        >
                          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                        </button>
                      </div>
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
                  {[effectiveFeatures.PASSWORD_LOGIN, effectiveFeatures.EMAIL_OTP, effectiveFeatures.MAGIC_LINK].filter(Boolean).length > 1 && (
                    <div className="flex rounded-lg border border-border/60 p-0.5 bg-muted/30 gap-0.5">
                      {effectiveFeatures.PASSWORD_LOGIN && (
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            mode === 'password'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => { if (mode !== 'password') { setMode('password'); setOtpStep('email'); setOtpCode(''); } }}
                          disabled={loading || mode === 'password'}
                          aria-pressed={mode === 'password'}
                        >
                          Password
                        </button>
                      )}
                      {effectiveFeatures.EMAIL_OTP && (
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            mode === 'otp'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => {
                            if (mode !== 'otp') {
                              setMode('otp');
                              setOtpStep('email');
                              setOtpCode('');
                              if (email) void sendOtp();
                            }
                          }}
                          disabled={loading || mode === 'otp'}
                          aria-pressed={mode === 'otp'}
                        >
                          Email code
                        </button>
                      )}
                      {effectiveFeatures.MAGIC_LINK && (
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            mode === 'magic'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => { if (mode !== 'magic') { setMode('magic'); setOtpStep('email'); setOtpCode(''); } }}
                          disabled={loading || mode === 'magic'}
                          aria-pressed={mode === 'magic'}
                        >
                          Magic link
                        </button>
                      )}
                    </div>
                  )}

                  {/* Switch to passkey */}
                  {effectiveFeatures.PASSKEYS && (
                    <button
                      type="button"
                      onClick={() => setAuthCategory('passkey')}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Sign in with passkey instead
                    </button>
                  )}
                </form>
              )}
            </>
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
