import { createHash } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
