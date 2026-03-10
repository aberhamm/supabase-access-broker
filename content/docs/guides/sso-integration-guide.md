---
title: 'SSO Integration Guide'
description: 'Simple guide to integrating your applications with the central auth portal for single sign-on'
category: 'guides'
audience: 'app-developer'
order: 5
---

# SSO Integration Guide

This guide explains how to integrate **your application** with the Access Broker's **auth portal** for SSO.

**Scope:** This is for client apps consuming the SSO exchange. If you're operating the Access Broker portal itself, see [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys).

> **💡 Want to see it in action?** Check out the [Demo Guide](/DEMO_GUIDE.md) to test the SSO flow locally with the included demo page.

## What is the Auth Portal?

The auth portal is a **centralized login page** where users authenticate once and gain access to all your applications. Think of it like:

- Google login that works across Gmail, Drive, YouTube
- Your company's SSO portal that unlocks all internal apps

### Why use it?

**For users:**

- Log in once, access all apps
- Modern auth options (passkeys, social login, OTP)
- Consistent login experience

**For developers:**

- No need to build login UI for each app
- Centralized user management
- Secure token exchange

## How it Works (Simple Flow)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Your App  │         │ Auth Portal  │         │  Supabase   │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      │  1. Redirect to        │                        │
      │     auth portal        │                        │
      ├───────────────────────>│                        │
      │                        │                        │
      │                        │  2. User signs in      │
      │                        │     (passkey/social/   │
      │                        │      email/password)   │
      │                        ├───────────────────────>│
      │                        │                        │
      │                        │  3. Session created    │
      │                        │<───────────────────────┤
      │                        │                        │
      │  4. Redirect back      │                        │
      │     with auth code     │                        │
      │<───────────────────────┤                        │
      │                        │                        │
      │  5. Exchange code      │                        │
      │     for user info      │                        │
      ├───────────────────────>│                        │
      │                        │                        │
      │  6. User data +        │                        │
      │     app claims         │                        │
      │<───────────────────────┤                        │
      │                        │                        │
      │  7. Create session     │                        │
      │     in your app        │                        │
      │                        │                        │
```

## Quick Start (3 Steps)

### Step 1: Add "Sign in" Button

In your app, redirect users to the portal:

```tsx
// components/LoginButton.tsx
export function LoginButton() {
  const handleLogin = () => {
    const portalUrl = 'https://access-broker.yourdomain.com';
    const appId = 'your-app-id';
    const callbackUrl = 'https://yourapp.com/auth/callback';

    const url = new URL(`${portalUrl}/login`);
    url.searchParams.set('app_id', appId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('state', crypto.randomUUID()); // optional, for security

    window.location.href = url.toString();
  };

  return <button onClick={handleLogin}>Sign In</button>;
}
```

### Step 2: Handle the Callback

Create a route to receive the auth code:

```tsx
// app/auth/callback/route.ts
import { NextResponse } from 'next/server';

const PORTAL_URL = 'https://access-broker.yourdomain.com';
const APP_ID = 'your-app-id';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  // Exchange the code for user info from your backend
  const response = await fetch(`${PORTAL_URL}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      app_id: APP_ID,
      app_secret: process.env.SSO_APP_SECRET,
    }),
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', url.origin));
  }

  const payload = await response.json();
  // payload: { user, app_id, app_claims, expires_in }

  // Check if user has access to your app
  if (payload.app_claims?.enabled !== true) {
    return NextResponse.redirect(new URL('/access-denied', url.origin));
  }

  // YOUR APP'S RESPONSIBILITY: Create a session for this user
  // The auth portal has verified the user - now establish their session in YOUR app
  // Examples: httpOnly cookie with JWT, Redis session, database session, etc.

  return NextResponse.redirect(new URL('/', url.origin));
}
```

### Step 3: Register Your App

Contact your dashboard admin to:

1. **Register your app** in the dashboard (if not already done)
2. **Allowlist your callback URL**: `https://yourapp.com/auth/callback`

The admin will run:

```sql
UPDATE public.apps
SET allowed_callback_urls = ARRAY['https://yourapp.com/auth/callback']
WHERE id = 'your-app-id';
```

**That's it!** Your app now supports SSO.

## What You Get Back

When you exchange the code (Step 2), you receive:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "app_id": "your-app-id",
  "app_claims": {
    "enabled": true,
    "role": "user",
    "permissions": ["read", "write"]
  },
  "expires_in": 300
}
```

### Key Fields

- **`user.id`**: Unique user identifier (use this as your user ID)
- **`user.email`**: User's email address
- **`app_claims.enabled`**: **MUST be `true`** to grant access
- **`app_claims.role`**: User's role in your app (e.g., `"admin"`, `"user"`)
- **`app_claims.permissions`**: Array of permission strings
- **`expires_in`**: Code validity window (usually 5 minutes)

### Security Requirements

- `POST /api/auth/exchange` is a backend-only endpoint.
- `app_secret` is required on every exchange request.
- The hosted SDK should only be used to redirect users to `/login`. Do not exchange codes in browser code.

## Optional: Use the Hosted SDK

For even simpler integration, use the portal's JavaScript SDK:

```html
<!-- In your HTML -->
<script>
  window.__AUTH_PORTAL_URL__ = 'https://access-broker.yourdomain.com';
</script>
<script src="https://access-broker.yourdomain.com/sdk/auth-portal.js"></script>
```

```js
// In your app
AuthPortal.login({
  appId: 'your-app-id',
  redirectUri: 'https://yourapp.com/auth/callback',
  state: 'optional-state-string',
});

// Later, when logging out (Single Logout - ends portal session)
AuthPortal.logout({
  appId: 'your-app-id',
  redirectUri: 'https://yourapp.com/logged-out',
});
```

## Logout Options

When users log out of your app, you have two choices:

### Option 1: Local Logout (Simple)

Clear your app's session only. User stays logged into the portal.

```typescript
// app/auth/logout/route.ts
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('your-session-cookie');
  return NextResponse.redirect(new URL('/login', request.url));
}
```

**Result:** Quick re-login (no re-authentication needed).

### Option 2: Single Logout / SLO (Full)

Redirect to the portal's logout endpoint to end the central session.

```typescript
// app/auth/logout/route.ts
const PORTAL_URL = 'https://access-broker.yourdomain.com';
const APP_URL = 'https://yourapp.com';

