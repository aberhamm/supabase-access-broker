'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldPlus, Copy, Check } from 'lucide-react';
import { enrollTOTP, verifyTOTP } from '@/app/actions/account';
import { useRouter } from 'next/navigation';
import type { TOTPEnrollment } from '@/types/claims';

interface MFAEnrollDialogProps {
  onEnrolled?: () => void;
}

export function MFAEnrollDialog({ onEnrolled }: MFAEnrollDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'start' | 'verify'>('start');
  const [loading, setLoading] = useState(false);
  const [enrollment, setEnrollment] = useState<TOTPEnrollment | null>(null);
  const [friendlyName, setFriendlyName] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleStartEnrollment = async () => {
    setLoading(true);

    try {
      const result = await enrollTOTP(friendlyName || undefined);

      if (result.success && result.enrollment) {
        setEnrollment(result.enrollment);
        setStep('verify');
      } else {
        toast.error(result.error || 'Failed to start enrollment');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to start enrollment');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!enrollment || !verifyCode) {
      toast.error('Please enter the verification code');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyTOTP(enrollment.id, verifyCode);

      if (result.success) {
        toast.success('MFA enabled successfully!');
        setOpen(false);
        resetState();
        router.refresh();
        onEnrolled?.();
      } else {
        toast.error(result.error || 'Invalid verification code');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!enrollment) return;

    try {
      await navigator.clipboard.writeText(enrollment.totp.secret);
      setCopied(true);
      toast.success('Secret copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy secret');
    }
  };

  const resetState = () => {
    setStep('start');
    setEnrollment(null);
    setFriendlyName('');
    setVerifyCode('');
    setCopied(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldPlus className="h-4 w-4 mr-2" />
          Add Authenticator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'start' ? 'Set Up Authenticator' : 'Verify Setup'}
          </DialogTitle>
          <DialogDescription>
            {step === 'start'
              ? 'Add an authenticator app for additional account security.'
              : 'Scan the QR code with your authenticator app and enter the code.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'start' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="friendlyName">Name (optional)</Label>
              <Input
                id="friendlyName"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                placeholder="e.g., 1Password, Google Authenticator"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                A name to help you identify this authenticator.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleStartEnrollment} disabled={loading}>
                {loading ? 'Setting up...' : 'Continue'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'verify' && enrollment && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              {/* QR Code */}
              <div className="rounded-lg border p-4 bg-white">
                <img
                  src={enrollment.totp.qr_code}
                  alt="QR Code for authenticator setup"
                  className="w-48 h-48"
                />
              </div>

              {/* Manual entry secret */}
              <div className="w-full space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Or enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                    {enrollment.totp.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifyCode">Verification Code</Label>
              <Input
                id="verifyCode"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
                disabled={loading}
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('start')}
                disabled={loading}
              >
                Back
              </Button>
              <Button type="submit" disabled={loading || verifyCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}


