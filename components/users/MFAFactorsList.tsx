'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Smartphone, Key, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { deleteMFAFactorAdmin } from '@/app/actions/users';
import { unenrollMFAFactor } from '@/app/actions/account';
import { useRouter } from 'next/navigation';
import { useStepUp } from '@/components/auth/StepUpProvider';
import { formatDistanceToNow } from 'date-fns';
import type { MFAFactor } from '@/types/claims';

interface MFAFactorsListProps {
  factors: MFAFactor[];
  userId?: string; // If provided, admin mode. Otherwise, self-service mode.
  onFactorDeleted?: () => void;
}

export function MFAFactorsList({
  factors,
  userId,
  onFactorDeleted,
}: MFAFactorsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();
  const { withStepUp } = useStepUp();

  const isAdminMode = !!userId;

  const handleDelete = async (factorId: string) => {
    setDeletingId(factorId);

    try {
      const result = await withStepUp(
        () =>
          isAdminMode
            ? deleteMFAFactorAdmin(userId, factorId)
            : unenrollMFAFactor(factorId),
        isAdminMode
          ? 'Confirm to remove this user’s MFA factor'
          : 'Confirm to remove your MFA factor',
      );

      if (result.success) {
        toast.success('MFA factor removed');
        router.refresh();
        onFactorDeleted?.();
      } else {
        toast.error(result.error || 'Failed to remove factor');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to remove factor');
    } finally {
      setDeletingId(null);
    }
  };

  const getFactorIcon = (type: string) => {
    switch (type) {
      case 'totp':
        return <Key className="h-4 w-4" />;
      case 'phone':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <ShieldCheck className="h-4 w-4" />;
    }
  };

  const getFactorLabel = (type: string) => {
    switch (type) {
      case 'totp':
        return 'Authenticator App';
      case 'phone':
        return 'SMS';
      default:
        return type;
    }
  };

  if (factors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No MFA factors enrolled
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isAdminMode
            ? 'This user has not set up multi-factor authentication.'
            : 'Add an authenticator app for extra security.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {factors.map((factor) => (
        <div
          key={factor.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              {getFactorIcon(factor.factor_type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {factor.friendly_name || getFactorLabel(factor.factor_type)}
                </span>
                <Badge
                  variant={factor.status === 'verified' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {factor.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {getFactorLabel(factor.factor_type)} · Added{' '}
                {formatDistanceToNow(new Date(factor.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={deletingId === factor.id}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove MFA Factor</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this {getFactorLabel(factor.factor_type).toLowerCase()} factor?
                  {!isAdminMode && (
                    <span className="block mt-2 text-destructive">
                      This will reduce the security of your account.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(factor.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingId === factor.id ? 'Removing...' : 'Remove'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}


