import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserProfileActions } from './UserProfileActions';

interface UserProfileHeaderServerProps {
  userId: string;
  email: string;
  isAdmin: boolean;
  emailConfirmed: boolean;
  lastSignIn: string | null;
}

export function UserProfileHeaderServer({
  userId,
  email,
  isAdmin,
  emailConfirmed,
  lastSignIn,
}: UserProfileHeaderServerProps) {
  const isActive = lastSignIn
    ? Math.floor((Date.now() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60 * 24)) <= 7
    : false;

  return (
    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-background via-primary/3 to-background p-5 animate-reveal sm:p-8">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-vivid/5 rounded-full blur-3xl -z-10" />

      <div className="relative">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/users"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Users
          </Link>
          <span>/</span>
          <span className="max-w-full truncate font-medium text-foreground sm:max-w-xs">{email}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left: Avatar and Info */}
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Large Avatar */}
            <div className="relative group">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-background font-bold text-3xl shrink-0 ring-4 ring-primary/20 shadow-lg">
                {email.charAt(0).toUpperCase()}
              </div>
              {isActive && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full ring-4 ring-background flex items-center justify-center animate-pulse">
                  <Activity className="h-3 w-3 text-background" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 space-y-3">
              <div>
                <h1 className="mb-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">{email}</h1>
                <p className="break-all text-sm font-mono text-muted-foreground">
                  ID: {userId.substring(0, 16)}...
                </p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && (
                  <Badge variant="default" className="gap-1.5 px-3 py-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Claims Admin
                  </Badge>
                )}
                {emailConfirmed ? (
                  <Badge variant="outline" className="gap-1.5 px-3 py-1 border-success/50 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Email Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 px-3 py-1 border-warning/50 text-warning">
                    <XCircle className="h-3.5 w-3.5" />
                    Unverified
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`gap-1.5 px-3 py-1 ${
                    isActive
                      ? 'border-success/50 text-success'
                      : 'border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`}
                  />
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Last Activity */}
              {lastSignIn && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Last active{' '}
                    {formatDistanceToNow(new Date(lastSignIn), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick Actions - Client Component */}
          <div className="w-full lg:w-auto">
            <UserProfileActions userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}
