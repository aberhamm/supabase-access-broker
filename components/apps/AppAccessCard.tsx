'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppClaim, AppConfig } from '@/types/claims';
import {
  toggleAppAccessAction,
  setAppRoleAction,
  toggleAppAdminAction,
} from '@/app/actions/claims';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { AppRoleSelector } from './AppRoleSelector';

interface AppAccessCardProps {
  userId: string;
  userApps: Record<string, AppClaim>;
  availableApps: AppConfig[];
  isGlobalAdmin?: boolean;
}

export function AppAccessCard({
  userId,
  userApps,
  availableApps,
  isGlobalAdmin = false,
}: AppAccessCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggleAccess = async (appId: string, currentEnabled: boolean) => {
    setLoading(appId);
    const result = await toggleAppAccessAction(userId, appId, !currentEnabled);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `App access ${!currentEnabled ? 'enabled' : 'disabled'} successfully`
      );
    }
    setLoading(null);
  };

  const handleRoleChange = async (appId: string, role: string) => {
    setLoading(appId);
    const result = await setAppRoleAction(userId, appId, role);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Role updated successfully');
    }
    setLoading(null);
  };

  const handleToggleAppAdmin = async (appId: string, currentAdmin: boolean) => {
    setLoading(appId);
    const result = await toggleAppAdminAction(userId, appId, !currentAdmin);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `App admin ${!currentAdmin ? 'granted' : 'revoked'} successfully`
      );
    }
    setLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableApps.map((app) => {
          const appData = userApps[app.id] || {};
          const isEnabled = appData.enabled === true;
          const role = appData.role || 'user';
          const isAppAdmin = appData.admin === true;

          return (
            <div
              key={app.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                {app.color && (
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: app.color }}
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{app.name}</p>
                    {isAppAdmin && (
                      <Badge variant="default" className="text-xs">
                        <Shield className="mr-1 h-3 w-3" />
                        App Admin
                      </Badge>
                    )}
                  </div>
                  {app.description && (
                    <p className="text-xs text-muted-foreground">
                      {app.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEnabled && (
                  <>
                    <AppRoleSelector
                      currentRole={role}
                      onRoleChange={(newRole) =>
                        handleRoleChange(app.id, newRole)
                      }
                      disabled={loading === app.id}
                    />
                    {isGlobalAdmin && (
                      <Button
                        variant={isAppAdmin ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          handleToggleAppAdmin(app.id, isAppAdmin)
                        }
                        disabled={loading === app.id}
                      >
                        <Shield className="mr-1 h-3 w-3" />
                        {isAppAdmin ? 'Admin' : 'Make Admin'}
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant={isEnabled ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => handleToggleAccess(app.id, isEnabled)}
                  disabled={loading === app.id}
                >
                  {isEnabled ? 'Revoke' : 'Grant'} Access
                </Button>
              </div>
            </div>
          );
        })}

        {availableApps.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No apps configured. Create apps in the Apps management page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
