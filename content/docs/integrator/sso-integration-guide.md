---
title: 'SSO Integration Guide'
description: 'Simple guide to integrating your applications with the central auth portal for single sign-on'
category: 'integrator'
audience: 'app-developer'
order: 5
---

# SSO Integration Guide

This guide explains how to integrate **your application** with the Access Broker's **auth portal** for SSO.

**Scope:** This is for client apps consuming the SSO exchange. If you're operating the Access Broker portal itself, see [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys).

> **💡 Want to see it in action?** Check out the [Demo Guide](/DEMO_GUIDE.md) to test the SSO flow locally with the included demo page.

## No Supabase dependency required

The Access Broker uses Supabase internally, but **your app does not need Supabase as a dependency**. The entire integration is plain HTTP:

- **SSO login**: Standard redirect → auth code → exchange flow (like OAuth2)
- **User management API**: REST endpoints with JSON payloads
- **Authentication**: API key header or app secret in request body

Any language or framework that can make HTTP requests and handle redirects can integrate — Rails, Django, Express, Go, PHP, Spring, or anything else. There is no Supabase SDK, client library, or database connection involved on the consumer side.

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
- Centralized user management and role/permission assignment
- Plain REST API — no vendor SDK or database dependency

## How it Works (Simple Flow)

```
┌─────────────┐         ┌──────────────┐
│   Your App  │         │ Auth Portal  │
└─────────────┘         └──────────────┘
      │                        │
      │  1. Redirect to        │
      │     auth portal        │
      ├───────────────────────>│
      │                        │
      │                        │  2. User signs in
      │                        │     (passkey/social/
      │                        │      email/password)
      │                        │
      │  3. Redirect back      │
      │     with auth code     │
      │<───────────────────────┤
      │                        │
      │  4. Exchange code      │
      │     for user info      │
      ├───────────────────────>│
      │                        │
      │  5. User data +        │
      │     app claims         │
      │<───────────────────────┤
      │                        │
      │  6. Create session     │
      │     in your app        │
      │                        │
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
      redirect_uri: REDIRECT_URI,
      app_secret: process.env.SSO_APP_SECRET,
    }),
  });

  if (!response.ok) {
    // The exchange endpoint returns { error, error_code } on failure.
    // Pass the error_code through so the user sees a meaningful message.
    const errorBody = await response.json().catch(() => ({}));
    const errorCode = errorBody.error_code || 'auth_failed';
    const errorMsg = errorBody.error || 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorCode)}&error_description=${encodeURIComponent(errorMsg)}`, url.origin)
    );
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
2. **Allowlist your redirect URLs**: any URL the portal should be able to redirect to — SSO callbacks, logout destinations, and account management return links

The admin will run:

```sql
UPDATE public.apps
SET allowed_callback_urls = ARRAY[
  'https://yourapp.com/auth/callback',
  'https://yourapp.com/auth/logout',
  'https://yourapp.com/profile'
]
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
    "permissions": ["read", "write"],
    "metadata": {
      "tier": "pro",
      "plan_features": ["alerts", "watchlist"]
    }
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
- **`app_claims.metadata`**: Free-form JSON object your app owns. Use it for anything outside the broker's built-in claim vocabulary (subscription tier, plan feature flags, billing references, etc.). See [Storing app-specific data](#storing-app-specific-data-in-metadata).
- **`expires_in`**: Code validity window (usually 5 minutes)

### Storing app-specific data in `metadata`

Only `enabled`, `role`, `permissions`, and `metadata` are allowed as top-level keys under `app_claims`. Anything else you want to attach to a user — subscription tier, quota counters, plan feature flags, external billing IDs — goes inside `metadata`:

```json
{
  "enabled": true,
  "role": "user",
  "metadata": {
    "tier": "pro",
    "stripe_customer_id": "cus_abc123",
    "plan_features": ["alerts", "watchlist"]
  }
}
```

Read it with `app_claims.metadata.tier`, `app_claims.metadata.plan_features`, etc. Writes go through `PATCH /api/apps/{appId}/users/{userId}/claims` with a `metadata` object — see [Update User Claims](#update-user-claims) for the merge semantics.

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

> **See also:** [Logout Guide](/docs/concepts/logout-guide) for complete logout documentation including troubleshooting and best practices.

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

### 3. Use an App Secret (Required)

Each app has one or more named secrets (e.g. "production", "staging"). Generate a secret from the dashboard under the app's SSO settings tab. The plaintext is shown once — store it as `SSO_APP_SECRET` in your backend environment.

```ts
body: JSON.stringify({
  code,
  app_id: APP_ID,
  app_secret: process.env.SSO_APP_SECRET, // stored securely, never in browser
});
```

The portal checks the secret against all active secrets for the app, so you can add a new secret for a new environment without invalidating existing ones.

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

### Issue: "Redirect URL not allowed"

**Symptom:** Portal rejects the redirect with an error (you'll see this on the portal's error page, not your app).

**Cause:** Your `redirect_uri` is not in the app's `allowed_callback_urls` allowlist.

**Fix:** Contact your dashboard admin to add it:

```sql
UPDATE public.apps
SET allowed_callback_urls = array_append(allowed_callback_urls, 'https://yourapp.com/auth/callback')
WHERE id = 'your-app-id';
```

**Note:** The URL must match exactly — check for trailing slashes, protocol (http vs https), and port numbers. This allowlist is used for all portal-to-app redirects: SSO callbacks, logout redirects, and account management return links.

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
// data.user.id is the user's unique ID
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

## Full API Reference

Beyond SSO login and user lookup, the Access Broker exposes a complete REST API for user lifecycle management. All endpoints below are authenticated — no Supabase SDK required.

### Authentication

Every API request must include one of:

1. **API key** (recommended for production):
   ```
   Authorization: Bearer sk_...
   ```

2. **App secret** (in the JSON request body):
   ```json
   { "app_secret": "your-secret", ... }
   ```

Both are scoped to a specific app. The API key is passed as a header and works with all HTTP methods. The app secret is passed in the request body and works with POST/PATCH/DELETE.

### Endpoints

#### SSO Code Exchange

**`POST /api/auth/exchange`** — Exchange an SSO auth code for user info.

```json
// Request
{
  "code": "auth-code-from-redirect",
  "app_id": "your-app-id",
  "redirect_uri": "https://your-app.com/callback",
  "app_secret": "your-secret"
}

