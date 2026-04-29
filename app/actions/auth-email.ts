'use server';

/**
 * Server actions for email-sending auth flows.
 *
 * Routing magic-link / OTP-code / password-reset email sends through server
 * actions lets us rate-limit per IP+email at the broker boundary instead of
 * relying on Supabase's upstream limits (which are global and email-only).
 *
 * Note on identifier-based limits: an attacker who knows a victim's email
 * could try to lock the victim out by hammering otp-send for that email
 * until the per-email limit kicks in. Our limits (5/min for OTP, 3/5min
 * for password reset) are tight enough to slow them but loose enough that
 * a legit user retrying isn't blocked.
 */

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { enforceAuthLimit, getClientIp } from '@/lib/auth-rate-limit';

export type AuthEmailResult =
  | { ok: true }
  | { ok: false; error: string; rateLimited?: boolean; retryAfterSec?: number };

const GENERIC_RATE_LIMIT_MSG =
  'Too many requests. Please wait a moment and try again.';

const GENERIC_FAILURE_MSG = 'Could not send the email. Please try again.';

async function rateLimit(action: 'login' | 'otp-send' | 'password-reset', email: string): Promise<AuthEmailResult | null> {
  const h = await headers();
  const ip = getClientIp(h);
  const result = await enforceAuthLimit({ action, ip, identifier: email });
  if (!result.allowed) {
    return {
      ok: false,
      error: GENERIC_RATE_LIMIT_MSG,
      rateLimited: true,
      retryAfterSec: result.retryAfterSec,
    };
  }
  return null;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 320) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function sendMagicLinkEmail(params: {
  email: string;
  redirectTo: string;
}): Promise<AuthEmailResult> {
  const email = normalizeEmail(params.email);
  if (!email) return { ok: false, error: 'Please enter a valid email address.' };

  const limited = await rateLimit('otp-send', email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: params.redirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) {
    // Don't echo Supabase's message — it can leak whether the user exists.
    console.error('[auth-email] sendMagicLinkEmail error:', error);
    return { ok: false, error: GENERIC_FAILURE_MSG };
  }

  return { ok: true };
}

export async function sendLoginOtpEmail(params: {
  email: string;
}): Promise<AuthEmailResult> {
  const email = normalizeEmail(params.email);
  if (!email) return { ok: false, error: 'Please enter a valid email address.' };

  const limited = await rateLimit('otp-send', email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error('[auth-email] sendLoginOtpEmail error:', error);
    return { ok: false, error: GENERIC_FAILURE_MSG };
  }

  return { ok: true };
}

export async function sendPasswordResetEmail(params: {
  email: string;
  redirectTo: string;
}): Promise<AuthEmailResult> {
  const email = normalizeEmail(params.email);
  if (!email) return { ok: false, error: 'Please enter a valid email address.' };

  const limited = await rateLimit('password-reset', email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: params.redirectTo,
  });

  if (error) {
    console.error('[auth-email] sendPasswordResetEmail error:', error);
    return { ok: false, error: GENERIC_FAILURE_MSG };
  }

  // Always return ok regardless of whether the email exists. Frontend always
  // shows "If an account exists, we sent a reset link" — that's the
  // enumeration-safe pattern.
  return { ok: true };
}
