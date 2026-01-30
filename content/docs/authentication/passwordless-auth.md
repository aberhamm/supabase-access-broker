---
title: "Passwordless Authentication (Magic Links)"
description: "Implement secure passwordless authentication using email magic links"
category: "authentication"
audience: "app-developer"
order: 3
---

# Passwordless Authentication (Magic Links)

> Note: This repository’s **dashboard login** supports multiple sign-in methods (magic link, email OTP code, OAuth, password, passkeys) behind feature flags.
> For cross-domain SSO + passkeys, see **[Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys)**.

**Context:** This guide shows you how to implement passwordless authentication using Supabase Auth's magic link (OTP) feature. Users receive an email with a one-time link to sign in without a password.

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript, React Server Components

**Prerequisites:**
- Supabase project created
- Basic understanding of Next.js App Router
- Email provider configured in Supabase (default works for development)

**What You'll Build:**
- Magic link login flow
- Auth callback handler
- Protected routes with middleware
- Access control patterns

## Table of Contents

- [Overview](#overview)
- [How Magic Links Work](#how-magic-links-work)
- [Environment Setup](#environment-setup)
- [Implementation](#implementation)
- [Access Control](#access-control)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

### What is Passwordless Authentication?

Passwordless authentication eliminates the need for users to remember passwords. Instead:

1. User enters their email address
2. System sends a one-time magic link via email
3. User clicks the link
4. User is authenticated and redirected to your app

### Benefits

- **Better UX**: No password to remember or type
- **More Secure**: No password to be stolen, phished, or reused
- **Lower Support**: No "forgot password" requests
- **Higher Conversion**: Simpler sign-in flow

### When to Use

✅ **Good for:**
- Consumer applications
- Internal tools
- Applications where email is primary identifier
- Mobile-first applications

❌ **Consider alternatives for:**
- Applications requiring offline access
- High-security environments requiring MFA
- Applications where users don't have reliable email access

## How Magic Links Work

### Flow Diagram

```
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  User   │─────▶│   App    │─────▶│ Supabase │─────▶│  Email   │
│ enters  │      │ requests │      │  sends   │      │ provider │
│  email  │      │   OTP    │      │   link   │      │          │
└─────────┘      └──────────┘      └──────────┘      └──────────┘
                        │                                   │
                        │                                   ▼
                        │                          ┌──────────────┐
                        │                          │ User clicks  │
                        │◀─────────────────────────│     link     │
                        │                          └──────────────┘
                        │
                        ▼
                ┌──────────────┐
                │ Auth callback│
                │  exchanges   │
                │ code for     │
                │   session    │
                └──────────────┘
                        │
                        ▼
                ┌──────────────┐
                │     User     │
                │ authenticated│
                └──────────────┘
```

## Environment Setup

**⚠️ CRITICAL:** Before implementing magic links, you MUST configure your environment variables and Supabase redirect URLs. Skipping this will cause magic links to redirect to `localhost` in production.

### 1. Set Environment Variables

Create a `.env.local` file (development) or set in your production environment:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# CRITICAL for production - ensures magic links redirect correctly
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**For more details:** See [Environment Configuration Guide](/docs/environment-configuration)

### 2. Configure Supabase Redirect URLs

Go to **Supabase Dashboard → Authentication → URL Configuration** and add:

**Development:**
```
http://localhost:3050/auth/callback
http://localhost:3050/**
```

**Production:**
```
https://your-domain.com/auth/callback
https://your-domain.com/**
```

**Why this matters:** Supabase only allows redirects to whitelisted URLs for security. Missing this configuration will cause "Invalid redirect URL" errors.

### 3. Create URL Helper (Recommended)

Create `lib/app-url.ts` to properly handle redirects:

```typescript
/**
 * Get the application URL for auth redirects
 * Uses NEXT_PUBLIC_APP_URL in production, window.location.origin in development
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3050';
}
```

Now you're ready to implement magic links!

## Security Model

- Magic links expire after **1 hour** (Supabase default, configurable)
- Each link can only be used **once**
- Links are tied to the requesting browser session (PKCE flow)
- Rate limiting: **1 link per 60 seconds** per email (configurable)

## Implementation

### 1. Supabase Client Setup

**File:** `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**File:** `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component
          }
        },
      },
    }
  );
}
```

### 2. Login Page

**File:** `app/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAppUrl } from '@/lib/app-url'; // ⭐ Use helper for proper redirects

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // ⭐ Use getAppUrl() instead of window.location.origin for production compatibility
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
        // Set to false for existing-users-only apps (like admin dashboards)
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-gray-600">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Click the link in the email to sign in. The link expires in 1 hour.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold">Sign In</h2>
          <p className="text-gray-600 mt-2">
            Enter your email to receive a magic link
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              required
              autoComplete="email"
              autoFocus
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending link...' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 3. Auth Callback Handler

