import { test, expect, Page, Response } from '@playwright/test';
import { supabase } from './utils/test-helpers';

// Use a separate test user to avoid magic link invalidation when running in parallel
const SESSION_TEST_USER = {
  email: 'test-session@example.com',
};

/**
 * Session Persistence E2E Tests
 *
 * These tests verify that user sessions persist correctly across:
 * - SPA navigation (clicking links)
 * - Full page navigation (goto)
 * - Hard refresh
 *
 * This is a regression test for a bug where Next.js prefetching of the
 * /auth/logout route would inadvertently clear session cookies.
 */
test.describe('Session Persistence', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Ensure this separate test user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users.find((u) => u.email === SESSION_TEST_USER.email);
    if (!existing) {
      await supabase.auth.admin.createUser({
        email: SESSION_TEST_USER.email,
        password: 'test-session-password',
        email_confirm: true,
        app_metadata: { claims_admin: true },
      });
    } else if (!existing.app_metadata?.claims_admin) {
      await supabase.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...existing.app_metadata, claims_admin: true },
      });
    }
  });

  /**
   * Helper to get auth cookie count from the page
   */
  async function getAuthCookieCount(page: Page): Promise<number> {
    const cookies = await page.context().cookies();
    return cookies.filter(c => c.name.includes('sb-') && c.name.includes('auth-token')).length;
  }

  /**
   * Helper to login via admin-generated magic link (works regardless of auth config)
   */
  async function login(page: Page): Promise<void> {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: SESSION_TEST_USER.email,
      options: {
        redirectTo: 'http://localhost:3050/auth/callback?next=%2F',
      },
    });

    if (error) throw error;

    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) throw new Error('Failed to generate test magic link token');

    await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email&next=%2F`);
    await page.waitForURL((url) => !url.pathname.includes('/auth/confirm'), { timeout: 15000 });
  }

  test('session persists across SPA navigation', async ({ page }) => {
    // Login
    await login(page);

    // Verify we're logged in (not on login page)
    const postLoginUrl = page.url();
    expect(postLoginUrl).not.toContain('/login');

    // Verify auth cookie exists
    let cookieCount = await getAuthCookieCount(page);
    expect(cookieCount).toBeGreaterThan(0);

    // Navigate to /users via SPA (click)
    const usersLink = page.locator('a[href="/users"]').first();
    await usersLink.click();
    await page.waitForLoadState('load');

    // Verify still logged in
    expect(page.url()).not.toContain('/login');
    cookieCount = await getAuthCookieCount(page);
    expect(cookieCount).toBeGreaterThan(0);

    // Navigate to /apps via SPA (click)
    const appsLink = page.locator('a[href="/apps"]').first();
    await appsLink.click();
    await page.waitForLoadState('load');

    // Verify still logged in
    expect(page.url()).not.toContain('/login');
    cookieCount = await getAuthCookieCount(page);
    expect(cookieCount).toBeGreaterThan(0);
  });

  test('session persists after hard refresh', async ({ page }) => {
    // Login
    await login(page);
    expect(page.url()).not.toContain('/login');

    // Navigate to a protected page
    await page.goto('/users');
    await page.waitForLoadState('load');
    expect(page.url()).toContain('/users');

    // Hard refresh
    await page.reload();
    await page.waitForLoadState('load');

    // Verify still on /users (not redirected to login)
    expect(page.url()).toContain('/users');
    expect(page.url()).not.toContain('/login');

    // Verify auth cookie still exists
    const cookieCount = await getAuthCookieCount(page);
    expect(cookieCount).toBeGreaterThan(0);
  });

  test('logout link does not get prefetched', async ({ page }) => {
    // Login first
    await login(page);
    expect(page.url()).not.toContain('/login');

    // Track all responses to /auth/logout
    const logoutRequests: string[] = [];
    const responseHandler = (response: Response) => {
      if (response.url().includes('/auth/logout')) {
        logoutRequests.push(response.url());
      }
    };
    page.on('response', responseHandler);

    // Navigate to a few pages (this would trigger prefetch if enabled)
    await page.goto('/users');
    await page.waitForLoadState('load');

    await page.goto('/apps');
    await page.waitForLoadState('load');

    await page.goto('/');
    await page.waitForLoadState('load');

    page.off('response', responseHandler);

    // Verify no requests were made to /auth/logout
    // (Before the fix, prefetch would cause logout requests)
    expect(logoutRequests).toHaveLength(0);

    // Verify still logged in
    expect(page.url()).not.toContain('/login');
    const cookieCount = await getAuthCookieCount(page);
    expect(cookieCount).toBeGreaterThan(0);
  });

  test('can manually logout', async ({ page }) => {
    // Login
    await login(page);
    expect(page.url()).not.toContain('/login');

    // Click logout button
    const logoutLink = page.locator('a[href="/auth/logout"]').first();
    await logoutLink.click();

    // Wait for redirect to login
    await page.waitForURL('**/login*', { timeout: 10000 });

    // Verify redirected to login
    expect(page.url()).toContain('/login');

    // Verify auth cookie is cleared
    const cookieCount = await getAuthCookieCount(page);
    expect(cookieCount).toBe(0);
  });
});
