'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ClaimEditor } from './ClaimEditor';

interface AddClaimButtonProps {
  userId: string;
}

export function AddClaimButton({ userId }: AddClaimButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Claim
      </Button>
      <ClaimEditor userId={userId} open={open} onOpenChange={setOpen} />
    </>
  );
}
