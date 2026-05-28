import { test, expect } from '@playwright/test';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';

test.describe('Health Endpoint (Plan 003)', () => {
  test('GET /api/health returns 200 with expected response shape', async ({ request }) => {
    const res = await request.get(`${APP_URL}/api/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();

    // status must be one of the defined values
    expect(['healthy', 'degraded']).toContain(body.status);

    // db must be one of the defined values
    expect(['ok', 'unreachable', 'misconfigured']).toContain(body.db);

    // timestamp must be a valid ISO string
    expect(body.timestamp).toBeTruthy();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

    // version must be a non-empty string
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  test('GET /api/health returns healthy status with DB connectivity', async ({ request }) => {
    const res = await request.get(`${APP_URL}/api/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.db).toBe('ok');
  });

  test('health response does not leak sensitive data', async ({ request }) => {
    const res = await request.get(`${APP_URL}/api/health`);
    const body = await res.json();

    // Should not contain env/infra details
    expect(body).not.toHaveProperty('environment');
    expect(body).not.toHaveProperty('uptime');
    expect(body).not.toHaveProperty('nodeVersion');

    // Only expected keys
    const keys = Object.keys(body).sort();
    expect(keys).toEqual(['db', 'status', 'timestamp', 'version']);
  });
});
