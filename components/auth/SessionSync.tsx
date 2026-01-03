'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * SessionSync component that listens for auth state changes across tabs.
 * When the user signs out in one tab, all other tabs will be redirected to /login.
 *
 * This component should be included in the root layout to ensure it's always active.
 */
export function SessionSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    // List of public routes that don't require authentication
    const publicPaths = ['/login', '/auth/callback', '/auth/logout', '/reset-password'];

    // Listen for auth state changes (includes cross-tab events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SessionSync] Auth state changed:', event, session ? 'has session' : 'no session');

      if (event === 'SIGNED_OUT') {
        // User signed out - redirect to login if not already on a public page
        const isPublicPage = publicPaths.some((path) => pathname?.startsWith(path));

        if (!isPublicPage) {
          console.log('[SessionSync] User signed out, redirecting to /login');
          router.push('/login');
        }
      }

      if (event === 'TOKEN_REFRESHED') {
        // Token was refreshed - this is normal, just log it
        console.log('[SessionSync] Token refreshed');
      }

      if (event === 'USER_UPDATED') {
        // User metadata was updated - might need to refresh the page
        // to pick up new claims
        console.log('[SessionSync] User updated');
      }
    });

    // Also listen for storage events (for cross-tab sync when Supabase uses localStorage)
    const handleStorageChange = (event: StorageEvent) => {
      // Supabase auth tokens are stored with keys containing 'supabase.auth'
      if (event.key?.includes('supabase.auth')) {
        if (event.newValue === null && event.oldValue !== null) {
          // Token was removed - user signed out in another tab
          const isPublicPage = publicPaths.some((path) => pathname?.startsWith(path));

          if (!isPublicPage) {
            console.log('[SessionSync] Storage cleared, redirecting to /login');
            router.push('/login');
          }
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }

    return () => {
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, [router, pathname]);

  // This component doesn't render anything
  return null;
}
