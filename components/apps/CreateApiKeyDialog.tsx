'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleConfig } from '@/types/claims';
import { createApiKey } from '@/app/actions/api-keys';
import { toast } from 'sonner';
import { Plus, AlertTriangle } from 'lucide-react';
import { CopyButton } from '@/components/users/CopyButton';
import { useStepUp } from '@/components/auth/StepUpProvider';

interface CreateApiKeyDialogProps {
  appId: string;
  roles: RoleConfig[];
  children?: React.ReactNode;
}

export function CreateApiKeyDialog({
  appId,
  roles,
  children,
}: CreateApiKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roleId, setRoleId] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const { withStepUp } = useStepUp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setLoading(true);

    try {
      // withStepUp opens the MFA challenge modal if the action returns the
      // step-up code, then retries the action automatically on success.
      const result = await withStepUp(
        () =>
          createApiKey({
            app_id: appId,
            name: name.trim(),
            description: description.trim() || undefined,
            role_id: roleId || undefined,
            expires_at: expiresAt || undefined,
          }),
        'Confirm to issue a new API key',
      );

      setCreatedSecret(result.secret);
      toast.success('API key created successfully');

      // Don't close dialog - show the secret
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create API key'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after animation
    setTimeout(() => {
      setName('');
      setDescription('');
      setRoleId('');
      setExpiresAt('');
      setCreatedSecret(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        {!createdSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for webhook authentication and external
                integrations.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., n8n Production Webhook"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description of what this key is used for"
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="role">Role (Optional)</Label>
                  <Select value={roleId} onValueChange={setRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No specific role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No specific role</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.label}
                          {role.is_global && ' (Global)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign a role to grant specific permissions to this key
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="expires">Expiration Date (Optional)</Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for keys that never expire
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create API Key'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>API Key Created Successfully!</DialogTitle>
              <DialogDescription>
                Copy this key now - you won&apos;t be able to see it again.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Save this key securely
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      This is the only time you&apos;ll see the full API key.
                      Store it somewhere safe like a password manager or
                      environment variables.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Label>Your API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdSecret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <CopyButton text={createdSecret} />
                </div>
              </div>

              <div className="mt-4 rounded-lg border p-4 bg-muted">
                <p className="text-sm font-medium mb-2">Usage Example:</p>
                <code className="text-xs block bg-background p-3 rounded border">
                  curl -X POST \<br />
                  &nbsp;&nbsp;https://your-domain.com/api/webhooks/{appId} \
                  <br />
                  &nbsp;&nbsp;-H &quot;X-API-Key: {createdSecret}&quot; \<br />
                  &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \
                  <br />
                  &nbsp;&nbsp;-d &apos;{'{'}
                  &quot;data&quot;: &quot;your payload&quot;
                  {'}'}&apos;
                </code>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
