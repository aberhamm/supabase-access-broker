'use client';

import type { AppConfig } from '@/types/claims';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface AppCardDisplayProps {
  app: AppConfig;
  onEdit: () => void;
  onDelete: () => void;
}

export function AppCardDisplay({ app, onEdit, onDelete }: AppCardDisplayProps) {
  return (
    <Link href={`/apps/${app.id}`} className="block transition-transform hover:scale-[1.02]">
      <Card className="h-full cursor-pointer hover:shadow-lg transition-shadow">
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
              <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-primary">
              <span>View Details</span>
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); onEdit(); }}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
