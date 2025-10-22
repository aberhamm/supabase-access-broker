'use client';

import { useEffect, useState } from 'react';
import { getUnifiedApiKeys, getExternalSources } from '@/app/actions/api-keys';
import { UnifiedApiKey, ExternalKeySource, RoleConfig } from '@/types/claims';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiKeysView } from '@/components/apps/ApiKeysView';
import { CreateApiKeyDialog } from '@/components/apps/CreateApiKeyDialog';
import { ManageExternalSourcesDialog } from '@/components/apps/ManageExternalSourcesDialog';

interface ApiKeysTabContentProps {
  appId: string;
}

export function ApiKeysTabContent({ appId }: ApiKeysTabContentProps) {
  const [unifiedKeys, setUnifiedKeys] = useState<UnifiedApiKey[] | null>(null);
  const [externalSources, setExternalSources] = useState<ExternalKeySource[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [keysData, sourcesData, rolesResponse] = await Promise.all([
          getUnifiedApiKeys(appId),
          getExternalSources(appId),
          fetch(`/api/apps/${appId}/roles`),
        ]);

        if (!rolesResponse.ok) throw new Error('Failed to load roles');
        const rolesData = await rolesResponse.json();

        setUnifiedKeys(keysData);
        setExternalSources(sourcesData);
        setRoles(rolesData);
      } catch (error) {
        console.error('Failed to load API keys:', error);
        setUnifiedKeys([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [appId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!unifiedKeys) {
    return <div>Failed to load API keys</div>;
  }

  // Calculate key stats
  const keyStats = {
    total: unifiedKeys.length,
    local: unifiedKeys.filter(k => k.is_local).length,
    external: unifiedKeys.filter(k => !k.is_local).length,
    bySource: unifiedKeys.reduce((acc, key) => {
      const source = key.is_local ? 'local' : (key.source_name || key.source);
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <ManageExternalSourcesDialog
          appId={appId}
          sources={externalSources}
        />
        <CreateApiKeyDialog appId={appId} roles={roles} />
      </div>
      <ApiKeysView
        appId={appId}
        unifiedKeys={unifiedKeys}
        keyStats={keyStats}
      />
    </div>
  );
}
