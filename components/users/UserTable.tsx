'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User } from '@/types/claims';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Eye, Search } from 'lucide-react';

interface UserTableProps {
  users: User[];
}

export function UserTable({ users }: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Memoize filtered users to avoid unnecessary recalculations
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter((user) =>
      user.email.toLowerCase().includes(lowerSearch)
    );
  }, [users, searchTerm]);

  // Memoize the claims count function
  const getClaimsCount = useCallback((user: User) => {
    if (!user.app_metadata) return 0;
    return Object.keys(user.app_metadata).filter(
      (key) => key !== 'provider' && key !== 'providers'
    ).length;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchTerm && (
          <span className="text-sm text-muted-foreground">
            {filteredUsers.length} of {users.length} users
          </span>
        )}
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Claims</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {searchTerm ? 'No users found' : 'No users registered'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.email}
                      {user.app_metadata?.claims_admin === true && (
                        <span className="badge-enhanced badge-admin">
                          Admin
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {user.id.substring(0, 8)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getClaimsCount(user)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_sign_in_at
                      ? formatDistanceToNow(new Date(user.last_sign_in_at), {
                          addSuffix: true,
                        })
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/users/${user.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
