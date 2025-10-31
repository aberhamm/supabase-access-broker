import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types/claims';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface UserActivityListProps {
  users: User[];
}

export function UserActivityList({ users }: UserActivityListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            users.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.last_sign_in_at
                      ? `Last sign in ${formatDistanceToNow(
                          new Date(user.last_sign_in_at),
                          { addSuffix: true }
                        )}`
                      : 'Never signed in'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user.app_metadata?.claims_admin === true && (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
