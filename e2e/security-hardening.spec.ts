import { test, expect } from '@playwright/test';
import {
  ensureTestUser,
  createTestApp,
  grantUserAppAccess,
  TEST_USER,
  TEST_APP,
  supabase,
} from './utils/test-helpers';
import { createHash } from 'node:crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
const DEMO_CALLBACK = `${APP_URL}/demo/sso-demo.html`;

test.describe('Security Hardening Regression Tests', () => {
  let testUserId: string;

  test.beforeAll(async () => {
    const user = await ensureTestUser();
    testUserId = user.id;
    await createTestApp();
    await grantUserAppAccess(testUserId, TEST_APP.id);
  });

  // =========================================================================
  // Critical #1: Webhook header spoofing
  // =========================================================================

  test('webhook: valid API key authenticates successfully', async ({ request }) => {
    // Create an API key for the test app
    const keyPlaintext = `sk_test_${Date.now()}`;
    const keyHash = createHash('sha256').update(keyPlaintext, 'utf8').digest('hex');

    await supabase
      .schema('access_broker_app')
      .from('api_keys')
      .insert({
        app_id: TEST_APP.id,
        name: 'security-test-key',
        key_hash: keyHash,
        enabled: true,
      });

    try {
      const res = await request.get(`${APP_URL}/api/webhooks/${TEST_APP.id}`, {
        headers: { 'Authorization': `Bearer ${keyPlaintext}` },
      });
      expect(res.status()).toBe(200);
    } finally {
      await supabase
        .schema('access_broker_app')
        .from('api_keys')
        .delete()
        .eq('name', 'security-test-key');
    }
  });

  test('webhook: invalid API key returns 401', async ({ request }) => {
    const res = await request.get(`${APP_URL}/api/webhooks/${TEST_APP.id}`, {
      headers: { 'Authorization': 'Bearer sk_invalid_key' },
    });
    expect(res.status()).toBe(401);
  });

  test('webhook: spoofed x-app-id header is ignored (Critical #1)', async ({ request }) => {
    const res = await request.post(`${APP_URL}/api/webhooks/${TEST_APP.id}`, {
      headers: {
        'x-api-key': 'sk_nonexistent',
        'x-app-id': TEST_APP.id, // Spoofed — should be ignored
        'x-role-name': 'admin', // Spoofed — should be ignored
      },
      data: { test: true },
    });
    // Should fail auth because the key is invalid, even though x-app-id matches
    expect(res.status()).toBe(401);
  });

  // =========================================================================
  // High #9: Roles endpoint authorization
  // =========================================================================

  test('roles: non-admin authenticated user gets 403', async ({ request }) => {
    // Create a non-admin test user
    const nonAdminEmail = `non-admin-${Date.now()}@example.com`;
    const { data: nonAdmin } = await supabase.auth.admin.createUser({
      email: nonAdminEmail,
      password: 'test-password-123',
      email_confirm: true,
      app_metadata: {}, // No claims_admin, no app admin
    });

    try {
      // Login as non-admin (using the Supabase client to get a session)
      const { data: session } = await supabase.auth.signInWithPassword({
        email: nonAdminEmail,
        password: 'test-password-123',
      });

      if (!session?.session?.access_token) {
        test.skip(true, 'Could not login as non-admin user');
        return;
      }

      // Call roles endpoint with non-admin session
      const res = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/roles`, {
        headers: {
          'Cookie': `sb-access-token=${session.session.access_token}`,
        },
      });

      // Should be 401 or 403 (depends on whether session cookie is accepted)
      expect([401, 403]).toContain(res.status());
    } finally {
      if (nonAdmin?.user?.id) {
        await supabase.auth.admin.deleteUser(nonAdmin.user.id);
      }
    }
  });

  // =========================================================================
  // Medium #16: Login error sanitization
  // =========================================================================

  test('login: unknown error code shows generic message', async ({ page }) => {
    await page.goto(`${APP_URL}/login?error=<script>alert(1)</script>`);
    await page.waitForTimeout(1000);

    // Should NOT reflect the raw error parameter
    const content = await page.content();
    expect(content).not.toContain('<script>alert(1)</script>');
    // Should show generic message
    expect(content).toContain('unexpected error');
  });

  // =========================================================================
  // Low #23: Health endpoint
  // =========================================================================

  test('health: response does not contain NODE_ENV', async ({ request }) => {
    const res = await request.get(`${APP_URL}/api/health`);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body).not.toHaveProperty('environment');
    expect(body).not.toHaveProperty('uptime');
  });

  // =========================================================================
  // High #8: Auth callback next param sanitization
  // =========================================================================

  test('auth callback: protocol-relative next param is sanitized', async ({ page }) => {
    await page.goto(`${APP_URL}/auth/callback?next=//evil.com`);
    // Should NOT navigate to evil.com — should go to / or /login
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain('evil.com');
  });

  test('auth callback: javascript next param is sanitized', async ({ page }) => {
    await page.goto(`${APP_URL}/auth/callback?next=javascript:alert(1)`);
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain('javascript:');
  });
});