export async function GET() {
  const cookieStore = await cookies();

  // 1. Clear local session first
  cookieStore.delete('your-session-cookie');

  // 2. Redirect to portal logout with callback
  const logoutUrl = new URL('/auth/logout', PORTAL_URL);
  logoutUrl.searchParams.set('next', `${APP_URL}/logged-out`);

  return NextResponse.redirect(logoutUrl.toString());
}
```

**Result:** User is logged out of portal and all SSO apps.

**Important:** Your callback URL (`https://yourapp.com/logged-out`) must be registered in your app's `allowed_callback_urls`.

> **See also:** [Logout Guide](/docs/authentication/logout-guide) for complete logout documentation including troubleshooting and best practices.

## Security Best Practices

### 1. Always Validate `app_claims.enabled`

```ts
if (payload.app_claims?.enabled !== true) {
  throw new Error('User does not have access to this app');
}
```

### 2. Exchange the Code Server-Side (Recommended)

Don't exchange the code in the browser — do it in your API route to:

- Keep the exchange secure
- Prevent code interception
- Safely store the app secret (if used)

### 3. Use an App Secret (Optional but Recommended)

For extra security, set a shared secret:

1. Generate a secret: `openssl rand -hex 32`
2. Store the **SHA-256 hash** in the portal DB
3. Send the **plain secret** when exchanging codes

```ts
body: JSON.stringify({
  code,
  app_id: APP_ID,
  app_secret: process.env.SSO_APP_SECRET, // stored securely, never in browser
});
```

The portal will verify the hash matches.

### 4. Validate State Parameter

To prevent CSRF attacks:

```ts
// Before redirect
const state = crypto.randomUUID();
sessionStorage.setItem('sso_state', state);

// In callback
const receivedState = url.searchParams.get('state');
const expectedState = sessionStorage.getItem('sso_state');
if (receivedState !== expectedState) {
  throw new Error('Invalid state parameter');
}
```

## Error Handling

The auth portal uses **implicit consent** — if a user is logged in, the authorization code is issued automatically. No explicit "Approve" screen is shown.

### Error Response Behavior

When an error occurs during the SSO flow, the portal handles it safely:

1. **If `redirect_uri` is valid and allowlisted**: The user is redirected back to your app with error parameters in the query string.
2. **If `redirect_uri` is invalid or not allowlisted**: The user sees a portal error page with recovery options (no redirect to prevent open redirect attacks).

### Error Parameters (Redirected to Your App)

When redirected back with an error, your callback URL will receive:

```
https://yourapp.com/auth/callback?error=ERROR_CODE&error_description=Human+readable+message&state=original_state
```

| Error Code                | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `invalid_request`         | Missing required parameters or malformed request |
| `unauthorized_client`     | Unknown `app_id` or app is disabled              |
| `invalid_redirect_uri`    | The `redirect_uri` is not in the allowlist       |
| `access_denied`           | User lacks permission to access the app          |
| `temporarily_unavailable` | Service temporarily unavailable                  |
| `server_error`            | Unexpected error occurred                        |

### Handling Errors in Your Callback

```ts
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Check for error response FIRST
  const error = url.searchParams.get('error');
  if (error) {
    const errorDescription = url.searchParams.get('error_description') || 'Authentication failed';
    console.error('[SSO Callback] Error:', error, errorDescription);

    // Don't retry infinitely - show an error page or redirect to login
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, url.origin));
  }

  const code = url.searchParams.get('code');
  // ... rest of normal flow
}
```

### Preventing Retry Loops

If your app receives an error, **do not automatically retry**. Instead:

1. Log the error for debugging
2. Show the user an error message
3. Provide a "Try Again" button that starts a fresh login flow

