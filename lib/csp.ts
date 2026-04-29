/**
 * Content Security Policy helpers.
 *
 * We generate a per-request nonce, set it on the request headers (so layouts
 * can read it via next/headers and tag inline/external scripts with it), and
 * use 'strict-dynamic' so any nonce-trusted script can chain-load further
 * scripts without each one needing its own allowlist entry.
 *
 * Notes:
 *   - style-src keeps 'unsafe-inline'. Tailwind, sonner toasts, and many
 *     React libraries inject inline styles; tightening style-src is a much
 *     bigger refactor and the XSS-via-style attack surface is far smaller
 *     than XSS-via-script.
 *   - In development we add 'unsafe-eval' for Next.js HMR / React dev tools.
 *   - 'strict-dynamic' makes 'self' and host-source allowlists for scripts
 *     ignored by browsers that support it (Chrome, FF, Edge); legacy
 *     browsers fall back to the host allowlist.
 */

const SCRIPT_HOST_FALLBACKS: string[] = [
  // Add additional script hosts here if you load any. Today we serve our own
  // analytics script (/a/script.js) from same-origin, so only 'self' applies.
];

export function generateNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64');
}

export function buildCspHeader(params: {
  nonce: string;
  supabaseUrl: string;
  isDev: boolean;
}): string {
  const { nonce, supabaseUrl, isDev } = params;

  const scriptSrc = [
    `'self'`,
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    ...SCRIPT_HOST_FALLBACKS,
    isDev ? `'unsafe-eval'` : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Connect: self for our own routes, supabaseUrl for auth/realtime, plus
  // the HIBP API used by the password policy server-side check.
  const connectSrc = [`'self'`, supabaseUrl, 'https://api.pwnedpasswords.com']
    .filter(Boolean)
    .join(' ');

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc}`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}
