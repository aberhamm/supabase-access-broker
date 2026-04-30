'use client';

import { useState } from 'react';
import type { UserIdentity } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, Unlink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getAppUrl } from '@/lib/app-url';
import { unlinkIdentityAction } from '@/app/actions/account';

type SupportedProvider = 'google' | 'apple' | 'github';

const SUPPORTED_PROVIDERS: ReadonlyArray<{ id: SupportedProvider; name: string }> = [
  { id: 'google', name: 'Google' },
  { id: 'apple', name: 'Apple' },
  { id: 'github', name: 'GitHub' },
];

type Props = {
  identities: UserIdentity[];
};

function identityLabel(identity: UserIdentity): string {
  const data = identity.identity_data as { email?: string } | undefined;
  return data?.email ?? 'Connected';
}

export function LinkedIdentitiesCard({ identities }: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  const linked = new Map<string, UserIdentity>();
  for (const ident of identities) linked.set(ident.provider, ident);

  // Apple's "Hide My Email" sends a relay address, so the linked email may
  // differ from the user's real email — that's expected and fine.
  const onlyOneIdentity = identities.length <= 1;

  async function handleConnect(provider: SupportedProvider) {
    setBusy(provider);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: `${getAppUrl()}/auth/callback?next=/account` },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No redirect URL returned');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start connection';
      toast.error(msg);
      setBusy(null);
    }
  }

  async function handleDisconnect(identity: UserIdentity, providerName: string) {
    if (onlyOneIdentity) {
      toast.error("You can't disconnect your only sign-in method.");
      return;
    }
    if (!confirm(`Disconnect ${providerName}? You'll no longer be able to sign in with it.`)) {
      return;
    }
    setBusy(identity.identity_id);
    try {
      const result = await unlinkIdentityAction(identity.identity_id);
      if (!result.success) throw new Error(result.error || 'Failed to disconnect');
      toast.success(`${providerName} disconnected`);
      // Reload so the page picks up the updated identity list from the server.
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to disconnect';
      toast.error(msg);
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connected sign-in methods
        </CardTitle>
        <CardDescription>
          Link multiple providers so you can sign in any way without creating duplicate accounts.
          Apple&apos;s &ldquo;Hide My Email&rdquo; relay is supported — connect it here to keep one account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {SUPPORTED_PROVIDERS.map(({ id, name }) => {
          const ident = linked.get(id);
          const disabled = busy !== null;
          if (ident) {
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {identityLabel(ident)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || onlyOneIdentity}
                  onClick={() => handleDisconnect(ident, name)}
                  title={onlyOneIdentity ? "You can't disconnect your only sign-in method." : undefined}
                >
                  <Unlink className="h-4 w-4 mr-1.5" />
                  {busy === ident.identity_id ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>
            );
          }
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">Not connected</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => handleConnect(id)}
              >
                <Link2 className="h-4 w-4 mr-1.5" />
                {busy === id ? 'Connecting…' : 'Connect'}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
