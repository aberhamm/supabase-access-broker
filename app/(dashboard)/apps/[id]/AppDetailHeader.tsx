'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {app.color && (
            <div
              className="h-14 w-14 rounded-xl shadow-sm shrink-0"
              style={{ backgroundColor: app.color }}
            />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
              {app.enabled ? (
                <Badge className="bg-green-600 hover:bg-green-600">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {app.description && (
              <p className="text-muted-foreground max-w-2xl">
                {app.description}
              </p>
            )}
          </div>
        </div>

        <Button variant="outline" onClick={() => setIsEditOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Edit App
        </Button>
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
