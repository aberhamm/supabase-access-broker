'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { createUserWithPassword, inviteUserWithEmail } from '@/app/actions/users';

interface IdentityStepProps {
  onUserCreated: (userId: string, email: string) => void;
  onCancel: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export function IdentityStep({ onUserCreated, onCancel, loading, setLoading }: IdentityStepProps) {
  const [passwordEmail, setPasswordEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordIsAdmin, setPasswordIsAdmin] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);

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

    if (result.success && result.user) {
      toast.success(`User ${passwordEmail} created successfully!`);
      onUserCreated(result.user.id, passwordEmail);
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

    if (result.success && result.user) {
      toast.success(`Invitation sent to ${inviteEmail}!`);
      onUserCreated(result.user.id, inviteEmail);
    } else {
      toast.error(result.error || 'Failed to send invitation');
    }
  };

  return (
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
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create & Continue'}
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
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Invite & Continue'}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
