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
import { ClaimBadge } from './ClaimBadge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { ClaimEditor } from './ClaimEditor';
import { DeleteClaimDialog } from './DeleteClaimDialog';

interface ClaimsListProps {
  claims: Record<string, unknown>;
  userId: string;
}

export function ClaimsList({ claims, userId }: ClaimsListProps) {
  const [editingClaim, setEditingClaim] = useState<{
    key: string;
    value: unknown;
  } | null>(null);
  const [deletingClaim, setDeletingClaim] = useState<string | null>(null);

  // Filter out system claims (provider, providers)
  const claimEntries = claims
    ? Object.entries(claims).filter(
        ([key]) => key !== 'provider' && key !== 'providers'
      )
    : [];

  if (claimEntries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No custom claims set for this user</p>
        <p className="text-xs mt-2">
          System claims like &ldquo;provider&rdquo; are hidden
        </p>
      </div>
    );
  }

  return (
    <>
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
              <TableCell className="font-mono font-medium">{key}</TableCell>
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
                    onClick={() => setEditingClaim({ key, value })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingClaim(key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingClaim && (
        <ClaimEditor
          userId={userId}
          claimKey={editingClaim.key}
          claimValue={editingClaim.value}
          open={!!editingClaim}
          onOpenChange={(open) => !open && setEditingClaim(null)}
        />
      )}

      {deletingClaim && (
        <DeleteClaimDialog
          userId={userId}
          claimKey={deletingClaim}
          open={!!deletingClaim}
          onOpenChange={(open) => !open && setDeletingClaim(null)}
        />
      )}
    </>
  );
}
