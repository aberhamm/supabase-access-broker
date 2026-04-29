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
import { ApiKey } from '@/types/claims';
import { deleteApiKey } from '@/app/actions/api-keys';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { useStepUp } from '@/components/auth/StepUpProvider';

interface DeleteApiKeyDialogProps {
  apiKey: ApiKey;
  appId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteApiKeyDialog({
  apiKey,
  appId,
  open,
  onOpenChange,
}: DeleteApiKeyDialogProps) {
  const [loading, setLoading] = useState(false);
  const { withStepUp } = useStepUp();

  const handleDelete = async () => {
    setLoading(true);

    try {
      await withStepUp(
        () => deleteApiKey(apiKey.id, appId),
        'Confirm to delete this API key',
      );
      toast.success('API key deleted successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete API key'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete API Key</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this API key?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Warning</p>
                <p className="text-sm text-muted-foreground">
                  Deleting &quot;{apiKey.name}&quot; will immediately break any
                  integrations using this key. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="font-medium">Key Name:</span> {apiKey.name}
            </div>
            {apiKey.description && (
              <div>
                <span className="font-medium">Description:</span>{' '}
                {apiKey.description}
              </div>
            )}
            {apiKey.role_name && (
              <div>
                <span className="font-medium">Role:</span> {apiKey.role_name}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete API Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

