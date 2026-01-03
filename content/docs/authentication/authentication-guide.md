---
title: "Authentication Setup Guide"
description: "Set up Supabase Auth with automatic role assignment"
category: "authentication"
audience: "app-developer"
order: 1
---

# Authentication Setup Guide

**Context:** This guide is part of the Supabase Access Broker documentation. It covers how to set up Supabase Auth (NOT NextAuth) and integrate it with the custom claims/roles system to control user access during sign up and sign in.

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript, React Server Components

**Prerequisites:**
- Supabase project created
- Custom claims functions installed (see install.sql)
- Basic understanding of Next.js App Router

**Key Terminology:**
- **Supabase Auth**: Supabase's authentication service (NOT NextAuth.js)
- **Claims**: Custom user attributes stored in JWT tokens (`app_metadata`)
- **App**: An application in your multi-app system (identified by app_id)
- **Role**: User's permission level within an app (e.g., 'admin', 'user', 'viewer')
- **Service Role Key**: Supabase secret key that bypasses RLS - use server-side only
- **RLS**: Row Level Security - PostgreSQL security policies
- **app_metadata**: User field for app-controlled data (cannot be modified by user)
- **user_metadata**: User field for user-controlled profile data

## Table of Contents

- [Overview](#overview)
- [Architecture: Dashboard vs Your Applications](#architecture-dashboard-vs-your-applications)
- [Initial Supabase Auth Setup](#initial-supabase-auth-setup)
- [Environment Configuration](#environment-configuration)
- [Setting Up Your Application](#setting-up-your-application)
- [Complete Sign Up Implementation for Your App](#complete-sign-up-implementation-for-your-app)
- [Complete Sign In Implementation for Your App](#complete-sign-in-implementation-for-your-app)
- [Sign Up Flow with Automatic Role Assignment](#sign-up-flow-with-automatic-role-assignment)
- [Sign In Flow](#sign-in-flow)
- [App-Specific Sign Up](#app-specific-sign-up)
- [Advanced: Database Triggers](#advanced-database-triggers)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

**Important:** This dashboard uses **Supabase Auth** (not NextAuth.js) for authentication.

### How It Works

The authentication system works with the custom claims functionality to:

- Authenticate users via email/password, magic links, or OAuth
- Automatically assign roles and app access during sign up
- Protect routes based on user claims
- Enable multi-app access control

### User Data Structure

**Context:** This is how user claims are stored in Supabase. The `app_metadata` field contains all custom claims.

```typescript
// Example user object structure
{
  id: "uuid-string",              // User ID
  email: "user@example.com",      // User email
  app_metadata: {                 // Custom claims (cannot be modified by user)
    claims_admin: true,           // Global admin flag (optional)
    organization_id: "org-123",   // Global claim example (optional)
    apps: {                       // App-specific claims
      "my-app": {                 // App ID (key)
        enabled: true,            // Required: grants access to this app
        role: "admin",            // App-specific role
        permissions: ["read", "write"],  // Custom permissions array
        // Any other custom fields for this app
      },
      "another-app": {
        enabled: false,           // User doesn't have access to this app
        role: "viewer"
      }
    }
  },
  user_metadata: {                // User profile data (can be modified by user)
    full_name: "John Doe",
    avatar_url: "https://..."
  }
}
```

## Architecture: Dashboard vs Your Applications

**IMPORTANT:** Understanding the separation between the dashboard and your applications is crucial.

### The Dashboard (This Repository)

**Purpose:** Admin interface for managing users, apps, and claims
**Location:** Separate codebase (this repo)
**Users:** Admin dashboard routes are admin-only, but the repo can also act as a central **auth portal** for SSO
**Authentication:** Supports magic link, email OTP (code), password, OAuth, and passkeys (all feature-flagged)

**What it does:**
- Manage user claims and roles
- Create and configure apps
- View all users
- Assign app access to users
 - Optionally: act as an auth portal for other apps (cross-domain SSO)

### Your Applications (Separate Codebases)

**Purpose:** Your actual applications that users interact with
**Location:** Separate codebases/deployments
**Users:** Regular users of your apps
**Authentication:** You implement sign up/sign in

**What they do:**
- Use the SAME Supabase project/auth instance
- Implement their own sign up/sign in flows
- Check claims to control access
- Display different features based on user roles

### Auth Portal (Optional)

If your apps are on different domains and you want a single passkey/login surface, this repo can be your **central auth portal**.

See: **[Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys)**.

### How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Auth Instance                    │
│                  (Shared by all applications)                │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼──────┐  ┌──▼──────┐  ┌──▼──────┐
        │   Dashboard  │  │  App 1  │  │  App 2  │
        │   (Admin)    │  │ (Users) │  │ (Users) │
        └──────────────┘  └─────────┘  └─────────┘

        - Manages users    - Sign up     - Sign up
        - Sets claims      - Sign in     - Sign in
        - Assigns roles    - Check       - Check
                            access        access
```

**Key Points:**
1. **Same Supabase Project** - All apps share one auth instance
2. **Different Apps** - Dashboard and your apps are separate codebases
3. **Unique App IDs** - Each app has a unique identifier (e.g., 'my-app', 'analytics')
4. **Centralized Management** - Dashboard manages access for all apps
5. **Distributed Auth** - Each app implements its own sign up/sign in

### Example Scenario

You have:
- **Dashboard** at `admin.yourdomain.com` (this repo)
- **App 1** at `app1.yourdomain.com` (your app)
- **App 2** at `app2.yourdomain.com` (your app)

All three use the same Supabase project, but:
- Dashboard manages users and claims
- App 1 has its own sign up/sign in pages
- App 2 has its own sign up/sign in pages

When a user signs up for App 1:
1. They create an account via Supabase Auth
2. App 1 assigns them `app_metadata.apps.app1.enabled = true`
3. They can now access App 1
4. They CANNOT access App 2 (unless App 2 also grants access)
5. Dashboard can manage their claims for both apps

**This guide shows you how to implement sign up/sign in in YOUR separate applications.**

## Environment Configuration

**⚠️ CRITICAL:** Before implementing authentication, configure your environment properly to ensure auth redirects work in production.

### Required Environment Variables

```env
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CRITICAL for production - ensures redirects work correctly
# Without this, magic links/password resets redirect to localhost
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Configure Supabase Redirect URLs

Go to **Supabase Dashboard → Authentication → URL Configuration** and add:

**Production:**
```
https://your-domain.com/auth/callback
https://your-domain.com/**
```

**Development:**
```
http://localhost:3050/auth/callback
http://localhost:3050/**
```

### Create URL Helper

Create `lib/app-url.ts` in your application:

```typescript
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

**For complete details:** See [Environment Configuration Guide](/docs/environment-configuration)

## Initial Supabase Auth Setup

### 1. Enable Authentication Providers

In your Supabase Dashboard:

1. Go to **Authentication → Providers**
2. Enable the providers you want to use:
   - **Email** (enabled by default)
   - **Magic Link** (used by this dashboard)
   - **OAuth providers** (Google, GitHub, etc.)

### 2. Configure Email Templates (Optional)

Customize authentication emails:

1. Go to **Authentication → Email Templates**
2. Customize templates for:
   - Confirm signup
   - Magic Link
   - Reset password
   - Change email

### 3. Configure Site URL

1. Go to **Authentication → URL Configuration**
2. Set your Site URL: `https://yourdomain.com`
3. Add Redirect URLs for development:
   - `http://localhost:3050/**`
   - Add any other domains you'll use

### 4. Configure Security Settings

1. Go to **Authentication → Policies**
2. Configure:
   - Enable email confirmations (recommended for production)
   - Set session duration
   - Configure password requirements

## Setting Up Your Application

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
# or
pnpm add @supabase/supabase-js @supabase/ssr
```

### 2. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create Supabase Client

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Create `lib/supabase/server.ts`:

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
          } catch {}
        },
      },
    }
  );
}
```

## Complete Sign Up Implementation for Your App

**Context:** This section shows the COMPLETE flow for implementing sign up in YOUR separate application (not the dashboard). This is a production-ready implementation that properly registers users with your app ID.

**Your App ID:** First, decide on your app's unique identifier. This should be a kebab-case string like:
- `'my-app'`
- `'analytics-dashboard'`
- `'e-commerce-platform'`

**Important:** This is the same app ID you'll use in the dashboard to manage user access.

### Sign Up: Step-by-Step

#### 1. Create the Sign Up Page

**File Location:** `app/signup/page.tsx` (in YOUR app, not the dashboard)

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ⚠️ IMPORTANT: Replace with your actual app ID
const APP_ID = 'my-app'; // Change this to your app's ID

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create user account via Supabase Auth
      console.log('Creating user account...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Optional: Add user profile data
          data: {
            // This goes to user_metadata (user-controlled)
            full_name: '', // You can collect this from a form field
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      console.log('User created:', authData.user.id);

      // Step 2: Assign app access via server API
      // This is CRITICAL - without this, user can't access your app
      console.log('Assigning app access...');
      const response = await fetch('/api/auth/assign-app-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          appId: APP_ID,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign app access');
      }

      console.log('App access assigned successfully');

      // Step 3: Redirect based on email confirmation setting
      if (authData.session) {
        // Email confirmation disabled - user is logged in
        router.push('/dashboard');
      } else {
        // Email confirmation enabled - show message
        router.push('/check-email');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      setError(error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h1 className="text-2xl font-bold mb-6">Create Account</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="At least 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        Already have an account?{' '}
        <a href="/login" className="text-blue-600 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
```

#### 2. Create the App Access Assignment API Route

**File Location:** `app/api/auth/assign-app-access/route.ts` (in YOUR app)

**Security:** This route uses the Service Role Key - it MUST be server-side only

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ⚠️ IMPORTANT: Replace with your actual app ID
const APP_ID = 'my-app'; // Must match the APP_ID in your sign up page

export async function POST(request: Request) {
  try {
    const { userId, appId } = await request.json();

    // Validate input
    if (!userId || !appId) {
      return NextResponse.json(
        { error: 'Missing userId or appId' },
        { status: 400 }
      );
    }

    // Validate that appId matches YOUR app
    if (appId !== APP_ID) {
      return NextResponse.json(
        { error: 'Invalid app ID' },
        { status: 400 }
      );
    }

    // Create admin client with SERVICE ROLE KEY
    // This bypasses RLS and can modify user claims
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // SECRET - server-side only!
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Step 1: Enable app access
    // This sets: app_metadata.apps.{APP_ID}.enabled = true
    const { error: enableError } = await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: appId,
      claim: 'enabled',
      value: true,
    });

    if (enableError) {
      console.error('Error enabling app access:', enableError);
      throw new Error(`Failed to enable app access: ${enableError.message}`);
    }

    // Step 2: Set default role
    // This sets: app_metadata.apps.{APP_ID}.role = 'user'
    const { error: roleError } = await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: appId,
      claim: 'role',
      value: 'user', // Default role for new users
    });

    if (roleError) {
      console.error('Error setting role:', roleError);
      throw new Error(`Failed to set role: ${roleError.message}`);
    }

    // Optional Step 3: Set default permissions array
    // This sets: app_metadata.apps.{APP_ID}.permissions = ['read']
    const { error: permError } = await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: appId,
      claim: 'permissions',
      value: ['read'], // Default permissions
    });

    if (permError) {
      console.error('Error setting permissions:', permError);
      // Not critical, continue
    }

    console.log(`Successfully assigned app access for user ${userId} to app ${appId}`);

    return NextResponse.json({
      success: true,
      message: 'App access assigned successfully',
    });
  } catch (error: any) {
    console.error('Error in assign-app-access:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 3. Create Check Email Page (Optional)

**File Location:** `app/check-email/page.tsx`

```typescript
export default function CheckEmailPage() {
  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
      <p className="mb-4">
        We've sent you a confirmation email. Please click the link in the email to
        verify your account.
      </p>
      <p className="text-sm text-gray-600">
        After confirming, you can <a href="/login" className="text-blue-600">sign in</a>.
      </p>
    </div>
  );
}
```

### What Happens When a User Signs Up

1. **User fills form** → Enters email and password
2. **Account created** → Supabase creates user in `auth.users` table
3. **API called** → Your app calls `/api/auth/assign-app-access`
4. **Claims set** → API sets:
   - `app_metadata.apps.{your-app-id}.enabled = true`
   - `app_metadata.apps.{your-app-id}.role = 'user'`
   - `app_metadata.apps.{your-app-id}.permissions = ['read']`
5. **User redirected** → To dashboard or check-email page

### Testing Sign Up

1. Run your app: `npm run dev`
2. Go to `/signup`
3. Enter email and password
4. Check Supabase Dashboard → Authentication → Users
5. Click on the user → should see `app_metadata.apps.{your-app-id}`
6. User can now sign in to your app!

## Complete Sign In Implementation for Your App

**Context:** This section shows the COMPLETE flow for implementing sign in with proper app access checking in YOUR separate application.

### Sign In: Step-by-Step

#### 1. Create the Sign In Page

**File Location:** `app/login/page.tsx` (in YOUR app)

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ⚠️ IMPORTANT: Must match your app ID
const APP_ID = 'my-app'; // Change this to your app's ID

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Sign in with Supabase Auth
      console.log('Signing in...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Sign in failed');
      }

      console.log('User signed in:', authData.user.id);

      // Step 2: Check if user has access to THIS app
      const hasAccess = authData.user.app_metadata?.apps?.[APP_ID]?.enabled === true;

      console.log('App metadata:', authData.user.app_metadata);
      console.log('Has access to app:', hasAccess);

      if (!hasAccess) {
        // User exists but doesn't have access to this app
        console.error('User does not have access to this app');

        // Sign them out
        await supabase.auth.signOut();

        throw new Error(
          `You don't have access to this application. ` +
          `Please contact support or sign up for access.`
        );
      }

      // Step 3: Get user's role for this app (optional)
      const userRole = authData.user.app_metadata?.apps?.[APP_ID]?.role || 'user';
      console.log('User role:', userRole);

      // Step 4: Redirect based on role or to dashboard
      if (userRole === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }

      // Success! User is signed in with access confirmed
      console.log('Sign in successful');

    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h1 className="text-2xl font-bold mb-6">Sign In</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        Don't have an account?{' '}
        <a href="/signup" className="text-blue-600 hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
```

#### 2. Create Access Denied Page

**File Location:** `app/access-denied/page.tsx`

```typescript
export default function AccessDeniedPage() {
  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h1 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h1>
      <p className="mb-4">
        You don't have access to this application.
      </p>
      <p className="mb-4">
        If you believe this is a mistake, please contact your administrator.
      </p>
      <div className="space-y-2">
        <a
          href="/signup"
          className="block w-full py-2 px-4 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700"
        >
          Sign Up for Access
        </a>
        <a
          href="/login"
          className="block w-full py-2 px-4 border text-center rounded-md hover:bg-gray-50"
        >
          Try Different Account
        </a>
      </div>
    </div>
  );
}
```

#### 3. Protect Routes with Middleware

**File Location:** `middleware.ts` (in YOUR app root)

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ⚠️ IMPORTANT: Must match your app ID
const APP_ID = 'my-app';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const isPublicRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/check-email') ||
    request.nextUrl.pathname.startsWith('/access-denied');

  // If not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If authenticated, check app access
  if (user && !isPublicRoute) {
    const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;

    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }
  }

  // If authenticated and on public route, redirect to dashboard
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;

    if (hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### What Happens When a User Signs In

1. **User submits form** → Email and password
2. **Auth validates** → Supabase checks credentials
3. **Claims loaded** → User's `app_metadata` is in the session
4. **Access checked** → Code checks `app_metadata.apps.{your-app-id}.enabled`
5. **If has access** → Redirect to dashboard
6. **If no access** → Sign out and show error

### Access Check Flow Diagram

```
User Signs In
     │
     ├─→ Credentials valid?
     │        │
     │        ├─→ NO → Show error
     │        │
     │        └─→ YES → Check app access
     │                      │
     │                      ├─→ app_metadata.apps.{your-app-id}.enabled === true?
     │                      │        │
     │                      │        ├─→ YES → Allow access → Redirect to dashboard
     │                      │        │
     │                      │        └─→ NO → Deny access → Sign out → Show error
```

### Testing Sign In

**Test Case 1: User with access**
1. Sign up through your app (assigns access)
2. Sign in → Should redirect to dashboard ✅

**Test Case 2: User without access**
1. Create user in Supabase Dashboard manually (don't assign app access)
2. Sign in → Should show "no access" error ✅

**Test Case 3: Wrong password**
1. Sign in with wrong password → Should show auth error ✅

### Debugging

Add console.logs to see what's happening:

```typescript
// After sign in
console.log('User object:', authData.user);
console.log('App metadata:', authData.user.app_metadata);
console.log('Apps:', authData.user.app_metadata?.apps);
console.log('This app:', authData.user.app_metadata?.apps?.[APP_ID]);
console.log('Has access:', authData.user.app_metadata?.apps?.[APP_ID]?.enabled);
```

Expected output for user with access:
```
User object: { id: 'uuid', email: 'user@example.com', ... }
App metadata: { apps: { 'my-app': { enabled: true, role: 'user' } } }
Apps: { 'my-app': { enabled: true, role: 'user' } }
This app: { enabled: true, role: 'user' }
Has access: true
```

### Summary: Complete Flow

**Sign Up Flow:**
1. User → `/signup` page
2. Enter email/password → Create account
3. API → `set_app_claim(enabled=true, role='user')`
4. User → Dashboard or check email

**Sign In Flow:**
1. User → `/login` page
2. Enter email/password → Authenticate
3. Check → `app_metadata.apps.{app-id}.enabled`
4. If true → Dashboard
5. If false → Sign out + error message

**Key Files:**
- `app/signup/page.tsx` - Sign up UI
- `app/login/page.tsx` - Sign in UI + access check
- `app/api/auth/assign-app-access/route.ts` - Assigns app access
- `middleware.ts` - Route protection
- `app/access-denied/page.tsx` - No access message

**Remember:**
- ✅ Replace `'my-app'` with your actual app ID
- ✅ Same app ID everywhere (sign up, sign in, middleware)
- ✅ Service role key only in server API routes
- ✅ Always check `enabled === true` on sign in
- ✅ Test both scenarios: with access and without

## Sign Up Flow with Automatic Role Assignment

### Basic Sign Up Component

**Context:** This example shows a complete client-side sign-up component that creates a user account and then calls a server-side API to assign default roles. This is the recommended pattern for secure role assignment.

**File Location:** `app/signup/page.tsx` (example)

Create a sign-up page with automatic role assignment:

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Create user account via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Optional: Add user profile metadata (stored in user_metadata)
          data: {
            full_name: '', // Can collect from form
          },
          // Optional: Redirect URL after email confirmation
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Step 2: After successful signup, assign default role via API
        // This requires the custom claims functions to be installed
        // IMPORTANT: This calls a server API to securely assign roles
        await assignDefaultRole(data.user.id);

        alert('Check your email to confirm your account!');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  );
}

// Helper function to assign default role (called from client)
async function assignDefaultRole(userId: string) {
  const supabase = createClient();

  // Call server action or edge function to assign role
  // Don't call this directly from client - use a server action instead!
  const response = await fetch('/api/assign-default-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    console.error('Failed to assign default role');
  }
}
```

### Server-Side Role Assignment (Recommended)

**Context:** This is a Next.js API route that runs server-side with access to the service role key. It securely assigns roles to users after sign up. This pattern ensures role assignment cannot be manipulated by the client.

**File Location:** `app/api/assign-default-role/route.ts`

**Security Note:** Uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS - only use server-side.

Create `app/api/assign-default-role/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Parse request body to get userId
    const { userId } = await request.json();

    // Create admin client with SERVICE ROLE KEY
    // This key bypasses RLS and can modify any user's data
    // IMPORTANT: Only use this server-side, never expose to client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // SECRET KEY
    );

    // Step 1: Enable app access for the user
    // This sets: app_metadata.apps.{app_id}.enabled = true
    const { error: appError } = await supabase.rpc('set_app_claim', {
      uid: userId,                // User ID from sign up
      app_id: 'your-app-id',     // Replace with your actual app ID
      claim: 'enabled',          // Claim key
      value: true,               // Claim value (boolean)
    });

    if (appError) throw appError;

    // Step 2: Set default role for the user in this app
    // This sets: app_metadata.apps.{app_id}.role = 'user'
    const { error: roleError } = await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: 'your-app-id',
      claim: 'role',            // Claim key
      value: 'user',            // Default role (can be 'admin', 'user', 'viewer', etc.)
    });

    if (roleError) throw roleError;

    // Success response
    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Error response
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Sign In Flow

### Magic Link Sign In (Used by Dashboard)

**Security Note:** The dashboard login uses `shouldCreateUser: false` to prevent unauthorized user creation. Only existing users can request magic links.

#### For Admin Dashboards (Existing Users Only)

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback`,
          shouldCreateUser: false, // Security: Only allow existing users
        },
      });

      if (error) throw error;
      alert('Check your email for the magic link!');
    } catch (error: any) {
      // Provide helpful error messages
      const errorMessage = error.message || '';
      if (errorMessage.toLowerCase().includes('user not found')) {
        alert('This email is not registered. Contact an administrator.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
      <p className="text-sm text-gray-600">
        Only existing users can sign in. New users must be created by an administrator.
      </p>
    </form>
  );
}
```

#### For User-Facing Apps (Allow New Users)

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function UserLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${getAppUrl()}/auth/callback`,
          shouldCreateUser: true, // Allow new user creation
        },
      });

      if (error) throw error;
      alert('Check your email for the magic link!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  );
}
```

#### Auth Callback Handler (Required)

Create `app/auth/callback/route.ts` to handle the magic link redirect:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

#### Key Points

1. **`shouldCreateUser: false`** - For admin dashboards to prevent unauthorized access
2. **`shouldCreateUser: true`** - For user-facing apps to allow sign-ups
3. **Callback handler** - Required to exchange the auth code for a session
4. **Error handling** - Provide clear messages for unregistered emails
5. **Supabase defaults** - Use default Supabase SSR config (no custom flowType needed)

### Email/Password Sign In

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

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user has access to your app
      const appId = 'your-app-id';
      const hasAccess = data.user?.app_metadata?.apps?.[appId]?.enabled;

      if (!hasAccess) {
        // Redirect to access denied or welcome page
        router.push('/access-denied');
        return;
      }

      // Successful login with access
      router.push('/dashboard');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

### OAuth Sign In (Google, GitHub, etc.)

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';

export default function OAuthLogin() {
  const supabase = createClient();

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
    }
  };

  return (
    <div>
      <button onClick={() => handleOAuthLogin('google')}>
        Sign in with Google
      </button>
      <button onClick={() => handleOAuthLogin('github')}>
        Sign in with GitHub
      </button>
    </div>
  );
}
```

Create OAuth callback handler at `app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to your app
  return NextResponse.redirect(requestUrl.origin);
}
```

## App-Specific Sign Up

### Sign Up with App Selection

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AppSignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedApp, setSelectedApp] = useState('app1');
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create the user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // 2. Assign app access via server action
        const response = await fetch('/api/assign-app-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            appId: selectedApp,
            role: 'user', // Default role
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to assign app access');
        }

        alert('Account created! Check your email to confirm.');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <select
        value={selectedApp}
        onChange={(e) => setSelectedApp(e.target.value)}
      >
        <option value="app1">Application 1</option>
        <option value="app2">Application 2</option>
      </select>
      <button type="submit" disabled={loading}>
        Sign Up
      </button>
    </form>
  );
}
```

### API Route for App Access Assignment

Create `app/api/assign-app-access/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, appId, role } = await request.json();

    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Enable app access
    await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: appId,
      claim: 'enabled',
      value: true,
    });

    // Set role
    await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: appId,
      claim: 'role',
      value: role,
    });

    // Optionally add more claims
    // await supabase.rpc('set_app_claim', {
    //   uid: userId,
    //   app_id: appId,
    //   claim: 'permissions',
    //   value: ['read', 'write'],
    // });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error assigning app access:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Advanced: Database Triggers

