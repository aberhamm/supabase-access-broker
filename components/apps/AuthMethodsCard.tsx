'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Mail, KeyRound, Smartphone, Github, Info } from 'lucide-react';

import type { AppConfig, AppAuthMethods } from '@/types/claims';
import { AUTH_FEATURES } from '@/lib/auth-config';
import { updateAppAuthMethodsAction, updateAppSelfSignupAction } from '@/app/actions/apps';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const DEFAULT_METHODS: AppAuthMethods = {
  password: true,
  magic_link: true,
  email_otp: true,
  passkeys: true,
  google: false,
  github: false,
};

// Each method definition for rendering
const METHOD_DEFS = [
  {
    key: 'password' as const,
    label: 'Password',
    description: 'Sign in with email and password',
    icon: Lock,
    requiresGlobal: AUTH_FEATURES.PASSWORD_LOGIN,
    globalFlag: 'NEXT_PUBLIC_AUTH_PASSWORD',
  },
  {
    key: 'magic_link' as const,
    label: 'Magic Link',
    description: 'Passwordless email link',
    icon: Mail,
    requiresGlobal: true, // magic link is on by default
    globalFlag: null,
  },
  {
    key: 'email_otp' as const,
    label: 'Email Code',
    description: '6-digit one-time code via email',
    icon: Mail,
    requiresGlobal: AUTH_FEATURES.EMAIL_OTP,
    globalFlag: 'NEXT_PUBLIC_AUTH_EMAIL_OTP',
  },
  {
    key: 'passkeys' as const,
    label: 'Passkeys',
    description: 'WebAuthn / biometric login',
    icon: Smartphone,
    requiresGlobal: AUTH_FEATURES.PASSKEYS,
    globalFlag: 'NEXT_PUBLIC_AUTH_PASSKEYS',
  },
  {
    key: 'google' as const,
    label: 'Google',
    description: 'Sign in with Google OAuth',
    icon: KeyRound,
    requiresGlobal: AUTH_FEATURES.GOOGLE_LOGIN,
    globalFlag: 'NEXT_PUBLIC_AUTH_GOOGLE',
  },
  {
    key: 'github' as const,
    label: 'GitHub',
    description: 'Sign in with GitHub OAuth',
    icon: Github,
    requiresGlobal: AUTH_FEATURES.GITHUB_LOGIN,
    globalFlag: 'NEXT_PUBLIC_AUTH_GITHUB',
  },
] as const;

export function AuthMethodsCard({ app, onUpdated }: { app: AppConfig; onUpdated?: () => void }) {
  const [methods, setMethods] = useState<AppAuthMethods>({
    ...DEFAULT_METHODS,
    ...(app.auth_methods ?? {}),
  });
  const [saving, setSaving] = useState<string | null>(null); // key of the toggle being saved
  const [selfSignup, setSelfSignup] = useState(app.allow_self_signup ?? false);
  const [defaultRole, setDefaultRole] = useState(app.self_signup_default_role ?? 'user');
  const [savingSignup, setSavingSignup] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const enabledCount = Object.values(methods).filter(Boolean).length;

  const toggle = async (key: keyof AppAuthMethods) => {
    const newMethods = { ...methods, [key]: !methods[key] };
    const prev = methods;
    setMethods(newMethods);
    setSaving(key);

    try {
      const result = await updateAppAuthMethodsAction(app.id, newMethods);
      if (result.error) {
        toast.error(result.error);
        setMethods(prev);
        return;
      }
      toast.success(`${key.replace('_', ' ')} ${newMethods[key] ? 'enabled' : 'disabled'}`);
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Failed to update');
      setMethods(prev);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Sign-in Methods
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Control which login methods are available when users sign in to{' '}
                <code className="rounded bg-muted px-1">{app.id}</code>.
              </p>
            </div>
            <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>
              {enabledCount} enabled
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {enabledCount === 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                No sign-in methods are enabled. Users will not be able to log in to this app via SSO
                until at least one method is enabled.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Only enabled methods appear on the login page when users are redirected here from this
              app. Methods disabled at the platform level cannot be enabled per-app.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {METHOD_DEFS.map(({ key, label, description, icon: Icon, requiresGlobal, globalFlag }) => {
              const isEnabled = methods[key];
              const platformDisabled = !requiresGlobal;
              const isSaving = saving === key;

              return (
                <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 rounded-md p-1.5 ${isEnabled && !platformDisabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`method-${key}`}
                          className={`text-sm font-medium leading-none cursor-pointer ${platformDisabled ? 'text-muted-foreground' : ''}`}
                        >
                          {label}
                        </Label>
                        {platformDisabled && globalFlag && (
                          <Badge variant="outline" className="text-xs font-normal">
                            Requires {globalFlag}=true
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    </div>
                  </div>
                  <Switch
                    id={`method-${key}`}
                    checked={isEnabled && !platformDisabled}
                    onCheckedChange={() => !platformDisabled && toggle(key)}
                    disabled={platformDisabled || isSaving}
                    aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${label}`}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Self-Signup
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Allow users to create accounts and access this app without an admin invite.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="min-w-0">
              <Label htmlFor="self-signup-toggle" className="text-sm font-medium cursor-pointer">
                Allow self-signup
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, users can register at <code className="rounded bg-muted px-1">/signup?app_id={app.id}</code>
              </p>
            </div>
            <Switch
              id="self-signup-toggle"
              checked={selfSignup}
              disabled={savingSignup}
              onCheckedChange={async (checked) => {
                const prev = selfSignup;
                setSelfSignup(checked);
                setSavingSignup(true);
                try {
                  const result = await updateAppSelfSignupAction(app.id, { allow_self_signup: checked });
                  if (result.error) {
                    toast.error(result.error);
                    setSelfSignup(prev);
                  } else {
                    toast.success(`Self-signup ${checked ? 'enabled' : 'disabled'}`);
                    onUpdated?.();
                  }
                } catch {
                  toast.error('Failed to update');
                  setSelfSignup(prev);
                } finally {
                  setSavingSignup(false);
                }
              }}
            />
          </div>

          {selfSignup && (
            <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <Label htmlFor="default-role" className="text-sm font-medium">
                Default role
              </Label>
              <p className="text-xs text-muted-foreground">
                Role automatically assigned to new self-signup users.
              </p>
              <div className="flex gap-2">
                <Input
                  id="default-role"
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  placeholder="user"
                  disabled={savingRole}
                  className="max-w-xs"
                />
                <button
                  type="button"
                  disabled={savingRole || defaultRole === (app.self_signup_default_role ?? 'user')}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={async () => {
                    setSavingRole(true);
                    try {
                      const result = await updateAppSelfSignupAction(app.id, { self_signup_default_role: defaultRole || 'user' });
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success('Default role updated');
                        onUpdated?.();
                      }
                    } catch {
                      toast.error('Failed to update');
                    } finally {
                      setSavingRole(false);
                    }
                  }}
                >
                  {savingRole ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
