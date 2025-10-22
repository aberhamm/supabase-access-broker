'use client';

import { useEffect, useState } from 'react';
import { RoleConfig } from '@/types/claims';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface RolesTabContentProps {
  appId: string;
}

export function RolesTabContent({ appId }: RolesTabContentProps) {
  const [roles, setRoles] = useState<RoleConfig[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoles() {
      try {
        const response = await fetch(`/api/apps/${appId}/roles`);
        if (!response.ok) throw new Error('Failed to load roles');
        const data = await response.json();
        setRoles(data);
      } catch (error) {
        console.error('Failed to load roles:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRoles();
  }, [appId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!roles) {
    return <div>Failed to load roles</div>;
  }

  const globalRoles = roles.filter((role) => role.is_global);
  const appRoles = roles.filter((role) => !role.is_global && role.app_id === appId);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">App-Specific Roles</h4>
        {appRoles.length > 0 ? (
          <div className="space-y-2">
            {appRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{role.label}</p>
                  {role.description && (
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No app-specific roles yet
          </p>
        )}
      </div>
      <div>
        <h4 className="font-medium mb-2">
          Global Roles ({globalRoles.length})
        </h4>
        <p className="text-sm text-muted-foreground">
          Available across all applications
        </p>
      </div>
      <div className="pt-4">
        <Link href={`/apps/${appId}/roles`}>
          <Button>Manage All Roles</Button>
        </Link>
      </div>
    </div>
  );
}
