'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Shield, LayoutDashboard, Settings } from 'lucide-react';
import { RolesTabContent } from '@/components/apps/RolesTabContent';
import { ApiKeysTabContent } from '@/components/apps/ApiKeysTabContent';
import { OverviewTabContent } from '@/components/apps/OverviewTabContent';
import { AppFormDialog } from '@/components/apps/AppFormDialog';
import type { AppConfig } from '@/types/claims';

interface AppDetailClientProps {
  app: AppConfig;
}

export function AppDetailClient({ app }: AppDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleAppUpdated = () => {
    // Refresh the page to get updated app data
    router.refresh();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {app.color && (
            <div
              className="h-14 w-14 rounded-xl shadow-sm flex-shrink-0"
              style={{ backgroundColor: app.color }}
            />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
              {app.enabled ? (
                <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {app.description && (
              <p className="text-muted-foreground max-w-2xl">{app.description}</p>
            )}
          </div>
        </div>

        <Button variant="outline" onClick={() => setIsEditOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Edit App
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTabContent app={app} onTabChange={setActiveTab} />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTabContent appId={app.id} />
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardContent className="pt-6">
              <ApiKeysTabContent appId={app.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit App Dialog */}
      <AppFormDialog
        app={app}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleAppUpdated}
      />
    </>
  );
}
