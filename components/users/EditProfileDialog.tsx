'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { updateUserProfileAdmin } from '@/app/actions/users';
import { updateOwnProfile } from '@/app/actions/account';
import { useRouter } from 'next/navigation';

interface EditProfileDialogProps {
  // For admin mode, provide userId. For self-service, omit it.
  userId?: string;
  currentEmail: string;
  currentPhone?: string;
  currentDisplayName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
}

export function EditProfileDialog({
  userId,
  currentEmail,
  currentPhone,
  currentDisplayName,
  variant = 'outline',
  size = 'sm',
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone || '');
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const router = useRouter();

  const isAdminMode = !!userId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        email: email !== currentEmail ? email : undefined,
        phone: phone !== (currentPhone || '') ? phone : undefined,
        display_name: displayName !== (currentDisplayName || '') ? displayName : undefined,
      };

      // Only submit if there are changes
      if (!data.email && data.phone === undefined && data.display_name === undefined) {
        toast.info('No changes to save');
        setOpen(false);
        return;
      }

      let result;
      if (isAdminMode) {
        result = await updateUserProfileAdmin(userId, data);
      } else {
        result = await updateOwnProfile(data);
      }

      if (result.success) {
        toast.success('Profile updated successfully');
        if (data.email) {
          toast.info('Email change may require verification');
        }
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset to current values when opening
      setEmail(currentEmail);
      setPhone(currentPhone || '');
      setDisplayName(currentDisplayName || '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            {isAdminMode
              ? 'Update this user\'s profile information.'
              : 'Update your profile information.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="user@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Changing email may require verification.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              placeholder="+1234567890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              placeholder="John Doe"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
