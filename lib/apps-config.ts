import { AppInfo } from '@/types/claims';

/**
 * Fallback App Registry Configuration
 *
 * IMPORTANT: This configuration is now used as a FALLBACK only.
 * Apps are primarily stored in the database (public.apps table).
 * This fallback is used when:
 * - Database is empty or unavailable
 * - USE_FALLBACK_CONFIG=true in environment (default)
 *
 * For production use, manage apps via the Admin UI (/apps page) or
 * insert them directly into the database.
 *
 * To add a new app:
 * - Preferred: Use the Admin UI at /apps to create apps
 * - Alternative: Add to this array as fallback
 * - Database entries take precedence over this config
 */
export const APPS: AppInfo[] = [
  {
    id: 'app1',
    name: 'Application 1',
    description: 'Main application',
    color: 'blue',
  },
  {
    id: 'app2',
    name: 'Application 2',
    description: 'Secondary application',
    color: 'green',
  },
  // Add more apps as needed
];

/**
 * Common role definitions that can be used across apps
 * Apps can use these or define their own custom roles
 */
export const COMMON_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to the application' },
  { value: 'user', label: 'User', description: 'Standard user access' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  { value: 'editor', label: 'Editor', description: 'Can edit but not manage users' },
] as const;

/**
 * Helper to get app info by ID
 */
export function getAppById(appId: string): AppInfo | undefined {
  return APPS.find((app) => app.id === appId);
}

/**
 * Helper to get all app IDs
 */
export function getAllAppIds(): string[] {
  return APPS.map((app) => app.id);
}

/**
 * Validate if an app ID exists in the configuration
 */
export function isValidAppId(appId: string): boolean {
  return APPS.some((app) => app.id === appId);
}