**File:** `app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Get the base URL for redirects
function getBaseUrl(request: Request): string {
  // Production: use environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Check for forwarded host (nginx/proxy)
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  // Check host header
  const host = request.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }

  // Fallback
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const baseUrl = getBaseUrl(request); // ⭐ Use proper URL detection

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully authenticated
      return NextResponse.redirect(new URL(next, baseUrl));
    }
  }

  // Auth failed, redirect to login
  return NextResponse.redirect(new URL('/login', baseUrl));
}
```

**⚠️ Important:** The `getBaseUrl()` function ensures redirects work correctly in production, especially with Docker, nginx, or other reverse proxies. See [Environment Configuration Guide](/docs/environment-configuration) for details.

### 4. Middleware for Route Protection

**File:** `middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Public routes
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback');

  // Redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if already logged in
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## Access Control

### Preventing Self-Registration

For applications where only existing users should be able to sign in:

```typescript
import { getAppUrl } from '@/lib/app-url';

const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${getAppUrl()}/auth/callback`, // ⭐ Use helper
    shouldCreateUser: false, // ✅ Only existing users
  },
});
```

**Error handling:**

```typescript
if (error) {
  if (error.message.includes('User not found')) {
    setError('This email is not registered. Contact support for access.');
  } else {
    setError(error.message);
  }
}
```

### Role-Based Access Control

Check user permissions after authentication:

```typescript
// app/auth/callback/route.ts
const { data: { user } } = await supabase.auth.getUser();

// Check if user has required role
const userRole = user?.app_metadata?.role;
const allowedRoles = ['admin', 'member'];

if (!userRole || !allowedRoles.includes(userRole)) {
  return NextResponse.redirect(new URL('/access-denied', requestUrl.origin));
}
```

See [Authorization Patterns](/docs/authorization-patterns) for comprehensive access control strategies.

## Configuration

### Supabase Dashboard Setup

**1. URL Configuration**

Navigate to **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3050` (dev) or `https://yourdomain.com` (prod)
- **Redirect URLs**: Add your callback URLs
  - `http://localhost:3050/auth/callback`
  - `https://yourdomain.com/auth/callback`

**2. Email Templates (Optional)**

Navigate to **Authentication → Email Templates → Magic Link**:

```html
<h2>Magic Link</h2>
<p>Click the link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In</a></p>
<p>This link expires in 1 hour.</p>
```

**3. Email Provider (Production)**

For production, configure an email provider:

- Navigate to **Authentication → Email Provider**
- Choose provider (SendGrid, AWS SES, etc.)
- Add credentials

Default Supabase provider works fine for development!

**4. Rate Limiting (Optional)**

Navigate to **Authentication → Rate Limits**:

- **Email/OTP**: Default 1 per 60 seconds (recommended)
- Adjust based on your needs

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Testing

### Manual Testing Flow

```bash
1. Start your development server
2. Navigate to /login
3. Enter a valid email address
4. Check email inbox (and spam folder)
5. Click the magic link in the email
6. Verify redirect to /dashboard
7. Verify session persists on page refresh
```

### Test Scenarios

**Scenario 1: First-time user (shouldCreateUser: true)**

```
✓ Enter email not in database
✓ Receive magic link email
✓ Click link → account created + authenticated
✓ Redirected to dashboard
```

