# E2E Tests

Automated end-to-end tests for the Claims Admin Dashboard SSO flow.

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
