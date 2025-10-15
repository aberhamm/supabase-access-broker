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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { deleteAppAction } from '@/app/actions/apps';
import { toast } from 'sonner';
import type { AppConfig } from '@/types/claims';

interface DeleteAppConfirmDialogProps {
  app: AppConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAppConfirmDialog({
  app,
  open,
  onOpenChange,
}: DeleteAppConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== app.id) {
      toast.error('Please type the app ID exactly to confirm deletion');
      return;
    }

    setLoading(true);

    try {
      const result = await deleteAppAction(app.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`App "${app.name}" deleted successfully`);
        onOpenChange(false);
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete app');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete App</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this app? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Deleting this app will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Remove all app-specific roles</li>
              <li>Remove app access from all users</li>
              <li>Delete all app-specific claims data</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">
              App to delete: <code className="rounded bg-muted px-2 py-1">{app.name}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">
              Type <code className="rounded bg-muted px-1">{app.id}</code> to confirm
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={loading}
              placeholder={app.id}
            />
          </div>
        </div>

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
            disabled={loading || confirmText !== app.id}
          >
            {loading ? 'Deleting...' : 'Delete App'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
