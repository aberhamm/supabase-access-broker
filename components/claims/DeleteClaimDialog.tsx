'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { deleteClaimAction } from '@/app/actions/claims';
import { toast } from 'sonner';

interface DeleteClaimDialogProps {
  userId: string;
  claimKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteClaimDialog({
  userId,
  claimKey,
  open,
  onOpenChange,
}: DeleteClaimDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      const result = await deleteClaimAction(userId, claimKey);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Claim "${claimKey}" deleted successfully`);
        onOpenChange(false);
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete claim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Claim</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this claim?
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This will permanently delete the claim <code className="rounded bg-muted px-1 py-0.5 text-foreground">{claimKey}</code> from this user&apos;s profile.
            This action cannot be undone.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
