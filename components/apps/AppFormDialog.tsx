'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Switch } from '@/components/ui/switch';
import { createAppAction, updateAppAction } from '@/app/actions/apps';
import { toast } from 'sonner';
import type { AppConfig } from '@/types/claims';

interface AppFormDialogProps {
  app?: AppConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Convert a string to kebab-case
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function AppFormDialog({ app, open, onOpenChange, onSuccess }: AppFormDialogProps) {
  const isEditing = !!app;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idManuallyEdited, setIdManuallyEdited] = useState(isEditing);
  const [formData, setFormData] = useState({
    id: app?.id || '',
    name: app?.name || '',
    description: app?.description || '',
    color: app?.color || '',
    enabled: app?.enabled ?? true,
  });

  // Reset state when dialog opens with different app
  useEffect(() => {
    if (open) {
      setIdManuallyEdited(!!app);
      setFormData({
        id: app?.id || '',
        name: app?.name || '',
        description: app?.description || '',
        color: app?.color || '',
        enabled: app?.enabled ?? true,
      });
    }
  }, [open, app]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id || !formData.name) {
      toast.error('App ID and Name are required');
      return;
    }

    setLoading(true);

    try {
      const result = isEditing
        ? await updateAppAction(formData.id, {
            name: formData.name,
            description: formData.description || undefined,
            color: formData.color || undefined,
            enabled: formData.enabled,
          })
        : await createAppAction({
            id: formData.id,
            name: formData.name,
            description: formData.description || undefined,
            color: formData.color || undefined,
            enabled: formData.enabled,
          });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditing
            ? `App "${formData.name}" updated successfully`
            : `App "${formData.name}" created successfully`
        );
        router.refresh();
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to save app');
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    { name: 'Blue', value: 'blue' },
    { name: 'Green', value: 'green' },
    { name: 'Red', value: 'red' },
    { name: 'Purple', value: 'purple' },
    { name: 'Orange', value: 'orange' },
    { name: 'Pink', value: 'pink' },
    { name: 'Yellow', value: 'yellow' },
    { name: 'Gray', value: 'gray' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit App' : 'Create New App'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the app configuration'
                : 'Add a new application to the system'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setFormData({
                    ...formData,
                    name: newName,
                    id: idManuallyEdited ? formData.id : toKebabCase(newName),
                  });
                }}
                disabled={loading}
                placeholder="e.g., My Application"
                required
              />
              {!isEditing && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>ID:</span>
                  {idManuallyEdited ? (
                    <Input
                      id="id"
                      value={formData.id}
                      onChange={(e) => {
                        setFormData({ ...formData, id: e.target.value });
                      }}
                      disabled={loading}
                      placeholder="e.g., my-app"
                      required
                      className="h-6 px-1.5 py-0 text-xs font-mono"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIdManuallyEdited(true)}
                      className="font-mono rounded px-1 hover:bg-muted transition-colors"
                    >
                      {formData.id || 'my-app'}
                    </button>
                  )}
                  {!idManuallyEdited && formData.id && (
                    <span className="text-muted-foreground/60">
                      (click to edit)
                    </span>
                  )}
                </div>
              )}
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  ID: <span className="font-mono">{formData.id}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                disabled={loading}
                placeholder="Brief description of this application"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: color.value })
                    }
                    disabled={loading}
                    className={`flex items-center gap-2 rounded-md border p-2 text-sm transition-colors hover:bg-muted ${
                      formData.color === color.value
                        ? 'border-primary bg-muted'
                        : 'border-border'
                    }`}
                  >
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Allow users to access this application
                </p>
              </div>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
                disabled={loading}
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
