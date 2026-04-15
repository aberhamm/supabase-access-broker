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
      // Browser will redirect
    } catch (e) {
      const message = e instanceof Error ? e.message : 'OAuth sign-in failed';
      toast.error(message);
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {enableGoogle && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!!loading}
          onClick={() => signIn('google')}
        >
          {loading === 'google' ? 'Connecting…' : 'Continue with Google'}
        </Button>
      )}
      {enableApple && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!!loading}
          onClick={() => signIn('apple')}
        >
          {loading === 'apple' ? 'Connecting…' : 'Continue with Apple'}
        </Button>
      )}
      {enableGitHub && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!!loading}
          onClick={() => signIn('github')}
        >
          {loading === 'github' ? 'Connecting…' : 'Continue with GitHub'}
        </Button>
      )}
    </div>
  );
}