**Context:** Database triggers are PostgreSQL functions that automatically execute when certain events occur (like user creation). This approach assigns roles at the database level during user insertion, ensuring every new user gets default roles without requiring application code.

**When to Use:**
- You want consistent default roles for ALL new users
- You prefer database-level automation over API calls
- You want to reduce application code complexity

**Alternative to:** API-based role assignment shown earlier

**Security:** Runs as SECURITY DEFINER (with elevated privileges) - test carefully

For automatic role assignment on sign up, you can use database triggers.

### Create a Trigger Function

**Run Location:** Supabase SQL Editor (Database → SQL Editor)

**What This Does:** Creates a PostgreSQL function that modifies the `raw_app_meta_data` field before a user is inserted into the `auth.users` table.

Run this SQL in your Supabase SQL Editor:

```sql
-- Function to assign default roles on user creation
CREATE OR REPLACE FUNCTION assign_default_roles()
RETURNS trigger AS $$
BEGIN
  -- Assign default app access for 'app1'
  NEW.raw_app_meta_data = jsonb_set(
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
    '{apps,app1}',
    jsonb_build_object(
      'enabled', true,
      'role', 'user'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user creation
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
CREATE TRIGGER on_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_roles();
```

### Multi-App Default Assignment

```sql
-- Function to assign multiple app defaults
CREATE OR REPLACE FUNCTION assign_default_roles()
RETURNS trigger AS $$
BEGIN
  -- Assign access to multiple apps with default roles
  NEW.raw_app_meta_data = jsonb_set(
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
    '{apps}',
    jsonb_build_object(
      'app1', jsonb_build_object('enabled', true, 'role', 'user'),
      'app2', jsonb_build_object('enabled', false, 'role', 'viewer')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Conditional Role Assignment Based on Email Domain

```sql
-- Assign roles based on email domain
CREATE OR REPLACE FUNCTION assign_default_roles()
RETURNS trigger AS $$
DECLARE
  user_role TEXT;
  app_enabled BOOLEAN;
