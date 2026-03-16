'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';
import { AppRoleSelector } from './AppRoleSelector';
import {
  getAppUsersAction,
  grantAppAccessByEmailAction,
} from '@/app/actions/app-users';
import {
  toggleAppAccessAction,
  setAppRoleAction,
} from '@/app/actions/claims';
import type { AppUser } from '@/types/claims';

interface AppUsersCardProps {
  appId: string;
}

export function AppUsersCard({ appId }: AppUsersCardProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [addLoading, setAddLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    const result = await getAppUsersAction(appId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setUsers(result.data || []);
    }
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRevoke = async (userId: string) => {
    setActionLoading(userId);
    const result = await toggleAppAccessAction(userId, appId, false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Access revoked');
      await fetchUsers();
    }
    setActionLoading(null);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    const result = await setAppRoleAction(userId, appId, newRole);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Role updated');
      await fetchUsers();
    }
    setActionLoading(null);
  };

  const handleAddUser = async () => {
    if (!email.trim()) return;
    setAddLoading(true);
    const result = await grantAppAccessByEmailAction(appId, email.trim(), role);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('User added');
      setDialogOpen(false);
      setEmail('');
      setRole('user');
      await fetchUsers();
    }
    setAddLoading(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Users</CardTitle>
              {!loading && (
                <Badge variant="secondary" className="text-xs">
                  {users.length}
                </Badge>
              )}
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <UserPlus className="mr-1 h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No users have access to this app yet.
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.user_id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{user.user_email}</p>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <AppRoleSelector
                    currentRole={user.app_data?.role || 'user'}
                    onRoleChange={(newRole) =>
                      handleRoleChange(user.user_id, newRole)
                    }
                    disabled={actionLoading === user.user_id}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(user.user_id)}
                    disabled={actionLoading === user.user_id}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddUser();
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <AppRoleSelector
                currentRole={role}
                onRoleChange={setRole}
                disabled={addLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={addLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={addLoading || !email.trim()}>
              {addLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
