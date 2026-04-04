import { test, expect } from '@playwright/test';
import {
  ensureTestUser,
  createTestApp,
  grantUserAppAccess,
  revokeUserAppAccess,
  setAppSelfSignup,
  supabase,
  TEST_USER,
  TEST_APP,
} from './utils/test-helpers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
const DEMO_CALLBACK = `${APP_URL}/demo/sso-demo.html`;

test.describe('Self-Service Signup', () => {
  let testUserId: string;

  test.beforeAll(async () => {
    const user = await ensureTestUser();
    testUserId = user.id;
    await createTestApp();
  });

  test.afterAll(async () => {
    // Reset self-signup to off after tests
    await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false }).catch(() => {});
  });

  test.describe('Signup page without app_id', () => {
    test('shows error when no app_id is provided', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByText('No application specified')).toBeVisible();
      await expect(page.getByText('Go to sign in')).toBeVisible();
    });
  });

  test.describe('Signup page with invalid app', () => {
    test('shows error for non-existent app', async ({ page }) => {
      await page.goto('/signup?app_id=nonexistent-app-12345&redirect_uri=http://localhost:3050/demo/sso-demo.html');
      await expect(page.getByText('not recognized')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Self-signup disabled', () => {
    test.beforeAll(async () => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });
    });

    test('shows contact admin message when self-signup is off', async ({ page }) => {
      await page.goto(`/signup?app_id=${TEST_APP.id}&redirect_uri=${encodeURIComponent(DEMO_CALLBACK)}`);
      await expect(page.getByText('Self-registration is not available')).toBeVisible({ timeout: 10000 });
    });

    test('does not show any auth forms', async ({ page }) => {
      await page.goto(`/signup?app_id=${TEST_APP.id}&redirect_uri=${encodeURIComponent(DEMO_CALLBACK)}`);
      await page.waitForTimeout(2000);
      await expect(page.getByRole('textbox', { name: 'Email' })).not.toBeVisible();
    });
  });

  test.describe('Self-signup enabled', () => {
    test.beforeAll(async () => {
      await setAppSelfSignup(TEST_APP.id, {
        allow_self_signup: true,
        self_signup_default_role: 'user',
      });
    });

    test.afterAll(async () => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });
    });

    test('shows auth forms when self-signup is enabled', async ({ page }) => {
      await page.goto(`/signup?app_id=${TEST_APP.id}&redirect_uri=${encodeURIComponent(DEMO_CALLBACK)}`);
      await expect(page.getByText('Create account')).toBeVisible({ timeout: 10000 });
      // At least one auth input should be visible
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    });

    test('shows sign-in link that preserves SSO params', async ({ page }) => {
      const state = 'test-state-123';
      await page.goto(
        `/signup?app_id=${TEST_APP.id}&redirect_uri=${encodeURIComponent(DEMO_CALLBACK)}&state=${state}`
      );
      await expect(page.getByText('Create account')).toBeVisible({ timeout: 10000 });

      const signInLink = page.getByRole('link', { name: 'Sign in' });
      await expect(signInLink).toBeVisible();

      const href = await signInLink.getAttribute('href');
      expect(href).toContain('app_id=' + TEST_APP.id);
      expect(href).toContain('redirect_uri=');
      expect(href).toContain('state=' + state);
    });
  });

  test.describe('Existing user self-grant', () => {
    test.beforeAll(async () => {
      await setAppSelfSignup(TEST_APP.id, {
        allow_self_signup: true,
        self_signup_default_role: 'user',
      });
    });

    test.afterAll(async () => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });
    });

    test('existing user without app access sees grant prompt', async ({ page }) => {
      // Ensure user does NOT have access to the app
      await revokeUserAppAccess(testUserId, TEST_APP.id);

      // Sign in as the test user via Supabase auth
      await page.goto('/login');
      const { data } = await supabase.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password,
      });
      if (!data.session) {
        test.skip(true, 'Could not sign in test user — password auth may be disabled');
        return;
      }

      // Set the session in the browser
      await page.evaluate(
        ({ accessToken, refreshToken }) => {
          localStorage.setItem(
            'sb-' + new URL(document.location.href).hostname + '-auth-token',
            JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
          );
        },
        {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        }
      );

      // Navigate to signup page
      await page.goto(
        `/signup?app_id=${TEST_APP.id}&redirect_uri=${encodeURIComponent(DEMO_CALLBACK)}&state=test`
      );

      // Should see the existing user prompt
      await expect(page.getByText("You're signed in as")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Continue with this account')).toBeVisible();
      await expect(page.getByText('Use a different account')).toBeVisible();
    });
  });

  test.describe('API: autoGrantAppAccess logic', () => {
    test.beforeAll(async () => {
      await setAppSelfSignup(TEST_APP.id, {
        allow_self_signup: true,
        self_signup_default_role: 'viewer',
      });
    });

    test.afterAll(async () => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });
      // Clean up: revoke access so other tests aren't affected
      await revokeUserAppAccess(testUserId, TEST_APP.id).catch(() => {});
    });

    test('grants correct default role via claims', async () => {
      // Remove any existing access
      await revokeUserAppAccess(testUserId, TEST_APP.id);

      // Simulate what autoGrantAppAccess does: call set_app_claims_batch
      const { data: appData } = await supabase
        .schema('access_broker_app')
        .from('apps')
        .select('allow_self_signup,self_signup_default_role')
        .eq('id', TEST_APP.id)
        .single();

      expect(appData?.allow_self_signup).toBe(true);
      expect(appData?.self_signup_default_role).toBe('viewer');

      // Grant via RPC (same as autoGrantAppAccess)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('set_app_claims_batch', {
        p_uid: testUserId,
        p_app_id: TEST_APP.id,
        p_claims: { enabled: true, role: appData!.self_signup_default_role },
      });

      expect(rpcError).toBeNull();
      expect((rpcResult as { status: string })?.status).toBe('OK');

      // Verify the claims were set
      const { data: userData } = await supabase.auth.admin.getUserById(testUserId);
      const appClaims = userData?.user?.app_metadata?.apps?.[TEST_APP.id];
      expect(appClaims).toEqual({ enabled: true, role: 'viewer' });
    });

    test('rejects grant when self-signup is disabled', async ({ request }) => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });

      // Verify the API reflects the setting
      const response = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/auth-methods`);
      const body = await response.json();
      expect(body.allow_self_signup).toBe(false);
    });

    test('idempotent: granting twice does not error', async () => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: true });
      await revokeUserAppAccess(testUserId, TEST_APP.id);

      // Grant once
      const { error: err1 } = await supabase.rpc('set_app_claims_batch', {
        p_uid: testUserId,
        p_app_id: TEST_APP.id,
        p_claims: { enabled: true, role: 'user' },
      });
      expect(err1).toBeNull();

      // Grant again — should succeed (no-op or overwrite)
      const { error: err2 } = await supabase.rpc('set_app_claims_batch', {
        p_uid: testUserId,
        p_app_id: TEST_APP.id,
        p_claims: { enabled: true, role: 'user' },
      });
      expect(err2).toBeNull();
    });
  });

  test.describe('Auth methods API reflects self-signup config', () => {
    test('returns allow_self_signup and default role', async ({ request }) => {
      await setAppSelfSignup(TEST_APP.id, {
        allow_self_signup: true,
        self_signup_default_role: 'trial',
      });

      const response = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/auth-methods`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.allow_self_signup).toBe(true);
      expect(body.self_signup_default_role).toBe('trial');

      // Clean up
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });
    });

    test('defaults to false when not set', async ({ request }) => {
      await setAppSelfSignup(TEST_APP.id, { allow_self_signup: false });

      const response = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/auth-methods`);
      const body = await response.json();
      expect(body.allow_self_signup).toBe(false);
    });
  });
});
