'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { createUserWithPassword, inviteUserWithEmail } from '@/app/actions/users';
import { useRouter } from 'next/navigation';

interface CreateUserDialogProps {
  onUserCreated?: () => void;
}

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Password creation form
  const [passwordEmail, setPasswordEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordIsAdmin, setPasswordIsAdmin] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);

  const resetForms = () => {
    setPasswordEmail('');
    setPassword('');
    setPasswordIsAdmin(false);
    setInviteEmail('');
    setInviteIsAdmin(false);
  };

  const handleCreateWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordEmail || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await createUserWithPassword({
      email: passwordEmail,
      password: password,
      isClaimsAdmin: passwordIsAdmin,
    });

    setLoading(false);

    if (result.success) {
      toast.success(`User ${passwordEmail} created successfully!`);
      resetForms();
      setOpen(false);
      router.refresh();
      onUserCreated?.();
    } else {
      toast.error(result.error || 'Failed to create user');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);

    const result = await inviteUserWithEmail({
      email: inviteEmail,
      isClaimsAdmin: inviteIsAdmin,
    });

    setLoading(false);

    if (result.success) {
      toast.success(`Invitation sent to ${inviteEmail}!`);
      resetForms();
      setOpen(false);
      router.refresh();
      onUserCreated?.();
    } else {
      toast.error(result.error || 'Failed to send invitation');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Create a new user account with a password or send them an invitation email.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">With Password</TabsTrigger>
            <TabsTrigger value="invite">Send Invite</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form onSubmit={handleCreateWithPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password-email">Email</Label>
                <Input
                  id="password-email"
                  type="email"
                  placeholder="user@example.com"
                  value={passwordEmail}
                  onChange={(e) => setPasswordEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="password-admin">Claims Admin</Label>
                  <p className="text-xs text-muted-foreground">
                    Grant full admin access to this user
                  </p>
                </div>
                <Switch
                  id="password-admin"
                  checked={passwordIsAdmin}
                  onCheckedChange={setPasswordIsAdmin}
                  disabled={loading}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="invite">
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={loading}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  User will receive an email with a link to set their password
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="invite-admin">Claims Admin</Label>
                  <p className="text-xs text-muted-foreground">
                    Grant full admin access to this user
                  </p>
                </div>
                <Switch
                  id="invite-admin"
                  checked={inviteIsAdmin}
                  onCheckedChange={setInviteIsAdmin}
                  disabled={loading}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
