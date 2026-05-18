import { createHash, randomUUID } from 'node:crypto';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { Browser, BrowserContext, Page } from '@playwright/test';

let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  _supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase() as object, prop);
  },
});

/**
 * Test user credentials
 * By default, uses an isolated test identity.
 * You can override by setting TEST_USER_EMAIL and TEST_USER_PASSWORD env vars
 */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test-sso@example.com',
  password: process.env.TEST_USER_PASSWORD || 'test-password-change-me',
};

export const TEST_APP = {
  id: 'demo-app', // Use the existing demo app we set up
  name: 'Demo Application',
  description: 'Test app for SSO integration',
  color: '#06b6d4',
  secret: process.env.TEST_APP_SECRET || 'demo-app-secret-for-tests',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
const DEMO_CALLBACK = `${APP_URL}/demo/sso-demo.html`;
const TEST_APP_SECRET_HASH = createHash('sha256').update(TEST_APP.secret, 'utf8').digest('hex');

/**
 * Get or ensure test user exists
 * Uses existing user if available, only creates if needed
 */
export async function ensureTestUser() {
  // Find user by email
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === TEST_USER.email);

  if (existing) {
    console.log(`Using existing user: ${TEST_USER.email}`);
    // Ensure user has claims_admin
    const currentMetadata = existing.app_metadata || {};
    if (!currentMetadata.claims_admin) {
      console.log('Granting claims_admin to test user...');
      await supabase.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          ...currentMetadata,
          claims_admin: true,
        },
      });
    }
    return existing;
  }

  // Only create if user doesn't exist (for CI/new environments)
  console.log(`Creating new test user: ${TEST_USER.email}`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
    app_metadata: {
      claims_admin: true,
    },
  });

  if (error) {
    console.error('Failed to create test user:', error.message);
    // Try to find the user one more time in case of race condition
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users.find((u) => u.email === TEST_USER.email);
    if (user) {
      console.log('Found user after race condition');
      return user;
    }
    throw new Error(`Cannot create test user: ${error.message}`);
  }
  return data.user;
}

/**
 * Delete test user (only if it was created for testing, not real users)
 */
export async function deleteTestUser() {
  // Only delete if it's a test email (contains 'test-sso@example')
  if (!TEST_USER.email.includes('test-sso@example')) {
    console.log('Skipping deletion of real user account');
    return;
  }

  const { data: users } = await supabase.auth.admin.listUsers();
  const testUser = users?.users.find((u) => u.email === TEST_USER.email);

  if (testUser) {
    await supabase.auth.admin.deleteUser(testUser.id);
    console.log('Test user deleted');
  }
}

/**
 * Create or update test app.
 * Uses upsert with a fallback select to handle flaky RLS errors on INSERT
 * (service_role should bypass RLS but intermittently doesn't on some instances).
 */
export async function createTestApp() {
  const appPayload = {
    id: TEST_APP.id,
    name: TEST_APP.name,
    description: TEST_APP.description,
    color: TEST_APP.color,
    enabled: true,
    allowed_callback_urls: [DEMO_CALLBACK],
    sso_client_secret_hash: TEST_APP_SECRET_HASH,
  };

  // Try upsert first — handles both create and update in one call
  const { data, error } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .upsert(appPayload, { onConflict: 'id' })
    .select()
    .single();

  if (!error && data) {
    console.log(`Test app upserted: ${TEST_APP.id}`);
    return data;
  }

  console.warn('Upsert failed, falling back to select:', error?.message);

  // Fallback: if upsert failed (e.g. RLS), check if the app already exists
  const { data: existing } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .select('*')
    .eq('id', TEST_APP.id)
    .maybeSingle();

  if (existing) {
    console.log(`Test app already exists: ${TEST_APP.id}`);
    // Try to update callback URLs
    await supabase
      .schema('access_broker_app')
      .from('apps')
      .update({
        enabled: true,
        allowed_callback_urls: [DEMO_CALLBACK],
        sso_client_secret_hash: TEST_APP_SECRET_HASH,
      })
      .eq('id', TEST_APP.id);
    return existing;
  }

  throw error || new Error('Failed to create or find test app');
}

