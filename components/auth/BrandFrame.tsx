import type { CSSProperties, ReactNode } from 'react';
import { contrast, paletteFor, onColor, type LoginBranding } from '@/lib/app-branding';

export function BrandFrame({ branding, children, compact = false }: {
  branding: LoginBranding; children: ReactNode; compact?: boolean;
}) {
  const style: Record<string, string> = {};
  for (const mode of ['light', 'dark'] as const) {
    const palette = paletteFor(branding.theme, mode);
    for (const [key, value] of Object.entries(palette)) style[`--brand-${mode}-${key}`] = value;
    style[`--brand-${mode}-wordmark`] = contrast(palette.accent, palette.background) >= 3 ? palette.accent : palette.primary;
    style[`--brand-${mode}-on-primary`] = onColor(palette.primary);
    style[`--brand-${mode}-on-accent`] = onColor(palette.accent);
  }
  return <div className={`brand-frame ${compact ? 'brand-preview' : 'min-h-screen'}`}
    data-brand-mode={branding.theme.mode} data-brand-font={branding.theme.font}
    data-testid="branded-login" style={style as CSSProperties}>
    <div className="brand-layout">
      <header className="brand-header">
        {branding.icon === 'lookbook' && /* Bundled approved asset; no registry URL can become an image source. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/branding/lookbook.png" width={44} height={44} alt="" />}
        <p className="brand-wordmark" data-case={branding.theme.wordmark}>{branding.name}</p>
      </header>
      {children}
      <footer className="brand-footer">Secure sign-in · Supabase Access Broker</footer>
    </div>
  </div>;
}