```ts
// BAD: Automatic retry loop
if (!response.ok) {
  window.location.href = `${PORTAL_URL}/login?app_id=${APP_ID}&...`; // ❌ Causes loop!
}

// GOOD: Show error state
if (!response.ok) {
  setErrorMessage('Login failed. Please try again.');
  setShowRetryButton(true); // User clicks to retry
}
```

## Common Issues

### Issue: Redirect Loop

**Symptom:** User gets redirected to portal, then back to app, then to portal again.

**Cause:** Your callback handler is redirecting to a protected route, which triggers another login.

**Fix:** Ensure your callback creates a valid session before redirecting:

```ts
// app/auth/callback/route.ts
// 1. Check for error params FIRST ✓
// 2. Exchange code ✓
// 3. Validate app_claims.enabled ✓
// 4. CREATE YOUR APP'S SESSION HERE (this is YOUR responsibility, not the portal's)
// 5. Then redirect ✓
```

> **Note:** The auth portal authenticates users and provides their info, but **your app** must manage its own sessions. The portal doesn't set cookies or JWTs in your domain.

### Issue: "Callback URL not allowed"

**Symptom:** Portal rejects the redirect with an error (you'll see this on the portal's error page, not your app).

**Cause:** Your `redirect_uri` is not allowlisted in `public.apps.allowed_callback_urls`.

**Fix:** Contact your dashboard admin to add it:

```sql
UPDATE public.apps
SET allowed_callback_urls = array_append(allowed_callback_urls, 'https://yourapp.com/auth/callback')
WHERE id = 'your-app-id';
```

**Note:** The URL must match exactly — check for trailing slashes, protocol (http vs https), and port numbers.

### Issue: Code already used / expired

**Symptom:** Exchange endpoint returns `401` or `400` with `error: "Invalid or expired code"`.

**Cause:** Auth codes are single-use and expire after 5 minutes.

**Fix:**

- Don't refresh the callback page (code is consumed on first use)
- Ensure your server clock is synchronized (use NTP)
- Start a fresh login flow if the code fails
- Check server logs for timing issues

## User Lookup API

Once a user has authenticated through SSO, your app may need to look up user information later (e.g., when receiving a Telegram message). The portal provides a backend-only `/api/users/lookup` endpoint for this purpose.

### Endpoint

**Route:** `POST /api/users/lookup`

**Request:**

```json
{
  "app_id": "your-app-id",
  "app_secret": "your-secret",
  "user_id": "uuid", // Option 1: Lookup by user ID
  "email": "user@example.com", // Option 2: Lookup by email
  "telegram_id": 123456789 // Option 3: Lookup by Telegram ID
}
```

**Note:** Provide exactly **one** lookup identifier. Requests with multiple identifiers return `400`.

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "app_claims": {
    "enabled": true,
    "role": "user",
    "permissions": ["read", "write"]
  }
}
```

### Usage Example

```typescript
// When you receive a Telegram message from user ID 123456789
const response = await fetch('https://access-broker.yourdomain.com/api/users/lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    app_id: process.env.APP_ID,
    app_secret: process.env.SSO_APP_SECRET,
    telegram_id: 123456789, // from incoming Telegram message
  }),
});

if (!response.ok) {
  throw new Error('User lookup failed');
}

const data = await response.json();
// data.user.id is the Supabase user ID
// data.app_claims tells you their role/permissions in your app
```

### Use Cases

- **Telegram bots**: Look up which user sent a message via their Telegram ID
- **Webhook handlers**: Resolve external identifiers (email, Telegram ID) to internal user IDs
- **Background jobs**: Fetch user details without requiring an active session

### Error Responses

| Status | Error | Description |
| --- | --- | --- |
| 400 | `Missing app_id` | Request missing app_id |
| 400 | `Missing lookup identifier` | No user_id, email, or telegram_id provided |
| 400 | `Provide only one lookup identifier` | Multiple identifiers provided |
| 400 | `Unknown app_id` | App not found in database |
| 401 | `Missing app_secret` | Request omitted the required app secret |
| 401 | `Invalid app_secret` | Secret doesn't match stored hash |
| 403 | `App secret is not configured` | The app must have an SSO client secret configured in the broker |
| 403 | `App is disabled` | App exists but is disabled |
| 404 | `User not found` | No user matches the identifier |

### Security Notes

- **Always use app_secret**: Store it securely in your backend environment variables
- **Never expose in browser**: Call this endpoint only from your server/backend
- **Check app_claims**: Verify `app_claims.enabled === true` before granting access
- **Audit logged**: All lookups are logged with app_id and lookup method

## What's Next

- **Technical spec**: [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys) — API contracts, database schema
- **Agent instructions**: [Auth Portal Agent Instructions](/docs/auth-portal-agent-instructions) — copy/paste tasks for AI agents
- **Auth quick reference**: [Auth Quick Reference](/docs/auth-quick-reference) — code snippets
- **Environment setup**: [Environment Configuration](/docs/environment-configuration) — production deployment