// Response (200)
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "app_id": "your-app-id",
  "app_claims": { "enabled": true, "role": "user", "permissions": ["read", "write"] },
  "expires_in": 300
}
```

#### User Lookup

**`POST /api/users/lookup`** — Look up a user by email, user ID, or Telegram ID. Provide exactly one identifier.

```json
// Request
{
  "app_id": "your-app-id",
  "app_secret": "your-secret",
  "email": "user@example.com"
}

// Response (200)
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "app_claims": { "enabled": true, "role": "user", "permissions": ["read", "write"] }
}
```

#### List App Users

**`GET /api/apps/{appId}/users`** — List all users who have claims for your app. Paginated.

Query parameters:
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `search` — filter by email
- `since` — ISO 8601 timestamp, return only users updated after this time

```json
// Response (200)
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "app_claims": { "enabled": true, "role": "admin", "permissions": ["read", "write"] }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

#### Get User Claims

**`GET /api/apps/{appId}/users/{userId}/claims`** — Get a specific user's claims for your app.

```json
// Response (200)
{
  "user_id": "uuid",
  "email": "user@example.com",
  "app_claims": { "enabled": true, "role": "user", "permissions": ["read"] }
}
```

#### Update User Claims

**`PATCH /api/apps/{appId}/users/{userId}/claims`** — Update a user's claims. Only the fields you include are changed.

Allowed fields: `enabled`, `role`, `permissions`, `metadata`.

**Merge semantics:**

- Top-level fields (`enabled`, `role`, `permissions`) are replaced wholesale. `permissions` is an array — if you want to add one permission, include the full array you want to end up with.
- `metadata` is **deep-merged** with the existing metadata object. Sibling keys you don't include are preserved. Keys you do include are overwritten. To remove a metadata key, set it to `null` (it will be stored as JSON null — there is no "unset" operation through this endpoint).

```json
// Request — promote to admin and note the upgrade in metadata.
// Assumes existing metadata was { "tier": "free", "stripe_customer_id": "cus_abc123" }.
{
  "app_secret": "your-secret",
  "role": "admin",
  "permissions": ["read", "write", "delete"],
  "metadata": {
    "tier": "pro"
  }
}

// Response (200) — stripe_customer_id was NOT in the request but is preserved
// because metadata is deep-merged.
{
  "user_id": "uuid",
  "app_claims": {
    "enabled": true,
    "role": "admin",
    "permissions": ["read", "write", "delete"],
    "metadata": {
      "tier": "pro",
      "stripe_customer_id": "cus_abc123"
    }
  },
  "updated_at": "2026-04-11T12:00:00Z"
}
```

#### Revoke User Access

**`DELETE /api/apps/{appId}/users/{userId}/claims`** — Revoke a user's access to your app. Sets `enabled: false` and clears role/permissions.

```json
// Response (200)
{
  "user_id": "uuid",
  "app_id": "your-app-id",
  "revoked": true,
  "revoked_at": "2026-03-21T12:00:00Z"
}
```

#### Invite User

**`POST /api/apps/{appId}/invite`** — Invite a user by email. Creates the account if it doesn't exist, and sets app claims in one call.

```json
// Request
{
  "app_secret": "your-secret",
  "email": "newuser@example.com",
  "role": "user",
  "permissions": ["read"],
  "send_email": true
}

// Response (200)
{
  "user_id": "uuid",
  "email": "newuser@example.com",
  "created": true,
  "app_claims": { "enabled": true, "role": "user", "permissions": ["read"] }
}
```

`send_email` defaults to `true`. Set to `false` to create the user silently without sending an invitation email.

#### Auth Methods

**`GET /api/apps/{appId}/auth-methods`** — Check which authentication methods are enabled for an app. No authentication required.

```json
// Response (200)
{
  "auth_methods": {
    "password": true,
    "magic_link": true,
    "email_otp": true,
    "passkeys": true,
    "google": true,
    "github": true
  },
  "status": "ok"
}
```

### Rate Limiting

All authenticated endpoints are rate-limited per app. Read endpoints (GET) and write endpoints (POST/PATCH/DELETE) have separate rate limits. If you exceed the limit, you'll receive a `429 Too Many Requests` response.

### Error Format

All endpoints return errors in a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:
- `400` — Bad request (missing/invalid parameters)
- `401` — Authentication failed (invalid API key or app secret)
- `403` — Forbidden (app disabled, key doesn't belong to this app)
- `404` — User not found
- `429` — Rate limited
- `500` — Internal server error

## What's Next

- **Technical spec**: [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys) — API contracts, database schema
- **Agent instructions**: [Auth Portal Agent Instructions](/docs/auth-portal-agent-instructions) — copy/paste tasks for AI agents
- **Auth quick reference**: [Auth Quick Reference](/docs/auth-quick-reference) — code snippets
- **Environment setup**: [Environment Configuration](/docs/environment-configuration) — production deployment
