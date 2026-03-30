'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Link2, KeyRound, Plus, Trash2, AlertTriangle } from 'lucide-react';

import type { AppConfig, SsoClientSecret } from '@/types/claims';
import { updateAppSSOSettingsAction, generateAppSecretAction, deleteAppSecretAction } from '@/app/actions/apps';

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
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
  const [secretLabel, setSecretLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [deletingSecretId, setDeletingSecretId] = useState<string | null>(null);

  const [secrets, setSecrets] = useState<SsoClientSecret[]>(app.sso_client_secrets ?? []);

  const addUrl = async () => {
    try {
      const normalized = normalizeUrl(newUrl);
      if (urls.includes(normalized)) {
        toast.info('That redirect URL is already in the allowlist.');
        return;
      }
      const newUrls = [...urls, normalized];
      setUrls(newUrls);
      setNewUrl('');

      setSaving(true);
      try {
        const result = await updateAppSSOSettingsAction(app.id, { allowed_callback_urls: newUrls });
        if (result.error) {
          toast.error(result.error);
          setUrls(urls);
          return;
        }
        toast.success('Redirect URL added');
        onUpdated?.();
      } catch (e) {
        const err = e as { message?: string };
        toast.error(err.message || 'Failed to add redirect URL');
        setUrls(urls);
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

    setSaving(true);
    try {
      const result = await updateAppSSOSettingsAction(app.id, { allowed_callback_urls: newUrls });
      if (result.error) {
        toast.error(result.error);
        setUrls(urls);
        return;
      }
      toast.success('Redirect URL removed');
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Failed to remove redirect URL');
      setUrls(urls);
    } finally {
      setSaving(false);
    }
  };

  const generateSecret = async () => {
    setGenerating(true);
    setGeneratedSecret(null);
    setCopied(false);
    try {
      const label = secretLabel.trim() || 'default';
      const result = await generateAppSecretAction(app.id, label);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setGeneratedSecret(result.data?.secret ?? null);
      if (result.data) {
        setSecrets(prev => [...prev, {
          id: result.data!.secretId,
          label,
          hash: '••••••••',
          created_at: new Date().toISOString(),
        }]);
      }
      toast.success('App secret generated');
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Failed to generate secret');
    } finally {
      setGenerating(false);
    }
  };

  const deleteSecret = async (secretId: string) => {
    setDeletingSecretId(secretId);
    try {
      const result = await deleteAppSecretAction(app.id, secretId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSecrets(prev => prev.filter(s => s.id !== secretId));
      toast.success('Secret deleted');
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Failed to delete secret');
    } finally {
      setDeletingSecretId(null);
    }
  };

  const copySecret = async () => {
    if (!generatedSecret) return;
    await navigator.clipboard.writeText(generatedSecret);
    setCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Allowed Redirect URLs
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            URLs the portal is allowed to redirect to for <code className="rounded bg-muted px-1">{app.id}</code> — SSO callbacks, logout redirects, and account management return links.
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
            <Label htmlFor="new_callback_url">Add redirect URL</Label>
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
              No redirect URLs configured yet. Add at least one URL to enable SSO and portal redirects for this app.
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
              SSO App Secrets
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Secrets used by client apps when exchanging auth codes. Create separate secrets for each environment.
            </p>
          </div>
          <Badge variant={secrets.length > 0 ? 'default' : 'secondary'}>
            {secrets.length} secret{secrets.length === 1 ? '' : 's'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing secrets list */}
          {secrets.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No secrets configured. Generate one to secure the code exchange endpoint.
            </div>
          ) : (
            <div className="space-y-2">
              {secrets.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(s.created_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSecret(s.id)}
                    disabled={deletingSecretId === s.id}
                    title="Delete secret"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={() => {
              setSecretDialogOpen(true);
              setGeneratedSecret(null);
              setSecretLabel('');
              setCopied(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Generate new secret
          </Button>

          <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate app secret</DialogTitle>
                <DialogDescription>
                  Create a named secret for a specific environment (e.g. &quot;production&quot;, &quot;staging&quot;, &quot;local&quot;). Existing secrets are not affected.
                </DialogDescription>
              </DialogHeader>

              {generatedSecret ? (
                <div className="space-y-3">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Copy this secret now. You will not be able to view it again.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label>Secret</Label>
                    <div className="flex gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all select-all">
                        {generatedSecret}
                      </code>
                      <Button type="button" variant="secondary" onClick={copySecret} className="shrink-0">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Set this as <code>SSO_APP_SECRET</code> in your client app&apos;s environment.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="secret_label">Label</Label>
                    <Input
                      id="secret_label"
                      value={secretLabel}
                      onChange={(e) => setSecretLabel(e.target.value)}
                      placeholder="e.g. production, staging, local"
                      disabled={generating}
                    />
                    <p className="text-xs text-muted-foreground">
                      A name to identify which environment uses this secret.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSecretDialogOpen(false)} disabled={generating}>
                  {generatedSecret ? 'Done' : 'Cancel'}
                </Button>
                {!generatedSecret && (
                  <Button
                    type="button"
                    onClick={generateSecret}
                    disabled={generating}
                  >
                    {generating ? 'Generating...' : 'Generate'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
