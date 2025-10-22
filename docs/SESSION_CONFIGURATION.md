# Session Configuration Guide

## Overview

Session timeouts are controlled by both **client-side cookie settings** (already configured in this codebase) and **Supabase JWT settings** (configured in Supabase dashboard).

## What's Already Configured

✅ **Client-side (This Codebase)**
- Cookie `maxAge`: 7 days (604,800 seconds)
- Auto-refresh tokens: Enabled
- Session persistence: Enabled
- Files updated:
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`
  - `middleware.ts`

## What You Need to Configure

⚠️ **Supabase Dashboard Settings**

The actual JWT token expiration is controlled by your Supabase project settings.

### Step-by-Step Instructions

#### Method 1: Via Supabase Dashboard (Recommended)

1. **Navigate to Auth Settings**
   - Go to: https://supabase.com/dashboard/project/ompkcxbssxfweeqwdibt/settings/auth
   - Or: Project Settings → Auth

2. **Update JWT Expiry**
   - Find: **"JWT expiry limit"**
   - Current default: `3600` seconds (1 hour)
   - **Change to**: `604800` seconds (7 days)
   - Valid range: 300 seconds to 604800 seconds

3. **Update Refresh Token Expiry** (Optional but recommended)
   - Find: **"Refresh token expiry limit"**
   - Current default: `2592000` seconds (30 days)
   - Recommended: Keep at 30 days or higher
   - This determines when users must log in again

4. **Save Changes**
   - Click the "Save" button at the bottom
   - Changes take effect immediately

#### Method 2: Via SQL (Advanced)

If you prefer SQL, run this in your Supabase SQL Editor:

```sql
-- Set JWT expiry to 7 days (604800 seconds)
-- Note: This might not work on all Supabase plans
-- Use the dashboard method instead if this fails
ALTER DATABASE postgres SET jwt_exp TO '604800';

-- Reload PostgreSQL configuration
SELECT pg_reload_conf();
```

⚠️ **Note**: SQL method may not work on managed Supabase instances. Use the dashboard method.

## How It Works

### Session Lifecycle

1. **User logs in**
   - Supabase issues a JWT token (expires based on "JWT expiry limit")
   - Supabase issues a refresh token (expires based on "Refresh token expiry limit")

2. **During session**
   - JWT token stored in browser cookie (maxAge: 7 days - set in our code)
   - Auto-refresh enabled (our code automatically refreshes before JWT expires)

3. **Token refresh**
   - Before JWT expires, app requests new JWT using refresh token
   - User stays logged in seamlessly
   - This continues until refresh token expires

4. **Session ends when**
   - Refresh token expires (default: 30 days)
   - User manually logs out
   - User clears browser data

### Recommended Settings

| Setting | Recommended Value | Reason |
|---------|------------------|---------|
| JWT Expiry | 604800s (7 days) | Balances security and convenience |
| Refresh Token Expiry | 2592000s (30 days) | Users stay logged in for a month |
| Cookie maxAge | 604800s (7 days) | Already set in code |
| Auto-refresh | Enabled | Already set in code |

### Security Considerations

**Longer sessions (7 days+)**
- ✅ Better UX - fewer logins required
- ✅ Good for admin dashboards with trusted users
- ⚠️ Slightly increased security risk if device is compromised

**Shorter sessions (1-2 hours)**
- ✅ More secure
- ✅ Better for public computers
- ⚠️ Annoying - users log in frequently

**For this admin dashboard**: 7 days is a good balance since admins are typically on trusted devices.

## Verification

To verify your session settings:

1. **Log in to the dashboard**
2. **Check browser DevTools**
   - Application → Cookies
   - Look for `sb-auth-token` cookie
   - Check expiration date (should be ~7 days from now if configured correctly)

3. **Test auto-refresh**
   - Leave dashboard open for several hours
   - Should stay logged in without manual refresh

## Troubleshooting

### Problem: Users logged out after 1 hour

**Solution**: Update JWT expiry in Supabase dashboard to 604800 seconds

### Problem: "Refresh token expired" error

**Solution**: Increase "Refresh token expiry limit" in Supabase dashboard

### Problem: Cookie expires but JWT is valid

**Solution**: Cookie maxAge is already set to 7 days in the code. If this happens, check browser settings - user may have "Clear cookies on browser close" enabled.

## Environment Variables

No environment variables needed for session configuration. All settings are:
- In Supabase dashboard (JWT expiry)
- Hardcoded in TypeScript files (cookie settings)

## Related Files

- `lib/supabase/client.ts` - Client-side session config
- `lib/supabase/server.ts` - Server-side session config
- `middleware.ts` - Middleware session handling

## Questions?

If sessions still expire too quickly after configuring:
1. Verify Supabase dashboard settings saved correctly
2. Check browser DevTools for JWT expiration
3. Look at server logs for refresh token errors
