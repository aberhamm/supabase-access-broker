'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { getAppUrl } from '@/lib/app-url';

type Provider = 'google' | 'github' | 'apple';

type SocialButtonsProps = {
  next?: string;
  enableGoogle?: boolean;
  enableGitHub?: boolean;
  enableApple?: boolean;
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.93 8.76c1.28.07 2.17.75 2.92.79.99-.2 1.94-.77 3-.83 1.28-.08 2.24.38 2.87 1.15-2.65 1.56-2.02 5.01.36 5.97-.5 1.3-.95 2.58-2.03 4.44zM12.04 8.68c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.338c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function SocialButtons({ next = '/', enableGoogle, enableGitHub, enableApple }: SocialButtonsProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState<Provider | null>(null);

  const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const signIn = async (provider: Provider) => {
    try {
      setLoading(provider);
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'OAuth sign-in failed';
      toast.error(message);
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {enableGoogle && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 text-sm font-medium"
          disabled={!!loading}
          onClick={() => signIn('google')}
        >
          <GoogleLogo className="size-5 shrink-0" />
          {loading === 'google' ? 'Connecting…' : 'Continue with Google'}
        </Button>
      )}
      {enableApple && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 text-sm font-medium"
          disabled={!!loading}
          onClick={() => signIn('apple')}
        >
          <AppleLogo className="size-5 shrink-0" />
          {loading === 'apple' ? 'Connecting…' : 'Continue with Apple'}
        </Button>
      )}
      {enableGitHub && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 text-sm font-medium"
          disabled={!!loading}
          onClick={() => signIn('github')}
        >
          <GitHubLogo className="size-5 shrink-0" />
          {loading === 'github' ? 'Connecting…' : 'Continue with GitHub'}
        </Button>
      )}
    </div>
  );
}
