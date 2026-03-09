/**
 * Global setup runs once before all tests
 * Use this to ensure test environment is ready
 */
async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  // Verify environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredEnvVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Make sure your .env.local file is configured with Supabase credentials.'
    );
  }

  console.log('✓ Environment variables verified');
  console.log('✓ Global setup complete\n');
}

export default globalSetup;
