'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider> & {
  nonce?: string;
};

export function ThemeProvider({ children, nonce, ...props }: ThemeProviderProps) {
  // next-themes injects an inline <script> at the top of <body> to set the
  // theme class before hydration (prevents FOUC). It needs to carry our
  // per-request CSP nonce so the new strict CSP doesn't block it.
  return (
    <NextThemesProvider nonce={nonce} {...props}>
      {children}
    </NextThemesProvider>
  );
}
