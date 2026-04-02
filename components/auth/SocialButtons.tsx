'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getAppUrl } from '@/lib/app-url';

type SocialButtonsProps = {
  next?: string;
  enableGoogle?: boolean;
  enableGitHub?: boolean;
  onNavigating?: () => void;
};

export function SocialButtons({ next = '/', enableGoogle, enableGitHub, onNavigating }: SocialButtonsProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState<'google' | 'github' | null>(null);

  const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const signIn = async (provider: 'google' | 'github') => {
    try {
      setLoading(provider);
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
      // Trigger card-level transition while browser redirects
      onNavigating?.();
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
          className="w-full btn-press"
          disabled={!!loading}
          onClick={() => signIn('google')}
        >
          {loading === 'google' && <Spinner className="mr-1 spinner-delayed" />}
          Continue with Google
        </Button>
      )}
      {enableGitHub && (
        <Button
          type="button"
          variant="outline"
          className="w-full btn-press"
          disabled={!!loading}
          onClick={() => signIn('github')}
        >
          {loading === 'github' && <Spinner className="mr-1 spinner-delayed" />}
          Continue with GitHub
        </Button>
      )}
    </div>
  );
}
