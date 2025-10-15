'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { APPS } from '@/lib/apps-config';
import { Badge } from '@/components/ui/badge';

interface AppSelectorProps {
  selectedAppId: string | null;
  onAppChange: (appId: string | null) => void;
  showAllOption?: boolean;
  isGlobalAdmin?: boolean;
}

export function AppSelector({
  selectedAppId,
  onAppChange,
  showAllOption = true,
  isGlobalAdmin = false,
}: AppSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Filter by App:</span>
      <Select
        value={selectedAppId || 'all'}
        onValueChange={(value) => onAppChange(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select an app" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && isGlobalAdmin && (
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                All Apps
                <Badge variant="outline" className="text-xs">
                  Global
                </Badge>
              </div>
            </SelectItem>
          )}
          {APPS.map((app) => (
            <SelectItem key={app.id} value={app.id}>
              <div className="flex items-center gap-2">
                {app.color && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: app.color }}
                  />
                )}
                {app.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
