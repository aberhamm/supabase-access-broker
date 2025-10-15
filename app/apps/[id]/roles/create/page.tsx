'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createRoleAction } from '@/app/actions/apps';
import { toast } from 'sonner';

export default function CreateRolePage() {
  const router = useRouter();
  const params = useParams();
  const appId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
    permissions: [] as string[],
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
      const result = await createRoleAction({
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
        toast.success(`Role "${formData.label}" created successfully`);
        router.push(`/apps/${appId}/roles`);
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to create role');
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
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <div className="flex items-center gap-4">
          <Link href={`/apps/${appId}/roles`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Roles
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Role</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role ID *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={loading}
                  placeholder="e.g., manager"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use lowercase with underscores. Cannot be changed after creation.
                </p>
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

              <div className="space-y-3">
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
                  <p className="text-sm text-muted-foreground">Add custom permission:</p>
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
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium">
                      Selected permissions ({formData.permissions.length}):
                    </p>
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

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/apps/${appId}/roles`)}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Creating...' : 'Create Role'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
