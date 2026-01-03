---
title: "Complete App Integration Guide"
description: "Everything you need to integrate Supabase Access Broker into your application"
category: "guides"
audience: "app-developer"
order: 1
---

# Complete App Integration Guide

**Purpose:** This guide provides complete, step-by-step instructions for integrating Supabase Access Broker into your application. After following this guide, you'll be able to register users to your app, authenticate them via SSO, and manage their claims.

**Target Audience:** Developers integrating their applications with Access Broker (not deploying the broker itself)

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript, PostgreSQL

**What This Guide Covers:**
1. How to register a user to your specific app
2. How to authenticate users using Supabase
3. How to modify and manage claims attributes
4. How to protect routes and check permissions

---

## Table of Contents

- [System Architecture Overview](#system-architecture-overview)
- [Prerequisites](#prerequisites)
- [Part 1: Initial Setup](#part-1-initial-setup)
- [Part 2: User Registration](#part-2-user-registration)
- [Part 3: User Authentication](#part-3-user-authentication)
- [Part 4: Managing Claims](#part-4-managing-claims)
- [Part 5: Access Control](#part-5-access-control)
- [Part 6: RLS Policies](#part-6-rls-policies)
- [Complete Code Examples](#complete-code-examples)
- [Troubleshooting](#troubleshooting)

---

## System Architecture Overview

### Understanding the Separation

**The Dashboard (Admin Panel):**
- Separate codebase for administrators
- Manages users, apps, and claims
- Located at: `admin.yourdomain.com` (example)

**Your Application (This Guide):**
- Your separate application codebase
- Where regular users sign up and sign in
- Located at: `app.yourdomain.com` (example)

**Shared Supabase Instance:**
- Both use the same Supabase project
- Authentication is centralized
- Claims are stored in `auth.users.raw_app_meta_data`

### How It Works

```
┌──────────────────────────────────────────────────┐
│         Supabase Auth Instance (Shared)          │
│  Contains: Users, Authentication, Claims         │
└──────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼─────┐  ┌─────▼─────┐
│   Dashboard  │  │   App 1   │  │   App 2   │
│   (Admin)    │  │  (Users)  │  │  (Users)  │
└──────────────┘  └───────────┘  └───────────┘
- Manages users   - Sign up      - Sign up
- Sets claims     - Sign in      - Sign in
- Assigns roles   - Check perms  - Check perms
```

### Key Concepts

**App ID:** A unique identifier for your application (e.g., `'my-app'`, `'analytics-dashboard'`)
- Stored as a key in `app_metadata.apps.{app_id}`
- Used to scope all app-specific claims
- Must be consistent across your entire application

**Claims Structure:**
```json
{
  "app_metadata": {
    "claims_admin": false,
    "organization_id": "org-123",
    "apps": {
      "your-app-id": {
        "enabled": true,
        "role": "user",
        "permissions": ["read", "write"],
        "subscription_tier": "premium"
      }
    }
  }
}
```

---

## Prerequisites

### Required

1. **Supabase Project**
   - Created and configured
   - URL and keys available

2. **Custom Claims Functions Installed**
   - Run `install.sql` in your Supabase SQL Editor
   - Provides RPC functions: `set_app_claim`, `get_app_claim`, `delete_app_claim`

3. **Your App Registered in Dashboard**
   - Create your app in the dashboard
   - Note your `app_id`

4. **Environment Variables**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
# or
pnpm add @supabase/supabase-js @supabase/ssr
```

---

## Part 1: Initial Setup

### Step 1: Create Supabase Clients

#### Client-Side Client

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

#### Server-Side Client

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
          } catch {}
        },
      },
    }
  );
}
```

### Step 2: Configure Your App ID

**Create a constants file to store your app ID:**

**File:** `lib/constants.ts`

```typescript
// ⚠️ CRITICAL: This must match the app_id used in the dashboard
export const APP_ID = 'your-app-id'; // Replace with your actual app ID

// Examples:
// export const APP_ID = 'analytics-dashboard';
// export const APP_ID = 'e-commerce-platform';
// export const APP_ID = 'project-management';
```

---

## Part 2: User Registration

### How User Registration Works

When a user signs up for your app, you need to:
1. Create their Supabase Auth account (email + password)
2. Assign them access to your app by setting `app_metadata.apps.{your-app-id}.enabled = true`
3. Set their default role (e.g., `'user'`)
4. Optionally set default permissions or other attributes

### Step 1: Create Sign Up Page

**File:** `app/signup/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { APP_ID } from '@/lib/constants';

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
      // Step 1: Create Supabase Auth account
      console.log('Creating user account...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            // Optional: User profile data (goes to user_metadata)
            full_name: '', // Collect from additional form fields if needed
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      console.log('User created:', authData.user.id);

      // Step 2: Register user to your app via server API
      console.log('Registering user to app...');
      const response = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          appId: APP_ID,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register user to app');
      }

      console.log('User registered to app successfully');

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

### Step 2: Create User Registration API Route

**File:** `app/api/auth/register-user/route.ts`

**⚠️ SECURITY: This route uses the SERVICE ROLE KEY - it MUST be server-side only**

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_ID } from '@/lib/constants';

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

    // Security: Verify appId matches YOUR app
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
    // Sets: app_metadata.apps.{APP_ID}.enabled = true
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
    // Sets: app_metadata.apps.{APP_ID}.role = 'user'
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

    // Step 3: Set default permissions (optional)
    // Sets: app_metadata.apps.{APP_ID}.permissions = ['read']
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

    console.log(`Successfully registered user ${userId} to app ${appId}`);

    return NextResponse.json({
      success: true,
      message: 'User registered to app successfully',
    });
  } catch (error: any) {
    console.error('Error in register-user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Check Email Page (Optional)

**File:** `app/check-email/page.tsx`

```typescript
export default function CheckEmailPage() {
  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
      <p className="mb-4">
        We've sent you a confirmation email. Please click the link in the email
        to verify your account.
      </p>
      <p className="text-sm text-gray-600">
        After confirming, you can{' '}
        <a href="/login" className="text-blue-600">
          sign in
        </a>
        .
      </p>
    </div>
  );
}
```

### What Gets Created

After successful registration, the user's `app_metadata` will look like:

```json
{
  "apps": {
    "your-app-id": {
      "enabled": true,
      "role": "user",
      "permissions": ["read"]
    }
  }
}
```

---

## Part 3: User Authentication

### How Authentication Works

1. User enters credentials
2. Supabase validates and creates session
3. Your app checks if user has access to your specific app (`app_metadata.apps.{app-id}.enabled`)
4. If yes → redirect to dashboard
5. If no → sign out and show error

### Step 1: Create Sign In Page

**File:** `app/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { APP_ID } from '@/lib/constants';

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

### Step 2: Create Access Denied Page

**File:** `app/access-denied/page.tsx`

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

### Step 3: Protect Routes with Middleware

**File:** `middleware.ts` (in project root)

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { APP_ID } from '@/lib/constants';

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

---

## Part 4: Managing Claims

### Understanding Claims Operations

Claims can be modified using Supabase RPC functions:
- `set_app_claim` - Set or update a claim
- `get_app_claim` - Read a claim value
- `delete_app_claim` - Remove a claim

**Important:** These operations require the SERVICE ROLE KEY and must be done server-side.

### Creating a Claims Management API

**File:** `app/api/claims/update/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_ID } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { userId, claim, value } = await request.json();

    // Validate input
    if (!userId || !claim || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update the claim
    const { error } = await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: APP_ID,
      claim: claim,
      value: value,
    });

    if (error) {
      console.error('Error updating claim:', error);
      throw new Error(`Failed to update claim: ${error.message}`);
    }

    console.log(`Updated claim ${claim} for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Claim updated successfully',
    });
  } catch (error: any) {
    console.error('Error in update claim:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Common Claims Modifications

#### Update User Role

```typescript
// Client-side call
async function updateUserRole(userId: string, newRole: string) {
  const response = await fetch('/api/claims/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      claim: 'role',
      value: newRole, // 'user', 'admin', 'viewer', etc.
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update role');
  }

  return response.json();
}
```

#### Update Permissions Array

```typescript
async function updateUserPermissions(userId: string, permissions: string[]) {
  const response = await fetch('/api/claims/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      claim: 'permissions',
      value: permissions, // ['read', 'write', 'delete']
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update permissions');
  }

  return response.json();
}
```

#### Add Custom Attribute

```typescript
async function setSubscriptionTier(userId: string, tier: string) {
  const response = await fetch('/api/claims/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      claim: 'subscription_tier',
      value: tier, // 'free', 'premium', 'enterprise'
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update subscription tier');
  }

  return response.json();
}
```

#### Refresh Session After Claim Update

**Important:** After updating claims, users must refresh their session to see changes.

```typescript
// Client-side: Refresh current user's session
const supabase = createClient();
const { error } = await supabase.auth.refreshSession();

if (error) {
  console.error('Failed to refresh session:', error);
}

// Now user.app_metadata will have updated claims
const { data: { user } } = await supabase.auth.getUser();
console.log('Updated claims:', user?.app_metadata);
```

---

## Part 5: Access Control

### Checking User Access and Roles

#### Server Component Access Check

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { APP_ID } from '@/lib/constants';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
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

#### Client Component Role Check

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { APP_ID } from '@/lib/constants';

export function RoleBasedUI() {
  const [role, setRole] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      setRole(user?.app_metadata?.apps?.[APP_ID]?.role || null);
    }
    loadRole();
  }, []);

  if (role === 'admin') {
    return <AdminDashboard />;
  } else if (role === 'user') {
    return <UserDashboard />;
  } else {
    return <ViewerDashboard />;
  }
}
```

#### API Route Protection

```typescript
// app/api/admin/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { APP_ID } from '@/lib/constants';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.app_metadata?.apps?.[APP_ID]?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Admin-only logic here
  return NextResponse.json({ message: 'Admin data' });
}
```

### Permission Checks

```typescript
// Check if user has specific permission
function hasPermission(user: any, permission: string): boolean {
  const permissions = user?.app_metadata?.apps?.[APP_ID]?.permissions || [];
  return permissions.includes(permission);
}

// Usage
const { data: { user } } = await supabase.auth.getUser();

if (hasPermission(user, 'write')) {
  // Show edit button
}

if (hasPermission(user, 'delete')) {
  // Show delete button
}
```

---

## Part 6: RLS Policies

### Setting Up Row Level Security

RLS policies use claims from the JWT token to control database access at the row level.

#### Enable RLS on Table

```sql
-- Enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

#### Basic App Access Policy

```sql
-- Users can only read data if they have access to the app
CREATE POLICY "Users with app access can read"
ON your_table
FOR SELECT
USING (
  COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'enabled')::boolean,
    false
  ) = true
);
```

#### Role-Based Policy

```sql
-- Only admins can delete
CREATE POLICY "Only admins can delete"
ON your_table
FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
  OR
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

#### Permission-Based Policy

```sql
-- Users need 'write' permission to update
CREATE POLICY "Users with write permission can update"
ON your_table
FOR UPDATE
USING (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions') ? 'write'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id -> 'permissions') ? 'write'
);
```

#### Owner + Admin Policy

```sql
-- Users can access their own data OR admins can access everything
CREATE POLICY "Owner or admin access"
ON your_table
FOR ALL
USING (
  auth.uid() = user_id
  OR
  (auth.jwt() -> 'app_metadata' -> 'apps' -> app_id ->> 'role') = 'admin'
  OR
  COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean,
    false
  ) = true
);
```

---

## Complete Code Examples

### Example 1: Complete Registration Flow

```typescript
// Client initiates sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});

if (data.user) {
  // Server assigns app access
  await fetch('/api/auth/register-user', {
    method: 'POST',
    body: JSON.stringify({
      userId: data.user.id,
      appId: APP_ID,
    }),
  });
}

// Result: User has app access
// app_metadata.apps.{APP_ID}.enabled = true
// app_metadata.apps.{APP_ID}.role = 'user'
```

### Example 2: Complete Sign In Flow

```typescript
// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Check access
const hasAccess = data.user?.app_metadata?.apps?.[APP_ID]?.enabled === true;

if (hasAccess) {
  // Redirect to dashboard
  router.push('/dashboard');
} else {
  // Sign out and show error
  await supabase.auth.signOut();
  alert('No access to this app');
}
```

### Example 3: Update Claims and Refresh

```typescript
// Server-side: Update claim
await supabase.rpc('set_app_claim', {
  uid: userId,
  app_id: APP_ID,
  claim: 'role',
  value: 'admin',
});

// Client-side: User refreshes session
await supabase.auth.refreshSession();

// Now claims are updated
const { data: { user } } = await supabase.auth.getUser();
console.log(user?.app_metadata?.apps?.[APP_ID]?.role); // 'admin'
```

---

## Troubleshooting

### User Can't Sign In

**Problem:** Sign in fails or shows "no access" error

**Solutions:**
1. Check if user exists in Supabase Dashboard → Authentication → Users
2. Verify `app_metadata.apps.{your-app-id}.enabled` is `true`
3. Check APP_ID matches everywhere
4. Verify environment variables are correct

### Claims Not Showing

**Problem:** Claims don't appear in `user.app_metadata`

**Solutions:**
1. Refresh session: `await supabase.auth.refreshSession()`
2. Check claims in Supabase Dashboard (click user → view app_metadata)
3. Verify custom claims functions are installed
4. Check API route logs for errors

### Access Denied on Valid User

**Problem:** User should have access but gets access denied

**Solutions:**
1. Check middleware APP_ID matches
2. Verify exact claim path: `app_metadata.apps.{app-id}.enabled`
3. Check for typos in app_id (case-sensitive)
4. Log the user object to see actual structure

### RLS Policies Not Working

**Problem:** RLS policies allow/deny incorrect access

**Solutions:**
1. Test JWT claims: `SELECT auth.jwt();`
2. Check if RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';`
3. Verify policy syntax is correct
4. Use COALESCE to handle null values

---

## Summary

### Registration Flow
1. User signs up → Create Supabase account
2. Server API → Set `app_metadata.apps.{app-id}.enabled = true`
3. Server API → Set `app_metadata.apps.{app-id}.role = 'user'`
4. User can now access your app

### Authentication Flow
1. User signs in → Supabase validates credentials
2. Check → `app_metadata.apps.{app-id}.enabled === true`
3. If true → Redirect to dashboard
4. If false → Sign out + show error

### Claims Management
1. Server API → Call `set_app_claim` RPC function
2. User → Refresh session to see changes
3. App → Check claims for access control

### Key Files Required
- `lib/supabase/client.ts` - Client-side Supabase client
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/constants.ts` - App ID constant
- `app/signup/page.tsx` - Sign up page
- `app/login/page.tsx` - Sign in page
- `app/api/auth/register-user/route.ts` - Registration API
- `app/api/claims/update/route.ts` - Claims management API
- `middleware.ts` - Route protection

### Remember
- ✅ Same APP_ID everywhere
- ✅ Service role key only server-side
- ✅ Always check `enabled === true`
- ✅ Refresh session after claim updates
- ✅ Use RLS policies for database access control

---

## Part 7: API Keys for Webhooks

For external integrations like n8n, Zapier, or custom webhooks, you can use API keys instead of user authentication.

### When to Use API Keys

- **Webhooks** from external services (n8n, Zapier, Make)
- **Server-to-server** communication
- **Automated processes** that don't represent a user
- **Third-party integrations** that need app access

### Creating API Keys

API keys are created through the admin dashboard:

1. Navigate to your app in the dashboard
2. Go to the **API Keys** tab
3. Create a key with appropriate permissions
4. Copy the key immediately (you won't see it again!)

### Using API Keys in Requests

Include the key in your HTTP requests:

```bash
curl -X POST https://your-app.com/api/webhooks/your-app-id \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"event": "data", "payload": {...}}'
```

### API Key Features

- **App-scoped**: Each key belongs to one app
- **Role-based**: Can be assigned permissions via roles
- **Expiration**: Optional expiration dates
- **Usage tracking**: Monitors last usage time
- **Secure**: Hashed in database, never retrievable

For detailed information, see the [API Keys Guide](/docs/api-keys-guide).

---

**You now have everything needed to integrate claims-based authentication into your application, including webhook support!**

---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
