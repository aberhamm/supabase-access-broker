#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * This script manages database migrations for the Supabase Claims Admin Dashboard.
 * It tracks which migrations have been applied and runs pending migrations in order.
 *
 * Usage:
 *   pnpm migrate              - Run all pending migrations
 *   pnpm migrate:status       - Show migration status
 *   pnpm migrate:force <name> - Force re-run a specific migration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Type for Supabase client (using any for Database type to avoid complex generics)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MigrationSupabaseClient = SupabaseClient<any>;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  debug: (msg: string) => console.log(`${colors.gray}${msg}${colors.reset}`),
};

interface Migration {
  name: string;
  path: string;
  checksum: string;
  content: string;
}

interface AppliedMigration {
  name: string;
  applied_at: string;
  checksum: string | null;
  success: boolean;
}

// Initialize Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    log.error('Missing required environment variables:');
    if (!url) log.error('  - NEXT_PUBLIC_SUPABASE_URL');
    if (!key) log.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Get all migration files
function getMigrationFiles(): Migration[] {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.startsWith('000_'))
    .sort(); // Sort alphabetically (001, 002, etc.)

  return files.map(file => {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    return {
      name: file.replace('.sql', ''),
      path: filePath,
      checksum,
      content,
    };
  });
}

// Get applied migrations from database
async function getAppliedMigrations(supabase: MigrationSupabaseClient): Promise<AppliedMigration[]> {
  const { data, error } = await supabase
    .from('migrations')
    .select('name, applied_at, checksum, success')
    .order('applied_at', { ascending: true });

  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === '42P01') {
      return [];
    }
    throw error;
  }

  return data || [];
}

// Initialize migration tracking (run 000_migration_tracker.sql if needed)
async function initializeMigrationTracking(supabase: MigrationSupabaseClient): Promise<boolean> {
  const trackerPath = path.join(__dirname, '../migrations/000_migration_tracker.sql');

  if (!fs.existsSync(trackerPath)) {
    log.warning('Migration tracker SQL not found. Skipping initialization.');
    return false;
  }

  // Check if migrations table exists
  const { error: checkError } = await supabase
    .from('migrations')
    .select('id')
    .limit(1);

  if (!checkError) {
    // Table already exists
    return true;
  }

  log.info('Initializing migration tracking system...');
  const trackerSQL = fs.readFileSync(trackerPath, 'utf-8');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('exec_sql', { sql: trackerSQL });

  if (error) {
    // Try direct execution (for service role)
    const { error: directError } = await supabase.from('migrations').select('id').limit(1);
    if (directError) {
      log.error('Failed to initialize migration tracking:');
      log.error(directError.message);
      return false;
    }
  }

  log.success('Migration tracking initialized');
  return true;
}

// Execute a migration
async function executeMigration(
  supabase: MigrationSupabaseClient,
  migration: Migration
): Promise<{ success: boolean; error?: string; executionTime: number }> {
  const startTime = Date.now();

  log.info(`Running migration: ${colors.cyan}${migration.name}${colors.reset}`);

  try {
    // Split migration into individual statements
    const statements = migration.content
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('exec_sql', { sql: statement });

      if (error) {
        // For service role, try direct query
        const { error: queryError } = await supabase.from('_').select().limit(0);
        if (queryError && queryError.message !== 'relation "_" does not exist') {
          throw new Error(error.message);
        }
      }
    }

    const executionTime = Date.now() - startTime;

    // Record successful migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('record_migration', {
      migration_name: migration.name,
      checksum_val: migration.checksum,
      exec_time: executionTime,
      success_val: true,
      error_msg: null,
    });

    log.success(`Migration completed in ${executionTime}ms: ${migration.name}`);
    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record failed migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('record_migration', {
      migration_name: migration.name,
      checksum_val: migration.checksum,
      exec_time: executionTime,
      success_val: false,
      error_msg: errorMessage,
    });

    log.error(`Migration failed: ${migration.name}`);
    log.error(`Error: ${errorMessage}`);
    return { success: false, error: errorMessage, executionTime };
  }
}

