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
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { createRoleAction, updateRoleAction } from '@/app/actions/apps';
import { toast } from 'sonner';
import type { RoleConfig } from '@/types/claims';

interface RoleFormDialogProps {
  role?: RoleConfig;
  appId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RoleFormDialog({
  role,
  appId,
  open,
  onOpenChange,
  onSuccess,
}: RoleFormDialogProps) {
  const isEditing = !!role;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: role?.name || '',
    label: role?.label || '',
    description: role?.description || '',
    permissions: role?.permissions || [],
  });
  const [newPermission, setNewPermission] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.label) {
      toast.error('Role name and label are required');
      return;
    }

    setLoading(true);

    try {
      const result = isEditing
        ? await updateRoleAction(role.id, {
            label: formData.label,
            description: formData.description || undefined,
            permissions: formData.permissions,
          })
        : await createRoleAction({
            name: formData.name,
            label: formData.label,
            description: formData.description || undefined,
            app_id: appId,
            is_global: false,
            permissions: formData.permissions,
          });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditing
            ? `Role "${formData.label}" updated successfully`
            : `Role "${formData.label}" created successfully`
        );
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const addPermission = () => {
    if (!newPermission.trim()) return;

    const trimmed = newPermission.trim();
    if (formData.permissions.includes(trimmed)) {
      toast.error('Permission already added');
      return;
    }

    setFormData({
      ...formData,
      permissions: [...formData.permissions, trimmed],
    });
    setNewPermission('');
  };

  const removePermission = (permission: string) => {
    setFormData({
      ...formData,
      permissions: formData.permissions.filter((p) => p !== permission),
    });
  };

  const commonPermissions = [
    'read',
    'write',
    'delete',
    'manage_users',
    'admin',
    'export',
    'import',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Role' : 'Create New Role'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the role configuration'
                : 'Create a new role for this application'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role ID *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={isEditing || loading}
                placeholder="e.g., manager"
                required
              />
              {!isEditing && (
                <p className="text-xs text-muted-foreground">
                  Use lowercase with underscores. Cannot be changed after creation.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Display Name *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                disabled={loading}
                placeholder="e.g., Manager"
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
                placeholder="Brief description of this role"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Common permissions:</p>
                <div className="flex flex-wrap gap-2">
                  {commonPermissions.map((perm) => (
                    <Button
                      key={perm}
                      type="button"
                      variant={formData.permissions.includes(perm) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (formData.permissions.includes(perm)) {
                          removePermission(perm);
                        } else {
                          setFormData({
                            ...formData,
                            permissions: [...formData.permissions, perm],
                          });
                        }
                      }}
                      disabled={loading}
                    >
                      {perm}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Custom permission:</p>
                <div className="flex gap-2">
                  <Input
                    value={newPermission}
                    onChange={(e) => setNewPermission(e.target.value)}
                    placeholder="e.g., approve_requests"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPermission();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addPermission}
                    disabled={loading || !newPermission.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {formData.permissions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selected permissions:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.permissions.map((perm) => (
                      <Badge key={perm} variant="secondary" className="gap-1">
                        {perm}
                        <button
                          type="button"
                          onClick={() => removePermission(perm)}
                          disabled={loading}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
