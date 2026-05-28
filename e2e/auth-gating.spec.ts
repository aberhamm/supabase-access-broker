import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signInAs,
  type TestUser,
} from './utils/test-helpers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
const DEMO_CALLBACK = `${APP_URL}/demo/sso-demo.html`;

/**
 * Auth Gating & Access Control E2E Tests
 *
 * Verifies the middleware enforces correct redirect behaviour:
 * - Unauthenticated users are redirected to /login
 * - Non-admin users are redirected to /access-denied
 * - Admin users (global or app-scoped) can reach the dashboard
 * - SSO params on /login redirect authenticated users to /sso/continue
 * - The ?next= param preserves the original path through login
 *
 * All tests use factory-created users for isolation; cleanup
 * is handled by the global teardown.
 */

test.describe('Auth Gating & Access Control', () => {
  let globalAdmin: TestUser;
  let appAdmin: TestUser;
  let nonAdmin: TestUser;

  test.beforeAll(async () => {
    // Create users with different permission levels
    [globalAdmin, appAdmin, nonAdmin] = await Promise.all([
      createTestUser({ tag: 'gate-global-admin', globalAdmin: true }),
      createTestUser({
        tag: 'gate-app-admin',
        apps: {
          'demo-app': { enabled: true, role: 'admin' },
        },
      }),
      createTestUser({ tag: 'gate-nonadmin' }),
    ]);
  });

  // -------------------------------------------------------------------------
  // Test 1: Unauthenticated → / redirects to /login
  // -------------------------------------------------------------------------
  test('unauthenticated request to / redirects to /login', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForURL('**/login**', { timeout: 15000 });
      expect(page.url()).toContain('/login');
    } finally {
      await context.close();
    }
  });

  // -------------------------------------------------------------------------
  // Test 2: Unauthenticated → /login renders without redirect loop
  // -------------------------------------------------------------------------
  test('unauthenticated request to /login renders login page (no redirect loop)', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/login');
      // Should stay on /login
      await page.waitForLoadState('load');
      expect(page.url()).toContain('/login');
      // Login page should render — look for the sign-in heading or card
      await expect(
        page.getByText('Sign in').first()
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: Non-admin user → / redirects to /access-denied
  // -------------------------------------------------------------------------
  test('non-admin user accessing / is redirected to /access-denied', async ({ page }) => {
    await signInAs(page, nonAdmin, { next: '/' });
    // signInAs navigates through /auth/confirm which sets the session,
    // then the middleware should redirect non-admins to /access-denied
    await page.waitForURL('**/access-denied**', { timeout: 15000 });
    expect(page.url()).toContain('/access-denied');
  });

  // -------------------------------------------------------------------------
  // Test 4: /access-denied page renders appropriate content
  // -------------------------------------------------------------------------
  test('/access-denied page displays expected messaging', async ({ page }) => {
    await signInAs(page, nonAdmin, { next: '/access-denied' });
    await page.waitForURL('**/access-denied**', { timeout: 15000 });

    // The page title
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 15000 });

    // The description
    await expect(
      page.getByText('You do not have permission to access this application')
    ).toBeVisible({ timeout: 10000 });

    // The claims_admin reference
    await expect(page.getByText('claims_admin').first()).toBeVisible({ timeout: 5000 });

    // Action buttons
    await expect(page.getByRole('button', { name: /Refresh Session/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Test 5: Global admin → / loads the dashboard
  // -------------------------------------------------------------------------
  test('global admin can access dashboard at /', async ({ page }) => {
    await signInAs(page, globalAdmin, { next: '/' });
    // Should NOT be redirected to /access-denied or /login
    await page.waitForLoadState('load');
    // Wait for the page to settle — middleware may redirect once
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).not.toContain('/access-denied');
  });

  // -------------------------------------------------------------------------
  // Test 6: App admin (not global admin) → / loads the dashboard
  // -------------------------------------------------------------------------
  test('app admin (not global admin) can access dashboard at /', async ({ page }) => {
    await signInAs(page, appAdmin, { next: '/' });
    // Should NOT be redirected to /access-denied or /login
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).not.toContain('/access-denied');
  });

  // -------------------------------------------------------------------------
  // Test 7: Authenticated + SSO params on /login → redirect to /sso/continue
  // -------------------------------------------------------------------------
  test('authenticated user on /login with SSO params redirects to /sso/continue', async ({ page }) => {
    // First sign in the user
    await signInAs(page, globalAdmin, { next: '/' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);

    // Now navigate to /login with SSO params
    const loginUrl = `/login?app_id=demo-app&redirect_uri=${encodeURIComponent(DEMO_CALLBACK)}`;
    await page.goto(loginUrl);

    // Middleware should redirect authenticated user with SSO params to /sso/continue
    await page.waitForURL('**/sso/continue**', { timeout: 15000 });
    expect(page.url()).toContain('/sso/continue');
    expect(page.url()).toContain('app_id=demo-app');
  });

  // -------------------------------------------------------------------------
  // Test 8: Unauthenticated → /?foo=bar → /login?next= includes original path
  // -------------------------------------------------------------------------
  test('unauthenticated request preserves query string in next param', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      // Navigate to a protected path with query params
      await page.goto('/?foo=bar');
      await page.waitForURL('**/login**', { timeout: 15000 });
      const url = new URL(page.url());
      const next = url.searchParams.get('next');
      // The middleware sets next to "pathname + search", so it should include
      // both the / path and the ?foo=bar query string
      expect(next).toBeTruthy();
      expect(next).toContain('foo=bar');
    } finally {
      await context.close();
    }
  });
});
