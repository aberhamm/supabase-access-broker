/** Public presentation contract. Only opaque RGB hex values and fixed enums enter CSS. */
export const COLOR_KEYS = ['primary', 'accent', 'background', 'surface', 'text', 'muted', 'error', 'focus', 'border'] as const;
export type BrandColor = typeof COLOR_KEYS[number];
export type BrandPalette = Record<BrandColor, string>;
export interface AppTheme {
  version: 1;
  mode: 'light' | 'dark' | 'system';
  font: 'portal' | 'inter-tight';
  wordmark: 'name' | 'upper' | 'lower';
  light: Partial<BrandPalette>;
  dark: Partial<BrandPalette>;
}
export interface LoginBranding {
  name: string;
  icon: 'lookbook' | null;
  theme: AppTheme;
}
export const DEFAULT_PALETTES: Record<'light' | 'dark', BrandPalette> = {
  light: { primary: '#253c80', accent: '#253c80', background: '#f7f8fc', surface: '#ffffff', text: '#171923', muted: '#545868', error: '#b42318', focus: '#253c80', border: '#ced1da' },
  dark: { primary: '#aac0ff', accent: '#aac0ff', background: '#11131b', surface: '#1b1f2b', text: '#f7f8fc', muted: '#b8bdcb', error: '#ffaaa3', focus: '#aac0ff', border: '#555e73' },
};
export const DEFAULT_THEME: AppTheme = { version: 1, mode: 'system', font: 'portal', wordmark: 'name', light: {}, dark: {} };
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function onColor(color: string): string {
  return contrast(color, '#000000') > contrast(color, '#ffffff') ? '#000000' : '#ffffff';
}
export function paletteFor(theme: AppTheme, mode: 'light' | 'dark'): BrandPalette {
  return { ...DEFAULT_PALETTES[mode], ...theme[mode] };
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
/** Reject unknown keys, CSS functions, alpha, URLs and unreadable text/focus combinations. */
export function validateTheme(value: unknown): string | null {
  if (!object(value) || value.version !== 1) return 'Theme must use version 1.';
  if (Object.keys(value).some(k => !['version', 'mode', 'font', 'wordmark', 'light', 'dark'].includes(k))) return 'Unknown theme setting.';
  if (!['light', 'dark', 'system'].includes(String(value.mode))) return 'Choose light, dark or system appearance.';
  if (!['portal', 'inter-tight'].includes(String(value.font))) return 'Choose an approved font.';
  if (!['name', 'upper', 'lower'].includes(String(value.wordmark))) return 'Choose a wordmark style.';
  for (const mode of ['light', 'dark'] as const) {
    const overrides = value[mode];
    if (!object(overrides) || Object.entries(overrides).some(([k, v]) => !(COLOR_KEYS as readonly string[]).includes(k) || !isHexColor(v))) return `${mode}: use six-digit hex colors only.`;
    const palette = { ...DEFAULT_PALETTES[mode], ...overrides } as BrandPalette;
    for (const bg of ['background', 'surface'] as const) {
      for (const fg of ['primary', 'text', 'muted', 'error'] as const) {
        if (contrast(palette[fg], palette[bg]) < 4.5) return `${mode}: ${fg} needs at least 4.5:1 contrast against ${bg}.`;
      }
      if (contrast(palette.focus, palette[bg]) < 3) return `${mode}: focus needs at least 3:1 contrast against ${bg}.`;
    }
  }
  return null;
}
/** Defensive read: invalid stored themes fall back; legacy color remains a safe hint. */
export function resolveTheme(value: unknown, legacyColor?: unknown): AppTheme {
  if (value != null && !validateTheme(value)) return value as AppTheme;
  const theme: AppTheme = { ...DEFAULT_THEME, light: {}, dark: {} };
  if (isHexColor(legacyColor)) {
    for (const mode of ['light', 'dark'] as const) {
      theme[mode].accent = legacyColor;
      const base = DEFAULT_PALETTES[mode];
      if (contrast(legacyColor, base.surface) >= 4.5 && contrast(legacyColor, base.background) >= 4.5) {
        theme[mode].primary = legacyColor;
        theme[mode].focus = legacyColor;
      }
    }
  }
  return theme;
}
export function publicBranding(value: unknown): LoginBranding {
  const row = object(value) ? value : {};
  return {
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 80) : 'Application',
    // Asset IDs map to reviewed, bundled files. Never fetch registry URLs or render markup.
    icon: row.icon === 'lookbook' ? 'lookbook' : null,
    theme: resolveTheme(row.login_theme, row.color),
  };
}
