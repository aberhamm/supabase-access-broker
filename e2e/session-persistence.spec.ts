import { test, expect, Page, Response } from '@playwright/test';

// Test environment config - can be overridden via env vars
const APP_URL = process.env.TEST_APP_URL || 'https://access-broker.home.arpa';
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@test.com',
  password: process.env.TEST_USER_PASSWORD || 'test',
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
  // Override baseURL and allow self-signed certs
  test.use({
    baseURL: APP_URL,
    ignoreHTTPSErrors: true,
  });

  /**
   * Helper to get auth cookie count from the page
   */
  async function getAuthCookieCount(page: Page): Promise<number> {
    const cookies = await page.context().cookies();
    return cookies.filter(c => c.name.includes('sb-') && c.name.includes('auth-token')).length;
  }

  /**
   * Helper to login and return to dashboard
   */
  async function login(page: Page): Promise<void> {
    await page.goto('/login');
    await page.waitForLoadState('load');

    await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);

    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or stay on login with error
    await page.waitForURL(url => !url.pathname.includes('/login') || url.search.includes('error'), {
      timeout: 10000,
    }).catch(() => {});

    // Give async cookie operations time to complete
    await page.waitForTimeout(1000);
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
