import { deleteTestUser, deleteTestApp, cleanupOldAuthCodes } from '../utils/test-helpers';

/**
 * Global teardown runs once after all tests complete.
 * Cleans up test accounts, apps, and expired auth codes
 * so they don't accumulate across runs.
 */
async function globalTeardown() {
  console.log('\n🧹 Starting global test teardown...');

  try {
    await cleanupOldAuthCodes();
    console.log('✓ Expired auth codes cleaned up');
  } catch (e) {
    console.warn('⚠ Could not clean up auth codes:', (e as Error).message);
  }

  try {
    await deleteTestUser();
    console.log('✓ Test user cleaned up');
  } catch (e) {
    console.warn('⚠ Could not clean up test user:', (e as Error).message);
  }

  try {
    await deleteTestApp();
    console.log('✓ Test app cleaned up');
  } catch (e) {
    console.warn('⚠ Could not clean up test app:', (e as Error).message);
  }

  console.log('✓ Global teardown complete\n');
}

export default globalTeardown;
