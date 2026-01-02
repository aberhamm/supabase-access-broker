/**
 * Get the application URL for auth redirects
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (production/staging)
 * 2. window.location.origin (fallback for development)
 *
 * Set NEXT_PUBLIC_APP_URL in production to ensure correct redirects:
 * - Vercel: Set in environment variables
 * - Docker: Set in .env or docker-compose
 * - Other: Set in your deployment configuration
 */
export function getAppUrl(): string {
  // In production, use the environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Fallback to window.location.origin (client-side only)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side fallback (should not happen in client components)
  return 'http://localhost:3050';
}
