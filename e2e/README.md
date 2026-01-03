# E2E Tests

Automated end-to-end tests for the Supabase Access Broker SSO flow.

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Install Playwright browsers:**
   ```bash
   pnpm exec playwright install
   ```

3. **Configure environment:**
   - Ensure your `.env.local` file has Supabase credentials
   - Tests will automatically use the same environment as your dev server

4. **Ensure database schema is up to date:**
   - Run migration 007 (`007_auth_and_passkeys.sql`) if not already applied
   - Ensure `auth_codes` table exists with proper RLS policies

## Running Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Debug mode (step through tests)
pnpm test:e2e:debug

# View test report
pnpm test:e2e:report
```

## Test Structure

### SSO Flow Tests (`sso-simple.spec.ts`)

Tests the complete SSO integration flow:

1. **Full SSO Flow Success**
   - User clicks "Sign In with Auth Portal"
   - Redirects to login page
   - User logs in
   - Redirects back to demo page
   - User info and access badge displayed

2. **Access Denied**
   - Tests behavior when user has no app access
   - Verifies "Denied" badge is shown

3. **Redirect URI Validation**
   - Tests that invalid callback URLs are rejected

4. **Auth Code Expiry**
   - Tests that auth codes are single-use
   - Verifies reusing a code fails

5. **CSRF Protection**
   - Tests that state parameter is included
   - Verifies state is validated

## Test Utilities

Helper functions in `e2e/utils/test-helpers.ts`:

- `createTestUser()` - Creates a test user with claims_admin
- `deleteTestUser()` - Cleans up test user
- `createTestApp()` - Creates a test SSO app
- `deleteTestApp()` - Removes test app
- `grantUserAppAccess()` - Grants user access to an app
- `cleanupOldAuthCodes()` - Removes expired auth codes

## CI/CD Integration

Tests are configured to run in CI (see `playwright.config.ts`):

- Single worker (no parallel execution)
- Automatic retries (2 attempts)
- HTML report generation

## Troubleshooting

### Tests fail with "relation does not exist"

Ensure migration 007 has been applied to your database.

### Tests timeout

Increase timeout in `playwright.config.ts` or check that the dev server starts correctly.

### "Service role key" errors

Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`.

### Tests pass locally but fail in CI

Check that all environment variables are set in your CI environment.

## CI/CD Integration Example

### GitHub Actions

Add this workflow file at `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXT_PUBLIC_APP_URL: http://localhost:3050

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### Required Secrets

Add these secrets in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Writing New Tests

### Test File Structure

```typescript
import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from './utils/test-helpers';

test.describe('Feature Name', () => {
  let testUserId: string;

  test.beforeAll(async () => {
    // Create test data
    testUserId = await createTestUser('test@example.com');
  });

  test.afterAll(async () => {
    // Cleanup test data
    await deleteTestUser(testUserId);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Expected Title/);
  });
});
```

### Best Practices

1. **Isolate test data** — Create unique test users/apps per test suite
2. **Clean up after tests** — Delete test data in `afterAll` hooks
3. **Use test helpers** — Leverage `e2e/utils/test-helpers.ts` for common operations
4. **Wait for elements** — Use `await expect(locator).toBeVisible()` instead of fixed waits
5. **Test real flows** — Focus on user journeys, not implementation details
