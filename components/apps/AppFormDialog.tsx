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

export function AppFormDialog({ app, open, onOpenChange, onSuccess }: AppFormDialogProps) {
  const isEditing = !!app;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: app?.id || '',
    name: app?.name || '',
    description: app?.description || '',
    color: app?.color || '',
    enabled: app?.enabled ?? true,
  });

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
              <Label htmlFor="id">App ID *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value })
                }
                disabled={isEditing || loading}
                placeholder="e.g., my-app"
                required
              />
              {!isEditing && (
                <p className="text-xs text-muted-foreground">
                  Use lowercase with hyphens. Cannot be changed after creation.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={loading}
                placeholder="e.g., My Application"
                required
              />
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
