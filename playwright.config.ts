import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Force port 3050 for E2E tests to avoid conflicts with dev server on 3000
process.env.PORT = '3050';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3050';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',

  /* Global setup to run before all tests */
  globalSetup: './e2e/setup/global-setup.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3050',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /responsive-smoke\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run a production-style server before tests to avoid flaky dev manifest errors */
  webServer: {
    command: 'pnpm build && PORT=3050 NEXT_PUBLIC_APP_URL=http://localhost:3050 pnpm start',
    url: 'http://localhost:3050',
    reuseExistingServer: false,
    timeout: 300 * 1000,
    env: {
      PORT: '3050',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3050',
    },
  },
});