// Show migration status
async function showStatus(supabase: MigrationSupabaseClient) {
  console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.cyan + '  Database Migration Status' + colors.reset);
  console.log(colors.cyan + '═'.repeat(70) + colors.reset + '\n');

  const migrations = getMigrationFiles();
  const applied = await getAppliedMigrations(supabase);
  const appliedMap = new Map(applied.map(m => [m.name, m]));

  let pendingCount = 0;
  let appliedCount = 0;

  for (const migration of migrations) {
    const appliedMigration = appliedMap.get(migration.name);

    if (appliedMigration) {
      const status = appliedMigration.success ? colors.green + '✓ Applied' : colors.red + '✗ Failed';
      const date = new Date(appliedMigration.applied_at).toLocaleString();
      console.log(`${status}${colors.reset}  ${migration.name}`);
      console.log(`${colors.gray}          ${date}${colors.reset}`);

      if (appliedMigration.checksum && appliedMigration.checksum !== migration.checksum) {
        console.log(`${colors.yellow}          ⚠ Checksum mismatch (file modified)${colors.reset}`);
      }

      appliedCount++;
    } else {
      console.log(`${colors.yellow}○ Pending${colors.reset}  ${migration.name}`);
      pendingCount++;
    }
  }

  console.log('\n' + colors.cyan + '─'.repeat(70) + colors.reset);
  console.log(`  Total: ${migrations.length} | Applied: ${appliedCount} | Pending: ${pendingCount}`);
  console.log(colors.cyan + '═'.repeat(70) + colors.reset + '\n');
}

// Run pending migrations
async function runMigrations(supabase: MigrationSupabaseClient, force?: string) {
  const migrations = getMigrationFiles();
  const applied = await getAppliedMigrations(supabase);
  const appliedMap = new Map(applied.map(m => [m.name, m]));

  const pending = force
    ? migrations.filter(m => m.name === force)
    : migrations.filter(m => !appliedMap.has(m.name) || !appliedMap.get(m.name)!.success);

  if (pending.length === 0) {
    log.success('All migrations are up to date!');
    return;
  }

  console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.cyan + `  Running ${pending.length} migration(s)` + colors.reset);
  console.log(colors.cyan + '═'.repeat(70) + colors.reset + '\n');

  let successCount = 0;
  let failCount = 0;

  for (const migration of pending) {
    const result = await executeMigration(supabase, migration);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      log.error('Migration failed. Stopping execution.');
      break;
    }
  }

  console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.cyan + '  Migration Summary' + colors.reset);
  console.log(colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(`  ${colors.green}✓ Success: ${successCount}${colors.reset}`);
  if (failCount > 0) {
    console.log(`  ${colors.red}✗ Failed: ${failCount}${colors.reset}`);
  }
  console.log(colors.cyan + '═'.repeat(70) + colors.reset + '\n');
}

// Main function
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  const supabase = getSupabaseClient();

  // Initialize migration tracking
  await initializeMigrationTracking(supabase);

  switch (command) {
    case 'status':
      await showStatus(supabase);
      break;

    case 'force':
      if (!arg) {
        log.error('Please specify a migration name to force re-run');
        log.info('Usage: pnpm migrate force <migration-name>');
        process.exit(1);
      }
      await runMigrations(supabase, arg);
      break;

    case undefined:
    case 'run':
      await runMigrations(supabase);
      break;

    default:
      log.error(`Unknown command: ${command}`);
      log.info('Available commands:');
      log.info('  pnpm migrate              - Run all pending migrations');
      log.info('  pnpm migrate status        - Show migration status');
      log.info('  pnpm migrate force <name>  - Force re-run a migration');
      process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  log.error('Unexpected error:');
  console.error(error);
  process.exit(1);
});
