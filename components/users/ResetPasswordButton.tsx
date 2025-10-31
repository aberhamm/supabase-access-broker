'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { triggerPasswordReset } from '@/app/actions/users';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ResetPasswordButtonProps {
  userEmail: string;
}

export function ResetPasswordButton({ userEmail }: ResetPasswordButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    setLoading(true);

    const result = await triggerPasswordReset(userEmail);

    setLoading(false);

    if (result.success) {
      toast.success(`Password reset email sent to ${userEmail}`);
      setOpen(false);
    } else {
      toast.error(result.error || 'Failed to send password reset email');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="sm">
          <KeyRound className="mr-2 h-4 w-4" />
          Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Send a password reset email to <strong>{userEmail}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            The user will receive an email with a link to reset their password.
            The link will be valid for a limited time.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleResetPassword} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
