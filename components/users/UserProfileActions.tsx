'use client';

import { Button } from '@/components/ui/button';
import { PageHeaderActions } from '@/components/layout/PageHeader';
import { Edit, Trash2, KeyRound } from 'lucide-react';

interface UserProfileActionsProps {
  userId: string;
}

export function UserProfileActions({ userId }: UserProfileActionsProps) {
  // These would be wired up to actual actions
  const handleEdit = () => {
    // TODO: Open edit dialog
    console.log('Edit user:', userId);
  };

  const handleResetPassword = () => {
    // TODO: Trigger password reset
    console.log('Reset password for:', userId);
  };

  const handleDelete = () => {
    // TODO: Open delete confirmation
    console.log('Delete user:', userId);
  };

  return (
    <PageHeaderActions className="lg:w-auto lg:flex-nowrap">
      <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
        <Edit className="h-4 w-4" />
        Edit
      </Button>
      <Button variant="outline" size="sm" onClick={handleResetPassword} className="gap-2">
        <KeyRound className="h-4 w-4" />
        Reset Password
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        className="gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    </PageHeaderActions>
  );
}
