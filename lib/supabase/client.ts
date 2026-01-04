import { createBrowserClient } from '@supabase/ssr';
import { debugLog, debugWarn, debugTrace } from '@/lib/auth-debug';

// Singleton browser client to prevent multiple instances causing conflicts
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

// Cookie helper functions for browser
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

function setCookie(
  name: string,
  value: string,
  options: { maxAge?: number; path?: string; sameSite?: 'Lax' | 'Strict' | 'None'; secure?: boolean } = {}
) {
  if (typeof document === 'undefined') return;

  const isSecure = window.location.protocol === 'https:';
  // Don't URL-encode - Supabase values are already base64 which is cookie-safe
  let cookie = `${name}=${value}`;

  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  cookie += `; Path=${options.path || '/'}`;
  cookie += `; SameSite=${options.sameSite || 'Lax'}`;
  if (isSecure) cookie += '; Secure';

  const ts = Date.now();
  debugLog(`[${ts}] [setCookie] Setting:`, name, 'value length:', value.length, 'cookie total length:', cookie.length);

  // Check if cookie is too large (4KB limit per cookie)
  if (cookie.length > 4096) {
    console.error(`[${ts}] [setCookie] WARNING: Cookie exceeds 4KB limit!`, name, cookie.length);
  }

  document.cookie = cookie;

  // Verify it was set with value
  const allCookies = document.cookie;
  const cookieMatch = allCookies.match(new RegExp(`${name}=([^;]*)`));
  const storedValue = cookieMatch ? cookieMatch[1] : '';
  debugLog(`[${ts}] [setCookie] Verification - stored value length:`, storedValue.length, 'expected:', value.length);
  if (storedValue.length !== value.length) {
    console.error(`[${ts}] [setCookie] MISMATCH! Cookie value was not stored correctly`);
    console.error(`[${ts}] [setCookie] Expected length:`, value.length, 'Got:', storedValue.length);
  }
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

export function createClient() {
  if (browserClient) {
    debugLog('[Supabase Client] Returning existing client');
    return browserClient;
  }

  debugLog('[Supabase Client] Creating new browser client with custom cookie handlers');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  browserClient = createBrowserClient(supabaseUrl, supabaseKey, {
    // Note: NOT using isSingleton - we manage our own singleton externally
    // Using both can cause state conflicts
    cookies: {
      getAll() {
        if (typeof document === 'undefined') return [];

        const cookies: { name: string; value: string }[] = [];
        document.cookie.split(';').forEach(cookie => {
          const [name, ...valueParts] = cookie.trim().split('=');
          if (name) {
            cookies.push({ name, value: valueParts.join('=') });
          }
        });
        debugLog('[Supabase Client] getAll called, found', cookies.length, 'cookies');
        return cookies;
      },
      setAll(cookiesToSet) {
        const ts = Date.now();
        debugLog(`[${ts}] [Supabase Client] setAll called with`, cookiesToSet.length, 'cookies');
        // Log stack trace if cookies are being cleared
        const deleteIntents = cookiesToSet
          .filter(({ value, options }) =>
            (value === '' || value === undefined || value === null) ||
            options?.maxAge === 0 ||
            (options?.expires ? new Date(options.expires).getTime() <= Date.now() : false)
          )
          .map(({ name, value, options }) => ({
            name,
            valueLength: value?.length ?? 0,
            maxAge: options?.maxAge,
            expires: options?.expires ? new Date(options.expires).toISOString() : undefined,
            path: options?.path,
            sameSite: options?.sameSite,
          }));
        if (deleteIntents.length > 0) {
          debugWarn(`[${ts}] [Supabase Client] Delete-intent cookies detected:`, deleteIntents);
          debugTrace(`[${ts}] [Supabase Client] Delete-intent stack:`);
        }
        cookiesToSet.forEach(({ name, value, options }) => {
          debugLog(`[${ts}] [Supabase Client] Setting cookie:`, name, 'length:', value.length);

          const isDelete = (!value || value.length === 0) && options?.maxAge === 0;
          if (!value || value.length === 0) {
            if (!isDelete) {
              debugWarn(`[${ts}] [Supabase Client] Skipping empty cookie without delete intent:`, name);
              return;
            }
          }

          // Map Supabase sameSite options to our type
          let sameSite: 'Lax' | 'Strict' | 'None' = 'Lax';
          const ss = String(options?.sameSite || 'lax').toLowerCase();
          if (ss === 'strict') sameSite = 'Strict';
          else if (ss === 'none') sameSite = 'None';

          setCookie(name, value, {
            maxAge: options?.maxAge ?? 7 * 24 * 60 * 60, // 7 days default
            path: options?.path ?? '/',
            sameSite,
            secure: window.location.protocol === 'https:',
          });
        });
        debugLog(`[${ts}] [Supabase Client] document.cookie length after setAll:`, document.cookie.length);
      },
    },
  });
  return browserClient;
}
