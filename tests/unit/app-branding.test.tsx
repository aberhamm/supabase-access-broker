import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_THEME, DEFAULT_PALETTES, contrast, onColor, paletteFor, publicBranding, resolveTheme, validateTheme } from '@/lib/app-branding';
import { LOOKBOOK_LOGIN_THEME } from '@/lib/branding-presets';
import { AuthShell } from '@/components/auth/AuthShell';
import lookbook from '../fixtures/lookbook-branding.json';

describe('approved login themes', () => {
  it('represents Lookbook without changing its canonical colors or button styling', () => {
    expect(validateTheme(LOOKBOOK_LOGIN_THEME)).toBeNull();
    const palette = paletteFor(LOOKBOOK_LOGIN_THEME, 'light');
    expect(palette.background).toBe('#f4f1ed');
    expect(palette.primary).toBe('#000000');
    expect(palette.accent).toBe('#ff0001');
    expect(palette.error).toBe('#c20000');
    expect(LOOKBOOK_LOGIN_THEME.mode).toBe('light');
  });
  it.each(['url(https://evil.test)', '#fff', '#00000000', 'red;position:fixed', 'var(--x)', '</style><script>', null, {}, 10])('rejects CSS payload %j', value => {
    expect(validateTheme({ ...DEFAULT_THEME, light: { primary: value } })).not.toBeNull();
  });
  it.each([
    { version: 2 }, { mode: 'url(evil)' }, { font: 'https://evil.test/font' },
    { wordmark: '<img>' }, { css: 'body{}' }, { light: { extra: '#000000' } },
    { light: { text: '#ffffff' } }, { light: { focus: '#ffffff' } },
    { dark: { error: '#000000' } }, { light: [] },
  ])('rejects malformed and inaccessible configuration %j', change => {
    expect(validateTheme({ ...DEFAULT_THEME, ...change })).not.toBeNull();
  });
  it('handles null, missing and malformed stored themes with safe defaults and legacy colors', () => {
    for (const raw of [null, undefined, 'bad', { version: 3 }, []]) {
      const result = resolveTheme(raw, '#ff0001');
      expect(validateTheme(result)).toBeNull();
      expect(result.light.accent).toBe('#ff0001');
      expect(result.light.primary).toBeUndefined();
    }
    expect(resolveTheme(null, 'url(https://evil)')).toEqual(DEFAULT_THEME);
  });
  it('guarantees normal text and focus contrast in both default palettes', () => {
    for (const p of Object.values(DEFAULT_PALETTES)) {
      for (const fg of ['text', 'muted', 'primary', 'error'] as const) {
        expect(contrast(p[fg], p.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p[fg], p.background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(p.focus, p.surface)).toBeGreaterThanOrEqual(3);
    }
    for (let i = 0; i < 256; i++) {
      const color = '#' + i.toString(16).padStart(2, '0').repeat(3);
      expect(contrast(color, onColor(color))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('serializes only presentation fields and escapes registry names', () => {
    const brand = publicBranding({ ...lookbook, name: '<img src=x onerror=alert(1)>', icon: 'https://evil.test/pixel', login_theme: LOOKBOOK_LOGIN_THEME });
    expect(Object.keys(brand).sort()).toEqual(['icon', 'name', 'theme']);
    expect(brand.icon).toBeNull();
    const html = renderToStaticMarkup(<AuthShell branding={brand}>Sign in</AuthShell>);
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('https://evil');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('allowed_callback_urls');
  });
});
