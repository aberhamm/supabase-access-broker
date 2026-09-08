'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppConfig } from '@/types/claims';
import { COLOR_KEYS, paletteFor, publicBranding, resolveTheme, validateTheme, type AppTheme } from '@/lib/app-branding';
import { LOOKBOOK_LOGIN_THEME } from '@/lib/branding-presets';
import { updateAppBrandingAction } from '@/app/actions/app-branding';
import { AuthShell } from '@/components/auth/AuthShell';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function BrandingEditor({ app }: { app: AppConfig }) {
  const [theme, setTheme] = useState<AppTheme>(() => resolveTheme(app.login_theme, app.color));
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const error = validateTheme(theme);
  const palette = paletteFor(theme, previewMode);
  const preview = publicBranding({ ...app, login_theme: { ...theme, mode: previewMode } });

  async function save(reset = false) {
    setSaving(true); setMessage('');
    try {
      const result = await updateAppBrandingAction(app.id, reset ? null : theme);
      setMessage(result.error ?? (reset ? 'Shared defaults restored.' : 'Login branding saved.'));
      if (!result.error) {
        if (reset) setTheme(resolveTheme(null, app.color));
        router.refresh();
      }
    } catch { setMessage('Unable to save branding. Please try again.'); }
    finally { setSaving(false); }
  }

  return <div className="grid gap-8 lg:grid-cols-2">
    <section className="space-y-6" aria-labelledby="branding-title">
      <div><h2 id="branding-title" className="text-xl font-semibold">Login branding</h2>
        <p className="mt-2 text-sm text-muted-foreground">Use this application’s name and approved icon from the registry. Colors apply to its validated SSO login links.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><Label htmlFor="brand-mode">Appearance</Label><select id="brand-mode" className="mt-2 w-full rounded border p-2 bg-background" value={theme.mode}
          onChange={e => setTheme({ ...theme, mode: e.target.value as AppTheme['mode'] })}>
          <option value="system">System</option><option value="light">Always light</option><option value="dark">Always dark</option>
        </select></div>
        <div><Label htmlFor="brand-font">Font</Label><select id="brand-font" className="mt-2 w-full rounded border p-2 bg-background" value={theme.font}
          onChange={e => setTheme({ ...theme, font: e.target.value as AppTheme['font'] })}>
          <option value="portal">Portal</option><option value="inter-tight">Inter Tight</option>
        </select></div>
        <div><Label htmlFor="brand-wordmark">Wordmark</Label><select id="brand-wordmark" className="mt-2 w-full rounded border p-2 bg-background" value={theme.wordmark}
          onChange={e => setTheme({ ...theme, wordmark: e.target.value as AppTheme['wordmark'] })}>
          <option value="name">Registry name</option><option value="upper">Uppercase</option><option value="lower">Lowercase</option>
        </select></div>
      </div>
      {app.id === 'lookbook-social' && <Button variant="outline" onClick={() => { setTheme(LOOKBOOK_LOGIN_THEME); setPreviewMode('light'); }}>Use approved Lookbook palette</Button>}
      <fieldset className="space-y-4"><legend className="mb-3 font-medium">{previewMode === 'light' ? 'Light' : 'Dark'} palette</legend>
        <div className="grid grid-cols-2 gap-4">{COLOR_KEYS.map(key => <div key={key}>
          <Label htmlFor={`brand-${key}`} className="capitalize">{key}</Label>
          <Input id={`brand-${key}`} className="mt-2 font-mono" value={theme[previewMode][key] ?? ''} placeholder={palette[key]} maxLength={7}
            onChange={e => { const colors = { ...theme[previewMode] }; if (e.target.value) colors[key] = e.target.value; else delete colors[key]; setTheme({ ...theme, [previewMode]: colors }); }} />
        </div>)}</div>
        <p className="text-xs text-muted-foreground">Six-digit hex colors. Empty fields inherit defaults. Text must reach 4.5:1 contrast; focus indicators 3:1. Button label colors are chosen automatically.</p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error} The preview uses safe defaults until corrected.</p>}
      <div className="flex flex-wrap gap-3">
        <Button disabled={saving || !!error} onClick={() => save()}>{saving ? 'Saving…' : 'Save branding'}</Button>
        <Button variant="outline" disabled={saving} onClick={() => save(true)}>Restore shared defaults</Button>
      </div>
      <p role="status" className="text-sm">{message}</p>
    </section>
    <section className="space-y-4" aria-label="Login preview">
      <div className="flex items-center justify-between"><h3 className="font-medium">Preview</h3>
        <div className="flex gap-2">{(['light', 'dark'] as const).map(mode => <Button key={mode} variant="outline" aria-pressed={previewMode === mode} onClick={() => setPreviewMode(mode)}>{mode === 'light' ? 'Light' : 'Dark'}</Button>)}</div>
      </div>
      <p className="text-xs text-muted-foreground">Inspect both palettes here. Login follows the saved appearance setting.</p>
      <AuthShell branding={preview} compact>
        <CardHeader><CardTitle className="text-2xl">Sign in</CardTitle><CardDescription>Sign in to continue</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="preview-email">Email</Label><Input id="preview-email" placeholder="you@example.com" readOnly />
          <Button type="button" className="w-full">Continue</Button>
          <p className="text-sm text-destructive">Example verification error</p>
        </CardContent>
      </AuthShell>
    </section>
  </div>;
}
