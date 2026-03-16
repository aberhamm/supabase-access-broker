'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Link2, KeyRound, Plus, Trash2, AlertTriangle } from 'lucide-react';

import type { AppConfig } from '@/types/claims';
import { updateAppSSOSettingsAction, generateAppSecretAction } from '@/app/actions/apps';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function normalizeUrl(input: string): string {
  return new URL(input.trim()).toString();
}

export function SSOSettingsCard({
  app,
  onUpdated,
}: {
  app: AppConfig;
  onUpdated?: () => void;
}) {
  const initialUrls = useMemo(() => app.allowed_callback_urls ?? [], [app.allowed_callback_urls]);

  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [secretConfigured, setSecretConfigured] = useState(!!app.sso_client_secret_hash);

  const addUrl = async () => {
    try {
      const normalized = normalizeUrl(newUrl);
      if (urls.includes(normalized)) {
        toast.info('That callback URL is already in the allowlist.');
        return;
      }
      const newUrls = [...urls, normalized];
      setUrls(newUrls);
      setNewUrl('');

      // Auto-save immediately
      setSaving(true);
      try {
        const result = await updateAppSSOSettingsAction(app.id, { allowed_callback_urls: newUrls });
        if (result.error) {
          toast.error(result.error);
          setUrls(urls); // Revert on error
          return;
        }
        toast.success('Callback URL added');
        onUpdated?.();
      } catch (e) {
        const err = e as { message?: string };
        toast.error(err.message || 'Failed to add callback URL');
        setUrls(urls); // Revert on error
      } finally {
        setSaving(false);
      }
    } catch {
      toast.error('Please enter a valid URL (e.g. https://app.example.com/auth/callback)');
    }
  };

  const removeUrl = async (u: string) => {
    const newUrls = urls.filter((x) => x !== u);
    setUrls(newUrls);

    // Auto-save immediately
    setSaving(true);
    try {
      const result = await updateAppSSOSettingsAction(app.id, { allowed_callback_urls: newUrls });
      if (result.error) {
        toast.error(result.error);
        setUrls(urls); // Revert on error
        return;
      }
      toast.success('Callback URL removed');
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Failed to remove callback URL');
      setUrls(urls); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const generateSecret = async () => {
    setGenerating(true);
    setGeneratedSecret(null);
    setCopied(false);
    try {
      const result = await generateAppSecretAction(app.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setGeneratedSecret(result.data?.secret ?? null);
      setSecretConfigured(true);
      toast.success('App secret generated');
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Failed to generate secret');
    } finally {
      setGenerating(false);
    }
  };

  const copySecret = async () => {
    if (!generatedSecret) return;
    await navigator.clipboard.writeText(generatedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Allowed Callback URLs
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Only these redirect URIs can be used with SSO for <code className="rounded bg-muted px-1">{app.id}</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This prevents open-redirect attacks. The portal will reject any <code>redirect_uri</code> that is not
              allowlisted here.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="new_callback_url">Add callback URL</Label>
            <div className="flex gap-2">
              <Input
                id="new_callback_url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://app.example.com/auth/callback"
                disabled={saving}
              />
              <Button type="button" variant="secondary" onClick={addUrl} disabled={saving || !newUrl.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {urls.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No callback URLs configured yet. Add at least one callback URL to enable SSO redirects for this app.
            </div>
          ) : (
            <div className="space-y-2">
              {urls.map((u) => (
                <div key={u} className="flex items-center justify-between gap-2 rounded-md border p-3">
                  <code className="text-xs font-mono break-all">{u}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeUrl(u)}
                    disabled={saving}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              SSO App Secret
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional shared secret used by client apps when exchanging auth codes.
            </p>
          </div>
          <Badge variant={secretConfigured ? 'default' : 'secondary'}>
            {secretConfigured ? 'Configured' : 'Not configured'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The plaintext secret is shown <strong>only once</strong>. Store it in your client app backend as an env
              var (e.g. <code>SSO_APP_SECRET</code>). The portal stores only a SHA-256 hash.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            variant={secretConfigured ? 'destructive' : 'default'}
            onClick={() => setSecretDialogOpen(true)}
          >
            {secretConfigured ? 'Regenerate secret' : 'Generate secret'}
          </Button>

          <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{secretConfigured ? 'Regenerate app secret' : 'Generate app secret'}</DialogTitle>
                <DialogDescription>
                  {secretConfigured
                    ? 'Regenerating will invalidate the previous secret immediately.'
                    : 'This will create a new secret for securing the code exchange endpoint.'}
                </DialogDescription>
              </DialogHeader>

              {generatedSecret ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>One-time secret (copy now)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={generatedSecret} />
                      <Button type="button" variant="secondary" onClick={copySecret}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Client apps should send this as <code>app_secret</code> when calling <code>/api/auth/exchange</code>.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Click confirm to generate a new secret. You will not be able to view it again later.
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSecretDialogOpen(false)} disabled={generating}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant={secretConfigured ? 'destructive' : 'default'}
                  onClick={generateSecret}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : secretConfigured ? 'Regenerate' : 'Generate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