/**
 * Delete test app
 */
export async function deleteTestApp() {
  await supabase.schema('access_broker_app').from('apps').delete().eq('id', TEST_APP.id);
}

/**
 * Grant user access to an app
 */
export async function grantUserAppAccess(userId: string, appId: string, role: string = 'user') {
  const { data, error: fetchError } = await supabase.auth.admin.getUserById(userId);

  if (fetchError || !data?.user) throw new Error('User not found');

  const currentMetadata = data.user.app_metadata || {};
  const apps = currentMetadata.apps || {};

  apps[appId] = {
    enabled: true,
    role,
  };

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...currentMetadata,
      apps,
    },
  });

  if (error) throw error;
}

/**
 * Clean up old auth codes (for test cleanup)
 */
export async function cleanupOldAuthCodes() {
  await supabase
    .schema('access_broker_app')
    .from('auth_codes')
    .delete()
    .lt('expires_at', new Date().toISOString());
}

/**
 * Toggle self-signup settings on a test app
 */
export async function setAppSelfSignup(
  appId: string,
  settings: { allow_self_signup: boolean; self_signup_default_role?: string }
) {
  const updateData: Record<string, unknown> = {
    allow_self_signup: settings.allow_self_signup,
  };
  if (settings.self_signup_default_role !== undefined) {
    updateData.self_signup_default_role = settings.self_signup_default_role;
  }

  const { error } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .update(updateData)
    .eq('id', appId);

  if (error) throw error;
}

/**
 * Merge auth_methods flags on a test app (preserves existing keys).
 */
export async function setAppAuthMethods(
  appId: string,
  methods: Partial<Record<'password' | 'magic_link' | 'email_otp' | 'passkeys' | 'google' | 'github' | 'apple', boolean>>
) {
  const { data, error: fetchError } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .select('auth_methods')
    .eq('id', appId)
    .single();

  if (fetchError) throw fetchError;

  const merged = { ...(data?.auth_methods ?? {}), ...methods };

  const { error } = await supabase
    .schema('access_broker_app')
    .from('apps')
    .update({ auth_methods: merged })
    .eq('id', appId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Multi-user factory + bulk cleanup
//
// Safe to run against any environment, including production. Every test user
// is tagged with three independent markers so cleanup can never delete a real
// user by accident:
//
//   1. Email local-part starts with `e2e+`
//   2. Email domain equals TEST_USER_DOMAIN (default `e2e.test`)
//   3. `app_metadata.e2e_test === true`
//
// Bulk cleanup requires ALL THREE to match. If a real user somehow had an
// `e2e+…@e2e.test` address, the metadata flag still protects them.
// ---------------------------------------------------------------------------

export const TEST_USER_PREFIX = 'e2e+';
const TEST_USER_DOMAIN = process.env.TEST_USER_DOMAIN || 'e2e.test';

/** Stable per-process run id, recorded on each created user for traceability. */
const E2E_RUN_ID = process.env.E2E_RUN_ID || randomUUID();

function isTestUser(u: { email?: string | null; app_metadata?: Record<string, unknown> }): boolean {
  const email = (u.email || '').toLowerCase();
  if (!email.startsWith(TEST_USER_PREFIX)) return false;
  const domain = email.split('@')[1];
  if (domain !== TEST_USER_DOMAIN.toLowerCase()) return false;
  return u.app_metadata?.e2e_test === true;
}

export type AppClaimSeed = {
  enabled?: boolean;
  role?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
};

export type TestUserSpec = {
  /** Short tag baked into the email local-part for log readability (e.g. "admin"). */
  tag?: string;
  /** Override the password (default: random). */
  password?: string;
  /** Set claims_admin=true at the global level. */
  globalAdmin?: boolean;
  /** Per-app claim seeds keyed by app id. */
  apps?: Record<string, AppClaimSeed>;
};

export type TestUser = {
  id: string;
  email: string;
  password: string;
  user: User;
};

/**
 * Create a fresh test user with prefixed email and the e2e_test marker set on
 * app_metadata. Always succeeds with a unique email.
 */
export async function createTestUser(spec: TestUserSpec = {}): Promise<TestUser> {
  const tag = (spec.tag || 'user').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const email = `${TEST_USER_PREFIX}${tag}-${randomUUID().slice(0, 8)}@${TEST_USER_DOMAIN}`;
  const password = spec.password || `pw-${randomUUID()}`;

  // The e2e_test marker is what cleanup keys off. Do not remove it from
  // existing users — strip-and-replace updates must preserve it.
  const appMetadata: Record<string, unknown> = {
    e2e_test: true,
    e2e_run_id: E2E_RUN_ID,
  };
  if (spec.globalAdmin) appMetadata.claims_admin = true;
  if (spec.apps) appMetadata.apps = spec.apps;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  });

  if (error || !data?.user) {
    throw new Error(`createTestUser failed: ${error?.message || 'unknown error'}`);
  }

  return { id: data.user.id, email, password, user: data.user };
}

