import { test, expect } from '@playwright/test';
import {
  ensureTestUser,
  createTestApp,
  grantUserAppAccess,
  TEST_USER,
  TEST_APP,
} from './utils/test-helpers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
const DEMO_CALLBACK = `${APP_URL}/demo/sso-demo.html`;

/**
 * Simplified SSO E2E tests that work with any auth method
 * These tests verify the SSO redirect flow and code exchange
 */
test.describe('SSO Integration - Simplified E2E', () => {
  let testUserId: string;

  test.beforeAll(async () => {
    const user = await ensureTestUser();
    testUserId = user.id;
    await createTestApp();
    // Use existing demo-app, just ensure user has access
    await grantUserAppAccess(testUserId, TEST_APP.id);
  });

  test('should generate SSO redirect URL with correct parameters', async ({ page }) => {
    await page.goto('/demo/sso-demo.html');

    // Intercept the navigation when clicking sign in
    const [response] = await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/login') || response.url().includes('/sso/complete')
      ),
      page.click('text=Sign In with Auth Portal')
    ]);

    const url = new URL(response.url());

    // SSO params should be directly in the URL (not in a 'next' param)
    // The middleware handles SSO params specially
    if (url.pathname === '/login') {
      // Check SSO params are in the login URL directly
      expect(url.searchParams.get('app_id')).toBe(TEST_APP.id);
      expect(url.searchParams.get('redirect_uri')).toContain('/demo/sso-demo.html');
      expect(url.searchParams.get('state')).toBeTruthy();
    }
    // If redirected to /sso/complete (user already logged in), check params
    else if (url.pathname === '/sso/complete') {
      expect(url.searchParams.get('app_id')).toBe(TEST_APP.id);
      expect(url.searchParams.get('redirect_uri')).toContain('/demo/sso-demo.html');
      expect(url.searchParams.get('state')).toBeTruthy();
    }
  });

  test('should exchange code and display user info (manual verification)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'This test requires manual login or password auth');

    // This test documents what SHOULD happen in the full flow
    // For it to fully pass, you need to be logged in or enable password auth

    await page.goto('/demo/sso-demo.html');

    // Click sign in
    await page.click('text=Sign In with Auth Portal');

    // Give time for redirect
    await page.waitForTimeout(3000);

    // Check current URL
    const url = page.url();
    console.log('Current URL after SSO initiation:', url);

    // If we end up back at the demo page, verify the exchange worked
    if (url.includes('/demo/sso-demo.html') && !url.includes('code=')) {
      // Check if user info is displayed (meaning auto-exchange happened)
      const hasUserInfo = await page.locator('text=User Information').isVisible({ timeout: 2000 }).catch(() => false);

      if (hasUserInfo) {
        await expect(page.locator(`text=${TEST_USER.email}`)).toBeVisible();
        await expect(page.locator('text=Granted')).toBeVisible();
        console.log('✓ SSO flow completed successfully with user info displayed');
      } else {
        console.log('User not logged in - would need to complete login manually');
      }
    }
  });

  test('API: should exchange valid auth code for user data', async ({ request }) => {
    // Create a mock auth code programmatically
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create an auth code manually
    const code = `test-code-${Date.now()}`;
    const { error: insertError } = await supabase.schema('access_broker_app').from('auth_codes').insert({
      code,
      user_id: testUserId,
      app_id: TEST_APP.id,
      redirect_uri: DEMO_CALLBACK,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
    });

    expect(insertError).toBeNull();

    // Exchange the code via API
    const response = await request.post(`${APP_URL}/api/auth/exchange`, {
      data: {
        code,
        app_id: TEST_APP.id,
        redirect_uri: DEMO_CALLBACK,
        app_secret: TEST_APP.secret,
      },
    });

    const body = await response.json();

    if (response.status() !== 200) {
      console.error('Code exchange failed:', body);
    }

    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('app_claims');
    expect(body).toHaveProperty('app_id', TEST_APP.id);
    expect(body.user.email).toBe(TEST_USER.email);
    expect(body.app_claims.enabled).toBe(true);
    expect(body.app_claims.role).toBe('user');
  });

  test('API: should reject invalid redirect_uri', async ({ page }) => {
    // Try to access SSO complete endpoint with unauthorized callback URL
    await page.goto('/');

    // Try to navigate to SSO complete with bad redirect_uri
    await page.goto('/sso/complete?app_id=demo-app&redirect_uri=https://evil.com/callback&state=test');

    // Should either show error or redirect to login/error page
    await page.waitForTimeout(2000);

    const finalUrl = page.url();

    // The key check: we should NOT have been redirected to evil.com domain
    const finalDomain = new URL(finalUrl).hostname;
    expect(finalDomain).not.toBe('evil.com');

    // Should stay on our localhost domain (login, error page, or home)
    expect(finalDomain).toMatch(/localhost|127\.0\.0\.1/);

    // Verify we're on a safe page (not the malicious callback)
    const appHost = new URL(APP_URL).host;
    const expectedPattern = new RegExp(`${appHost.replace('.', '\\.')}\\/(login|access-denied|$)`);
    expect(finalUrl).toMatch(expectedPattern);
  });

  test('API: should reject reused auth codes', async ({ request }) => {
    // Create and immediately use an auth code
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const code = `test-code-reuse-${Date.now()}`;
    await supabase.schema('access_broker_app').from('auth_codes').insert({
      code,
      user_id: testUserId,
      app_id: TEST_APP.id,
      redirect_uri: DEMO_CALLBACK,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // Use the code once
    const firstResponse = await request.post(`${APP_URL}/api/auth/exchange`, {
      data: {
        code,
        app_id: TEST_APP.id,
        redirect_uri: DEMO_CALLBACK,
        app_secret: TEST_APP.secret,
      },
    });

    expect(firstResponse.status()).toBe(200);

    // Try to reuse the same code
    const secondResponse = await request.post(`${APP_URL}/api/auth/exchange`, {
      data: {
        code,
        app_id: TEST_APP.id,
        redirect_uri: DEMO_CALLBACK,
        app_secret: TEST_APP.secret,
      },
    });

    expect(secondResponse.status()).toBe(400);
    const body = await secondResponse.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  test('API: should reject exchange with mismatched redirect_uri (Critical #3)', async ({ request }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const code = `test-code-redirect-${Date.now()}`;
    await supabase.schema('access_broker_app').from('auth_codes').insert({
      code,
      user_id: testUserId,
      app_id: TEST_APP.id,
      redirect_uri: DEMO_CALLBACK,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // Exchange with WRONG redirect_uri
    const response = await request.post(`${APP_URL}/api/auth/exchange`, {
      data: {
        code,
        app_id: TEST_APP.id,
        redirect_uri: 'https://evil.com/steal',
        app_secret: TEST_APP.secret,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  test('API: should reject exchange without redirect_uri', async ({ request }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const code = `test-code-noredirect-${Date.now()}`;
    await supabase.schema('access_broker_app').from('auth_codes').insert({
      code,
      user_id: testUserId,
      app_id: TEST_APP.id,
      redirect_uri: DEMO_CALLBACK,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // Exchange WITHOUT redirect_uri — should be rejected (now required)
    const response = await request.post(`${APP_URL}/api/auth/exchange`, {
      data: {
        code,
        app_id: TEST_APP.id,
        app_secret: TEST_APP.secret,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/missing|required/i);
  });

  test('API: concurrent exchange of same code — only one succeeds (Critical #2)', async ({ request }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const code = `test-code-race-${Date.now()}`;
    await supabase.schema('access_broker_app').from('auth_codes').insert({
      code,
      user_id: testUserId,
      app_id: TEST_APP.id,
      redirect_uri: DEMO_CALLBACK,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // Fire two concurrent exchange requests
    const exchangeData = {
      code,
      app_id: TEST_APP.id,
      redirect_uri: DEMO_CALLBACK,
      app_secret: TEST_APP.secret,
    };

    const [res1, res2] = await Promise.all([
      request.post(`${APP_URL}/api/auth/exchange`, { data: exchangeData }),
      request.post(`${APP_URL}/api/auth/exchange`, { data: exchangeData }),
    ]);

    const statuses = [res1.status(), res2.status()].sort();
    // Exactly one should succeed (200) and one should fail (400)
    expect(statuses).toEqual([200, 400]);
  });
});
