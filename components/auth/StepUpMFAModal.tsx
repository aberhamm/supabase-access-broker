'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
};

interface StepUpMFAModalProps {
  open: boolean;
  /** Called with `true` when the session was successfully elevated to AAL2; `false` if the user cancelled. */
  onClose: (elevated: boolean) => void;
  /** Optional context shown to the user explaining what they're confirming. */
  reason?: string;
}

export function StepUpMFAModal({ open, onClose, reason }: StepUpMFAModalProps) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!open) {
      // Reset state on close so a stale code doesn't linger across opens.
      setCode('');
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (cancelled) return;
        if (error) {
          setErrorMsg('Could not list MFA factors. Try logging out and back in.');
          return;
        }
        const verified = [
          ...(data?.totp ?? []),
          ...(data?.phone ?? []),
        ].filter((f) => f.status === 'verified');
        setFactors(verified);
        setFactorId(verified[0]?.id ?? null);
      } catch {
        if (!cancelled) setErrorMsg('Could not load MFA factors.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  useEffect(() => {
    if (open && factorId && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open, factorId]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) {
      setErrorMsg('No MFA factor selected.');
      return;
    }
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 6) {
      setErrorMsg('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: trimmed,
      });
      if (verifyError) throw verifyError;

      // Session is now AAL2. The next server-action call will pass the gate.
      onClose(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    onClose(false);
  };

  if (!open) return null;

  if (factors.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Enroll multi-factor authentication</DialogTitle>
            <DialogDescription>
              {reason ?? 'This action requires multi-factor authentication.'} Enroll
              an authenticator app in your account settings to continue.
            </DialogDescription>
          </DialogHeader>
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button asChild>
              <a href="/account">Go to account</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Confirm with multi-factor authentication</DialogTitle>
          <DialogDescription>
            {reason ?? 'Re-authenticate to perform this sensitive action.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4">
          {factors.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="step-up-factor">Authenticator</Label>
              <select
                id="step-up-factor"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={factorId ?? ''}
                onChange={(e) => setFactorId(e.target.value)}
                disabled={loading}
              >
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendly_name || f.factor_type}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="step-up-code">6-digit code</Label>
            <Input
              ref={inputRef}
              id="step-up-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              required
              placeholder="123456"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive" role="alert">
              {errorMsg}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
