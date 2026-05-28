import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signInAs,
  supabase,
  type TestUser,
} from './utils/test-helpers';

/**
 * Dashboard User Management E2E Tests
 *
 * Covers the admin dashboard user table, search/filter, user detail page,
 * admin toggle, and user deletion. All tests use the createTestUser factory
 * for isolation; cleanup is handled by the existing global teardown.
 */
test.describe('Dashboard User Management', () => {
  let adminUser: TestUser;
  let targetUser: TestUser;

  test.beforeAll(async () => {
    // Create an admin user that can access the dashboard
    adminUser = await createTestUser({ tag: 'dash-admin', globalAdmin: true });
    // Create a regular user that will appear in the user table
    targetUser = await createTestUser({ tag: 'dash-target' });
  });

  test('user table renders with at least one user', async ({ page }) => {
    await signInAs(page, adminUser, { next: '/users' });
    await page.waitForURL('**/users', { timeout: 15000 });

    // The EnhancedUserTable renders a <table> with class "data-table"
    const table = page.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Verify at least one row in the table body
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('search input filters the user list', async ({ page }) => {
    await signInAs(page, adminUser, { next: '/users' });
    await page.waitForURL('**/users', { timeout: 15000 });

    // Wait for table to render
    const table = page.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Type the target user's email into the search box
    const searchInput = page.locator('#user-search');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(targetUser.email);

    // Wait for filtering to take effect - the result count text should appear
    await expect(page.getByText(/\d+ of \d+ users/)).toBeVisible({ timeout: 5000 });

    // Verify the target user appears in the filtered results
    await expect(page.getByText(targetUser.email)).toBeVisible({ timeout: 5000 });
  });

  test('clicking a user row navigates to user detail page', async ({ page }) => {
    await signInAs(page, adminUser, { next: '/users' });
    await page.waitForURL('**/users', { timeout: 15000 });

    // Wait for table
    const table = page.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Search for the target user to isolate the row
    const searchInput = page.locator('#user-search');
    await searchInput.fill(targetUser.email);
    await expect(page.getByText(targetUser.email)).toBeVisible({ timeout: 5000 });

    // Click the "View" button link for this user
    const viewLink = page.locator(`a[href="/users/${targetUser.id}"]`).first();
    await viewLink.click();

    // Verify navigation to user detail page
    await page.waitForURL(`**/users/${targetUser.id}`, { timeout: 15000 });

    // Verify the detail page shows the user's email
    await expect(page.getByText(targetUser.email).first()).toBeVisible({ timeout: 10000 });

    // Verify the detail page shows account status card
    await expect(page.getByText('Account Status')).toBeVisible({ timeout: 5000 });

    // Verify claims section exists
    await expect(page.getByText('Custom Claims')).toBeVisible({ timeout: 5000 });
  });

  test('user detail page shows email, status, and claims', async ({ page }) => {
    await signInAs(page, adminUser, { next: `/users/${targetUser.id}` });
    await page.waitForURL(`**/users/${targetUser.id}`, { timeout: 15000 });

    // Email is displayed in the header
    await expect(page.getByText(targetUser.email).first()).toBeVisible({ timeout: 10000 });

    // User Information card exists with email
    await expect(page.getByText('User Information')).toBeVisible({ timeout: 5000 });

    // Account status card exists (shows email confirmation and ban status)
    await expect(page.getByText('Account Status')).toBeVisible({ timeout: 5000 });

    // Status badges - the user should show as "Email Verified" since we
    // created with email_confirm: true
    await expect(page.getByText('Email Verified').first()).toBeVisible({ timeout: 5000 });

    // Claims section
    await expect(page.getByText('Custom Claims')).toBeVisible({ timeout: 5000 });
  });

  test('toggle admin changes admin status', async ({ page }) => {
    // Create a fresh disposable user for this test
    const toggleUser = await createTestUser({ tag: 'dash-toggle' });

    // Navigate to the user's detail page
    await signInAs(page, adminUser, { next: `/users/${toggleUser.id}` });
    await page.waitForURL(`**/users/${toggleUser.id}`, { timeout: 15000 });
    await expect(page.getByText(toggleUser.email).first()).toBeVisible({ timeout: 10000 });

    // Verify the user is NOT an admin initially (should show "Standard User")
    await expect(page.getByText('Standard User')).toBeVisible({ timeout: 5000 });

    // Toggle admin via the API (the current UI doesn't expose a toggle
    // button on the new detail page, so we use the admin API)
    await supabase.auth.admin.updateUserById(toggleUser.id, {
      app_metadata: {
        ...toggleUser.user.app_metadata,
        claims_admin: true,
      },
    });

    // Reload the page to see the change
    await page.reload();
    await page.waitForLoadState('load');

    // Verify the user is now shown as "Claims Admin"
    await expect(page.getByText('Claims Admin').first()).toBeVisible({ timeout: 10000 });

    // Toggle back to non-admin
    await supabase.auth.admin.updateUserById(toggleUser.id, {
      app_metadata: {
        ...toggleUser.user.app_metadata,
        claims_admin: false,
      },
    });

    await page.reload();
    await page.waitForLoadState('load');

    // Verify back to standard user
    await expect(page.getByText('Standard User')).toBeVisible({ timeout: 10000 });
  });

  test('delete user removes user from the table', async ({ page }) => {
    // Create a fresh disposable user for deletion
    const deleteUser = await createTestUser({ tag: 'dash-delete' });

    // First verify the user appears in the table
    await signInAs(page, adminUser, { next: '/users' });
    await page.waitForURL('**/users', { timeout: 15000 });

    const table = page.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Search for the user
    const searchInput = page.locator('#user-search');
    await searchInput.fill(deleteUser.email);
    await expect(page.getByText(deleteUser.email)).toBeVisible({ timeout: 5000 });

    // Navigate to the user detail page
    const viewLink = page.locator(`a[href="/users/${deleteUser.id}"]`).first();
    await viewLink.click();
    await page.waitForURL(`**/users/${deleteUser.id}`, { timeout: 15000 });
    await expect(page.getByText(deleteUser.email).first()).toBeVisible({ timeout: 10000 });

    // Click the Delete button to open the dialog
    const deleteButton = page.getByRole('button', { name: /Delete/ }).first();
    await deleteButton.click();

    // The dialog should appear asking for confirmation
    await expect(page.getByText('Delete User')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Are you sure you want to delete this user?')).toBeVisible();

    // Type the email to confirm deletion
    const confirmInput = page.locator('#confirm-email');
    await confirmInput.fill(deleteUser.email);

    // Click the confirm Delete User button in the dialog
    const confirmDeleteButton = page.getByRole('button', { name: 'Delete User' });
    await confirmDeleteButton.click();

    // After deletion, user should be redirected to /users
    await page.waitForURL('**/users', { timeout: 15000 });

    // Search for the deleted user - should not appear
    const searchInputAfter = page.locator('#user-search');
    await searchInputAfter.fill(deleteUser.email);

    // Wait for filtering to complete, then verify user is gone.
    // After typing, the filter result count ("N of M users") appears — wait
    // for that, then assert the deleted email is absent.
    await expect(page.getByText(/\d+ of \d+ users/).or(page.getByText('No users found'))).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(deleteUser.email)).not.toBeVisible({ timeout: 5000 });
  });
});
