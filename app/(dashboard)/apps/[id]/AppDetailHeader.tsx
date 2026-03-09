'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeaderActions } from '@/components/layout/PageHeader';
import { Settings } from 'lucide-react';
import { AppFormDialog } from '@/components/apps/AppFormDialog';
import type { AppConfig } from '@/types/claims';

interface AppDetailHeaderProps {
  app: AppConfig;
}

export function AppDetailHeader({ app }: AppDetailHeaderProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleAppUpdated = () => {
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          {app.color && (
            <div
              className="h-12 w-12 rounded-xl shadow-sm shrink-0 sm:h-14 sm:w-14"
              style={{ backgroundColor: app.color }}
            />
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{app.name}</h1>
              {app.enabled ? (
                <Badge className="bg-green-600 hover:bg-green-600">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {app.description && (
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                {app.description}
              </p>
            )}
          </div>
        </div>

        <PageHeaderActions className="lg:w-auto lg:flex-nowrap">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Edit App
          </Button>
        </PageHeaderActions>
      </div>

      <AppFormDialog
        app={app}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleAppUpdated}
      />
    </>
  );
}
