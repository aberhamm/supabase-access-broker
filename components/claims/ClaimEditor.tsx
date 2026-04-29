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
import { Textarea } from '@/components/ui/textarea';
import { setClaimAction } from '@/app/actions/claims';
import { toast } from 'sonner';
import { getClaimType } from '@/lib/claims';
import { useStepUp } from '@/components/auth/StepUpProvider';

interface ClaimEditorProps {
  userId: string;
  claimKey?: string;
  claimValue?: unknown;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId?: string;
  customAction?: (userId: string, key: string, value: string) => Promise<{ error?: string | null; data?: unknown }>;
}

export function ClaimEditor({
  userId,
  claimKey,
  claimValue,
  open,
  onOpenChange,
  appId,
  customAction,
}: ClaimEditorProps) {
  const isEditing = !!claimKey;
  const [key, setKey] = useState(claimKey || '');
  const [value, setValue] = useState(
    claimValue !== undefined
      ? typeof claimValue === 'object'
        ? JSON.stringify(claimValue, null, 2)
        : typeof claimValue === 'string'
        ? `"${claimValue}"`
        : String(claimValue)
      : ''
  );
  const [loading, setLoading] = useState(false);
  const { withStepUp } = useStepUp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!key || !value) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // Use custom action if provided (for app-specific claims), otherwise use default.
      // setClaimAction is gated server-side; per-app custom actions may also be gated.
      const runner = customAction
        ? () => customAction(userId, key, value)
        : () => setClaimAction(userId, key, value) as Promise<{ error?: string | null; data?: unknown }>;
      const result = await withStepUp(
        runner,
        appId ? 'Confirm to update an app claim' : 'Confirm to update a claim',
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        const claimType = appId ? `app claim for ${appId}` : 'claim';
        toast.success(
          isEditing
            ? `${claimType} "${key}" updated successfully`
            : `${claimType} "${key}" added successfully`
        );
        onOpenChange(false);
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to save claim');
    } finally {
      setLoading(false);
    }
  };

  const getValueHint = () => {
    if (!value) return null;

    try {
      const parsed = JSON.parse(value);
      const type = getClaimType(parsed);
      return (
        <p className="text-xs text-muted-foreground">
          Valid {type} value
        </p>
      );
    } catch {
      return (
        <p className="text-xs text-destructive">
          Invalid JSON. For strings, use double quotes: &ldquo;text&rdquo;
        </p>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Claim' : 'Add New Claim'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the value for this custom claim'
                : 'Add a new custom claim to this user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Claim Name</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={isEditing || loading}
                placeholder="e.g., user_level"
                required
              />
              {!isEditing && (
                <p className="text-xs text-muted-foreground">
                  Use lowercase with underscores. Avoid reserved names like
                  &ldquo;provider&rdquo; or &ldquo;providers&rdquo;
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value (JSON format)</Label>
              <Textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={loading}
                placeholder='Enter value: 100, true, "text", ["a","b"], {"x":1}'
                rows={5}
                className="font-mono text-sm"
                required
              />
              {getValueHint()}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Examples:</p>
                <ul className="list-inside list-disc space-y-0.5 font-mono">
                  <li>Number: 100</li>
                  <li>String: &quot;MANAGER&quot;</li>
                  <li>Boolean: true or false</li>
                  <li>Array: [&quot;item1&quot;, &quot;item2&quot;]</li>
                  <li>Object: {`{"level": 5, "active": true}`}</li>
                </ul>
              </div>
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
