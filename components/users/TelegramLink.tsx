'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  linkTelegramAction,
  unlinkTelegramAction,
  TelegramData,
} from '@/app/actions/telegram';
import { toast } from 'sonner';
import {
  MessageCircle,
  Link2,
  Unlink,
  ExternalLink,
  Info,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface TelegramLinkProps {
  /** The Supabase user ID to manage Telegram linking for */
  userId: string;
  /** Current Telegram data if already linked, null/undefined if not linked */
  telegram?: TelegramData | null;
}

/**
 * TelegramLink Component
 *
 * Allows administrators to link/unlink Telegram accounts to Supabase users.
 * The Telegram data is stored as a custom claim in the user's app_metadata.
 *
 * @example
 * ```tsx
 * // In a user profile page
 * <TelegramLink
 *   userId="user-uuid-here"
 *   telegram={user.app_metadata?.telegram}
 * />
 * ```
 *
 * @see linkTelegramAction - Server action for linking
 * @see unlinkTelegramAction - Server action for unlinking
 */
export function TelegramLink({ userId, telegram }: TelegramLinkProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const id = parseInt(telegramId, 10);
    if (isNaN(id) || id <= 0) {
      toast.error('Telegram ID must be a positive number');
      setLoading(false);
      return;
    }

    try {
      const result = await linkTelegramAction(userId, {
        id,
        username: username.replace(/^@/, '') || undefined, // Strip @ if user included it
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Telegram account linked successfully');
        setOpen(false);
        resetForm();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to link Telegram account');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);

    try {
      const result = await unlinkTelegramAction(userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Telegram account unlinked');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to unlink Telegram account');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTelegramId('');
    setUsername('');
    setFirstName('');
    setLastName('');
    setShowHelp(false);
  };

  // =========================================================================
  // LINKED STATE - Show the connected Telegram account
  // =========================================================================
  if (telegram) {
    const displayName = [telegram.first_name, telegram.last_name]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="space-y-3">
        {/* Connected Account Card */}
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {displayName && (
                    <p className="font-medium text-sky-900 dark:text-sky-100">
                      {displayName}
                    </p>
                  )}
                  {telegram.username && (
                    <a
                      href={`https://t.me/${telegram.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
                      title={`Open Telegram profile for @${telegram.username}`}
                    >
                      @{telegram.username}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ID:{' '}
                  <code className="rounded bg-muted px-1 font-mono">
                    {telegram.id}
                  </code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Linked {format(new Date(telegram.linked_at), 'PPP')}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={loading}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Remove Telegram account link"
            >
              <Unlink className="mr-2 h-4 w-4" />
              {loading ? 'Unlinking...' : 'Unlink'}
            </Button>
          </div>
        </div>

        {/* Info note about session refresh */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>
            The Telegram data is stored in the user&apos;s JWT claims. They may
            need to refresh their session to see updates in client applications.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // UNLINKED STATE - Show the link button and dialog
  // =========================================================================
  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <MessageCircle className="mr-2 h-4 w-4 text-sky-500" />
            Link Telegram Account
            <Link2 className="ml-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleLink}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-sky-500" />
                Link Telegram Account
              </DialogTitle>
              <DialogDescription>
                Associate a Telegram account with this user. This enables
                Telegram-based features and identification across your
                applications.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Help Toggle */}
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                {showHelp ? 'Hide help' : 'How do I find the Telegram ID?'}
              </button>

              {/* Help Section */}
              {showHelp && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                  <p className="font-medium">Finding a Telegram User ID:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>
                      Open Telegram and message{' '}
                      <a
                        href="https://t.me/userinfobot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:underline dark:text-sky-400"
                      >
                        @userinfobot
                      </a>
                    </li>
                    <li>
                      Forward any message from the target user to the bot
                    </li>
                    <li>The bot will reply with the user&apos;s numeric ID</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Alternative:</strong> If you have a Telegram bot,
                    you can get user IDs from the{' '}
                    <code className="rounded bg-muted px-1">
                      message.from.id
                    </code>{' '}
                    field in bot updates.
                  </p>
                </div>
              )}

              {/* Telegram ID Field */}
              <div className="space-y-2">
                <Label htmlFor="telegram-id" className="flex items-center gap-1">
                  Telegram ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="telegram-id"
                  type="number"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  placeholder="e.g., 123456789"
                  required
                  disabled={loading}
                  min="1"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The permanent numeric ID for this Telegram account
                </p>
              </div>

              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="telegram-username">Username</Label>
                <div className="flex">
                  <span className="flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="telegram-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                    placeholder="username"
                    className="rounded-l-none"
                    disabled={loading}
                    pattern="[a-zA-Z][a-zA-Z0-9_]{4,31}"
                    title="5-32 characters, starts with a letter"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional. Creates a clickable link to their Telegram profile.
                </p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="telegram-firstname">First Name</Label>
                  <Input
                    id="telegram-firstname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegram-lastname">Last Name</Label>
                  <Input
                    id="telegram-lastname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    disabled={loading}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Optional. Helps identify the account in the dashboard.
              </p>

              {/* Data Usage Note */}
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                <div className="text-amber-800 dark:text-amber-200">
                  <p className="font-medium">How this data is used:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
                    <li>Stored in the user&apos;s JWT token claims</li>
                    <li>Available to your applications for authorization</li>
                    <li>Can be queried via Supabase RPC functions</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Linking...' : 'Link Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contextual help when no account is linked */}
      <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <p>
          Link a Telegram account to enable Telegram-based notifications, bot
          interactions, or identity verification in your applications.
        </p>
      </div>
    </div>
  );
}
