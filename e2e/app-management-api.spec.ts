import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
  ensureTestUser,
  createTestApp,
  grantUserAppAccess,
  supabase,
  TEST_USER,
  TEST_APP,
} from './utils/test-helpers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';

// Unique key name per worker to avoid conflicts with parallel workers
const E2E_KEY_PREFIX = 'e2e-test-key';
const E2E_KEY_NAME = `${E2E_KEY_PREFIX}-${process.pid}-${Date.now()}`;

// Helper: create an API key for the test app
async function createTestApiKey(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const secret = `sk_${randomPart}`;
  const keyHash = createHash('sha256').update(secret, 'utf8').digest('hex');

  const { data, error } = await supabase.rpc('create_api_key', {
    p_app_id: TEST_APP.id,
    p_name: E2E_KEY_NAME,
    p_key_hash: keyHash,
    p_description: 'Temporary key for E2E tests',
    p_role_id: null,
    p_expires_at: null,
    p_created_by: null,
  });

  if (error) throw error;
  return secret;
}

// Helper: clean up only this worker's API key (not other workers' keys)
async function cleanupTestApiKeys() {
  const { data } = await supabase.rpc('get_app_api_keys', { p_app_id: TEST_APP.id });
  if (!data) return;
  for (const key of data as { id: string; name: string }[]) {
    if (key.name === E2E_KEY_NAME) {
      await supabase.rpc('delete_api_key', { p_id: key.id });
    }
  }
}

// Dedicated user for lifecycle tests to avoid race conditions with parallel test files
const LIFECYCLE_USER_EMAIL = 'test-lifecycle@example.com';