BEGIN
  -- Determine role based on email domain
  IF NEW.email LIKE '%@company.com' THEN
    user_role := 'admin';
    app_enabled := true;
  ELSE
    user_role := 'user';
    app_enabled := true;
  END IF;

  -- Set app access
  NEW.raw_app_meta_data = jsonb_set(
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
    '{apps,app1}',
    jsonb_build_object(
      'enabled', app_enabled,
      'role', user_role
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Examples

### Complete Sign Up/Sign In Flow

Here's a complete example combining sign up, sign in, and role checking:

```typescript
// app/auth/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const APP_ID = 'your-app-id'; // Replace with your app ID

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Assign default app access
        await fetch('/api/assign-app-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            appId: APP_ID,
            role: 'user',
          }),
        });

        alert('Success! Check your email to confirm your account.');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check app access
      const hasAccess = data.user?.app_metadata?.apps?.[APP_ID]?.enabled;
      const userRole = data.user?.app_metadata?.apps?.[APP_ID]?.role;

      if (!hasAccess) {
        alert('You do not have access to this application.');
        await supabase.auth.signOut();
        return;
      }

      // Redirect based on role
      if (userRole === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        <button onClick={() => setMode('signin')}>Sign In</button>
        <button onClick={() => setMode('signup')}>Sign Up</button>
      </div>

      <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}
```

### Protecting Routes with Middleware

**Context:** Next.js middleware runs before requests are processed, making it ideal for authentication checks. This example shows how to protect all routes by checking if users are authenticated and have access to your app.

**File Location:** `middleware.ts` (must be in project root)

**How it Works:**
1. Runs on every request (based on config.matcher)
2. Checks if user is authenticated
3. Checks if user has access to the specific app
4. Redirects to login or access-denied if checks fail

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const APP_ID = 'your-app-id';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Check app access
  if (user && !request.nextUrl.pathname.startsWith('/auth')) {
    const hasAccess = user.app_metadata?.apps?.[APP_ID]?.enabled === true;

    if (!hasAccess && !request.nextUrl.pathname.startsWith('/access-denied')) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
```

### Server Component Access Control

**Context:** Next.js App Router Server Components can directly access Supabase without client-side JavaScript. This example shows how to protect a page and check user access at the component level.

**File Location:** `app/dashboard/page.tsx` (example)

**When to Use:** For page-level protection in addition to middleware, or when you need role information to render different content.

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const APP_ID = 'your-app-id';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Check app access and role
  const appData = user.app_metadata?.apps?.[APP_ID];
  const hasAccess = appData?.enabled === true;
  const role = appData?.role;

  if (!hasAccess) {
    redirect('/access-denied');
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.email}</p>
      <p>Your role: {role}</p>

      {role === 'admin' && (
        <div>
          <h2>Admin Controls</h2>
          {/* Admin-only features */}
        </div>
      )}
    </div>
  );
}
```

## Troubleshooting

### Users Can't Sign Up

**Problem:** Sign up fails or doesn't create user.

**Solutions:**
- Check if email confirmations are required (disable for testing)
- Verify Supabase credentials in `.env.local`
- Check Supabase logs in Dashboard → Logs → Auth
- Ensure email provider is configured

### Roles Not Assigned on Sign Up

**Problem:** New users don't get default roles.

**Solutions:**
- Verify custom claims functions are installed (`install.sql`)
- Check if trigger is created: `SELECT * FROM pg_trigger WHERE tgname = 'on_user_created';`
- Manually assign role via dashboard or SQL
- Check API route logs for errors

### Users Can't Access App After Sign In

**Problem:** User logs in but redirected to access denied.

**Solutions:**
- Check if `apps.{app_id}.enabled` is `true`
- Verify app ID matches exactly (case-sensitive)
- Have user refresh session: `supabase.auth.refreshSession()`
- Check middleware configuration

### Claims Not Visible in JWT

**Problem:** Claims don't appear in `user.app_metadata`.

**Solutions:**
- User must refresh session after claims are set
- Log out and back in
- Check raw data: `SELECT raw_app_meta_data FROM auth.users WHERE id = 'user-id';`
- Verify claims were set correctly

### OAuth Sign In Issues

**Problem:** OAuth redirect fails or doesn't work.

**Solutions:**
- Add OAuth provider redirect URL in Supabase Dashboard
- Verify provider credentials (client ID, secret)
- Check callback route exists and is correct
- Test redirect URL: should be `https://yourdomain.com/auth/callback`

## Best Practices

1. **Always Use Server-Side Role Assignment**
   - Never trust client to set their own roles
   - Use Service Role Key only on server
   - Validate user permissions before assignment

2. **Implement Proper Error Handling**
   - Show user-friendly error messages
   - Log errors for debugging
   - Handle rate limiting errors

3. **Use Database Triggers for Consistency**
   - Automatic role assignment reduces errors
   - Ensures all users have required claims
   - Centralizes permission logic

4. **Protect Your Service Role Key**
   - Never expose in client code
   - Only use in server components/actions
   - Store securely in environment variables

5. **Test Different User Flows**
   - Test sign up with different email domains
   - Test OAuth providers
   - Test role-based redirects
   - Test access denied scenarios

6. **Handle Session Management**
   - Implement proper sign out
   - Handle session expiration
   - Refresh tokens when needed

## Related Documentation

- [CLAIMS_GUIDE.md](/docs/claims-guide) - Understanding custom claims
- [MULTI_APP_GUIDE.md](/docs/multi-app-guide) - Multi-app architecture
- [SETUP.md](/docs/setup) - Initial dashboard setup
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)

## Support

For additional help:
1. Check the Supabase Auth documentation
2. Review example code in this repository
3. Check Supabase logs in your dashboard
4. Open an issue on GitHub

---

**Next Steps:**
- Implement sign up/sign in in your application
- Configure default roles via triggers or API routes
- Test authentication flow thoroughly
- Set up proper error handling and logging

---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
