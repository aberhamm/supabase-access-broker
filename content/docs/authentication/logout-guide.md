---
title: "Logout Guide"
description: "Complete guide for implementing logout in internal apps and external SSO clients"
category: "authentication"
audience: "app-developer"
order: 6
---

# Logout Guide

**Context:** This guide covers how to implement logout functionality for both the auth portal itself and external applications using SSO. You'll learn about local logout, single logout (SLO), and best practices for session termination.

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript

**Prerequisites:**
- Understanding of [Session Management](./session-management.md)
- For external apps: familiarity with [SSO Integration Guide](../guides/sso-integration-guide.md)

## Table of Contents

- [Logout Types Overview](#logout-types-overview)
- [Internal App Logout](#internal-app-logout)
- [External App Logout (SSO Clients)](#external-app-logout-sso-clients)
- [Single Logout (SLO)](#single-logout-slo)
- [Security Considerations](#security-considerations)
- [Audit Logging](#audit-logging)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Logout Types Overview

There are three main logout scenarios to understand:

| Type | Description | Use Case |
|------|-------------|----------|
| **Internal Logout** | User logs out from the auth portal directly | Portal users, admin dashboard |
| **Local Logout** | External app clears its own session only | Simple apps, user stays logged into portal |
| **Single Logout (SLO)** | External app triggers portal logout, ending central session | Full logout across all apps |

### Decision Flow

```
User clicks "Sign Out" in your app
           │
           ├─→ Is this the auth portal itself?
           │         │
           │         YES → Internal logout (/auth/logout)
           │
           └─→ Is this an external SSO app?
                     │
                     ├─→ Want to end portal session too?
                     │         │
                     │         YES → Single Logout (SLO)
                     │         │     Redirect to portal's /auth/logout
                     │         │
                     │         NO  → Local logout only
                     │               Clear your app's session
```

## Internal App Logout

For users logging out directly from the auth portal or admin dashboard.

### Using the Logout Route

The auth portal provides a centralized logout endpoint at `/auth/logout`:

```typescript
// Simple logout link
<Link href="/auth/logout" prefetch={false}>
  Sign Out
</Link>
```

### With Custom Redirect

Redirect to a specific page after logout:

```typescript
// Redirect to a custom page after logout
<Link href="/auth/logout?next=/goodbye" prefetch={false}>
  Sign Out
</Link>
```

### Programmatic Logout

```typescript
'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    // Navigate to logout route
    router.push('/auth/logout');
  };

  return (
    <button onClick={handleLogout}>
      Sign Out
    </button>
  );
}
```

### What the Logout Route Does

The `/auth/logout` route performs these actions:

1. **Signs out from Supabase Auth** - Invalidates the session server-side
2. **Clears auth cookies** - Removes `sb-*-auth-token` cookies
3. **Sets cache headers** - Prevents caching of the logout response
4. **Redirects** - Sends user to `/login` or custom `next` URL

## External App Logout (SSO Clients)

External applications that use the auth portal for SSO have two options for logout.

### Option 1: Local Logout Only

The simplest approach - your app clears its own session without affecting the portal session.

```typescript
// app/auth/logout/route.ts (in YOUR app)
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);

  // Clear YOUR app's session cookies
  cookieStore.delete('your-app-session');
  cookieStore.delete('your-app-user');

  // Redirect to your login page
  return NextResponse.redirect(new URL('/login', url.origin));
}
```

**Behavior:**
- User is logged out of YOUR app only
- User remains logged into the auth portal
- User remains logged into other SSO apps
- Next login will be instant (no re-authentication needed)

**Best for:**
- Apps where quick re-login is desirable
- Switching between accounts in the same app
- Development/testing scenarios

### Option 2: Single Logout (SLO)

Redirect to the portal's logout endpoint to end the central session.

```typescript
// app/auth/logout/route.ts (in YOUR app)
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PORTAL_URL = process.env.AUTH_PORTAL_URL || 'https://auth.yourdomain.com';
const YOUR_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com';

export async function GET(request: Request) {
  const cookieStore = await cookies();

  // 1. Clear YOUR app's session first
  cookieStore.delete('your-app-session');

  // 2. Redirect to portal logout with callback to your app
  const logoutUrl = new URL('/auth/logout', PORTAL_URL);
  logoutUrl.searchParams.set('next', `${YOUR_APP_URL}/logged-out`);

  return NextResponse.redirect(logoutUrl.toString());
}
```

**Important:** Your callback URL (`https://yourapp.com/logged-out`) must be registered in your app's `allowed_callback_urls` in the portal database.

**Behavior:**
- User is logged out of YOUR app
- User is logged out of the auth portal
- User must re-authenticate to access any SSO app
- Full session termination

**Best for:**
- Security-sensitive applications
- Compliance requirements
- Shared/public computers
- End-of-session workflows

## Single Logout (SLO)

### How SLO Works

```
┌─────────────┐         ┌──────────────┐
│   Your App  │         │ Auth Portal  │
└─────────────┘         └──────────────┘
      │                        │
      │  1. User clicks        │
      │     "Sign Out"         │
      │                        │
      │  2. Clear local        │
      │     session            │
      │                        │
      │  3. Redirect to        │
      │     /auth/logout?next= │
      ├───────────────────────>│
      │                        │
      │                        │  4. Validate redirect URL
      │                        │     (must be in allowed_callback_urls)
      │                        │
      │                        │  5. Sign out from Supabase
      │                        │
      │                        │  6. Clear portal cookies
      │                        │
      │  7. Redirect back      │
      │<───────────────────────┤
      │                        │
      │  8. Show "logged out"  │
      │     page to user       │
      │                        │
```

### Complete SLO Implementation

**Step 1: Create a logout page in your app**

```typescript
// app/logged-out/page.tsx
export default function LoggedOutPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">You've been signed out</h1>
      <p className="text-gray-600 mb-8">
        You have been logged out of all applications.
      </p>
      <a
        href="/login"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Sign in again
      </a>
    </div>
  );
}
```

**Step 2: Create the logout route**

```typescript
// app/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PORTAL_URL = process.env.AUTH_PORTAL_URL!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);

  // Check for "local" query param to skip SLO
  const localOnly = url.searchParams.get('local') === 'true';

  // Always clear local session
  cookieStore.delete('session');
  cookieStore.delete('user');

  if (localOnly) {
    // Local logout only - redirect to app's login
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  // SLO - redirect to portal logout
  const logoutUrl = new URL('/auth/logout', PORTAL_URL);
  logoutUrl.searchParams.set('next', `${APP_URL}/logged-out`);

  return NextResponse.redirect(logoutUrl.toString());
}

// Support POST for form submissions
export async function POST(request: Request) {
  return GET(request);
}
```

**Step 3: Register your callback URL**

Contact your portal admin or update the database:

```sql
UPDATE access_broker_app.apps
SET allowed_callback_urls = array_append(
  allowed_callback_urls,
  'https://yourapp.com/logged-out'
)
WHERE id = 'your-app-id';
```

### Using the SDK for SLO

If you're using the auth portal SDK:

```javascript
// Sign out with SLO
AuthPortal.logout({
  appId: 'your-app-id',
  redirectUri: 'https://yourapp.com/logged-out'
});

// Sign out locally only (if supported by SDK)
AuthPortal.localLogout();
```

## Security Considerations

### Redirect URL Validation

The portal validates all external redirect URLs to prevent open redirect attacks:

1. **Protocol check** - Only HTTPS allowed (except localhost for development)
2. **Allowlist check** - URL must be in an enabled app's `allowed_callback_urls`
3. **Exact match** - URL must match exactly (no partial matches)

```typescript
// These will work (if registered):
/auth/logout?next=https://myapp.com/logged-out     ✅
/auth/logout?next=https://myapp.com/auth/complete  ✅
/auth/logout?next=http://localhost:3000/logged-out ✅ (dev only)

// These will be rejected:
/auth/logout?next=https://evil.com/steal-tokens    ❌ (not registered)
/auth/logout?next=http://myapp.com/logged-out      ❌ (not HTTPS)
/auth/logout?next=javascript:alert(1)              ❌ (invalid protocol)
```

### Cookie Security

The portal ensures proper cookie cleanup:

```typescript
// Cookies cleared on logout:
sb-{project-ref}-auth-token      // Main auth cookie
sb-{project-ref}-auth-token.0    // Chunked cookie part 1
sb-{project-ref}-auth-token.1    // Chunked cookie part 2

// Cookie deletion settings:
{
  path: '/',
  expires: new Date(0),
  maxAge: 0
}
```

### Cache Headers

Logout responses include headers to prevent caching:

```
Cache-Control: no-store, max-age=0
Pragma: no-cache
```

## Audit Logging

All logout events are recorded for security monitoring.

### Internal Logout Events

```typescript
{
  event_type: 'logout_success',
  user_id: 'user-uuid',
  metadata: {
    redirect_to: '/login',
    source: 'internal'
  }
}
```

### SLO Events (External Redirect)

```typescript
{
  event_type: 'logout_external_redirect',
  user_id: 'user-uuid',
  app_id: 'external-app-id',
  metadata: {
    redirect_to: 'https://externalapp.com/logged-out',
    app_name: 'External App Name'
  }
}
```

### Viewing Audit Logs

Admins can query logout events:

```sql
SELECT * FROM access_broker_app.sso_audit_logs
WHERE event_type IN ('logout_success', 'logout_external_redirect')
ORDER BY created_at DESC
LIMIT 100;
```

## Best Practices

### 1. Always Clear Local Session First

Before redirecting to SLO, clear your app's session:

```typescript
// Good: Clear local first, then SLO
cookieStore.delete('session');
return NextResponse.redirect(portalLogoutUrl);

// Bad: Only redirect to SLO (local session may persist on redirect failure)
return NextResponse.redirect(portalLogoutUrl);
```

### 2. Handle SLO Failures Gracefully

If the portal logout fails, ensure the user is still logged out locally:

```typescript
// In your logout route
try {
  // Attempt SLO redirect
  return NextResponse.redirect(portalLogoutUrl);
} catch (error) {
  console.error('SLO redirect failed:', error);
  // Fall back to local logout
  return NextResponse.redirect(new URL('/login', url.origin));
}
```

### 3. Provide Clear User Feedback

```typescript
// logged-out/page.tsx
export default function LoggedOutPage() {
  return (
    <div>
      <h1>Signed out successfully</h1>
      <p>You've been logged out of all connected applications.</p>
      <p>For security, please close this browser if using a shared computer.</p>
    </div>
  );
}
```

### 4. Use POST for Logout Actions

While GET is supported, POST is more semantically correct:

```typescript
// Form-based logout (prevents accidental logout via link prefetch)
<form action="/auth/logout" method="POST">
  <button type="submit">Sign Out</button>
</form>
```

### 5. Disable Prefetch on Logout Links

```tsx
// Next.js: Prevent accidental logout from link prefetching
<Link href="/auth/logout" prefetch={false}>
  Sign Out
</Link>
```

## Troubleshooting

### Issue: Redirect URL Not Allowed

**Symptom:** Portal shows error or redirects to `/login` instead of your app.

**Cause:** Your callback URL is not registered in the app's `allowed_callback_urls`.

**Fix:**
```sql
-- Add your logout callback URL
UPDATE access_broker_app.apps
SET allowed_callback_urls = array_append(
  allowed_callback_urls,
  'https://yourapp.com/logged-out'
)
WHERE id = 'your-app-id';
```

**Check:**
```sql
SELECT id, name, allowed_callback_urls
FROM access_broker_app.apps
WHERE id = 'your-app-id';
```

### Issue: User Still Logged In After Logout

**Symptom:** User clicks logout but can still access protected pages.

**Causes & Fixes:**

1. **Cached pages** - Add cache headers to protected pages
2. **Service worker** - Clear service worker cache on logout
3. **Local storage** - Clear localStorage/sessionStorage

```typescript
// Comprehensive client-side cleanup
function fullLogout() {
  // Clear storage
  localStorage.clear();
  sessionStorage.clear();

  // Clear service worker cache
  if ('serviceWorker' in navigator) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }

  // Navigate to logout
  window.location.href = '/auth/logout';
}
```

### Issue: Logout Loop

**Symptom:** User keeps getting redirected between app and portal.

**Cause:** Your logged-out page might be protected and redirecting back to login.

**Fix:** Ensure your logout callback page is public:

```typescript
// middleware.ts
const PUBLIC_PATHS = [
  '/login',
  '/logged-out',  // Add this!
  '/auth/callback',
];

export function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // ... auth check
}
```

### Issue: HTTP URL Rejected

**Symptom:** Development logout redirects fail with "URL not allowed".

**Cause:** HTTP URLs are rejected except for localhost.

**Fix:** Use localhost (not IP address) for development:
```
✅ http://localhost:3000/logged-out
❌ http://127.0.0.1:3000/logged-out
❌ http://192.168.1.100:3000/logged-out
```

## What's Next

- [Session Management](./session-management.md) - Understanding session lifecycle
- [SSO Integration Guide](../guides/sso-integration-guide.md) - Complete SSO setup
- [Security Best Practices](../guides/environment-configuration.md) - Production security
