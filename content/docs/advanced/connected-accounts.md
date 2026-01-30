---
title: "Connected Accounts"
description: "Link external accounts like Telegram to Supabase users"
category: "advanced"
audience: "dashboard-admin"
order: 12
---

# Connected Accounts

Link external accounts (like Telegram) to your Supabase users for cross-platform identity management, notifications, and authorization.

## Overview

Connected accounts allow you to associate external service identities with Supabase users. This is useful for:

- **Cross-platform identification**: Know which Telegram account belongs to which user
- **Notifications**: Send messages via Telegram bots to the right users
- **Bot interactions**: Verify users in Telegram bots against your Supabase database
- **Multi-channel auth**: Use Telegram as an additional verification method

## Telegram Integration

### Data Structure

Telegram account data is stored as a custom claim in the user's `app_metadata`:

```json
{
  "telegram": {
    "id": 123456789,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "linked_at": "2024-01-15T10:30:00.000Z"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | ✅ Yes | Unique Telegram user ID |
| `username` | string | No | Telegram username (without @) |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `linked_at` | string | Auto | ISO timestamp when linked |

### Finding a User's Telegram ID

The Telegram ID is a permanent numeric identifier. To find it:

1. **Using @userinfobot** (easiest):
   - Open Telegram and message [@userinfobot](https://t.me/userinfobot)
   - Forward any message from the target user to the bot
   - The bot replies with the user's numeric ID

2. **Using your own bot**:
   - Access the `message.from.id` field in bot updates
   - Example from webhook payload:
   ```json
   {
     "message": {
       "from": {
         "id": 123456789,
         "first_name": "John",
         "username": "johndoe"
       }
     }
   }
   ```

3. **Using Telegram's Bot API**:
   ```bash
   # When a user messages your bot, check the getUpdates response
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
   ```

### Linking via Dashboard

1. Navigate to **Users** → Select a user
2. Find the **Connected Accounts** card
3. Click **Link Telegram Account**
4. Enter the Telegram ID (required) and optional details
5. Click **Link Account**

### Linking Programmatically

#### Server-Side (Server Actions)

```typescript
import { linkTelegramAction, unlinkTelegramAction } from '@/app/actions/telegram';

// Link a Telegram account
const result = await linkTelegramAction('user-uuid', {
  id: 123456789,
  username: 'johndoe',
  first_name: 'John',
  last_name: 'Doe'
});

if (result.error) {
  console.error('Failed:', result.error);
} else {
  console.log('Linked at:', result.data.linked_at);
}

// Unlink a Telegram account
const unlinkResult = await unlinkTelegramAction('user-uuid');
```

#### Direct RPC (Supabase Client)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceRoleKey);

// Link Telegram via set_claim RPC
const { error } = await supabase.rpc('set_claim', {
  uid: 'user-uuid',
  claim: 'telegram',
  value: {
    id: 123456789,
    username: 'johndoe',
    first_name: 'John',
    linked_at: new Date().toISOString()
  }
});

// Unlink via delete_claim RPC
await supabase.rpc('delete_claim', {
  uid: 'user-uuid',
  claim: 'telegram'
});
```

### Reading Telegram Data

#### From JWT Token (Client-Side)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, anonKey);
const { data: { session } } = await supabase.auth.getSession();

// Access from the session's user metadata
const telegram = session?.user?.app_metadata?.telegram;

if (telegram) {
  console.log('Telegram ID:', telegram.id);
  console.log('Username:', telegram.username);
}
```

#### From Database (Server-Side)

```typescript
// Using admin client
const { data: user } = await supabase.auth.admin.getUserById('user-uuid');
const telegram = user?.app_metadata?.telegram;

// Or via RPC
const { data: telegram } = await supabase.rpc('get_claim', {
  uid: 'user-uuid',
  claim: 'telegram'
});
```

### Use Cases

#### 1. Telegram Bot User Verification

Verify that a Telegram user is who they claim to be:

```typescript
// In your Telegram bot webhook handler
async function handleTelegramUpdate(update) {
  const telegramId = update.message.from.id;

  // Find the Supabase user with this Telegram ID
  const { data: users } = await supabase.auth.admin.listUsers();

  const linkedUser = users.users.find(
    user => user.app_metadata?.telegram?.id === telegramId
  );

  if (linkedUser) {
    // User is verified - proceed with authorized actions
    return { verified: true, user: linkedUser };
  } else {
    // Unknown Telegram user
    return { verified: false };
  }
}
```

#### 2. Send Notifications via Telegram

```typescript
async function sendTelegramNotification(userId: string, message: string) {
  // Get user's Telegram ID
  const { data: user } = await supabase.auth.admin.getUserById(userId);
  const telegramId = user?.app_metadata?.telegram?.id;

  if (!telegramId) {
    throw new Error('User has no linked Telegram account');
  }

  // Send via Telegram Bot API
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramId,
      text: message
    })
  });
}
```

#### 3. RLS Policy Based on Telegram Status

```sql
-- Allow access only to users with linked Telegram accounts
CREATE POLICY "telegram_users_only" ON some_table
FOR SELECT USING (
  auth.jwt() -> 'app_metadata' -> 'telegram' IS NOT NULL
);

-- Check specific Telegram ID
CREATE POLICY "specific_telegram_user" ON some_table
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' -> 'telegram' ->> 'id')::bigint = 123456789
);
```

### Security Considerations

1. **Verification**: The dashboard doesn't verify that a Telegram ID actually belongs to the user. For high-security scenarios, implement a verification flow (e.g., send a code via Telegram bot that the user must enter).

2. **ID Uniqueness**: Consider adding a database constraint or check to prevent the same Telegram ID being linked to multiple users.

3. **Session Refresh**: Users need to refresh their session after Telegram data is updated to see changes in client-side JWT claims.

4. **Data Privacy**: Telegram IDs are permanent identifiers. Store only what you need and document your data usage.

### Troubleshooting

**"Invalid Telegram ID" error**
- Ensure the ID is a positive integer
- Telegram IDs are always numeric, never text

**Telegram data not appearing in JWT**
- User needs to refresh their session
- Call `supabase.auth.refreshSession()` or have user log out and back in

**Can't find user's Telegram ID**
- Use [@userinfobot](https://t.me/userinfobot) on Telegram
- Ask the user to message your bot, then read from the update payload

## Future Connected Accounts

The same pattern can be extended for other platforms:

- **Discord**: Store `discord_id` and `discord_username`
- **WhatsApp**: Store phone number (with consent)
- **Slack**: Store Slack user ID for workspace integrations
- **GitHub**: Already available via Supabase OAuth, but can store additional data

---

## Related Documentation

- [Claims Guide](/docs/claims-guide) - Understanding custom claims
- [Complete Integration Guide](/docs/complete-integration-guide) - Full integration walkthrough
- [Authorization Patterns](/docs/authorization-patterns) - Role-based access patterns
- [RLS Policies](/docs/rls-policies) - Database security with claims

---

## What's Next

- **Claims:** [/docs/claims-guide](/docs/claims-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **RLS policies:** [/docs/rls-policies](/docs/rls-policies)
- **Complete integration:** [/docs/complete-integration-guide](/docs/complete-integration-guide)
