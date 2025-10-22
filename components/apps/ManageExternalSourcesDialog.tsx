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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ExternalKeySource } from '@/types/claims';
import {
  createExternalSource,
  deleteExternalSource,
  toggleExternalSource,
} from '@/app/actions/api-keys';
import { toast } from 'sonner';
import { Settings2, Plus, Trash2 } from 'lucide-react';
import { ExternalSourceBadge } from './ExternalSourceBadge';

interface ManageExternalSourcesDialogProps {
  appId: string;
  sources: ExternalKeySource[];
  children?: React.ReactNode;
}

export function ManageExternalSourcesDialog({
  appId,
  sources,
  children,
}: ManageExternalSourcesDialogProps) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<'n8n' | 'django' | 'generic'>('generic');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !apiUrl.trim()) {
      toast.error('Name and API URL are required');
      return;
    }

    setLoading(true);

    try {
      const credentials = apiKey.trim()
        ? JSON.stringify({ type: 'bearer', token: apiKey.trim() })
        : undefined;

      await createExternalSource({
        app_id: appId,
        name: name.trim(),
        source_type: sourceType,
        api_url: apiUrl.trim(),
        api_credentials: credentials,
      });

      toast.success('External source added successfully');
      setShowAddForm(false);
      setName('');
      setSourceType('generic');
      setApiUrl('');
      setApiKey('');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add external source'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (source: ExternalKeySource) => {
    try {
      await toggleExternalSource(source.id, appId, !source.enabled);
      toast.success(
        `Source ${!source.enabled ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to toggle source'
      );
    }
  };

  const handleDelete = async (source: ExternalKeySource) => {
    if (!confirm(`Are you sure you want to delete "${source.name}"?`)) {
      return;
    }

    try {
      await deleteExternalSource(source.id, appId);
      toast.success('External source deleted successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete source'
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Settings2 className="mr-2 h-4 w-4" />
            Manage Sources
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage External Key Sources</DialogTitle>
          <DialogDescription>
            Configure external systems to fetch and display their API keys
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Existing sources */}
          {sources.length > 0 && (
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-medium">Configured Sources</h4>
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{source.name}</span>
                      <ExternalSourceBadge
                        source={source.source_type}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {source.api_url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={() => handleToggle(source)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(source)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new source form */}
          {!showAddForm ? (
            <Button
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add External Source
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
              <h4 className="text-sm font-medium">Add New Source</h4>

              <div className="grid gap-2">
                <Label htmlFor="source-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="source-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., n8n Production"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="source-type">Type</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as 'n8n' | 'django' | 'generic')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="n8n">n8n</SelectItem>
                    <SelectItem value="django">Django</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="source-url">
                  API URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="source-url"
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://your-service.com/api/keys"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="source-key">API Key (Optional)</Label>
                <Input
                  id="source-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Bearer token for authentication"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if the API doesn&apos;t require authentication
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Source'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
