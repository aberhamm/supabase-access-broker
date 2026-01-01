---
title: "Password Authentication"
description: "Implement secure password authentication with reset and recovery flows"
category: "authentication"
audience: "app-developer"
order: 6
---

# Password Authentication

**Context:** This guide shows you how to implement password-based authentication using Supabase Auth, including sign-up, sign-in, password reset, and user management flows.

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript, React Server Components

**Prerequisites:**
- Supabase project created
- Basic understanding of Next.js App Router
- Email provider configured in Supabase (for password reset emails)

**What You'll Build:**
- Password sign-up and sign-in
- Password reset flow ("Forgot password")
- Password update functionality
- Admin user creation with passwords
- Protected routes with authorization

## Table of Contents

- [Overview](#overview)
- [Environment Setup](#environment-setup)
- [Implementation](#implementation)
- [Password Reset Flow](#password-reset-flow)
- [Admin User Management](#admin-user-management)
- [Security](#security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

### When to Use Password Authentication

✅ **Good for:**
- Enterprise applications
- Applications requiring offline access
- Apps where users expect traditional login
- Compliance requirements
- Multi-device sync scenarios

❌ **Consider passwordless for:**
- Consumer applications prioritizing simplicity
- Mobile-first experiences
- Applications where email is primary identifier

## Environment Setup

**Before implementing password authentication**, ensure your environment is configured correctly:

### Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CRITICAL for production - ensures password reset emails redirect correctly
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Configure Supabase Redirect URLs

For password reset emails to work, add to **Supabase Dashboard → Authentication → URL Configuration**:

```
https://your-domain.com/reset-password
https://your-domain.com/**
```

**For complete setup:** See [Environment Configuration Guide](/docs/environment-configuration)

### Authentication Flows

**Sign Up:**
```
User enters email + password → Account created → Authenticated
```

**Sign In:**
```
User enters email + password → Credentials verified → Authenticated
```

**Password Reset:**
```
User requests reset → Email sent → User clicks link →
Sets new password → Authenticated
```

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
            // Server Component
          }
        },
      },
    }
  );
}

// Admin client (for user management)
export async function createAdminClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
            // Server Component
          }
        },
      },
    }
  );
}
```

### 2. Sign Up Page

**File:** `app/signup/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { getAppUrl } from '@/lib/app-url'; // ⭐ Import URL helper

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`, // ⭐ Use helper
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else if (data.user) {
      // Check if email confirmation is required
      if (data.user.identities && data.user.identities.length === 0) {
        alert('This email is already registered. Please sign in instead.');
      } else {
        alert('Success! Check your email to confirm your account.');
        router.push('/login');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold">Create Account</h2>
          <p className="text-gray-600 mt-2">Sign up for a new account</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
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
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 8 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 3. Sign In Page

**File:** `app/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold">Sign In</h2>
          <p className="text-gray-600 mt-2">Access your account</p>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <a
                href="/reset-password"
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <a href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 4. Auth Callback Handler

**File:** `app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const type = requestUrl.searchParams.get('type');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is a password recovery flow
      if (type === 'recovery') {
        return NextResponse.redirect(
          new URL('/reset-password?mode=update', requestUrl.origin)
        );
      }

      // Regular authentication flow
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

### 5. Middleware

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

  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/reset-password');

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
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

## Password Reset Flow

### Reset Request Page

**File:** `app/reset-password/page.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAppUrl } from '@/lib/app-url'; // ⭐ Import URL helper

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'request' | 'update'>('request');
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if we're in update mode (user clicked reset link)
    const modeParam = searchParams.get('mode');
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (modeParam === 'update' || session?.user) {
        setMode('update');
        setTimeout(() => passwordRef.current?.focus(), 100);
      }
    };
    checkSession();
  }, [searchParams, supabase.auth]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppUrl()}/reset-password?mode=update`, // ⭐ Use helper
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for a password reset link.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert('Password updated successfully!');
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold">
            {mode === 'request' ? 'Reset Password' : 'Set New Password'}
          </h2>
          <p className="text-gray-600 mt-2">
            {mode === 'request'
              ? 'Enter your email to receive a reset link'
              : 'Enter your new password'}
          </p>
        </div>

        {mode === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
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
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <input
                ref={passwordRef}
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}

        <p className="text-center">
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
```

