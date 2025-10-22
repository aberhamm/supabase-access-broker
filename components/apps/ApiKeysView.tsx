'use client';

import { useState } from 'react';
import { UnifiedApiKey } from '@/types/claims';
import { ApiKeysList } from './ApiKeysList';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ApiKeysViewProps {
  appId: string;
  unifiedKeys: UnifiedApiKey[];
  keyStats: {
    total: number;
    local: number;
    external: number;
    bySource: Record<string, number>;
  };
}

export function ApiKeysView({ appId, unifiedKeys, keyStats }: ApiKeysViewProps) {
  const [showExternal, setShowExternal] = useState(true);

  // Filter keys based on toggle
  const displayKeys = showExternal
    ? unifiedKeys
    : unifiedKeys.filter((key) => key.is_local);

  return (
    <div className="space-y-4">
      {/* Toggle and Stats */}
      {keyStats.external > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Switch
              id="show-external"
              checked={showExternal}
              onCheckedChange={setShowExternal}
            />
            <div>
              <Label htmlFor="show-external" className="cursor-pointer">
                Show external keys
              </Label>
              <p className="text-xs text-muted-foreground">
                Include keys from n8n, Django, and other external systems
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {Object.entries(keyStats.bySource).map(([source, count]) => (
              <Badge key={source} variant="secondary">
                {source}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Keys List */}
      <ApiKeysList apiKeys={displayKeys} appId={appId} showSource={showExternal} />
    </div>
  );
}

