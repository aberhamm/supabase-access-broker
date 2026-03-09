'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { debugError, debugLog } from '@/lib/auth-debug';
import { createClient } from '@/lib/supabase/client';

type PasskeyButtonProps = {
  next?: string;
  className?: string;
};

import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

type OptionsResponse = {
  options: PublicKeyCredentialRequestOptionsJSON;
  debug?: { rpId: string; origin: string; host: string };
};

// Timeout for passkey authentication (10 seconds)
// Short timeout helps users quickly learn if they have no passkeys registered
const PASSKEY_TIMEOUT_MS = 10_000;

/**
 * Convert WebAuthn errors to user-friendly messages
 */
function getWebAuthnErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Passkey authentication failed';
  }

  const name = error.name;
  const message = error.message.toLowerCase();

  // Timeout error
  if (name === 'TimeoutError' || message.includes('timeout')) {
    return 'Passkey authentication timed out. Please try again.';
  }

  // NotAllowedError can mean different things
  if (name === 'NotAllowedError') {
    // User cancelled the operation
    if (message.includes('cancelled') || message.includes('canceled') || message.includes('abort')) {
      return 'Passkey authentication was cancelled';
    }
    // No credentials available for this RP ID
    if (message.includes('no credentials') || message.includes('no passkey') || message.includes('not found')) {
      return 'No passkeys found for this account. Please register a passkey first.';
    }
    // Generic not allowed - often means no discoverable credentials
    return 'No passkeys available. You may need to register a passkey first.';
  }

  if (name === 'AbortError') {
    return 'Passkey authentication was cancelled';
  }

  if (name === 'SecurityError') {
    return 'Security error: passkeys can only be used on secure origins (HTTPS or localhost)';
  }

  if (name === 'NotSupportedError') {
    return 'Your browser does not support passkeys';
  }

  if (name === 'InvalidStateError') {
    return 'Invalid passkey state. Please try again.';
  }

  // Fall back to the original error message
  return error.message || 'Passkey authentication failed';
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error(message);
        error.name = 'TimeoutError';
        reject(error);
      }, ms);
    }),
  ]);
}

export function PasskeyButton({ next = '/', className }: PasskeyButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handlePasskeySignIn = async () => {
    try {
      setLoading(true);
      debugLog('[Passkey] Starting authentication...');
      await supabase.auth.signOut();

      const optionsRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to start passkey login');
      }

      const { options, debug } = (await optionsRes.json()) as OptionsResponse;

      // Log debug info to help troubleshoot RP ID / origin issues
      debugLog('[Passkey] Server configuration:', debug);
      debugLog('[Passkey] Browser origin:', window.location.origin);
      debugLog('[Passkey] Options received:', { ...options, challenge: '(hidden)' });

      // Attempt WebAuthn authentication - this triggers the browser's passkey prompt
      // Add timeout to prevent hanging indefinitely when no credentials exist
      let authResponse;
      try {
        debugLog('[Passkey] Calling startAuthentication...');
        authResponse = await withTimeout(
          startAuthentication({ optionsJSON: options }),
          PASSKEY_TIMEOUT_MS,
          'Passkey authentication timed out. No passkeys may be registered for this account.'
        );
        debugLog('[Passkey] Authentication successful');
      } catch (webAuthnError) {
        // Handle WebAuthn-specific errors with user-friendly messages
        debugError('[Passkey] WebAuthn error:', webAuthnError);
        const friendlyMessage = getWebAuthnErrorMessage(webAuthnError);
        throw new Error(friendlyMessage);
      }

      const verifyRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, next }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Passkey verification failed');
      }

      const payload = (await verifyRes.json()) as { verified: boolean; action_link?: string };
      if (!payload.verified || !payload.action_link) {
        throw new Error('Passkey verification failed');
      }

      // Complete Supabase session creation via generated magic-link (no email involved)
      window.location.href = payload.action_link;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Passkey sign-in failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" className={className} onClick={handlePasskeySignIn} disabled={loading}>
      {loading ? 'Starting passkey...' : 'Sign in with Passkey'}
    </Button>
  );
}