## Admin User Management

### Create User Server Action

**File:** `app/actions/users.ts`

```typescript
'use server';

import { createAdminClient } from '@/lib/supabase/server';

export async function createUserWithPassword(
  email: string,
  password: string,
  metadata?: Record<string, any>
) {
  const supabase = await createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    app_metadata: metadata || {},
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

export async function inviteUser(
  email: string,
  metadata?: Record<string, any>
) {
  const supabase = await createAdminClient();

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?mode=update`,
    data: metadata || {},
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

export async function resetUserPassword(email: string) {
  const supabase = await createAdminClient();

  // Generate password reset for user
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?mode=update`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
```

## Security

### Password Requirements

**Minimum Requirements:**

```typescript
function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain a number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain a special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Configuration in Supabase

Navigate to **Authentication → Policies**:

- **Minimum password length**: 8 characters (recommended)
- **Password requirements**: Consider enforcing complexity
- **Password history**: Prevent reuse of recent passwords

### Rate Limiting

Supabase provides built-in rate limiting for authentication endpoints:

- **Sign-up**: Configurable per email/IP
- **Sign-in**: Configurable attempts before lockout
- **Password reset**: 1 per 60 seconds per email

Configure in **Authentication → Rate Limits**

### Best Practices

**1. Never Log Passwords**

```typescript
// ❌ Bad
console.log('Login attempt:', { email, password });

// ✅ Good
console.log('Login attempt:', { email });
```

**2. Use HTTPS in Production**

```typescript
// Ensure secure cookies in production
const isProduction = process.env.NODE_ENV === 'production';

cookies.set('auth-token', token, {
  secure: isProduction, // HTTPS only in production
  httpOnly: true,
  sameSite: 'lax',
});
```

**3. Implement Account Lockout**

Track failed attempts and temporarily lock accounts after threshold.

**4. Use Strong Password Hashing**

Supabase uses bcrypt by default - no action needed!

## Testing

### Test Sign Up Flow

```bash
1. Navigate to /signup
2. Enter email and password (8+ characters)
3. Submit form
4. Check email for confirmation
5. Click confirmation link
6. Verify redirect to login
7. Sign in with credentials
```

### Test Sign In Flow

```bash
1. Navigate to /login
2. Enter valid email and password
3. Submit form
4. Verify redirect to /dashboard
5. Verify session persists on refresh
```

### Test Password Reset Flow

```bash
1. Navigate to /reset-password
2. Enter email address
3. Check email for reset link
4. Click reset link
5. Enter new password (8+ characters)
6. Confirm new password
7. Submit form
8. Verify redirect to /dashboard
9. Sign out and sign in with new password
```

## Troubleshooting

### "Invalid login credentials" Error

**Problem**: Correct password doesn't work

**Solutions**:
1. Verify email is confirmed (check Supabase Dashboard)
2. Check password is correct (no extra spaces)
3. Ensure user exists in `auth.users` table
4. Check Supabase logs for details

### Password Reset Email Not Received

**Problem**: User doesn't get reset email

**Solutions**:
1. Check spam folder
2. Verify email provider configured (production)
3. Check Supabase logs for email sending errors
4. Verify rate limiting hasn't blocked the request
5. Ensure redirect URL is in allowed list

### Can't Sign In After Password Reset

**Problem**: New password doesn't work

**Solutions**:
1. Ensure password was actually updated (check Supabase logs)
2. Try signing out completely and clearing cookies
3. Request another password reset
4. Check for any middleware blocking the flow

### Session Expires Too Quickly

**Problem**: User signed out unexpectedly

**Solutions**:
1. Check token expiry settings in Supabase Dashboard
2. Verify middleware refreshes tokens properly
3. Ensure cookies aren't being deleted
4. Check for any logout logic in the app

## Next Steps

- [Passwordless Authentication](/docs/passwordless-auth) - Magic link option
- [Authorization Patterns](/docs/authorization-patterns) - Control access
- [Authentication Guide](/docs/authentication-guide) - Full auth patterns

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Password Authentication](https://supabase.com/docs/guides/auth/auth-password)
- [Server-Side Auth](https://supabase.com/docs/guides/auth/server-side)

---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
