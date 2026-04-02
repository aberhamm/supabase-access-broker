'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import { useAppAuthMethods } from '@/lib/use-app-auth-methods';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { OTPInput } from '@/components/auth/OTPInput';
import { autoGrantAppAccess } from '@/app/actions/signup';

function friendlySignupError(error: unknown, fallback: string): string {
  const err = error as { error_description?: string; message?: string; name?: string };
  const message = (err.error_description || err.message || '').toLowerCase();

  if (err.name === 'TypeError' && message.includes('fetch')) {
    return 'Unable to reach the authentication server. Check your network connection.';
  }
  if (message.includes('networkerror') || message.includes('network request failed')) {
    return 'Network error — please check your connection and try again.';
  }
  if (message.includes('already registered') || message.includes('user already registered')) {
    return 'This email is already registered. Try signing in instead.';
  }
  if (message.includes('password') && message.includes('length')) {
    return 'Password must be at least 6 characters.';
  }

  return err.error_description || err.message || fallback;
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);
  const [existingSession, setExistingSession] = useState<{ email: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const appId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('app_id');
  }, []);

  const { effectiveFeatures, appStatus, appMethodsReady, allowSelfSignup, mode, setMode } = useAppAuthMethods(appId);

  // Build the SSO complete path with signup=1
  const ssoCompletePath = useMemo(() => {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get('redirect_uri');
    const state = params.get('state');

    if (appId && redirectUri) {
      const sso = new URLSearchParams();
      sso.set('app_id', appId);
      sso.set('redirect_uri', redirectUri);
      if (state) sso.set('state', state);
      sso.set('signup', '1');
      return `/sso/complete?${sso.toString()}`;
    }
    return '/';
  }, [appId]);

  // Build login link preserving SSO params
  const loginLink = useMemo(() => {
    if (typeof window === 'undefined') return '/login';
    const params = new URLSearchParams(window.location.search);
    const loginParams = new URLSearchParams();
    const aid = params.get('app_id');
    const redirectUri = params.get('redirect_uri');
    const state = params.get('state');
    if (aid) loginParams.set('app_id', aid);
    if (redirectUri) loginParams.set('redirect_uri', redirectUri);
    if (state) loginParams.set('state', state);
    const qs = loginParams.toString();
    return qs ? `/login?${qs}` : '/login';
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    if (!mounted) return;
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user?: { email?: string } } | null } }) => {
      if (session?.user?.email) {
        setExistingSession({ email: session.user.email });
      }
    });
  }, [mounted, supabase]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle existing user granting themselves access
  const handleExistingUserGrant = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    setFormError(null);
    try {
      const result = await autoGrantAppAccess(appId);
      if (result.error) {
        setFormError(result.error);
      } else {
        window.location.href = ssoCompletePath;
      }
    } catch {
      setFormError('Failed to grant access. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [appId, ssoCompletePath]);

  const handlePasswordSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email) { setFormError('Please enter your email'); return; }
    if (!password) { setFormError('Please enter a password'); return; }
    if (password.length < 6) { setFormError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match'); return; }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(ssoCompletePath)}`,
        },
      });

      if (error) throw error;

      // If email confirmation is required, session will be null
      if (!data.session) {
        setEmailConfirmSent(true);
        toast.success('Check your email to confirm your account!');
        return;
      }

      // Session active — grant access and redirect
      if (appId) {
        const grantResult = await autoGrantAppAccess(appId);
        if (grantResult.error) {
          setFormError(grantResult.error);
          return;
        }
      }
      window.location.href = ssoCompletePath;
    } catch (error) {
      setFormError(friendlySignupError(error, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = useCallback(async () => {
    setFormError(null);
    if (!email) { setFormError('Please enter your email'); return; }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;

      setOtpStep('code');
      setCodeSentTo(email);
      setResendCountdown(30);
      toast.success('Check your email for the 6-digit code');
    } catch (error) {
      setFormError(friendlySignupError(error, 'Failed to send code'));
    } finally {
      setLoading(false);
    }
  }, [email, supabase]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const token = otpCode.replace(/\D/g, '');
    if (token.length !== 6) { setFormError('Enter the 6-digit code'); return; }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) throw error;

      if (data.session && appId) {
        const grantResult = await autoGrantAppAccess(appId);
        if (grantResult.error) {
          setFormError(grantResult.error);
          return;
        }
      }

      window.location.href = ssoCompletePath;
    } catch (error) {
      setFormError(friendlySignupError(error, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email) { setFormError('Please enter your email'); return; }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(ssoCompletePath)}`,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      toast.success('Check your email for the magic link!');
    } catch (error) {
      setFormError(friendlySignupError(error, 'Failed to send magic link'));
    } finally {
      setLoading(false);
    }
  };

  // No app_id provided
  if (mounted && !appId) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-primary/3" />
        </div>
        <Card className="w-full max-w-md shadow-2xl glass glass-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No application specified. Please use a signup link from your application.</p>
            <a href="/login" className="mt-4 inline-block text-sm text-primary hover:text-primary/80 transition-colors">
              Go to sign in
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email confirmation sent state
  if (emailConfirmSent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-primary/3" />
        </div>
        <Card className="w-full max-w-md shadow-2xl glass glass-border">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
            <CardDescription className="text-center">
              We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Didn&apos;t receive the email? Check your spam folder or try again.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setEmailConfirmSent(false); setPassword(''); setConfirmPassword(''); }}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-primary/3" />
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-float-slower" />
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
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <CardTitle className="text-2xl font-bold">Create account</CardTitle>
            <CardDescription>
              Sign up to get started
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Error banner */}
          {formError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="flex items-start justify-between gap-3">
                <p className="text-destructive font-medium">{formError}</p>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
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
                  {appStatus === 'error' && 'Unable to load signup options for this application. Please try again.'}
                </div>
              )}

              {/* Self-signup not enabled */}
              {appId && appStatus === 'ok' && !allowSelfSignup && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Self-registration is not available for this application. Contact your administrator to request access.
                </div>
              )}

              {/* No methods configured */}
              {appId && appStatus === 'ok' && allowSelfSignup && !Object.values(effectiveFeatures).some(Boolean) && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No sign-up methods have been configured for this application.
                  Contact your administrator.
                </div>
              )}

              {/* Existing user prompt */}
              {existingSession && appStatus === 'ok' && allowSelfSignup && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-6 text-center space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  <p className="text-sm font-medium">
                    You&apos;re signed in as <strong>{existingSession.email}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Would you like to access this app with your existing account?
                  </p>
                  <Button
                    className="w-full"
                    disabled={loading}
                    onClick={handleExistingUserGrant}
                  >
                    {loading ? 'Granting access...' : 'Continue with this account'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      supabase.auth.signOut();
                      setExistingSession(null);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Use a different account
                  </button>
                </div>
              )}

              {/* Auth forms — only show when no existing session and self-signup is enabled */}
              {!existingSession && appStatus === 'ok' && allowSelfSignup && Object.values(effectiveFeatures).some(Boolean) && (
                <>
                  {/* Social login buttons */}
                  {(effectiveFeatures.GOOGLE_LOGIN || effectiveFeatures.GITHUB_LOGIN) && (
                    <div className="space-y-3">
                      <SocialButtons
                        next={ssoCompletePath}
                        enableGoogle={effectiveFeatures.GOOGLE_LOGIN}
                        enableGitHub={effectiveFeatures.GITHUB_LOGIN}
                      />
                    </div>
                  )}

                  {/* Divider */}
                  {(effectiveFeatures.GOOGLE_LOGIN || effectiveFeatures.GITHUB_LOGIN) &&
                   (effectiveFeatures.PASSWORD_LOGIN || effectiveFeatures.EMAIL_OTP || effectiveFeatures.MAGIC_LINK) && (
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/60" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or</span>
                      </div>
                    </div>
                  )}

                  {/* Email form */}
                  {(effectiveFeatures.PASSWORD_LOGIN || effectiveFeatures.EMAIL_OTP || effectiveFeatures.MAGIC_LINK) && (
                    <form
                      onSubmit={
                        mode === 'password'
                          ? handlePasswordSignup
                          : mode === 'otp'
                            ? otpStep === 'email'
                              ? handleSendOtp
                              : handleVerifyOtp
                            : handleMagicLinkSignup
                      }
                      className="space-y-4"
                    >
                      {/* Email field */}
                      <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={loading || (mode === 'otp' && otpStep === 'code')}
                          required
                          autoComplete="email"
                          autoFocus
                          className="h-11"
                        />
                      </div>

                      {/* Password fields */}
                      {mode === 'password' && effectiveFeatures.PASSWORD_LOGIN && (
                        <>
                          <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 delay-75">
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              name="password"
                              type="password"
                              placeholder="Create a password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              disabled={loading}
                              autoComplete="new-password"
                              required
                              className="h-11"
                            />
                          </div>
                          <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 delay-100">
                            <Label htmlFor="confirm-password">Confirm password</Label>
                            <Input
                              id="confirm-password"
                              name="confirm-password"
                              type="password"
                              placeholder="Confirm your password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              disabled={loading}
                              autoComplete="new-password"
                              required
                              className="h-11"
                            />
                          </div>
                        </>
                      )}

                      {/* OTP code step */}
                      {mode === 'otp' && effectiveFeatures.EMAIL_OTP && otpStep === 'code' && (
                        <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                          {codeSentTo && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                              Code sent to {codeSentTo}
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
                              onClick={() => { setOtpStep('email'); setOtpCode(''); }}
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

                      <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                        {mode === 'magic' && (loading ? 'Sending magic link...' : 'Send magic link')}
                        {mode === 'otp' && (
                          otpStep === 'email'
                            ? (loading ? 'Sending code...' : 'Send code')
                            : (loading ? 'Verifying...' : 'Verify code')
                        )}
                        {mode === 'password' && (loading ? 'Creating account...' : 'Create account')}
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
                    </form>
                  )}
                </>
              )}

              {/* Footer */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <a href={loginLink} className="text-primary hover:text-primary/80 transition-colors font-medium">
                    Sign in
                  </a>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
