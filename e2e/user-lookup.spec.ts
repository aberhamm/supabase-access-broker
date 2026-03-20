import { test, expect } from '@playwright/test';
import {
  ensureTestUser,
  createTestApp,
  grantUserAppAccess,
  supabase,
  TEST_USER,
  TEST_APP,
} from './utils/test-helpers';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';

test.describe('User Lookup API', () => {
  let testUserId: string;
  const telegramData = {
    id: 999000111,
    username: 'testbot',
    first_name: 'Test',
    last_name: 'User',
    linked_at: new Date().toISOString(),
  };

  test.beforeAll(async () => {
    const user = await ensureTestUser();
    testUserId = user.id;
    await createTestApp();
    await grantUserAppAccess(testUserId, TEST_APP.id);

    const { data: current } = await supabase.auth.admin.getUserById(testUserId);
    const currentMetadata = current?.user?.app_metadata || {};
    await supabase.auth.admin.updateUserById(testUserId, {
      app_metadata: {
        ...currentMetadata,
        telegram: telegramData,
      },
    });
  });

  test('should look up user by user_id', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/users/lookup`, {
      data: {
        app_id: TEST_APP.id,
        app_secret: TEST_APP.secret,
        user_id: testUserId,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(testUserId);
    expect(body.user.email).toBe(TEST_USER.email);
    expect(body.app_claims.enabled).toBe(true);
  });

  test('should look up user by email (case-insensitive)', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/users/lookup`, {
      data: {
        app_id: TEST_APP.id,
        app_secret: TEST_APP.secret,
        email: TEST_USER.email.toUpperCase(),
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(testUserId);
  });

  test('should look up user by telegram_id', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/users/lookup`, {
      data: {
        app_id: TEST_APP.id,
        app_secret: TEST_APP.secret,
        telegram_id: telegramData.id,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(testUserId);
  });

  test('should reject multiple lookup identifiers', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/users/lookup`, {
      data: {
        app_id: TEST_APP.id,
        app_secret: TEST_APP.secret,
        user_id: testUserId,
        email: TEST_USER.email,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Provide only one lookup identifier');
  });

  test('should require a lookup identifier', async ({ request }) => {
    const response = await request.post(`${APP_URL}/api/users/lookup`, {
      data: {
        app_id: TEST_APP.id,
        app_secret: TEST_APP.secret,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Missing lookup identifier/i);
  });
});
