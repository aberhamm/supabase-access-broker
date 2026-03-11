'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { createAppAction, getUsedColorsAction } from '@/app/actions/apps';
import { toast } from 'sonner';

// All available colors
const ALL_COLORS = [
  { name: 'Blue', value: 'blue' },
  { name: 'Green', value: 'green' },
  { name: 'Red', value: 'red' },
  { name: 'Purple', value: 'purple' },
  { name: 'Orange', value: 'orange' },
  { name: 'Pink', value: 'pink' },
  { name: 'Teal', value: 'teal' },
  { name: 'Yellow', value: 'yellow' },
  { name: 'Indigo', value: 'indigo' },
  { name: 'Cyan', value: 'cyan' },
  { name: 'Amber', value: 'amber' },
  { name: 'Lime', value: 'lime' },
];

// Convert a string to kebab-case
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

export default function CreateAppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [usedColors, setUsedColors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    color: '',
    enabled: true,
  });

  // Fetch used colors on mount
  useEffect(() => {
    async function fetchUsedColors() {
      const result = await getUsedColorsAction();
      if (result.data) {
        setUsedColors(result.data);
        // Set default color to first available
        const availableColor = ALL_COLORS.find(
          (c) => !result.data!.includes(c.value)
        );
        if (availableColor) {
          setFormData((prev) => ({ ...prev, color: availableColor.value }));
        }
      }
    }
    fetchUsedColors();
  }, []);

  // Filter out used colors
  const availableColors = useMemo(() => {
    return ALL_COLORS.filter((color) => !usedColors.includes(color.value));
  }, [usedColors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id || !formData.name) {
      toast.error('App ID and Name are required');
      return;
    }

    if (!formData.color) {
      toast.error('Please select a color');
      return;
    }

    setLoading(true);

    try {
      const result = await createAppAction({
        id: formData.id,
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        enabled: formData.enabled,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`App "${formData.name}" created successfully`);
        router.refresh();
        router.push('/apps');
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to create app');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/apps">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Apps
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New App</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                    // Only auto-populate ID if user hasn't manually edited it
                    id: idManuallyEdited ? formData.id : toKebabCase(newName),
                  });
                }}
                disabled={loading}
                placeholder="e.g., My Application"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">App ID *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) => {
                  setIdManuallyEdited(true);
                  setFormData({ ...formData, id: e.target.value });
                }}
                disabled={loading}
                placeholder="e.g., my-app"
                required
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from name. Use lowercase with hyphens. Cannot be
                changed after creation.
              </p>
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
              <Label>Color *</Label>
              {availableColors.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4 text-center">
                  All colors are currently in use by other apps.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {availableColors.map((color) => (
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
                  <p className="text-xs text-muted-foreground">
                    {usedColors.length > 0 &&
                      `${usedColors.length} color${
                        usedColors.length > 1 ? 's' : ''
                      } already in use by other apps.`}
                  </p>
                </>
              )}
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

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/apps')}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !formData.color}
                className="flex-1"
              >
                {loading ? 'Creating...' : 'Create App'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
