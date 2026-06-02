import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import {
  ensureTestUser,
  createTestApp,
  grantUserAppAccess,
  signInAs,
  supabase,
  TEST_USER,
  TEST_APP,
} from './utils/test-helpers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';

// Unique key name per worker to avoid conflicts
const E2E_KEY_NAME = `e2e-api-ep-${process.pid}-${Date.now()}`;

// ---------------------------------------------------------------------------
// Helpers (same pattern as app-management-api.spec.ts)
// ---------------------------------------------------------------------------

async function createTestApiKey(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const secret = `sk_${randomPart}`;
  const keyHash = createHash('sha256').update(secret, 'utf8').digest('hex');

  const { data, error } = await supabase.rpc('create_api_key', {
    p_app_id: TEST_APP.id,
    p_name: E2E_KEY_NAME,
    p_key_hash: keyHash,
    p_description: 'Temporary key for api-endpoints E2E tests',
    p_role_id: null,
    p_expires_at: null,
    p_created_by: null,
  });

  if (error) throw error;
  return secret;
}

async function cleanupTestApiKeys() {
  const { data } = await supabase.rpc('get_app_api_keys', {
    p_app_id: TEST_APP.id,
  });
  if (!data) return;
  for (const key of data as { id: string; name: string }[]) {
    if (key.name === E2E_KEY_NAME) {
      await supabase.rpc('delete_api_key', { p_id: key.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('API Endpoints — invite, auth-methods, roles, rate limiting', () => {
  test.describe.configure({ mode: 'serial' });

  let testUserId: string;
  let apiKey: string;

  test.beforeAll(async () => {
    const user = await ensureTestUser();
    testUserId = user.id;
    await createTestApp();
    await grantUserAppAccess(testUserId, TEST_APP.id, 'admin');
    await cleanupTestApiKeys();
    apiKey = await createTestApiKey();
  });

  test.afterAll(async () => {
    await cleanupTestApiKeys();
  });

  // =========================================================================
  // POST /api/apps/{appId}/invite
  // =========================================================================

  test('invite: creates new user and grants app access', async ({ request }) => {
    // Use a unique email that almost certainly does not exist yet
    const uniqueEmail = `e2e+invite-new-${randomUUID().slice(0, 8)}@e2e.test`;

    const response = await request.post(
      `${APP_URL}/api/apps/${TEST_APP.id}/invite`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        data: {
          email: uniqueEmail,
          role: 'viewer',
          permissions: ['read'],
          send_email: false, // skip email to avoid side effects
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user_id).toBeTruthy();
    expect(body.email).toBe(uniqueEmail);
    expect(body.created).toBe(true);
    expect(body.app_claims).toBeDefined();
    expect(body.app_claims.enabled).toBe(true);
    expect(body.app_claims.role).toBe('viewer');
    expect(body.app_claims.permissions).toEqual(['read']);

    // Cleanup: delete the newly created user
    await supabase.auth.admin.deleteUser(body.user_id);
  });

  test('invite: existing user grants access without duplicating', async ({
    request,
  }) => {
    const response = await request.post(
      `${APP_URL}/api/apps/${TEST_APP.id}/invite`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        data: {
          email: TEST_USER.email,
          role: 'member',
          permissions: ['read'],
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user_id).toBe(testUserId);
    expect(body.created).toBe(false);
    expect(body.app_claims).toBeDefined();
    expect(body.app_claims.enabled).toBe(true);
    expect(body.app_claims.role).toBe('member');
  });

  // =========================================================================
  // GET /api/apps/{appId}/auth-methods (public endpoint, no auth needed)
  // =========================================================================

  test('auth-methods: returns current auth methods for app', async ({
    request,
  }) => {
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/auth-methods`
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.app_name).toBeTruthy();
    // auth_methods may be null (defaults) or an object
    expect(body).toHaveProperty('auth_methods');
    expect(typeof body.allow_self_signup).toBe('boolean');
    expect(body.self_signup_default_role).toBeTruthy();
  });

  test('auth-methods: returns app_not_found for unknown app', async ({
    request,
  }) => {
    const response = await request.get(
      `${APP_URL}/api/apps/nonexistent-app-${randomUUID()}/auth-methods`
    );

    expect(response.status()).toBe(200); // Endpoint returns 200 with status field
    const body = await response.json();
    expect(body.status).toBe('app_not_found');
    expect(body.auth_methods).toBeNull();
  });

  test('auth-methods: persists toggle changes via direct DB update', async ({
    request,
  }) => {
    // Read current auth methods
    const before = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/auth-methods`
    );
    const beforeBody = await before.json();
    const originalMethods = beforeBody.auth_methods;

    // Toggle via DB directly (no PATCH endpoint exists — it's a Server Action)
    const updatedMethods = {
      ...(originalMethods ?? {}),
      magic_link: !(originalMethods?.magic_link ?? true),
    };

    await supabase
      .schema('access_broker_app')
      .from('apps')
      .update({ auth_methods: updatedMethods })
      .eq('id', TEST_APP.id);

    // Verify GET reflects the change
    const after = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/auth-methods`
    );
    const afterBody = await after.json();
    expect(afterBody.auth_methods?.magic_link).toBe(
      updatedMethods.magic_link
    );

    // Restore original
    await supabase
      .schema('access_broker_app')
      .from('apps')
      .update({ auth_methods: originalMethods ?? {} })
      .eq('id', TEST_APP.id);
  });

  // =========================================================================
  // GET /api/apps/{appId}/roles (session auth — requires cookie)
  // =========================================================================

  test('roles: returns roles list with session auth', async ({
    page,
  }) => {
    // Sign in as the test user to get a session cookie
    await signInAs(page, { email: TEST_USER.email });

    // Use page.request which carries the session cookies
    const response = await page.request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/roles`
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Response is an array of roles
    expect(Array.isArray(body)).toBe(true);
  });

  test('roles: returns 401 without session', async ({ request }) => {
    // Plain request without session cookies → should be unauthorized
    const response = await request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/roles`
    );

    // The endpoint returns 401 when no user is authenticated
    expect(response.status()).toBe(401);
  });

  test('roles: create and delete role via RPC, verify in GET', async ({
    page,
  }) => {
    // Sign in as admin
    await signInAs(page, { email: TEST_USER.email });

    // Create a role directly via Supabase RPC (POST/DELETE are Server Actions, not API routes)
    const roleName = `e2e-role-${randomUUID().slice(0, 8)}`;
    const { data: createData, error: createError } = await supabase.rpc(
      'create_role',
      {
        p_name: roleName,
        p_label: `E2E Role ${roleName}`,
        p_description: 'Temporary role for e2e test',
        p_app_id: TEST_APP.id,
        p_is_global: false,
        p_permissions: JSON.stringify(['read', 'write']),
      }
    );
    expect(createError).toBeNull();
    expect(createData).toBe('OK');

    // Verify the role appears in the GET response and capture its ID
    const listResponse = await page.request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/roles`
    );
    expect(listResponse.status()).toBe(200);
    const roles = await listResponse.json();
    const found = (roles as { name: string; id: string }[]).find(
      (r) => r.name === roleName
    );
    expect(found).toBeDefined();
    const roleId = found!.id;

    // Clean up: delete the role via RPC
    const { data: deleteResult } = await supabase.rpc('delete_role', { p_id: roleId });
    expect(deleteResult).toBe('OK');

    // Verify deletion
    const afterDelete = await page.request.get(
      `${APP_URL}/api/apps/${TEST_APP.id}/roles`
    );
    const rolesAfter = await afterDelete.json();
    const notFound = (rolesAfter as { name: string }[]).find(
      (r) => r.name === roleName
    );
    expect(notFound).toBeUndefined();
  });

  // =========================================================================
  // Rate limiting — rapid requests should yield 429
  // =========================================================================

  test('rate limiting: rapid write requests return 429', async ({
    request,
  }) => {
    // The write rate limit is 30 requests per minute per app-id key.
    // We fire 35 requests rapidly; at least one should return 429.
    const results: number[] = [];

    // Use a dedicated API key for rate limit testing so we don't pollute
    // the bucket used by other tests.
    const rateLimitKeyName = `e2e-ratelimit-${process.pid}-${Date.now()}`;
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const randomPart = Array.from(array, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    const rlSecret = `sk_${randomPart}`;
    const rlKeyHash = createHash('sha256')
      .update(rlSecret, 'utf8')
      .digest('hex');

    await supabase.rpc('create_api_key', {
      p_app_id: TEST_APP.id,
      p_name: rateLimitKeyName,
      p_key_hash: rlKeyHash,
      p_description: 'Rate limit test key',
      p_role_id: null,
      p_expires_at: null,
      p_created_by: null,
    });

    try {
      // Send 35 rapid invite requests (write tier = 30/min)
      const promises = Array.from({ length: 35 }, (_, i) =>
        request
          .post(`${APP_URL}/api/apps/${TEST_APP.id}/invite`, {
            headers: { authorization: `Bearer ${rlSecret}` },
            data: {
              email: TEST_USER.email,
              role: 'member',
            },
          })
          .then((r) => r.status())
      );

      const statuses = await Promise.all(promises);
      results.push(...statuses);

      const got429 = results.some((s) => s === 429);
      expect(got429).toBe(true);

      // Verify the 429 response includes the expected headers
      if (got429) {
        // Send one more to get the actual response for header inspection
        const overflowResponse = await request.post(
          `${APP_URL}/api/apps/${TEST_APP.id}/invite`,
          {
            headers: { authorization: `Bearer ${rlSecret}` },
            data: {
              email: TEST_USER.email,
              role: 'member',
            },
          }
        );
        // If still rate limited, check headers
        if (overflowResponse.status() === 429) {
          const retryAfter = overflowResponse.headers()['retry-after'];
          expect(retryAfter).toBeTruthy();
          const body = await overflowResponse.json();
          expect(body.error).toContain('Rate limit');
        }
      }
    } finally {
      // Cleanup the rate limit test key
      const { data: keys } = await supabase.rpc('get_app_api_keys', {
        p_app_id: TEST_APP.id,
      });
      if (keys) {
        for (const key of keys as { id: string; name: string }[]) {
          if (key.name === rateLimitKeyName) {
            await supabase.rpc('delete_api_key', { p_id: key.id });
          }
        }
      }

      // The invite route buckets the write rate limit on app_id (not the API
      // key), so the 35 requests above exhausted `app-api:write:<app_id>` for
      // the whole 60s window. Clear it so later serial tests that POST to the
      // same app's /invite (e.g. app_secret auth) don't get a stray 429.
      await supabase
        .schema('access_broker_app')
        .from('rate_limits')
        .delete()
        .eq('bucket', `app-api:write:${TEST_APP.id}`);
    }
  });

  // Restore test user state after all tests
  test.afterAll(async () => {
    try {
      await grantUserAppAccess(testUserId, TEST_APP.id, 'admin');
    } catch {
      // Best effort
    }
  });
});
