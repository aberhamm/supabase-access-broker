'use client';

import { Button } from '@/components/ui/button';
import { PageHeaderActions } from '@/components/layout/PageHeader';
import { DeleteUserDialog } from './DeleteUserDialog';
import { Edit, KeyRound } from 'lucide-react';

interface UserProfileActionsProps {
  userId: string;
  userEmail: string;
}

export function UserProfileActions({ userId, userEmail }: UserProfileActionsProps) {
  const handleEdit = () => {
    console.log('Edit user:', userId);
  };

  const handleResetPassword = () => {
    console.log('Reset password for:', userId);
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
      <DeleteUserDialog userId={userId} userEmail={userEmail} />
    </PageHeaderActions>
  );
}
