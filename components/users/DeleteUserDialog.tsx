'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Trash2 } from 'lucide-react';
import { deleteUser } from '@/app/actions/users';
import { toast } from 'sonner';

interface DeleteUserDialogProps {
  userId: string;
  userEmail: string;
}

export function DeleteUserDialog({ userId, userEmail }: DeleteUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== userEmail) {
      toast.error('Please type the user email exactly to confirm deletion');
      return;
    }

    setLoading(true);

    try {
      const result = await deleteUser(userId);

      if (!result.success) {
        toast.error(result.error || 'Failed to delete user');
      } else {
        toast.success(`User "${userEmail}" deleted successfully`);
        setOpen(false);
        router.push('/users');
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setConfirmText('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Deleting this user will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Permanently remove the user account</li>
              <li>Remove all user claims and app access</li>
              <li>Invalidate any active sessions</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">
              User to delete: <code className="rounded bg-muted px-2 py-1">{userEmail}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-email">
              Type <code className="rounded bg-muted px-1 text-xs break-all">{userEmail}</code> to confirm
            </Label>
            <Input
              id="confirm-email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={loading}
              placeholder={userEmail}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || confirmText !== userEmail}
          >
            {loading ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
