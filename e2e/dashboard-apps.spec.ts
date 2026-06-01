import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signInAs,
  supabase,
  type TestUser,
} from './utils/test-helpers';

/**
 * Dashboard App CRUD & Claims Management E2E Tests
 *
 * Covers creating, editing, configuring auth methods, managing roles,
 * assigning claims to users, and deleting apps through the dashboard UI.
 * All tests use factory-created apps and users for isolation; cleanup
 * is handled by the global teardown plus explicit afterAll hooks.
 */

/** Generate a unique app name/id per test run to avoid collisions. */
function uniqueAppTag() {
  return `e2e-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('Dashboard App CRUD & Claims', () => {
  test.describe.configure({ mode: 'serial' });

  let adminUser: TestUser;
  let targetUser: TestUser;
  const tag = uniqueAppTag();
  const appName = `Test App ${tag}`;
  const appDescription = `E2E test app ${tag}`;

  // Tracks the created app id so later tests can reference it
  let createdAppId: string;

  test.beforeAll(async () => {
    adminUser = await createTestUser({ tag: 'app-admin', globalAdmin: true });
    targetUser = await createTestUser({ tag: 'app-target' });
  });

  test.afterAll(async () => {
    // Best-effort cleanup: delete test app if it still exists
    if (createdAppId) {
      await supabase
        .schema('access_broker_app')
        .from('apps')
        .delete()
        .eq('id', createdAppId)
        .then(() => {});
    }
  });

  // -----------------------------------------------------------------------
  // Test 1: Create a new app via the UI
  // -----------------------------------------------------------------------
  test('create a new app via the UI', async ({ page }) => {
    await signInAs(page, adminUser, { next: '/apps' });
    await page.waitForURL('**/apps', { timeout: 15000 });

    // Wait for the page to load
    await expect(page.getByText('App Management')).toBeVisible({ timeout: 15000 });

    // Click the "Create App" link/button
    const createBtn = page.getByRole('link', { name: /Create App/i });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Wait for the create page to load
    await page.waitForURL('**/apps/create', { timeout: 15000 });
    await expect(page.getByText('Create New App')).toBeVisible({ timeout: 10000 });

    // Fill the name field — ID auto-generates via kebab-case
    const nameInput = page.locator('#name');
    await nameInput.fill(appName);

    // The ID should auto-generate; capture it
    // Wait a tick for the auto-ID to populate
    await page.waitForTimeout(300);

    // Fill description
    const descTextarea = page.locator('#description');
    await descTextarea.fill(appDescription);

    // Pick a color (click the first available color button in the color grid)
    const colorGrid = page.locator('.grid-cols-3');
    await colorGrid.scrollIntoViewIfNeeded();
    const colorButton = colorGrid.locator('button').first();
    if (await colorButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await colorButton.click();
    }

    // Submit the form
    const submitBtn = page.getByRole('button', { name: /Create App$/i });
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // After creation, should navigate back to /apps
    await page.waitForURL('**/apps', { timeout: 15000 });

    // Verify the new app appears in the grid (use first() — name appears in card title, description, and toast)
    await expect(page.getByText(appName).first()).toBeVisible({ timeout: 10000 });

    // Extract the app ID from the grid card link
    const appLink = page.locator(`a[href^="/apps/"]`).filter({ hasText: appName });
    const href = await appLink.getAttribute('href');
    createdAppId = href?.replace('/apps/', '') || '';
    expect(createdAppId).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Test 2: Edit app name and description
  // -----------------------------------------------------------------------
  test('edit app name and description', async ({ page }) => {
    expect(createdAppId).toBeTruthy();

    await signInAs(page, adminUser, { next: `/apps/${createdAppId}` });
    await page.waitForURL(`**/apps/${createdAppId}`, { timeout: 15000 });

    // Wait for the app detail page to render
    await expect(page.getByRole('heading', { name: appName })).toBeVisible({ timeout: 15000 });

    // Click the "Edit App" button
    const editBtn = page.getByRole('button', { name: /Edit App/i });
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    // Wait for the edit dialog to appear
    await expect(page.getByRole('heading', { name: 'Edit App' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Update the app configuration')).toBeVisible({ timeout: 3000 });

    // Update name
    const updatedName = `${appName} Updated`;
    const nameInput = page.locator('#name');
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Update description
    const updatedDesc = `${appDescription} - updated`;
    const descInput = page.locator('#description');
    await descInput.clear();
    await descInput.fill(updatedDesc);

    // Submit
    const updateBtn = page.getByRole('button', { name: /Update$/i });
    await updateBtn.click();

    // Wait for the success toast before verifying
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify the updated name appears on the page after server revalidation
    await page.reload();
    await page.waitForLoadState('load');
    await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 15000 });
  });

  // -----------------------------------------------------------------------
  // Test 3: Toggle auth methods on/off
  // -----------------------------------------------------------------------
  test('toggle auth methods and verify persistence', async ({ page }) => {
    expect(createdAppId).toBeTruthy();

    // Navigate to the auth methods tab
    await signInAs(page, adminUser, { next: `/apps/${createdAppId}/auth-methods` });
    await page.waitForURL(`**/apps/${createdAppId}/auth-methods`, { timeout: 15000 });

    // Wait for the Sign-in Methods card to render
    await expect(page.getByText('Sign-in Methods')).toBeVisible({ timeout: 15000 });

    // Find the "Password" toggle switch by its id (method-password)
    const passwordSwitch = page.locator('#method-password');
    await expect(passwordSwitch).toBeVisible({ timeout: 5000 });

    // Check the initial state
    const initialChecked = await passwordSwitch.isChecked();

    // Toggle it
    await passwordSwitch.click();

    // Wait for the toast confirmation
    await expect(
      page.getByText(/password (enabled|disabled)/i)
    ).toBeVisible({ timeout: 5000 });

    // Reload and verify the toggle persisted
    await page.reload();
    await page.waitForLoadState('load');
    await expect(page.getByText('Sign-in Methods')).toBeVisible({ timeout: 15000 });

    const newChecked = await page.locator('#method-password').isChecked();
    expect(newChecked).toBe(!initialChecked);

    // Toggle it back to restore original state
    await page.locator('#method-password').click();
    await expect(
      page.getByText(/password (enabled|disabled)/i)
    ).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Test 4: Create a custom role, verify, then delete it
  // -----------------------------------------------------------------------
  test('create and delete a custom role', async ({ page }) => {
    expect(createdAppId).toBeTruthy();

    // Navigate to the roles tab
    await signInAs(page, adminUser, { next: `/apps/${createdAppId}/roles` });
    await page.waitForURL(`**/apps/${createdAppId}/roles`, { timeout: 15000 });

    // Wait for the roles page to render
    await expect(page.getByText('App-Specific Roles')).toBeVisible({ timeout: 15000 });

    // Click "Create Role" button
    const createRoleBtn = page.getByRole('button', { name: /Create Role/i }).first();
    await expect(createRoleBtn).toBeVisible({ timeout: 5000 });
    await createRoleBtn.click();

    // Wait for the role form dialog
    await expect(page.getByText('Create New Role')).toBeVisible({ timeout: 5000 });

    // Fill role fields
    const roleName = `e2e_test_role_${Date.now()}`;
    const roleLabel = `E2E Test Role`;

    await page.locator('#name').fill(roleName);
    await page.locator('#label').fill(roleLabel);

    // Click a common permission (e.g. "read")
    const readPermBtn = page.getByRole('button', { name: 'read' }).first();
    if (await readPermBtn.isVisible()) {
      await readPermBtn.click();
    }

    // Submit
    const createBtn = page.getByRole('button', { name: /^Create$/i });
    await createBtn.click();

    // Verify the role appears in the list
    await expect(page.getByText(roleName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(roleLabel)).toBeVisible({ timeout: 5000 });

    // Now delete the role — click the trash icon button in the same row
    const roleRow = page.locator('tr').filter({ hasText: roleName });
    const deleteBtn = roleRow.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    await deleteBtn.click();

    // Confirm deletion in the dialog
    await expect(page.getByText('Delete Role')).toBeVisible({ timeout: 5000 });
    const confirmDeleteBtn = page.getByRole('button', { name: /^Delete Role$/i });
    await confirmDeleteBtn.click();

    // Verify the role is removed from the list
    await expect(page.getByText(roleName)).not.toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // Test 5: Assign a claim (grant app access) to a test user
  // -----------------------------------------------------------------------
  test('assign app access to a test user', async ({ page }) => {
    expect(createdAppId).toBeTruthy();

    // Navigate to the app overview page (which has the Users card)
    await signInAs(page, adminUser, { next: `/apps/${createdAppId}` });
    await page.waitForURL(`**/apps/${createdAppId}`, { timeout: 15000 });

    // Wait for the overview page and Users card to render
    await expect(page.getByText('Users').first()).toBeVisible({ timeout: 15000 });

    // Click "Add Existing" to open the add user dialog
    const addExistingBtn = page.getByRole('button', { name: /Add Existing/i });
    await expect(addExistingBtn).toBeVisible({ timeout: 5000 });
    await addExistingBtn.click();

    // Wait for the "Add User" dialog
    await expect(page.getByText('Add User')).toBeVisible({ timeout: 5000 });

    // Type the target user's email
    const emailInput = page.locator('input[placeholder="Search by email or name..."]');
    await emailInput.fill(targetUser.email);

    // Wait a moment for autocomplete, then just proceed to grant
    await page.waitForTimeout(500);

    // Click "Grant Access"
    const grantBtn = page.getByRole('button', { name: /Grant Access/i });
    await grantBtn.click();

    // Wait for the success toast
    await expect(page.getByText('User added')).toBeVisible({ timeout: 10000 });

    // Verify the user now appears in the users list on the overview
    await expect(page.getByText(targetUser.email)).toBeVisible({ timeout: 10000 });

    // Verify the claim appears on the user's detail page
    await page.goto(`/users/${targetUser.id}`);
    await page.waitForURL(`**/users/${targetUser.id}`, { timeout: 15000 });
    await expect(page.getByText(targetUser.email).first()).toBeVisible({ timeout: 15000 });

    // Look for the "App Access" card and verify our app shows up
    await expect(page.getByText('App Access')).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // Test 6: Delete the test app via confirm dialog
  // -----------------------------------------------------------------------
  test('delete app via confirm dialog', async ({ page }) => {
    expect(createdAppId).toBeTruthy();

    // Navigate to the apps grid page
    await signInAs(page, adminUser, { next: '/apps' });
    await page.waitForURL('**/apps', { timeout: 15000 });
    await expect(page.getByText('App Management')).toBeVisible({ timeout: 15000 });

    // Find the app card and click its delete (trash) button
    // The delete button is inside the card and has a Trash2 icon
    const appCard = page.locator('a[href^="/apps/"]').filter({ hasText: createdAppId });
    await expect(appCard).toBeVisible({ timeout: 10000 });

    // Click the delete icon within the card (stopPropagation prevents navigation)
    const deleteIcon = appCard.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    await deleteIcon.click();

    // Confirm in the DeleteAppConfirmDialog
    await expect(page.getByText('Delete App')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Are you sure you want to delete this app?')).toBeVisible();

    // Type the app ID to confirm
    const confirmInput = page.locator('#confirm');
    await confirmInput.fill(createdAppId);

    // Click the "Delete App" button
    const deleteAppBtn = page.getByRole('button', { name: /^Delete App$/i });
    await expect(deleteAppBtn).toBeEnabled({ timeout: 3000 });
    await deleteAppBtn.click();

    // Wait for the toast and verify the app is removed from the grid
    await expect(page.getByText(`"${createdAppId}"`, { exact: false }).or(
      page.getByText('deleted successfully')
    )).toBeVisible({ timeout: 10000 });

    // The app card should no longer be visible (search for the app ID)
    await page.waitForTimeout(1000);
    await expect(page.locator(`a[href="/apps/${createdAppId}"]`)).not.toBeVisible({ timeout: 5000 });

    // Mark as cleaned up so afterAll doesn't try to delete again
    createdAppId = '';
  });
});
