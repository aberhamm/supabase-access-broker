'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAppAuthMethods } from '@/lib/use-app-auth-methods';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { autoGrantAppAccess } from '@/app/actions/signup';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [existingSession, setExistingSession] = useState<{ email: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const appId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('app_id');
  }, []);

  const { effectiveFeatures, appStatus, appMethodsReady, allowSelfSignup } = useAppAuthMethods(appId);

  // Only Apple and Google are allowed for new account creation.
  const signupMethodsAvailable = effectiveFeatures.GOOGLE_LOGIN || effectiveFeatures.APPLE_LOGIN;

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
              Sign up with Apple or Google to get started
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

              {/* No Apple/Google configured */}
              {appId && appStatus === 'ok' && allowSelfSignup && !signupMethodsAvailable && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Sign-up is restricted to Apple and Google accounts, but neither is enabled for this application.
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

              {/* Apple + Google only */}
              {!existingSession && appStatus === 'ok' && allowSelfSignup && signupMethodsAvailable && (
                <div className="space-y-4">
                  <SocialButtons
                    next={ssoCompletePath}
                    enableGoogle={effectiveFeatures.GOOGLE_LOGIN}
                    enableApple={effectiveFeatures.APPLE_LOGIN}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    New accounts must be created with Apple or Google. This helps us verify real identities.
                  </p>
                </div>
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
