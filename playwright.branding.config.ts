import { defineConfig, devices } from '@playwright/test';
// Explicit fake values override .env.local inside Next. This suite has NO global
// account setup/teardown and cannot seed, migrate, or send mail to production.
const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3063',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'branding-test-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'branding-test-service',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3062',
  NEXT_PUBLIC_AUTH_PASSWORD: 'true',
  NEXT_PUBLIC_AUTH_GOOGLE: 'true',
  NEXT_PUBLIC_AUTH_PASSKEYS: 'true',
  NEXT_PUBLIC_AUTH_EMAIL_OTP: 'true',
  NEXT_PUBLIC_AUTH_MAGIC_LINK: 'true',
  APP_CACHE_TTL: '0',
};
export default defineConfig({
  testDir: './e2e', testMatch: 'login-branding.spec.ts', workers: 1,
  reporter: 'list', use: { baseURL: env.NEXT_PUBLIC_APP_URL, channel: 'chrome', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    { command: './node_modules/.bin/tsx e2e/setup/branding-supabase.ts', url: 'http://127.0.0.1:3063/health', reuseExistingServer: false },
    { command: './node_modules/.bin/next build && ./node_modules/.bin/next start --hostname 127.0.0.1 --port 3062', url: env.NEXT_PUBLIC_APP_URL + '/login', env, reuseExistingServer: false, timeout: 300_000 },
  ],
});
