import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signInAs,
  supabase,
  type TestUser,
} from './utils/test-helpers';
import * as OTPAuth from 'otpauth';

/**
 * Account Settings & MFA Enrollment E2E Tests
 *
 * Covers the /account page: profile display, password changes (valid and
 * too-short), MFA TOTP enrollment/unenrollment, and linked-identities card.
 * All tests use the createTestUser factory for isolation; cleanup is handled
 * by the existing global teardown.
 */
test.describe('Account Settings & MFA', () => {
  let testUser: TestUser;

  test.beforeAll(async () => {
    testUser = await createTestUser({ tag: 'acct-settings' });
  });

  test('account page loads and shows user email', async ({ page }) => {
    await signInAs(page, testUser, { next: '/account' });
    await page.waitForURL('**/account', { timeout: 15000 });

    // The account page should display the user's email
    await expect(page.getByText(testUser.email)).toBeVisible({ timeout: 10000 });

    // Profile card heading should be visible (use the card title heading)
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible({ timeout: 5000 });
  });

  test('change password with valid 14-char password succeeds', async ({ page }) => {
    await signInAs(page, testUser, { next: '/account' });
    await page.waitForURL('**/account', { timeout: 15000 });

    // Open the Change Password dialog
    const changeBtn = page.getByRole('button', { name: /Change Password/ });
    await expect(changeBtn).toBeVisible({ timeout: 10000 });
    await changeBtn.click();

    // The dialog should appear
    await expect(page.getByText('Enter a new password for your account.')).toBeVisible({
      timeout: 5000,
    });

    // Fill in a valid 14-char password
    const newPassword = 'ValidPw14chars';
    await page.locator('#newPassword').fill(newPassword);
    await page.locator('#confirmPassword').fill(newPassword);

    // Submit the form
    await page.getByRole('button', { name: /^Change Password$/ }).click();

    // Verify success toast
    await expect(page.getByText('Password changed successfully')).toBeVisible({
      timeout: 10000,
    });

    // Update the test user's password so later tests can still sign in via
    // the admin magic link (password change doesn't break magic-link signInAs).
  });

  test('change password with 5-char password shows error', async ({ page }) => {
    await signInAs(page, testUser, { next: '/account' });
    await page.waitForURL('**/account', { timeout: 15000 });

    // Open the Change Password dialog
    const changeBtn = page.getByRole('button', { name: /Change Password/ });
    await expect(changeBtn).toBeVisible({ timeout: 10000 });
    await changeBtn.click();

    await expect(page.getByText('Enter a new password for your account.')).toBeVisible({
      timeout: 5000,
    });

    // Fill in a too-short password (5 chars) — below the 12-char minimum
    const shortPassword = 'ab12x';
    await page.locator('#newPassword').fill(shortPassword);
    await page.locator('#confirmPassword').fill(shortPassword);

    // Submit the form
    await page.getByRole('button', { name: /^Change Password$/ }).click();

    // Verify error toast about minimum length
    await expect(page.getByText(/at least 12 characters/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('MFA enrollment: enroll TOTP with valid code', async ({ page }) => {
    // Create a fresh user for MFA enrollment to avoid state leakage
    const mfaUser = await createTestUser({ tag: 'mfa-enroll' });
    await signInAs(page, mfaUser, { next: '/account' });
    await page.waitForURL('**/account', { timeout: 15000 });

    // Click the "Add Authenticator" button to start enrollment
    const addBtn = page.getByRole('button', { name: /Add Authenticator/ });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // The dialog should appear with the "Set Up Authenticator" title
    await expect(page.getByText('Set Up Authenticator')).toBeVisible({ timeout: 5000 });

    // Click "Continue" to start enrollment (no friendly name needed)
    await page.getByRole('button', { name: /Continue/ }).click();

    // Wait for the QR code step OR an error toast if TOTP enrollment is disabled
    // on this Supabase instance.
    const verifyStep = page.getByText('Verify Setup');
    const errorToast = page.getByText(/enroll is disabled|Failed to start enrollment/i);
    const which = await Promise.race([
      verifyStep.waitFor({ timeout: 15000 }).then(() => 'verify' as const),
      errorToast.waitFor({ timeout: 15000 }).then(() => 'disabled' as const),
    ]);

    if (which === 'disabled') {
      test.skip(true, 'TOTP enrollment is disabled on this Supabase instance');
      return;
    }

    // The QR code image should be visible
    await expect(
      page.locator('img[alt="QR Code for authenticator setup"]')
    ).toBeVisible({ timeout: 10000 });

    // Read the TOTP secret from the <code> element
    const secretElement = page.locator('code.font-mono');
    await expect(secretElement).toBeVisible({ timeout: 5000 });
    const secret = (await secretElement.textContent())?.trim();
    expect(secret).toBeTruthy();

    // Generate a valid TOTP code from the secret
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret!),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    const code = totp.generate();

    // Enter the code in the verification input
    await page.locator('#verifyCode').fill(code);

    // Submit verification
    await page.getByRole('button', { name: /Verify & Enable/ }).click();

    // Verify success toast
    await expect(page.getByText('MFA enabled successfully')).toBeVisible({
      timeout: 15000,
    });

    // After success, the factor should appear in the MFA factors list —
    // look for the "Authenticator App" label and "verified" badge
    await expect(page.getByText('Authenticator App', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('verified')).toBeVisible({ timeout: 5000 });

    // Clean up via admin API to avoid polluting state
    await cleanupMfaFactors(mfaUser.id);
  });

  test('MFA unenrollment: remove enrolled factor', async ({ page }) => {
    // Create a fresh user, enroll MFA via the admin API, then test the UI unenroll flow
    const mfaUser = await createTestUser({ tag: 'mfa-unenroll' });

    // Enroll TOTP via admin API to set up the pre-condition.
    // Skip the test if TOTP enrollment is disabled on this instance.
    let factorId: string;
    let totpSecret: string;
    try {
      const result = await enrollMfaViaAdmin(mfaUser);
      factorId = result.factorId;
      totpSecret = result.totpSecret;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('disabled')) {
        test.skip(true, 'TOTP enrollment is disabled on this Supabase instance');
        return;
      }
      throw err;
    }

    // Sign in. The user now has a verified MFA factor.
    await signInAs(page, mfaUser, { next: '/account' });
    await page.waitForURL('**/account', { timeout: 15000 });

    // The enrolled factor should be visible in the list
    await expect(page.getByText('Authenticator App').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('verified')).toBeVisible({ timeout: 5000 });

    // Click the delete button (trash icon) for the factor
    const deleteBtn = page.locator('button:has(svg.text-destructive)');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // The confirmation dialog should appear
    await expect(page.getByText('Remove MFA Factor')).toBeVisible({ timeout: 5000 });

    // Click "Remove" to confirm deletion
    const removeBtn = page.getByRole('button', { name: /^Remove$/ });
    await removeBtn.click();

    // The step-up modal may appear because removing MFA requires MFA verification.
    // Check if the step-up modal appears and handle it.
    const stepUpInput = page.locator('input[placeholder="000000"]');
    const stepUpVisible = await stepUpInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (stepUpVisible) {
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(totpSecret),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });

      // Wait until we're early in a fresh TOTP window to avoid boundary expiry
      const secsIntoWindow = Math.floor(Date.now() / 1000) % 30;
      if (secsIntoWindow > 20) {
        await page.waitForTimeout((31 - secsIntoWindow) * 1000);
      }

      await stepUpInput.fill(totp.generate());
      await page.getByRole('button', { name: /Verify/i }).click();

      // If the code was stale, the modal stays open — retry once with a fresh code
      const stillVisible = await stepUpInput.isVisible({ timeout: 3000 }).catch(() => false);
      if (stillVisible) {
        await page.waitForTimeout(5000);
        await stepUpInput.clear();
        await stepUpInput.fill(totp.generate());
        await page.getByRole('button', { name: /Verify/i }).click();
      }
    }

    // Verify success: toast should show "MFA factor removed"
    await expect(page.getByText('MFA factor removed')).toBeVisible({ timeout: 15000 });

    // The factor should no longer be in the list — the empty state should show
    await expect(page.getByText('No MFA factors enrolled')).toBeVisible({ timeout: 10000 });
  });

  test('linked identities card is visible', async ({ page }) => {
    await signInAs(page, testUser, { next: '/account' });
    await page.waitForURL('**/account', { timeout: 15000 });

    // The LinkedIdentitiesCard should render with its heading
    await expect(page.getByText('Connected sign-in methods')).toBeVisible({
      timeout: 10000,
    });

    // The card should show at least the supported providers (Google, Apple, GitHub).
    // Use exact: true to avoid matching substrings in the card description.
    await expect(page.getByText('Google', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Apple', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('GitHub', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Enroll a TOTP factor for a user via the admin API. Returns the factor ID
 * and the TOTP secret so the test can generate codes if needed.
 */
async function enrollMfaViaAdmin(user: TestUser): Promise<{ factorId: string; totpSecret: string }> {
  // Use the Supabase admin client to sign in as the user, enroll, and verify
  // TOTP in one shot. We do this server-side to set up the test pre-condition.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
  if (signInError || !signInData.session) {
    throw new Error(`Admin sign-in failed for ${user.email}: ${signInError?.message}`);
  }

  // We need a user-scoped client (not the admin service-role one) to call MFA methods
  const { createClient } = await import('@supabase/supabase-js');
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${signInData.session.access_token}`,
        },
      },
    }
  );

  // Set the session on the user client
  await userClient.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  // Enroll TOTP
  const { data: enrollData, error: enrollError } = await userClient.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'E2E Test Factor',
  });
  if (enrollError || !enrollData) {
    throw new Error(`MFA enroll failed: ${enrollError?.message}`);
  }

  const totpSecret = enrollData.totp.secret;
  const factorId = enrollData.id;

  // Generate a valid TOTP code and verify the enrollment
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(totpSecret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  const code = totp.generate();

  // Challenge + verify
  const { data: challengeData, error: challengeError } =
    await userClient.auth.mfa.challenge({ factorId });
  if (challengeError || !challengeData) {
    throw new Error(`MFA challenge failed: ${challengeError?.message}`);
  }

  const { error: verifyError } = await userClient.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });
  if (verifyError) {
    throw new Error(`MFA verify failed: ${verifyError.message}`);
  }

  return { factorId, totpSecret };
}

/**
 * Clean up all MFA factors for a user via admin API.
 */
async function cleanupMfaFactors(userId: string) {
  const { data, error } = await supabase.auth.admin.mfa.listFactors({
    userId,
  });
  if (error || !data) return;

  for (const factor of data.factors) {
    await supabase.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
  }
}