test.describe('App Management API', () => {
  test.describe.configure({ mode: 'serial' });
  let testUserId: string;
  let lifecycleUserId: string;
  let apiKey: string;

  test.beforeAll(async () => {
    const user = await ensureTestUser();
    testUserId = user.id;
    await createTestApp();
    await grantUserAppAccess(testUserId, TEST_APP.id, 'admin');

    // Create or find a dedicated lifecycle test user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let lcUser = existingUsers?.users.find((u) => u.email === LIFECYCLE_USER_EMAIL);
    if (!lcUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: LIFECYCLE_USER_EMAIL,
        password: 'test-lifecycle-password',
        email_confirm: true,
        app_metadata: { claims_admin: true },
      });
      if (error) throw error;
      lcUser = data.user;
    }
    lifecycleUserId = lcUser!.id;
    await grantUserAppAccess(lifecycleUserId, TEST_APP.id, 'admin');

    await cleanupTestApiKeys();
    apiKey = await createTestApiKey();
  });

  test.afterAll(async () => {
    await cleanupTestApiKeys();
  });

  // --- Authentication tests ---

  test('T42: API key auth works on GET /users', async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/users`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.users).toBeDefined();
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  test('T43: app_secret auth works on POST /invite', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/apps/${TEST_APP.id}/invite`, {
      data: {
        app_secret: TEST_APP.secret,
        email: TEST_USER.email,
      },
    });
    expect(response.status()).toBe(200);
  });

  test('T44: wrong app API key returns 403', async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/apps/nonexistent-app/users`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(response.status()).toBe(403);
  });

  test('T45: no auth returns 401', async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/users`);
    expect(response.status()).toBe(401);
  });

  // --- GET /users ---

  test('T19: returns paginated user list', async ({ request }) => {
    const response = await request.get(`${APP_URL}/api/apps/${TEST_APP.id}/users`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.users).toBeInstanceOf(Array);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
    expect(typeof body.total).toBe('number');
  });

  test('T20: search filter works', async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users?search=${encodeURIComponent(TEST_USER.email)}`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.users.length).toBeGreaterThanOrEqual(1);
    expect(body.users[0].email).toContain(TEST_USER.email.split('@')[0]);
  });

  test('T21: page/limit clamping', async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users?page=0&limit=999`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(100);
  });

  // --- GET /users/{uid}/claims ---

  test('T23: returns claims for valid user', async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${testUserId}/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user_id).toBe(testUserId);
    expect(body.email).toBe(TEST_USER.email);
    expect(body.app_claims).toBeDefined();
  });

  test('T24: 404 for unknown user', async ({ request }) => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${fakeUuid}/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(response.status()).toBe(404);
  });

  test('T25: invalid UUID format returns 400', async ({ request }) => {
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/not-a-uuid/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(response.status()).toBe(400);
  });

  // --- Full lifecycle: PATCH → GET → DELETE → GET ---

  test('T47: full lifecycle - update claims, verify, revoke, verify', async ({ request }) => {
    // T26/T27: PATCH - set role and permissions (uses dedicated lifecycle user)
    const patchResponse = await request.patch(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${lifecycleUserId}/claims`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        data: {
          role: 'editor',
          permissions: ['read', 'write', 'publish'],
        },
      }
    );
    expect(patchResponse.status()).toBe(200);
    const patchBody = await patchResponse.json();
    expect(patchBody.user_id).toBe(lifecycleUserId);
    expect(patchBody.app_claims).toBeDefined();
    expect(patchBody.app_claims.role).toBe('editor');
    expect(patchBody.app_claims.permissions).toEqual(['read', 'write', 'publish']);
    expect(patchBody.updated_at).toBeDefined();

    // T23: GET - verify claims were set
    const getResponse = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${lifecycleUserId}/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(getResponse.status()).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.app_claims.role).toBe('editor');
    expect(getBody.app_claims.permissions).toEqual(['read', 'write', 'publish']);

    // T32: DELETE - revoke access
    const deleteResponse = await request.delete(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${lifecycleUserId}/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.revoked).toBe(true);
    expect(deleteBody.revoked_at).toBeDefined();

    // T34: GET - verify claims were cleared
    const verifyResponse = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${lifecycleUserId}/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(verifyResponse.status()).toBe(200);
    const verifyBody = await verifyResponse.json();
    expect(verifyBody.app_claims.enabled).toBe(false);
    // role and permissions should be cleared
    expect(verifyBody.app_claims.role).toBeUndefined();
    expect(verifyBody.app_claims.permissions).toBeUndefined();

    // T33: DELETE again - idempotent
    const deleteAgainResponse = await request.delete(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${lifecycleUserId}/claims`,
      { headers: { authorization: `Bearer ${apiKey}` } }
    );
    expect(deleteAgainResponse.status()).toBe(200);

    // Restore access for other tests
    await grantUserAppAccess(lifecycleUserId, TEST_APP.id, 'admin');
  });

  // --- PATCH validation ---

  test('T28: rejects invalid claim values', async ({ request }) => {
    const response = await request.patch(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${testUserId}/claims`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        data: { role: '' },
      }
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/role must be/);
  });

  test('T29: rejects empty body (no valid fields)', async ({ request }) => {
    const response = await request.patch(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${testUserId}/claims`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        data: { unknown_field: 'value' },
      }
    );
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/No valid fields/);
  });

  test('T30: PATCH 404 for unknown user', async ({ request }) => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const response = await request.patch(
      `${APP_URL}/api/apps/${TEST_APP.id}/users/${fakeUuid}/claims`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        data: { role: 'admin' },
      }
    );
    expect(response.status()).toBe(404);
  });

  // --- POST /invite ---

  test('T37: invite existing user gets claims', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/apps/${TEST_APP.id}/invite`, {
      headers: { authorization: `Bearer ${apiKey}` },
      data: {
        email: TEST_USER.email,
        role: 'member',
        permissions: ['read'],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user_id).toBe(testUserId);
    expect(body.created).toBe(false);
    expect(body.app_claims.enabled).toBe(true);
    expect(body.app_claims.role).toBe('member');
  });

  test('T40: invalid email format returns 400', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/apps/${TEST_APP.id}/invite`, {
      headers: { authorization: `Bearer ${apiKey}` },
      data: { email: 'not-an-email' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Invalid email/);
  });

  test('T41: missing email returns 400', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/apps/${TEST_APP.id}/invite`, {
      headers: { authorization: `Bearer ${apiKey}` },
      data: { role: 'admin' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Missing email/);
  });

  // Restore test user to admin state after all tests
  test.afterAll(async () => {
    try {
      await grantUserAppAccess(testUserId, TEST_APP.id, 'admin');
    } catch {
      // Best effort
    }
  });
});
