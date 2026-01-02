'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type PasskeyButtonProps = {
  next?: string;
  className?: string;
};

export function PasskeyButton({ next = '/', className }: PasskeyButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePasskeySignIn = async () => {
    try {
      setLoading(true);

      const optionsRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to start passkey login');
      }

      const { options } = (await optionsRes.json()) as { options: Parameters<typeof startAuthentication>[0] };

      const authResponse = await startAuthentication(options);

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
