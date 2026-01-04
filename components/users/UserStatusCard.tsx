'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Ban,
  CheckCircle,
  Mail,
  ShieldBan,
  ShieldCheck,
  Send,
  AlertTriangle,
} from 'lucide-react';
import {
  banUser,
  unbanUser,
  confirmUserEmail,
  resendConfirmationEmail,
} from '@/app/actions/users';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { BAN_DURATION_LABELS, type BanDuration } from '@/types/claims';

interface UserStatusCardProps {
  userId: string;
  userEmail: string;
  emailConfirmedAt?: string | null;
  bannedUntil?: string | null;
}

export function UserStatusCard({
  userId,
  userEmail,
  emailConfirmedAt,
  bannedUntil,
}: UserStatusCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<BanDuration>('24h');
  const router = useRouter();

  const isEmailConfirmed = !!emailConfirmedAt;
  const isBanned = !!bannedUntil && new Date(bannedUntil) > new Date();

  const handleBan = async () => {
    setLoading('ban');

    try {
      const result = await banUser(userId, banDuration);

      if (result.success) {
        toast.success(`User banned for ${BAN_DURATION_LABELS[banDuration]}`);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to ban user');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to ban user');
    } finally {
      setLoading(null);
    }
  };

  const handleUnban = async () => {
    setLoading('unban');

    try {
      const result = await unbanUser(userId);

      if (result.success) {
        toast.success('User unbanned');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to unban user');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to unban user');
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmEmail = async () => {
    setLoading('confirm');

    try {
      const result = await confirmUserEmail(userId);

      if (result.success) {
        toast.success('Email confirmed');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to confirm email');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to confirm email');
    } finally {
      setLoading(null);
    }
  };

  const handleResendConfirmation = async () => {
    setLoading('resend');

    try {
      const result = await resendConfirmationEmail(userEmail);

      if (result.success) {
        toast.success('Confirmation email sent');
      } else {
        toast.error(result.error || 'Failed to send confirmation email');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to send confirmation email');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Account Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Confirmation Status */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email</span>
            </div>
            <Badge variant={isEmailConfirmed ? 'default' : 'secondary'}>
              {isEmailConfirmed ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Confirmed
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Unconfirmed
                </>
              )}
            </Badge>
          </div>

          {isEmailConfirmed ? (
            <p className="text-xs text-muted-foreground">
              Confirmed on {format(new Date(emailConfirmedAt), 'PPP')}
            </p>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConfirmEmail}
                disabled={loading === 'confirm'}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {loading === 'confirm' ? 'Confirming...' : 'Confirm Now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendConfirmation}
                disabled={loading === 'resend'}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-1" />
                {loading === 'resend' ? 'Sending...' : 'Resend Email'}
              </Button>
            </div>
          )}
        </div>

        {/* Ban Status */}
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldBan className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Account Access</span>
            </div>
            <Badge variant={isBanned ? 'destructive' : 'outline'}>
              {isBanned ? (
                <>
                  <Ban className="h-3 w-3 mr-1" />
                  Banned
                </>
              ) : (
                'Active'
              )}
            </Badge>
          </div>

          {isBanned ? (
            <>
              <p className="text-xs text-muted-foreground">
                Banned until {format(new Date(bannedUntil!), 'PPP p')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnban}
                disabled={loading === 'unban'}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {loading === 'unban' ? 'Unbanning...' : 'Remove Ban'}
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select
                  value={banDuration}
                  onValueChange={(v) => setBanDuration(v as BanDuration)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BAN_DURATION_LABELS)
                      .filter(([key]) => key !== 'none')
                      .map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={loading === 'ban'}
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Ban
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ban User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to ban <strong>{userEmail}</strong> for{' '}
                        <strong>{BAN_DURATION_LABELS[banDuration]}</strong>?
                        <br />
                        <br />
                        The user will be unable to sign in during this period.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBan}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {loading === 'ban' ? 'Banning...' : 'Ban User'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


