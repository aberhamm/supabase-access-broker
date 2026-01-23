import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const PROD_URL = process.env.TEST_APP_URL || 'https://access-broker.home.arpa';

/**
 * Playwright config for testing against production
 * Run with: npx playwright test --config=playwright.prod.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'session-persistence.spec.ts', // Session persistence regression tests

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: PROD_URL,
    ignoreHTTPSErrors: true, // Allow self-signed certs
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NO webServer - we're testing against production
});
