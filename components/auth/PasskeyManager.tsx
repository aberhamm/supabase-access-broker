'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { debugError, debugLog } from '@/lib/auth-debug';

export type PasskeyItem = {
  id: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  device_type: string | null;
};

type PasskeyManagerProps = {
  initialPasskeys: PasskeyItem[];
  onDelete: (id: string) => Promise<void>;
};

export function PasskeyManager({ initialPasskeys, onDelete }: PasskeyManagerProps) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>(initialPasskeys);
  const [adding, setAdding] = useState(false);
  const [deviceName, setDeviceName] = useState('');

  // Sync state when props change (e.g., after router.refresh())
  useEffect(() => {
    setPasskeys(initialPasskeys);
  }, [initialPasskeys]);

  const handleAdd = async () => {
    try {
      setAdding(true);
      debugLog('[Passkey] Starting registration...');

      // Check WebAuthn support
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser');
      }

      // Check if platform authenticator is available (Touch ID, Face ID, Windows Hello)
      const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      debugLog('[Passkey] Platform authenticator available:', platformAvailable);

      const optsRes = await fetch('/api/auth/passkey/register/options', { method: 'GET' });
      if (!optsRes.ok) {
        const err = await optsRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to start passkey registration');
      }

      const { options } = (await optsRes.json()) as { options: PublicKeyCredentialCreationOptionsJSON };
      debugLog('[Passkey] Got options, calling startRegistration...', { rpId: options.rp.id, origin: window.location.origin });

      // Add timeout to detect if WebAuthn hangs
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('WebAuthn timed out - no authenticator response')), 120000);
      });

      const regResponse = await Promise.race([
        startRegistration({ optionsJSON: options }),
        timeoutPromise,
      ]);
      debugLog('[Passkey] Registration response received');

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: regResponse, name: deviceName || null }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Passkey registration failed');
      }

      const payload = (await verifyRes.json()) as { verified: boolean };
      if (!payload.verified) throw new Error('Passkey registration failed');

      toast.success('Passkey added');
      setDeviceName('');
      router.refresh();
    } catch (e) {
      debugError('[Passkey] Error:', e);
      const message = e instanceof Error ? e.message : 'Failed to add passkey';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.success('Passkey removed');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete passkey';
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="passkeyName">Device name (optional)</Label>
          <Input
            id="passkeyName"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g. MacBook Touch ID"
            disabled={adding}
          />
          <Button type="button" onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : 'Add Passkey'}
          </Button>
        </div>

        <div className="space-y-2">
          {passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
          ) : (
            passkeys.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name || 'Unnamed passkey'}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.device_type ? `${p.device_type} · ` : ''}
                    Added {new Date(p.created_at).toLocaleString()}
                    {p.last_used_at ? ` · Last used ${new Date(p.last_used_at).toLocaleString()}` : ''}
                  </div>
                </div>
                <Button type="button" variant="destructive" onClick={() => handleDelete(p.id)}>
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
