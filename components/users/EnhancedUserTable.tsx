'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { getUserCustomClaimsCount, User } from '@/types/claims';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  Eye,
  Search,
  Filter,
  LayoutGrid,
  LayoutList,
  Table as TableIcon,
  ShieldCheck,
  Activity,
  Clock,
  Copy,
  Check,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EnhancedUserTableProps {
  users: User[];
}

type ViewMode = 'table' | 'grid' | 'compact';
type RoleFilter = 'all' | 'admin' | 'user';
type ActivityFilter = 'all' | 'active' | 'inactive';

export function EnhancedUserTable({ users }: EnhancedUserTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [hasManualViewMode, setHasManualViewMode] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Focus search on "/"
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById('user-search')?.focus();
      }
      // Clear search on Escape
      if (e.key === 'Escape') {
        setSearchTerm('');
        setRoleFilter('all');
        setActivityFilter('all');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewMode = () => {
      if (hasManualViewMode) return;
      setViewMode(mediaQuery.matches ? 'compact' : 'table');
    };

    syncViewMode();
    mediaQuery.addEventListener('change', syncViewMode);

    return () => mediaQuery.removeEventListener('change', syncViewMode);
  }, [hasManualViewMode]);

  const getClaimsCount = useCallback((user: User) => {
    return getUserCustomClaimsCount(user.app_metadata);
  }, []);

  const isUserActive = useCallback((user: User) => {
    if (!user.last_sign_in_at) return false;
    const daysSinceSignIn = Math.floor(
      (Date.now() - new Date(user.last_sign_in_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceSignIn <= 7;
  }, []);

  const filteredUsers = useMemo(() => {
    let result = users;

    // Text search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(
        (user) =>
          user.email.toLowerCase().includes(lowerSearch) ||
          user.id.toLowerCase().includes(lowerSearch)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((user) => {
        const isAdmin = user.app_metadata?.claims_admin === true;
        return roleFilter === 'admin' ? isAdmin : !isAdmin;
      });
    }

    // Activity filter
    if (activityFilter !== 'all') {
      result = result.filter((user) => {
        const active = isUserActive(user);
        return activityFilter === 'active' ? active : !active;
      });
    }

    return result;
  }, [users, searchTerm, roleFilter, activityFilter, isUserActive]);

  const copyToClipboard = async (text: string, userId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasActiveFilters = roleFilter !== 'all' || activityFilter !== 'all' || searchTerm !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setActivityFilter('all');
  };

  if (viewMode === 'grid') {
    return (
      <div className="space-y-4" data-view-mode={viewMode}>
        <ViewControls
          viewMode={viewMode}
          setViewMode={setViewMode}
          setHasManualViewMode={setHasManualViewMode}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          activityFilter={activityFilter}
          setActivityFilter={setActivityFilter}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          resultCount={filteredUsers.length}
          totalCount={users.length}
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || hasActiveFilters ? 'No users found' : 'No users registered'}
              </p>
            </div>
          ) : (
            filteredUsers.map((user, index) => (
              <UserCard
                key={user.id}
                user={user}
                index={index}
                getClaimsCount={getClaimsCount}
                isUserActive={isUserActive}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="space-y-4" data-view-mode={viewMode}>
        <ViewControls
          viewMode={viewMode}
          setViewMode={setViewMode}
          setHasManualViewMode={setHasManualViewMode}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          activityFilter={activityFilter}
          setActivityFilter={setActivityFilter}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          resultCount={filteredUsers.length}
          totalCount={users.length}
        />

        <div className="space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || hasActiveFilters ? 'No users found' : 'No users registered'}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <CompactUserRow
                key={user.id}
                user={user}
                getClaimsCount={getClaimsCount}
                isUserActive={isUserActive}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-view-mode={viewMode}>
      <ViewControls
        viewMode={viewMode}
        setViewMode={setViewMode}
        setHasManualViewMode={setHasManualViewMode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        activityFilter={activityFilter}
        setActivityFilter={setActivityFilter}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        resultCount={filteredUsers.length}
        totalCount={users.length}
      />

      <div className="rounded-md border overflow-x-auto">
        <Table className="data-table min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Claims</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  {searchTerm || hasActiveFilters ? 'No users found' : 'No users registered'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isAdmin = user.app_metadata?.claims_admin === true;
                const claimsCount = getClaimsCount(user);
                const active = isUserActive(user);

                return (
                  <TableRow key={user.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0 ring-1 ring-primary/20">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.email}</span>
                          {isAdmin && (
                            <span className="flex items-center gap-1 text-xs text-warning mt-0.5">
                              <ShieldCheck className="h-3 w-3" />
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => copyToClipboard(user.id, user.id)}
                        className="flex items-center gap-2 group/copy"
                      >
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                          {user.id.substring(0, 8)}...
                        </code>
                        {copiedId === user.id ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {claimsCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${active ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`}
                        />
                        <span className="text-sm text-muted-foreground">
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.last_sign_in_at ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(user.last_sign_in_at), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/users/${user.id}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ViewControls({
  viewMode,
  setViewMode,
  setHasManualViewMode,
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  activityFilter,
  setActivityFilter,
  hasActiveFilters,
  clearFilters,
  resultCount,
  totalCount,
}: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setHasManualViewMode: (value: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  roleFilter: RoleFilter;
  setRoleFilter: (filter: RoleFilter) => void;
  activityFilter: ActivityFilter;
  setActivityFilter: (filter: ActivityFilter) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="user-search"
            type="text"
            placeholder="Search by email or ID... (Press / to focus)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 max-sm:flex-1">
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 flex h-5 w-5 items-center justify-center rounded-full p-0">
                    !
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Role</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={roleFilter === 'all'}
                onCheckedChange={() => setRoleFilter('all')}
              >
                All Users
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={roleFilter === 'admin'}
                onCheckedChange={() => setRoleFilter('admin')}
              >
                Admins Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={roleFilter === 'user'}
                onCheckedChange={() => setRoleFilter('user')}
              >
                Standard Users
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              <DropdownMenuLabel>Activity</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={activityFilter === 'all'}
                onCheckedChange={() => setActivityFilter('all')}
              >
                All
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activityFilter === 'active'}
                onCheckedChange={() => setActivityFilter('active')}
              >
                Active (7 days)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activityFilter === 'inactive'}
                onCheckedChange={() => setActivityFilter('inactive')}
              >
                Inactive
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2 max-sm:flex-1"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}

          <div className="flex items-center gap-1 rounded-lg border p-1 max-sm:w-full">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setHasManualViewMode(true);
                setViewMode('table');
              }}
              className="h-8 w-8 p-0 max-sm:flex-1"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setHasManualViewMode(true);
                setViewMode('grid');
              }}
              className="h-8 w-8 p-0 max-sm:flex-1"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setHasManualViewMode(true);
                setViewMode('compact');
              }}
              className="h-8 w-8 p-0 max-sm:flex-1"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {(searchTerm || hasActiveFilters) && (
        <div className="text-sm text-muted-foreground">
          {resultCount} of {totalCount} users
        </div>
      )}
    </div>
  );
}

function UserCard({
  user,
  index,
  getClaimsCount,
  isUserActive,
}: {
  user: User;
  index: number;
  getClaimsCount: (user: User) => number;
  isUserActive: (user: User) => boolean;
}) {
  const isAdmin = user.app_metadata?.claims_admin === true;
  const claimsCount = getClaimsCount(user);
  const active = isUserActive(user);

  return (
    <Link href={`/users/${user.id}`}>
      <div
        className="group relative overflow-hidden rounded-lg border p-6 card-hover animate-reveal"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg shrink-0 ring-1 ring-primary/20">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {user.id.substring(0, 12)}...
                </p>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Badge variant="default" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <span className="font-mono">{claimsCount}</span>
              Claims
            </Badge>
            <Badge variant={active ? 'default' : 'outline'} className="gap-1">
              <Activity className="h-3 w-3" />
              {active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="pt-3 border-t text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {user.last_sign_in_at
              ? `Last seen ${formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}`
              : 'Never signed in'}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CompactUserRow({
  user,
  getClaimsCount,
  isUserActive,
}: {
  user: User;
  getClaimsCount: (user: User) => number;
  isUserActive: (user: User) => boolean;
}) {
  const isAdmin = user.app_metadata?.claims_admin === true;
  const claimsCount = getClaimsCount(user);
  const active = isUserActive(user);

  return (
    <Link href={`/users/${user.id}`}>
      <div className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`} />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
          {user.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{user.email}</span>
            {isAdmin && <ShieldCheck className="h-3 w-3 text-warning shrink-0" />}
          </div>
        </div>
        <Badge variant="outline" className="font-mono shrink-0 text-xs">
          {claimsCount}
        </Badge>
        <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
          {user.last_sign_in_at
            ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
            : 'Never'}
        </span>
      </div>
    </Link>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
