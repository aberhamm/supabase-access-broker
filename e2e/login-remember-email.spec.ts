import { test, expect } from '@playwright/test';

const REMEMBERED_EMAIL_KEY = 'remembered_email';
const REMEMBERED_EMAIL = 'person@example.com';

test.describe('Login remembered email', () => {
  test('shows welcome back state when email is remembered', async ({ page }) => {
    await page.addInitScript(({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Ignore storage errors; the UI should still render.
      }
    }, { key: REMEMBERED_EMAIL_KEY, value: REMEMBERED_EMAIL });

    await page.goto('/login');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('pe****@example.com')).toBeVisible();

    await page.getByRole('button', { name: /not you\?/i }).click();

    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('');
    await expect(page.getByRole('button', { name: /sign in as/i })).toBeVisible();
  });

  test('renders even when storage access throws', async ({ page }) => {
    await page.addInitScript(() => {
      const thrower = () => {
        throw new Error('blocked');
      };
      try {
        window.localStorage.getItem = thrower;
        window.localStorage.setItem = thrower;
        window.localStorage.removeItem = thrower;
      } catch {
        // If overriding fails, the test still ensures basic rendering.
      }
    });

    await page.goto('/login');
    await expect(page.getByText('Sign in', { exact: true })).toBeVisible();
  });
});
