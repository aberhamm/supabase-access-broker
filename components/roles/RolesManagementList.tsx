'use client';

import { useState } from 'react';
import type { RoleConfig } from '@/types/claims';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Shield } from 'lucide-react';
import { RoleFormDialog } from './RoleFormDialog';
import { DeleteRoleDialog } from './DeleteRoleDialog';

interface RolesManagementListProps {
  roles: RoleConfig[];
  appId: string;
  isReadOnly?: boolean;
}

export function RolesManagementList({
  roles,
  appId,
  isReadOnly = false,
}: RolesManagementListProps) {
  const [editingRole, setEditingRole] = useState<RoleConfig | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleConfig | null>(null);

  if (roles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No roles found</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Permissions</TableHead>
            {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-mono font-medium">
                {role.name}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {role.label}
                  {role.is_global && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="mr-1 h-3 w-3" />
                      Global
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-md">
                <span className="text-sm text-muted-foreground">
                  {role.description || 'No description'}
                </span>
              </TableCell>
              <TableCell>
                {role.permissions && role.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 3).map((perm) => (
                      <Badge key={perm} variant="secondary" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                    {role.permissions.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{role.permissions.length - 3} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </TableCell>
              {!isReadOnly && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRole(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingRole(role)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingRole && !isReadOnly && (
        <RoleFormDialog
          role={editingRole}
          appId={appId}
          open={!!editingRole}
          onOpenChange={(open) => !open && setEditingRole(null)}
        />
      )}

      {deletingRole && !isReadOnly && (
        <DeleteRoleDialog
          role={deletingRole}
          open={!!deletingRole}
          onOpenChange={(open) => !open && setDeletingRole(null)}
        />
      )}
    </>
  );
}
