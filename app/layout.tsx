import type { Metadata } from 'next';
import { Karla, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionSync } from '@/components/auth/SessionSync';

const displayFont = Karla({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const monoFont = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Access Broker',
  description: 'Unified identity and access management for Supabase applications',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${monoFont.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionSync />
          {children}
          <Toaster />
        </ThemeProvider>
        <script defer src="/a/script.js" data-website-id="7a49a3b7-9900-496b-87a1-855d9d03574f" />
      </body>
    </html>
  );
}
