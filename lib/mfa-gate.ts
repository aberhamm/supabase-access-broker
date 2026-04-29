/**
 * Step-up authentication helper for sensitive operations.
 *
 * Two enforcement modes (controlled by REQUIRE_MFA_FOR_ADMINS env var):
 *
 *   - "soft" (default): If the user HAS verified MFA factors enrolled, their
 *     session must be at AAL2 (i.e. they completed the MFA challenge during
 *     this login). If they have no factors, the operation is allowed — we
 *     don't block users who haven't enrolled yet, since that would lock
 *     out admins on first deployment.
 *
 *   - "hard": Admins MUST enroll MFA. No factors enrolled = blocked.
 *     Recommended once all admins have completed enrollment.
 *
 * Surface a `MFA_STEP_UP_REQUIRED` error code so the caller can route the
 * user to /account#mfa for enrollment or to a step-up challenge UI.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const MFA_STEP_UP_REQUIRED = 'MFA_STEP_UP_REQUIRED';
export const MFA_ENROLLMENT_REQUIRED = 'MFA_ENROLLMENT_REQUIRED';

export type MFAGateResult =
  | { ok: true }
  | { ok: false; code: typeof MFA_STEP_UP_REQUIRED | typeof MFA_ENROLLMENT_REQUIRED; message: string };

function isHardMode(): boolean {
  return process.env.REQUIRE_MFA_FOR_ADMINS === '1' || process.env.REQUIRE_MFA_FOR_ADMINS === 'true';
}

/**
 * Verify the calling user's session is sufficient for a sensitive operation.
 *
 * Call this AFTER your existing requireClaimsAdmin / requireAppAdmin check —
 * it's an additional gate, not a replacement.
 */
export async function requireStepUp(supabase: SupabaseClient): Promise<MFAGateResult> {
  // 1. Determine current AAL.
  const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) {
    // If we can't determine AAL, block. Better to error than silently allow.
    return {
      ok: false,
      code: MFA_STEP_UP_REQUIRED,
      message: 'Could not verify multi-factor authentication state.',
    };
  }

  const currentLevel = aalData?.currentLevel ?? 'aal1';
  const nextLevel = aalData?.nextLevel ?? 'aal1';

  // 2. List enrolled factors.
  const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
  if (factorsErr) {
    return {
      ok: false,
      code: MFA_STEP_UP_REQUIRED,
      message: 'Could not enumerate MFA factors.',
    };
  }

  const verifiedFactors = [
    ...(factorsData?.totp ?? []),
    ...(factorsData?.phone ?? []),
  ].filter((f) => f.status === 'verified');

  const hasEnrolledMFA = verifiedFactors.length > 0;

  // 3. Apply policy.
  if (!hasEnrolledMFA) {
    if (isHardMode()) {
      return {
        ok: false,
        code: MFA_ENROLLMENT_REQUIRED,
        message: 'Multi-factor authentication is required for admin actions. Enroll a factor in Account → Security.',
      };
    }
    // Soft mode: allow without MFA.
    return { ok: true };
  }

  // User has enrolled MFA — require AAL2 session.
  if (currentLevel !== 'aal2' || nextLevel === 'aal2' && currentLevel !== 'aal2') {
    return {
      ok: false,
      code: MFA_STEP_UP_REQUIRED,
      message: 'Re-authenticate with your MFA factor to continue.',
    };
  }

  return { ok: true };
}

/**
 * Convenience: throw on failure with a stable error message containing the
 * step-up code so server actions can surface it to the client.
 */
export async function assertStepUp(supabase: SupabaseClient): Promise<void> {
  const result = await requireStepUp(supabase);
  if (!result.ok) {
    const err = new Error(result.message) as Error & { code?: string };
    err.code = result.code;
    throw err;
  }
}

/**
 * Re-throw an error from a catch block while preserving the step-up code.
 *
 * The default `throw new Error(err.message)` pattern in many server actions
 * loses the `code` property that assertStepUp() attaches, which means the
 * client-side withStepUp() can't detect that step-up is needed. Use this
 * helper instead when you want to wrap or sanitize the error message.
 */
export function rethrowWithCode(err: unknown, fallbackMessage: string): never {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    const wrapped = new Error(err.message) as Error & { code?: string };
    if (code) wrapped.code = code;
    throw wrapped;
  }
  throw new Error(fallbackMessage);
}
