'use client';

import type { AppConfig } from '@/types/claims';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Settings } from 'lucide-react';
import Link from 'next/link';

interface AppCardDisplayProps {
  app: AppConfig;
  onEdit: () => void;
  onDelete: () => void;
}

export function AppCardDisplay({ app, onEdit, onDelete }: AppCardDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {app.color && (
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: app.color }}
              />
            )}
            <CardTitle className="text-lg">{app.name}</CardTitle>
          </div>
          <Badge variant={app.enabled ? 'default' : 'secondary'}>
            {app.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">App ID</p>
          <code className="text-sm rounded bg-muted px-2 py-1">{app.id}</code>
        </div>

        {app.description && (
          <div>
            <p className="text-sm text-muted-foreground">{app.description}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <Link href={`/apps/${app.id}/roles`}>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Roles
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