**Scenario 2: Existing user**

```
✓ Enter email in database
✓ Receive magic link email
✓ Click link → authenticated
✓ Redirected to dashboard
```

**Scenario 3: Existing-only mode (shouldCreateUser: false)**

```
✓ Enter email not in database
✗ Show error: "User not found"
✓ Enter email in database
✓ Receive magic link and sign in successfully
```

**Scenario 4: Expired link**

```
✓ Wait >1 hour after receiving email
✗ Click link → error message
✓ Request new magic link
✓ Click new link → authenticated
```

## Troubleshooting

### Magic Link Not Received

**Problem**: User doesn't receive the email

**Solutions**:
1. Check spam/junk folder
2. Verify email address is correct
3. Check Supabase logs in Dashboard → Logs → Auth
4. Verify email provider is configured (production)
5. Check rate limiting hasn't blocked the email

### Link Doesn't Work

**Problem**: Clicking link shows error

**Solutions**:
1. Verify callback URL is in allowed redirect URLs
2. Check link hasn't expired (1 hour limit)
3. Ensure link hasn't been used already (one-time use)
4. Verify `exchangeCodeForSession()` is called in callback
5. Check browser console for errors

### Session Not Persisting

**Problem**: User signed out on page refresh

**Solutions**:
1. Verify middleware is properly configured
2. Check cookies are being set (browser DevTools → Application → Cookies)
3. Ensure server client uses correct cookie handling
4. Verify domain settings for cookies (localhost vs production)

### "Invalid Code Verifier" Error

**Problem**: PKCE verification fails

**Solutions**:
1. Don't override `flowType` in Supabase client config
2. Use default Supabase SSR configuration
3. Ensure user completes flow in same browser session
4. Clear browser cache and cookies, try again

## Best Practices

### 1. User Feedback

Provide clear messaging during the flow:

```typescript
// Show loading state
{loading && <p>Sending magic link...</p>}

// Show success message
{success && <p>Check your email for the link</p>}

// Show specific errors
{error && <p className="text-red-600">{error}</p>}
```

### 2. Link Expiry Communication

Tell users when the link expires:

```typescript
<p className="text-sm text-gray-500">
  The link expires in 1 hour. If it expires, request a new one.
</p>
```

### 3. Rate Limiting

Prevent abuse with UI feedback:

```typescript
const [cooldown, setCooldown] = useState(0);

const handleResend = async () => {
  if (cooldown > 0) return;

  await sendMagicLink();
  setCooldown(60); // 60 second cooldown

  const interval = setInterval(() => {
    setCooldown((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
};

// In UI
<button disabled={cooldown > 0}>
  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
</button>
```

### 4. Mobile Optimization

Magic links work great on mobile:

```typescript
// Ensure proper viewport
<meta name="viewport" content="width=device-width, initial-scale=1" />

// Use autofocus on email input
<input autoFocus type="email" />

// Large, touch-friendly buttons
<button className="w-full py-3 text-lg">Send magic link</button>
```

### 5. Analytics

Track the authentication funnel:

```typescript
// Track magic link requested
analytics.track('magic_link_requested', { email });

// Track magic link clicked (in callback)
analytics.track('magic_link_verified', { userId: user.id });

// Track authentication completed
analytics.track('user_authenticated', { userId: user.id, method: 'magic_link' });
```

## Next Steps

- [Password Authentication](/docs/password-auth) - Add password option
- [Authorization Patterns](/docs/authorization-patterns) - Control access
- [Authentication Guide](/docs/authentication-guide) - Full auth patterns
- [API Keys Guide](/docs/api-keys-guide) - API authentication

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Email Link (Magic Link) Guide](https://supabase.com/docs/guides/auth/auth-magic-link)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

## What's Next

- **Auth setup:** [/docs/authentication-guide](/docs/authentication-guide)
- **Session management:** [/docs/session-management](/docs/session-management)
- **Logout:** [/docs/logout-guide](/docs/logout-guide)
- **Authorization:** [/docs/authorization-patterns](/docs/authorization-patterns)
