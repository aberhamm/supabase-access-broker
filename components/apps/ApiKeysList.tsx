'use client';

import { ApiKey, UnifiedApiKey } from '@/types/claims';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, AlertCircle, Eye } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { toggleApiKey } from '@/app/actions/api-keys';
import { toast } from 'sonner';
import { DeleteApiKeyDialog } from './DeleteApiKeyDialog';
import { ExternalSourceBadge } from './ExternalSourceBadge';
import { useStepUp } from '@/components/auth/StepUpProvider';

interface ApiKeysListProps {
  apiKeys: ApiKey[] | UnifiedApiKey[];
  appId: string;
  showSource?: boolean; // Show source column for unified view
}

export function ApiKeysList({ apiKeys, appId, showSource = false }: ApiKeysListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | UnifiedApiKey | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const { withStepUp } = useStepUp();

  const isUnifiedKey = (key: ApiKey | UnifiedApiKey): key is UnifiedApiKey => {
    return 'is_local' in key;
  };

  const handleToggle = async (key: ApiKey | UnifiedApiKey) => {
    // Only allow toggling local keys
    if (isUnifiedKey(key) && !key.is_local) {
      toast.error('Cannot toggle external API keys from this dashboard');
      return;
    }

    setTogglingKey(key.id);
    try {
      await withStepUp(
        () => toggleApiKey(key.id, appId, !key.enabled),
        key.enabled ? 'Confirm to disable this API key' : 'Confirm to enable this API key',
      );
      toast.success(
        `API key ${!key.enabled ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to toggle API key'
      );
    } finally {
      setTogglingKey(null);
    }
  };

  const handleDeleteClick = (key: ApiKey | UnifiedApiKey) => {
    // Only allow deleting local keys
    if (isUnifiedKey(key) && !key.is_local) {
      toast.error('Cannot delete external API keys from this dashboard');
      return;
    }
    setSelectedKey(key);
    setDeleteDialogOpen(true);
  };

  const maskKey = (keyHash?: string) => {
    if (!keyHash) return 'External key';
    // Show first 8 chars of the hash as a reference
    return `sk_${'*'.repeat(48)}...${keyHash.slice(-8)}`;
  };

  const isExpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (apiKeys.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No API keys yet</p>
        <p className="text-sm mt-2">Create one to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {showSource && <TableHead>Source</TableHead>}
              <TableHead>Role</TableHead>
              <TableHead>Key Reference</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key) => {
              const expired = isExpired(key.expires_at);
              const unified = isUnifiedKey(key) ? key : null;
              const isExternal = unified && !unified.is_local;

              return (
                <TableRow key={key.id} className={isExternal ? 'bg-muted/30' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{key.name}</div>
                      {key.description && (
                        <div className="text-sm text-muted-foreground">
                          {key.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {showSource && (
                    <TableCell>
                      <ExternalSourceBadge
                        source={unified?.source || 'local'}
                        sourceName={unified?.source_name}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    {key.role_name ? (
                      <Badge variant="outline">{key.role_name}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No role
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {maskKey(unified?.key_hash)}
                    </code>
                  </TableCell>
                  <TableCell>
                    {key.expires_at ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {format(new Date(key.expires_at), 'PP')}
                        </span>
                        {expired && (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Never
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {key.last_used_at ? (
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(key.last_used_at), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Never
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isExternal ? (
                        <div title="Read-only">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <Switch
                            checked={key.enabled}
                            onCheckedChange={() => handleToggle(key)}
                            disabled={togglingKey === key.id || expired}
                          />
                          {expired && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isExternal && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(key)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedKey && !isUnifiedKey(selectedKey) && (
        <DeleteApiKeyDialog
          apiKey={selectedKey as ApiKey}
          appId={appId}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        />
      )}
    </>
  );
}
