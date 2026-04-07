export const AUTH_FEATURES = {
  // Passkeys (WebAuthn)
  PASSKEYS: process.env.NEXT_PUBLIC_AUTH_PASSKEYS === 'true',

  // OAuth providers
  GOOGLE_LOGIN: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true',
  GITHUB_LOGIN: process.env.NEXT_PUBLIC_AUTH_GITHUB === 'true',

  // Email OTP (6-digit code) vs magic link
  EMAIL_OTP: process.env.NEXT_PUBLIC_AUTH_EMAIL_OTP === 'true',

  // Traditional password sign-in (ON unless explicitly disabled)
  PASSWORD_LOGIN: process.env.NEXT_PUBLIC_AUTH_PASSWORD !== 'false',

  // Magic links (default OFF; set to 'true' to enable)
  MAGIC_LINK: process.env.NEXT_PUBLIC_AUTH_MAGIC_LINK === 'true',
} as const;

export const AUTH_PORTAL = {
  /**
   * Public base URL of this auth portal (used for origins/redirects).
   *
   * Prefer setting NEXT_PUBLIC_APP_URL and reuse it here.
   */
  BASE_URL:
    process.env.NEXT_PUBLIC_AUTH_PORTAL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3050',

  /**
   * Relying Party ID for passkeys.
   *
   * For Option B (central auth portal), this should be the portal host
   * (e.g. auth.mycompany.com). Passkeys will only work on this RP ID.
   */
  RP_ID: process.env.NEXT_PUBLIC_AUTH_PASSKEY_RP_ID || undefined,
} as const;

export function getAuthPortalHostname(): string {
  try {
    return new URL(AUTH_PORTAL.BASE_URL).hostname;
  } catch {
    return 'localhost';
  }
}

export function getPasskeyRpId(): string {
  return AUTH_PORTAL.RP_ID || getAuthPortalHostname();
}
