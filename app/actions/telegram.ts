'use server';

import { createClient } from '@/lib/supabase/server';
import { setClaim, deleteClaim, isClaimsAdmin } from '@/lib/claims';
import { revalidatePath } from 'next/cache';

/**
 * Telegram account data structure stored in user's app_metadata
 *
 * @example
 * ```json
 * {
 *   "telegram": {
 *     "id": 123456789,
 *     "username": "johndoe",
 *     "first_name": "John",
 *     "last_name": "Doe",
 *     "linked_at": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 * ```
 */
export interface TelegramData {
  /**
   * Unique Telegram user ID (numeric).
   * This is the permanent identifier for a Telegram account.
   * Can be obtained via @userinfobot or Telegram Bot API.
   */
  id: number;

  /**
   * Telegram username (without @).
   * Optional as not all Telegram users have a username.
   * Used for generating t.me links.
   */
  username?: string;

  /**
   * User's first name on Telegram.
   * Helps identify the account in the UI.
   */
  first_name?: string;

  /**
   * User's last name on Telegram.
   * Optional field from Telegram profile.
   */
  last_name?: string;

  /**
   * ISO 8601 timestamp when the account was linked.
   * Automatically set by the system.
   */
  linked_at: string;
}

/**
 * Links a Telegram account to a Supabase user.
 *
 * This stores the Telegram data as a custom claim in the user's app_metadata,
 * making it available in JWT tokens for authorization purposes.
 *
 * @param uid - The Supabase user ID to link the Telegram account to
 * @param telegramData - The Telegram account information (without linked_at)
 * @returns Object with success status or error message
 *
 * @example
 * ```typescript
 * const result = await linkTelegramAction('user-uuid', {
 *   id: 123456789,
 *   username: 'johndoe',
 *   first_name: 'John',
 *   last_name: 'Doe'
 * });
 *
 * if (result.error) {
 *   console.error('Failed to link:', result.error);
 * } else {
 *   console.log('Linked at:', result.data?.linked_at);
 * }
 * ```
 *
 * @requires claims_admin - Caller must have claims_admin privilege
 *
 * @see unlinkTelegramAction - To remove the Telegram association
 * @see TelegramData - For the data structure stored
 */
export async function linkTelegramAction(
  uid: string,
  telegramData: Omit<TelegramData, 'linked_at'>
) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  // Validate telegram ID - must be a positive integer
  if (
    !telegramData.id ||
    typeof telegramData.id !== 'number' ||
    telegramData.id <= 0 ||
    !Number.isInteger(telegramData.id)
  ) {
    return { error: 'Invalid Telegram ID: Must be a positive integer' };
  }

  // Validate username format if provided (alphanumeric and underscores, 5-32 chars)
  if (telegramData.username) {
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
    if (!usernameRegex.test(telegramData.username)) {
      return {
        error:
          'Invalid username format: Must be 5-32 characters, start with a letter, and contain only letters, numbers, and underscores',
      };
    }
  }

  const data: TelegramData = {
    ...telegramData,
    linked_at: new Date().toISOString(),
  };

  const { error } = await setClaim(supabase, uid, 'telegram', data);

  if (error) {
    return { error: error.message || 'Failed to link Telegram account' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');

  return { success: true, data };
}

/**
 * Removes the Telegram account association from a Supabase user.
 *
 * This deletes the 'telegram' claim from the user's app_metadata.
 * The user will need to refresh their session to see the change.
 *
 * @param uid - The Supabase user ID to unlink Telegram from
 * @returns Object with success status or error message
 *
 * @example
 * ```typescript
 * const result = await unlinkTelegramAction('user-uuid');
 *
 * if (result.error) {
 *   console.error('Failed to unlink:', result.error);
 * } else {
 *   console.log('Telegram account unlinked successfully');
 * }
 * ```
 *
 * @requires claims_admin - Caller must have claims_admin privilege
 *
 * @see linkTelegramAction - To link a Telegram account
 */
export async function unlinkTelegramAction(uid: string) {
  const supabase = await createClient();

  // Verify user is claims_admin
  const { data: isAdmin } = await isClaimsAdmin(supabase);
  if (!isAdmin) {
    return { error: 'Unauthorized: You must be a claims_admin' };
  }

  const { error } = await deleteClaim(supabase, uid, 'telegram');

  if (error) {
    return { error: error.message || 'Failed to unlink Telegram account' };
  }

  revalidatePath(`/users/${uid}`);
  revalidatePath('/users');

  return { success: true };
}
