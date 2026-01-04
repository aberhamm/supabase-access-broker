'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { debugLog } from '@/lib/auth-debug';
import { PUBLIC_ROUTE_PREFIXES } from '@/lib/auth-routes';

/**
 * SessionSync component that listens for auth state changes across tabs.
 * When the user signs out in one tab, all other tabs will be redirected to /login.
 *
 * This component should be included in the root layout to ensure it's always active.
 */
export function SessionSync() {
  const router = useRouter();
  const pathname = usePathname();
  // Use ref to access current pathname in callback without re-subscribing
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes (includes cross-tab events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      debugLog('[SessionSync] Auth state changed:', event, session ? 'has session' : 'no session');

      if (event === 'SIGNED_OUT') {
        // User signed out - redirect to login if not already on a public page
        const currentPath = pathnameRef.current;
        const isPublicPage = PUBLIC_ROUTE_PREFIXES.some((path) => currentPath?.startsWith(path));

        if (!isPublicPage) {
          debugLog('[SessionSync] User signed out, redirecting to /login');
          router.push('/login');
        }
      }

      if (event === 'TOKEN_REFRESHED') {
        // Token was refreshed - this is normal, just log it
        debugLog('[SessionSync] Token refreshed');
      }

      if (event === 'USER_UPDATED') {
        // User metadata was updated - might need to refresh the page
        // to pick up new claims
        debugLog('[SessionSync] User updated');
      }
    });

    // Also listen for storage events (for cross-tab sync when Supabase uses localStorage)
    const handleStorageChange = (event: StorageEvent) => {
      // Supabase auth tokens are stored with keys containing 'supabase.auth'
      if (event.key?.includes('supabase.auth')) {
        if (event.newValue === null && event.oldValue !== null) {
          // Token was removed - user signed out in another tab
          const currentPath = pathnameRef.current;
          const isPublicPage = PUBLIC_ROUTE_PREFIXES.some((path) => currentPath?.startsWith(path));

          if (!isPublicPage) {
            debugLog('[SessionSync] Storage cleared, redirecting to /login');
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
  }, [router]); // Removed pathname from deps - use ref instead

  // This component doesn't render anything
  return null;
}

