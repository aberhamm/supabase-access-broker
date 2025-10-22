'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { AppConfig } from '@/types/claims';
import { AppCardDisplay } from './AppCardDisplay';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load dialog components for better performance
const AppFormDialog = dynamic(() => import('./AppFormDialog').then(mod => ({ default: mod.AppFormDialog })), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false
});

const DeleteAppConfirmDialog = dynamic(() => import('./DeleteAppConfirmDialog').then(mod => ({ default: mod.DeleteAppConfirmDialog })), {
  loading: () => <Skeleton className="h-32 w-full" />,
  ssr: false
});

interface AppManagementGridProps {
  apps: AppConfig[];
}

export function AppManagementGrid({ apps }: AppManagementGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingApp, setEditingApp] = useState<AppConfig | null>(null);
  const [deletingApp, setDeletingApp] = useState<AppConfig | null>(null);

  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (apps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No apps configured yet. Click &quot;Create App&quot; to get started.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Currently using fallback configuration from apps-config.ts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search apps..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredApps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No apps match your search
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => (
            <AppCardDisplay
              key={app.id}
              app={app}
              onEdit={() => setEditingApp(app)}
              onDelete={() => setDeletingApp(app)}
            />
          ))}
        </div>
      )}

      {editingApp && (
        <AppFormDialog
          app={editingApp}
          open={!!editingApp}
          onOpenChange={(open) => !open && setEditingApp(null)}
        />
      )}

      {deletingApp && (
        <DeleteAppConfirmDialog
          app={deletingApp}
          open={!!deletingApp}
          onOpenChange={(open) => !open && setDeletingApp(null)}
        />
      )}
    </div>
  );
}
