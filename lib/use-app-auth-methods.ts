'use client';

import { useEffect, useMemo, useState } from 'react';
import { AUTH_FEATURES } from '@/lib/auth-config';
import type { AppAuthMethods } from '@/types/claims';

export type AuthMode = 'magic' | 'otp' | 'password';

export interface AppAuthMethodsResult {
  effectiveFeatures: typeof AUTH_FEATURES;
  appStatus: 'ok' | 'app_not_found' | 'app_disabled' | 'error' | null;
  appMethodsReady: boolean;
  allowSelfSignup: boolean;
  selfSignupDefaultRole: string;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
}

export function useAppAuthMethods(appId: string | null): AppAuthMethodsResult {
  const [appAuthMethods, setAppAuthMethods] = useState<AppAuthMethods | null>(null);
  const [appMethodsReady, setAppMethodsReady] = useState(false);
  const [appStatus, setAppStatus] = useState<'ok' | 'app_not_found' | 'app_disabled' | 'error' | null>(null);
  const [allowSelfSignup, setAllowSelfSignup] = useState(false);
  const [selfSignupDefaultRole, setSelfSignupDefaultRole] = useState('user');
  const [mode, setMode] = useState<AuthMode>(() => {
    if (AUTH_FEATURES.EMAIL_OTP) return 'otp';
    if (AUTH_FEATURES.PASSWORD_LOGIN) return 'password';
    return 'magic';
  });

  useEffect(() => {
    if (!appId) {
      setAppMethodsReady(true);
      return;
    }
    fetch(`/api/apps/${appId}/auth-methods`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        auth_methods: AppAuthMethods | null;
        allow_self_signup?: boolean;
        self_signup_default_role?: string;
        status?: string;
      } | null) => {
        setAppAuthMethods(data?.auth_methods ?? null);
        setAppStatus((data?.status as 'ok' | 'app_not_found' | 'app_disabled' | 'error') ?? 'error');
        setAllowSelfSignup(data?.allow_self_signup ?? false);
        setSelfSignupDefaultRole(data?.self_signup_default_role ?? 'user');
      })
      .catch(() => { setAppAuthMethods(null); setAppStatus('error'); })
      .finally(() => setAppMethodsReady(true));
  }, [appId]);

  const effectiveFeatures = useMemo(() => {
    if (!appId) return AUTH_FEATURES;
    if (!appAuthMethods) {
      return {
        PASSKEYS: false,
        GOOGLE_LOGIN: false,
        GITHUB_LOGIN: false,
        EMAIL_OTP: false,
        PASSWORD_LOGIN: false,
        MAGIC_LINK: false,
      };
    }
    return {
      PASSKEYS: AUTH_FEATURES.PASSKEYS && !!appAuthMethods.passkeys,
      GOOGLE_LOGIN: AUTH_FEATURES.GOOGLE_LOGIN && !!appAuthMethods.google,
      GITHUB_LOGIN: AUTH_FEATURES.GITHUB_LOGIN && !!appAuthMethods.github,
      EMAIL_OTP: AUTH_FEATURES.EMAIL_OTP && !!appAuthMethods.email_otp,
      PASSWORD_LOGIN: AUTH_FEATURES.PASSWORD_LOGIN && !!appAuthMethods.password,
      MAGIC_LINK: AUTH_FEATURES.MAGIC_LINK && !!appAuthMethods.magic_link,
    };
  }, [appId, appAuthMethods]);

  // Update mode when per-app effective features resolve
  useEffect(() => {
    if (!appMethodsReady || !appId) return;
    if (effectiveFeatures.EMAIL_OTP) setMode('otp');
    else if (effectiveFeatures.PASSWORD_LOGIN) setMode('password');
    else setMode('magic');
  }, [appMethodsReady, appId, effectiveFeatures]);

  return {
    effectiveFeatures,
    appStatus,
    appMethodsReady,
    allowSelfSignup,
    selfSignupDefaultRole,
    mode,
    setMode,
  };
}
