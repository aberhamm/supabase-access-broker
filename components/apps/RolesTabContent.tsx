'use client';

import { useEffect, useState, useCallback } from 'react';
import { RoleConfig } from '@/types/claims';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { RolesManagementList } from '@/components/roles/RolesManagementList';
import { RoleFormDialog } from '@/components/roles/RoleFormDialog';

interface RolesTabContentProps {
  appId: string;
}

export function RolesTabContent({ appId }: RolesTabContentProps) {
  const [roles, setRoles] = useState<RoleConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showGlobalRoles, setShowGlobalRoles] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      const response = await fetch(`/api/apps/${appId}/roles`);
      if (!response.ok) throw new Error('Failed to load roles');
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Failed to load roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleRolesChanged = useCallback(() => {
    loadRoles();
  }, [loadRoles]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!roles) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Failed to load roles</p>
        <Button variant="outline" className="mt-4" onClick={loadRoles}>
          Retry
        </Button>
      </div>
    );
  }

  const globalRoles = roles.filter((role) => role.is_global);
  const appRoles = roles.filter((role) => !role.is_global && role.app_id === appId);

  return (
    <div className="space-y-6">
      {/* App-Specific Roles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">App-Specific Roles</h3>
            <Badge variant="secondary">{appRoles.length}</Badge>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        </div>

        {appRoles.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <RolesManagementList
                roles={appRoles}
                appId={appId}
                onRolesChanged={handleRolesChanged}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">No app-specific roles yet</p>
                <p className="text-sm mt-1">
                  Create roles tailored to this application's needs
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Role
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Global Roles Section (Collapsible) */}
      {globalRoles.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowGlobalRoles(!showGlobalRoles)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showGlobalRoles ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Shield className="h-4 w-4" />
            Global Roles ({globalRoles.length})
            <span className="text-xs font-normal">
              — Available across all applications
            </span>
          </button>

          {showGlobalRoles && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline">Read-only</Badge>
                  <span className="text-muted-foreground font-normal">
                    Global roles cannot be edited from here
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RolesManagementList
                  roles={globalRoles}
                  appId={appId}
                  isReadOnly
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Role Dialog */}
      <RoleFormDialog
        appId={appId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleRolesChanged}
      />
    </div>
  );
}
