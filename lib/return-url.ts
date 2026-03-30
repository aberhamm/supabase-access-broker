import { isLogoutRedirectAllowed } from '@/lib/sso-service';

export interface ValidatedReturnUrl {
  valid: true;
  url: string;
  appName: string;
  appId: string;
}

export interface InvalidReturnUrl {
  valid: false;
}

export type ReturnUrlValidation = ValidatedReturnUrl | InvalidReturnUrl;

/**
 * Validate a return_url query parameter against registered app callback URLs.
 * Reuses the same validation as logout redirects (HTTPS required, must be in
 * an enabled app's allowed_callback_urls).
 */
export async function validateReturnUrl(
  returnUrl: string | null | undefined
): Promise<ReturnUrlValidation> {
  if (!returnUrl || typeof returnUrl !== 'string') {
    return { valid: false };
  }

  const trimmed = returnUrl.trim();
  if (!trimmed) {
    return { valid: false };
  }

  const result = await isLogoutRedirectAllowed(trimmed);

  if (result.allowed && result.appId && result.appName) {
    return {
      valid: true,
      url: trimmed,
      appName: result.appName,
      appId: result.appId,
    };
  }

  return { valid: false };
}
