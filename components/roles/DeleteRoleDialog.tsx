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
import { deleteRoleAction } from '@/app/actions/apps';
import { toast } from 'sonner';
import type { RoleConfig } from '@/types/claims';

interface DeleteRoleDialogProps {
  role: RoleConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({
  role,
  open,
  onOpenChange,
}: DeleteRoleDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      const result = await deleteRoleAction(role.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Role "${role.label}" deleted successfully`);
        onOpenChange(false);
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this role?
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Deleting the role{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              {role.label}
            </code>{' '}
            will affect any users currently assigned this role. This action cannot
            be undone.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Role Details:</p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{' '}
              <code className="rounded bg-muted px-1">{role.name}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Label:</span> {role.label}
            </p>
            {role.permissions.length > 0 && (
              <p>
                <span className="text-muted-foreground">Permissions:</span>{' '}
                {role.permissions.join(', ')}
              </p>
            )}
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
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
