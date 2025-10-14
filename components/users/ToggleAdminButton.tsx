'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, ShieldOff } from 'lucide-react';
import { toggleClaimsAdminAction } from '@/app/actions/claims';
import { toast } from 'sonner';

interface ToggleAdminButtonProps {
  userId: string;
  isAdmin: boolean;
}

export function ToggleAdminButton({ userId, isAdmin }: ToggleAdminButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);

    try {
      const result = await toggleClaimsAdminAction(userId, !isAdmin);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isAdmin
            ? 'Claims admin access removed'
            : 'User promoted to claims admin'
        );
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to update admin status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isAdmin ? 'destructive' : 'default'}
      className="w-full"
      onClick={handleToggle}
      disabled={loading}
    >
      {isAdmin ? (
        <>
          <ShieldOff className="mr-2 h-4 w-4" />
          {loading ? 'Removing...' : 'Remove Claims Admin'}
        </>
      ) : (
        <>
          <Shield className="mr-2 h-4 w-4" />
          {loading ? 'Adding...' : 'Make Claims Admin'}
        </>
      )}
    </Button>
  );
}
