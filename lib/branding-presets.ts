import type { AppTheme } from './app-branding';

// Reviewed snapshot from unstructured-data-portal @portal/theme, 2026-09-08.
// palettes.ts (2ad4d77), LOOKBOOK_WEBSITE_THEME_CONFIG and buttonColor(primary).
// No runtime remote dependency; applying this preset requires a claims_admin save.
export const LOOKBOOK_LOGIN_THEME: AppTheme = {
  "version": 1,
  "mode": "light",
  "font": "inter-tight",
  "wordmark": "upper",
  "light": {
    "primary": "#000000",
    "accent": "#ff0001",
    "background": "#f4f1ed",
    "surface": "#f5ede7",
    "text": "#000000",
    "muted": "#57514c",
    "error": "#c20000",
    "focus": "#c20000",
    "border": "#d2cfcb"
  },
  "dark": {}
};