/**
 * Bulk delete every user that matches all three e2e markers. Iterates the full
 * auth.users list — pass `onlyThisRun: true` to restrict to users created in
 * the current process (matching `app_metadata.e2e_run_id === E2E_RUN_ID`).
 */
export async function cleanupTestUsers(opts: { onlyThisRun?: boolean } = {}): Promise<number> {
  let deleted = 0;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data?.users ?? [];
    if (batch.length === 0) break;

    const targets = batch.filter((u) => {
      if (!isTestUser(u)) return false;
      if (opts.onlyThisRun && u.app_metadata?.e2e_run_id !== E2E_RUN_ID) return false;
      return true;
    });

    for (const u of targets) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (!delErr) deleted += 1;
    }

    if (batch.length < 200) break;
    page += 1;
  }
  return deleted;
}

/**
 * Drive the login form to sign a user in via password. Used to test the actual
 * UI path. For tests that just need an authenticated session as a fixture,
 * prefer signInAs() — it skips the form and is faster + less brittle.
 */
export async function loginViaPasswordUi(page: Page, user: Pick<TestUser, 'email' | 'password'>) {
  await page.goto('/login');
  // Force password mode in case the page defaulted to magic link / OTP.
  const passwordTab = page.getByRole('button', { name: /Sign in with password/i });
  if (await passwordTab.isVisible().catch(() => false)) {
    await passwordTab.click();
  }
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
}

/**
 * Establish a session for `user` in `page` without going through the UI. Uses
 * an admin-generated magic link, which the existing /auth/confirm route turns
 * into a server-set session cookie. Robust against UI changes.
 */
export async function signInAs(page: Page, user: Pick<TestUser, 'email'>, opts: { next?: string } = {}) {
  const next = opts.next || '/';

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`generateLink failed for ${user.email}: ${error?.message || 'no token'}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
  const confirmUrl = new URL('/auth/confirm', appUrl);
  confirmUrl.searchParams.set('token_hash', data.properties.hashed_token);
  confirmUrl.searchParams.set('type', 'magiclink');
  confirmUrl.searchParams.set('next', next);

  await page.goto(confirmUrl.toString());
}

/**
 * Spin up an isolated browser context already signed in as `user`. Use this
 * when a test needs multiple concurrent users (admin + member, two tenants,
 * etc.). Each context gets its own cookie jar.
 */
export async function createSignedInContext(
  browser: Browser,
  user: TestUser,
  opts: { next?: string } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, user, opts);
  return { context, page };
}

/**
 * Remove a user's app access (clear app claims)
 */
export async function revokeUserAppAccess(userId: string, appId: string) {
  const { data, error: fetchError } = await supabase.auth.admin.getUserById(userId);
  if (fetchError || !data?.user) throw new Error('User not found');

  const currentMetadata = { ...(data.user.app_metadata || {}) };
  const apps = { ...(currentMetadata.apps || {}) };
  delete apps[appId];

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { ...currentMetadata, apps },
  });

  if (error) throw error;
}
