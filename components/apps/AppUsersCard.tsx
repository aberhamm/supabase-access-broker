'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { UserPlus, Plus, Loader2 } from 'lucide-react';
import { AppRoleSelector } from './AppRoleSelector';
import { CreateUserWizard } from '@/components/users/CreateUserWizard';
import {
  getAppUsersAction,
  grantAppAccessByEmailAction,
  searchUsersAction,
} from '@/app/actions/app-users';
import type { UserSuggestion } from '@/app/actions/app-users';
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
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setSelectedIndex(-1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const result = await searchUsersAction(value);
      if (result.data.length > 0) {
        setSuggestions(result.data);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250);
  };

  const selectSuggestion = (suggestion: UserSuggestion) => {
    setEmail(suggestion.email);
    setShowSuggestions(false);
    setSuggestions([]);
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
      setSuggestions([]);
      setShowSuggestions(false);
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
            <div className="flex items-center gap-2">
              <CreateUserWizard
                preselectedAppId={appId}
                onComplete={fetchUsers}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1 h-4 w-4" />
                    Create New
                  </Button>
                }
              />
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <UserPlus className="mr-1 h-4 w-4" />
                Add Existing
              </Button>
            </div>
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
              <div className="relative">
                <Input
                  placeholder="Search by email or name..."
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (showSuggestions && suggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedIndex((i) =>
                          i < suggestions.length - 1 ? i + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedIndex((i) =>
                          i > 0 ? i - 1 : suggestions.length - 1
                        );
                      } else if (e.key === 'Enter' && selectedIndex >= 0) {
                        e.preventDefault();
                        selectSuggestion(suggestions[selectedIndex]);
                      } else if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      } else if (e.key === 'Enter') {
                        handleAddUser();
                      }
                    } else if (e.key === 'Enter') {
                      handleAddUser();
                    }
                  }}
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={s.user_id}
                        type="button"
                        className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent ${
                          i === selectedIndex ? 'bg-accent' : ''
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(s);
                        }}
                      >
                        <span className="truncate font-medium">
                          {s.email}
                        </span>
                        {s.display_name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {s.display_name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
