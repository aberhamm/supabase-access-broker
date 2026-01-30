'use client';

import { useState } from 'react';
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
import { Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { ClaimBadge } from '../claims/ClaimBadge';
import { getAppById } from '@/lib/apps-config';
import { ClaimEditor } from '../claims/ClaimEditor';
import { DeleteClaimDialog } from '../claims/DeleteClaimDialog';
import { setAppClaimAction, deleteAppClaimAction } from '@/app/actions/claims';
import { AppClaim, isAppAdmin } from '@/types/claims';

interface AppClaimsListProps {
  userId: string;
  apps: Record<string, Record<string, unknown>>;
}

export function AppClaimsList({ userId, apps }: AppClaimsListProps) {
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [editingClaim, setEditingClaim] = useState<{
    appId: string;
    key: string;
    value: unknown;
  } | null>(null);
  const [deletingClaim, setDeletingClaim] = useState<{
    appId: string;
    key: string;
  } | null>(null);

  const toggleApp = (appId: string) => {
    const newExpanded = new Set(expandedApps);
    if (newExpanded.has(appId)) {
      newExpanded.delete(appId);
    } else {
      newExpanded.add(appId);
    }
    setExpandedApps(newExpanded);
  };

  const getClaimEntries = (appData: Record<string, unknown>) => {
    if (!appData || typeof appData !== 'object') return [];

    // Filter out reserved/system app claims
    return Object.entries(appData).filter(
      ([key]) => !['enabled', 'role', 'permissions'].includes(key)
    );
  };

  if (!apps || Object.keys(apps).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No app-specific claims set for this user</p>
        <p className="text-xs mt-2">
          Use the App Access card to grant access to applications
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {Object.entries(apps).map(([appId, appData]) => {
          const app = getAppById(appId);
          const isExpanded = expandedApps.has(appId);
          const claimEntries = getClaimEntries(appData);
          const hasCustomClaims = claimEntries.length > 0;

          return (
            <div key={appId} className="rounded-lg border">
              <button
                onClick={() => toggleApp(appId)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {app?.color && (
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: app.color }}
                    />
                  )}
                  <span className="font-medium">
                    {app?.name || appId}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {hasCustomClaims ? `${claimEntries.length} custom claim${claimEntries.length !== 1 ? 's' : ''}` : 'No custom claims'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {appData.enabled === true && (
                    <Badge variant="secondary">Enabled</Badge>
                  )}
                  {typeof appData.role === 'string' && appData.role && (
                    <Badge variant="outline">{appData.role}</Badge>
                  )}
                  {isAppAdmin(appData as AppClaim) && (
                    <Badge variant="default">Admin</Badge>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t p-4">
                  {hasCustomClaims ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claim Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claimEntries.map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-mono font-medium">
                              {key}
                            </TableCell>
                            <TableCell>
                              <ClaimBadge value={value} />
                            </TableCell>
                            <TableCell>
                              <div className="max-w-md truncate font-mono text-sm">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditingClaim({ appId, key, value })
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setDeletingClaim({ appId, key })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No custom claims for this app
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* App-specific claim editor */}
      {editingClaim && (
        <ClaimEditor
          userId={userId}
          claimKey={editingClaim.key}
          claimValue={editingClaim.value}
          open={!!editingClaim}
          onOpenChange={(open) => !open && setEditingClaim(null)}
          appId={editingClaim.appId}
          customAction={async (uid, claim, value) => {
            return await setAppClaimAction(
              uid,
              editingClaim.appId,
              claim,
              value
            );
          }}
        />
      )}

      {/* App-specific claim deletion */}
      {deletingClaim && (
        <DeleteClaimDialog
          userId={userId}
          claimKey={deletingClaim.key}
          open={!!deletingClaim}
          onOpenChange={(open) => !open && setDeletingClaim(null)}
          appId={deletingClaim.appId}
          customAction={async (uid, claim) => {
            return await deleteAppClaimAction(uid, deletingClaim.appId, claim);
          }}
        />
      )}
    </>
  );
}
