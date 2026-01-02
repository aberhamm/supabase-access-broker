---
title: "SSO Integration Guide"
description: "Simple guide to integrating your applications with the central auth portal for single sign-on"
category: "guides"
audience: "app-developer"
order: 5
---

# SSO Integration Guide

This guide explains how to integrate your application with the **central auth portal** for single sign-on (SSO).

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
    const portalUrl = 'https://auth.yourdomain.com';
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

const PORTAL_URL = 'https://auth.yourdomain.com';
const APP_ID = 'your-app-id';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  // Exchange the code for user info
  const response = await fetch(`${PORTAL_URL}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      app_id: APP_ID,
      // app_secret: process.env.SSO_APP_SECRET, // optional, for extra security
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
    "email": "user@example.com",
    "email_verified": true,
    "app_metadata": { ... },
    "user_metadata": { ... }
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

## Optional: Use the Hosted SDK

For even simpler integration, use the portal's JavaScript SDK:

```html
<!-- In your HTML -->
<script>
  window.__AUTH_PORTAL_URL__ = 'https://auth.yourdomain.com';
</script>
<script src="https://auth.yourdomain.com/sdk/auth-portal.js"></script>
```

```js
// In your app
AuthPortal.login({
  appId: 'your-app-id',
  redirectUri: 'https://yourapp.com/auth/callback',
  state: 'optional-state-string'
});

// Later, when logging out
AuthPortal.logout({
  appId: 'your-app-id',
  redirectUri: 'https://yourapp.com'
});
```

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
})
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

## Common Issues

### Issue: Redirect Loop

**Symptom:** User gets redirected to portal, then back to app, then to portal again.

**Cause:** Your callback handler is redirecting to a protected route, which triggers another login.

**Fix:** Ensure your callback creates a valid session before redirecting:

```ts
// app/auth/callback/route.ts
// 1. Exchange code ✓
// 2. Validate app_claims.enabled ✓
// 3. CREATE YOUR APP'S SESSION HERE (this is YOUR responsibility, not the portal's)
// 4. Then redirect ✓
```

> **Note:** The auth portal authenticates users and provides their info, but **your app** must manage its own sessions. The portal doesn't set cookies or JWTs in your domain.

### Issue: "Callback URL not allowed"

**Symptom:** Portal rejects the redirect with an error.

**Cause:** Your `redirect_uri` is not allowlisted in `public.apps.allowed_callback_urls`.

**Fix:** Contact your dashboard admin to add it:

```sql
UPDATE public.apps
SET allowed_callback_urls = array_append(allowed_callback_urls, 'https://yourapp.com/auth/callback')
WHERE id = 'your-app-id';
```

### Issue: Code already used / expired

**Symptom:** Exchange endpoint returns `401` or `400`.

**Cause:** Auth codes are single-use and expire after 5 minutes.

**Fix:**
- Don't refresh the callback page (code is consumed)
- Ensure your server clock is correct
- Start a fresh login flow

## What's Next

- **Technical spec**: [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys) — API contracts, database schema
- **Agent instructions**: [Auth Portal Agent Instructions](/docs/auth-portal-agent-instructions) — copy/paste tasks for AI agents
- **Auth quick reference**: [Auth Quick Reference](/docs/auth-quick-reference) — code snippets
- **Environment setup**: [Environment Configuration](/docs/environment-configuration) — production deployment
