---
title: "Session Management Guide"
description: "Complete guide for getting, retrieving, and managing user sessions"
category: "authentication"
audience: "app-developer"
order: 5
---

# Session Management Guide

**Context:** This guide covers how to work with user sessions in your Supabase-powered application. You'll learn how to retrieve sessions, refresh them, persist them across page loads, and handle session lifecycle events.

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript

**Prerequisites:**
- Supabase client setup complete
- Basic understanding of Supabase Auth
- Environment variables configured

**Key Concepts:**
- **Session:** Contains the JWT access token and refresh token
- **Access Token (JWT):** Short-lived token for API authentication (default: 1 hour)
- **Refresh Token:** Long-lived token to obtain new access tokens (default: 30 days)
- **Session Persistence:** Storing session data in cookies/local storage
- **Auto-refresh:** Automatically refreshing the access token before expiration

## Table of Contents

- [Understanding Sessions](#understanding-sessions)
- [Getting the Current Session](#getting-the-current-session)
- [Getting the Current User](#getting-the-current-user)
- [Refreshing Sessions](#refreshing-sessions)
- [Session Lifecycle Events](#session-lifecycle-events)
- [Session Persistence](#session-persistence)
- [Server-Side Session Management](#server-side-session-management)
- [Client-Side Session Management](#client-side-session-management)
- [Session Configuration](#session-configuration)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Understanding Sessions

### What is a Session?

A session in Supabase Auth contains:

```typescript
{
  access_token: string;      // JWT token for API authentication
  refresh_token: string;     // Token to get new access tokens
  expires_in: number;        // Seconds until access token expires
  expires_at: number;        // Unix timestamp of expiration
  token_type: "bearer";      // Token type
  user: User;                // User object with metadata
}
```

### Session Lifecycle

```
User Signs In
     │
     ├─→ Session Created
     │       ├─→ Access Token (expires in 1 hour)
     │       └─→ Refresh Token (expires in 30 days)
     │
     ├─→ Session Stored (in cookies)
     │
     ├─→ Auto-refresh Enabled
     │       └─→ New access token obtained before expiration
     │
     └─→ Session Ends
             ├─→ Refresh token expires (30 days)
             ├─→ User signs out
             └─→ User clears browser data
```

### Token Expiration

**Access Token (JWT):**
- **Default Duration:** 3600 seconds (1 hour)
- **Configurable:** 300 to 604800 seconds (5 min to 7 days)
- **Purpose:** Used for authenticating API requests
- **Refresh:** Auto-refreshed by Supabase client before expiration

**Refresh Token:**
- **Default Duration:** 2592000 seconds (30 days)
- **Purpose:** Used to obtain new access tokens
- **Expiration:** User must sign in again after expiration

## Getting the Current Session

### Client-Side (Browser)

**When to Use:** Client Components, browser-side operations

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';

async function getCurrentSession() {
  const supabase = createClient();

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  if (session) {
    console.log('Session found:', {
      accessToken: session.access_token,
      expiresAt: new Date(session.expires_at! * 1000),
      user: session.user.email,
    });

    return session;
  } else {
    console.log('No active session');
    return null;
  }
}
```

### Server-Side (Next.js)

**When to Use:** Server Components, Server Actions, API Routes

```typescript
import { createClient } from '@/lib/supabase/server';

async function getCurrentSession() {
  const supabase = await createClient();

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  return session;
}
```

### Session Object Properties

```typescript
if (session) {
  // Access token (JWT)
  const jwt = session.access_token;

  // Refresh token
  const refreshToken = session.refresh_token;

  // Expiration info
  const expiresIn = session.expires_in; // Seconds until expiration
  const expiresAt = session.expires_at; // Unix timestamp

  // User data
  const user = session.user;
  const email = session.user.email;
  const userId = session.user.id;
  const appMetadata = session.user.app_metadata; // Custom claims
  const userMetadata = session.user.user_metadata; // Profile data

  // Check if token is about to expire (within 5 minutes)
  const timeUntilExpiry = (session.expires_at! * 1000) - Date.now();
  const isExpiringSoon = timeUntilExpiry < 5 * 60 * 1000;
}
```

## Getting the Current User

### Get User (Recommended)

**Best Practice:** Use `getUser()` instead of `getSession()` when you only need user data. It validates the JWT on the server.

```typescript
// Client-side
const supabase = createClient();
const { data: { user }, error } = await supabase.auth.getUser();

if (user) {
  console.log('User ID:', user.id);
  console.log('Email:', user.email);
  console.log('App metadata:', user.app_metadata);
  console.log('User metadata:', user.user_metadata);
}
```

### Difference: getUser() vs getSession()

| Method | Use Case | Validation | Speed |
|--------|----------|------------|-------|
| `getUser()` | When you need user data | Validates JWT with server | Slower (network call) |
| `getSession()` | When you need full session | Reads from local storage | Faster (local) |

**Rule of Thumb:**
- Use `getUser()` for security-critical operations
- Use `getSession()` when you need the access token or refresh token

## Refreshing Sessions

### Manual Refresh

**When to Use:**
- After updating user claims/metadata in the dashboard
- When you suspect the session is stale
- After long periods of inactivity

```typescript
const supabase = createClient();

async function refreshSession() {
  const { data: { session }, error } = await supabase.auth.refreshSession();

  if (error) {
    console.error('Error refreshing session:', error);
    return null;
  }

  console.log('Session refreshed:', {
    newExpiresAt: new Date(session!.expires_at! * 1000),
    user: session!.user.email,
  });

  return session;
}
```

### Auto-Refresh (Default Behavior)

Supabase client automatically refreshes the session before the access token expires.

**Default Settings:**
- Auto-refresh is **enabled by default**
- Refresh happens **60 seconds before expiration**
- Handled transparently in the background

**How It Works:**

```typescript
// This is already configured in lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Auto-refresh is enabled by default
        autoRefreshToken: true,  // Default: true
        persistSession: true,     // Default: true
      },
    }
  );
}
```

### Check if Refresh is Needed

```typescript
async function shouldRefreshSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return false;

  const now = Date.now();
  const expiresAt = session.expires_at! * 1000;
  const timeUntilExpiry = expiresAt - now;

  // Refresh if less than 5 minutes remaining
  const shouldRefresh = timeUntilExpiry < 5 * 60 * 1000;

  if (shouldRefresh) {
    console.log('Session expiring soon, should refresh');
    console.log('Time until expiry:', Math.floor(timeUntilExpiry / 1000), 'seconds');
  }

  return shouldRefresh;
}
```

### Force Refresh After Claim Update

**Important:** When claims are updated via the admin dashboard, the user must refresh their session to see the changes.

```typescript
async function refreshAfterClaimUpdate() {
  const supabase = createClient();

  console.log('Refreshing session to get updated claims...');

  const { data: { session }, error } = await supabase.auth.refreshSession();

  if (error) {
    console.error('Error refreshing:', error);
    return;
  }

  // Now the session has updated claims
  const updatedClaims = session!.user.app_metadata;
  console.log('Updated claims:', updatedClaims);

  // Reload the page to reflect changes
  window.location.reload();
}
```

## Session Lifecycle Events

### Listen to Auth State Changes

**Use Case:** React to session changes (sign in, sign out, token refresh)

```typescript
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function AuthListener() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);

      switch (event) {
        case 'SIGNED_IN':
          console.log('User signed in:', session?.user.email);
          router.push('/dashboard');
          break;

        case 'SIGNED_OUT':
          console.log('User signed out');
          router.push('/login');
          break;

        case 'TOKEN_REFRESHED':
          console.log('Token refreshed');
          console.log('New expiry:', new Date(session!.expires_at! * 1000));
          break;

        case 'USER_UPDATED':
          console.log('User metadata updated');
          break;

        case 'PASSWORD_RECOVERY':
          console.log('Password recovery initiated');
          break;

        default:
          console.log('Other auth event:', event);
      }
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return null;
}
```

### Auth Events Reference

| Event | When It Fires | Use Case |
|-------|---------------|----------|
| `SIGNED_IN` | User successfully signs in | Redirect to dashboard, track analytics |
| `SIGNED_OUT` | User signs out | Clear app state, redirect to login |
| `TOKEN_REFRESHED` | Access token is refreshed | Update UI with new claims |
| `USER_UPDATED` | User metadata changes | Refresh profile display |
| `PASSWORD_RECOVERY` | Password reset initiated | Show instructions |
| `MFA_CHALLENGE_VERIFIED` | MFA verification complete | Continue auth flow |

### React Hook for Session State

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { session, loading };
}

// Usage:
function MyComponent() {
  const { session, loading } = useSession();

  if (loading) return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;

  return <div>Welcome, {session.user.email}</div>;
}
```

## Session Persistence

### Cookie-Based Persistence (Recommended)

**Default in SSR:** Supabase stores sessions in cookies for Next.js App Router.

**Benefits:**
- Works with Server Components
- Automatic server-side access
- Secure httpOnly cookies (when configured)
- Survives page reloads

**Configuration:**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all cookies
        getAll() {
          return cookieStore.getAll();
        },
        // Set cookies (for session persistence)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handle cookie setting errors
          }
        },
      },
    }
  );
}
```

### Cookie Settings

**Cookie Options** (set automatically by Supabase):

```typescript
{
  name: 'sb-<project-ref>-auth-token',
  maxAge: 604800,           // 7 days (default)
  httpOnly: false,          // Accessible to JavaScript
  secure: true,             // HTTPS only (production)
  sameSite: 'lax',          // CSRF protection
  path: '/',                // Available site-wide
}
```

### Local Storage (Client-Side Only)

**Not Recommended for SSR** but available for client-only apps.

```typescript
// Client-side only configuration
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: window.localStorage, // Use localStorage
        persistSession: true,
      },
    }
  );
}
```

### Checking Session Persistence

```typescript
// Check if session is persisted
async function checkSessionPersistence() {
  const supabase = createClient();

  // Get session from storage
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    console.log('Session found in storage');
    console.log('Expires at:', new Date(session.expires_at! * 1000));

    // Check if it's still valid
    const now = Date.now();
    const expiresAt = session.expires_at! * 1000;
    const isValid = expiresAt > now;

    console.log('Session is', isValid ? 'valid' : 'expired');

    return isValid;
  } else {
    console.log('No session in storage');
    return false;
  }
}
```

## Server-Side Session Management

### Get Session in Server Component

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get session from cookies
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.email}</p>
      <p>Session expires: {new Date(session.expires_at! * 1000).toLocaleString()}</p>
    </div>
  );
}
```

### Get Session in API Route

```typescript
// app/api/protected/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Use the session
  const userId = session.user.id;

  return NextResponse.json({
    userId,
    email: session.user.email,
    expiresAt: session.expires_at,
  });
}
```

### Session in Middleware

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if needed
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check if session is about to expire (within 5 minutes)
  const expiresAt = session.expires_at! * 1000;
  const timeUntilExpiry = expiresAt - Date.now();

  if (timeUntilExpiry < 5 * 60 * 1000) {
    console.log('Session expiring soon, refreshing...');
    await supabase.auth.refreshSession();
  }

  return response;
}
```

## Client-Side Session Management

### Session in Client Component

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

export default function ClientDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <h1>Client Dashboard</h1>
      <p>Email: {session.user.email}</p>
      <p>Session expires: {new Date(session.expires_at! * 1000).toLocaleString()}</p>

      <button onClick={async () => {
        await supabase.auth.refreshSession();
        alert('Session refreshed');
      }}>
        Refresh Session
      </button>

      <button onClick={async () => {
        await supabase.auth.signOut();
      }}>
        Sign Out
      </button>
    </div>
  );
}
```

### Session Timer Component

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SessionTimer() {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function updateTimer() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const now = Date.now();
        const expiresAt = session.expires_at! * 1000;
        const remaining = Math.max(0, expiresAt - now);
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(null);
      }
    }

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [supabase]);

  if (timeRemaining === null) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  const isExpiringSoon = timeRemaining < 5 * 60 * 1000;

  return (
    <div className={isExpiringSoon ? 'text-red-600' : 'text-gray-600'}>
      Session expires in: {minutes}:{seconds.toString().padStart(2, '0')}
      {isExpiringSoon && ' - Please save your work'}
    </div>
  );
}
```

## Session Configuration

### Custom Session Duration

**Configure in Supabase Dashboard:**

1. Go to **Authentication → Policies**
2. Set **JWT expiry limit**: 300 - 604800 seconds
3. Set **Refresh token expiry**: Up to 10 years

**Recommended Settings:**

| App Type | JWT Expiry | Refresh Token Expiry |
|----------|------------|---------------------|
| Admin Dashboard | 604800s (7 days) | 2592000s (30 days) |
| User-Facing App | 3600s (1 hour) | 604800s (7 days) |
| High-Security | 1800s (30 min) | 86400s (1 day) |

### Custom Cookie Settings

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Auto-refresh settings
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // For OAuth/magic link redirects
      },
      cookieOptions: {
        // Custom cookie settings
        name: 'my-app-auth',
        lifetime: 604800,     // 7 days
        domain: 'myapp.com',  // Your domain
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}
```

## Best Practices

### 1. Always Validate Sessions Server-Side

**❌ Don't:** Trust client-side session checks for security

```typescript
// Client component - NOT secure for access control
const { session } = await supabase.auth.getSession();
if (session) {
  // Show sensitive data - BAD!
}
```

**✅ Do:** Validate on the server

```typescript
// Server component - Secure
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser(); // Validates JWT
if (!user) redirect('/login');
```

### 2. Refresh Session After Claim Updates

```typescript
// After admin updates claims in dashboard
async function handleClaimUpdate() {
  const supabase = createClient();

  // Force refresh to get new claims
  await supabase.auth.refreshSession();

  // Now user.app_metadata has updated values
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Updated claims:', user?.app_metadata);
}
```

### 3. Handle Session Expiration Gracefully

```typescript
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function SessionExpirationHandler() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Session expired or user signed out
          alert('Your session has expired. Please sign in again.');
          router.push('/login');
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('Session refreshed successfully');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return null;
}
```

### 4. Use getUser() for Security Checks

```typescript
// ✅ Good: Validates JWT with server
const { data: { user } } = await supabase.auth.getUser();

// ❌ Less secure: Just reads from storage
const { data: { session } } = await supabase.auth.getSession();
```

### 5. Clear Session on Sign Out

```typescript
async function signOut() {
  const supabase = createClient();

  // Sign out and clear session
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    return;
  }

  // Clear any app-specific state
  localStorage.clear();
  sessionStorage.clear();

  // Redirect to login
  window.location.href = '/login';
}
```

### 6. Monitor Session Health

```typescript
async function checkSessionHealth() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { status: 'no_session', healthy: false };
  }

  const now = Date.now();
  const expiresAt = session.expires_at! * 1000;
  const timeUntilExpiry = expiresAt - now;

  return {
    status: timeUntilExpiry > 0 ? 'active' : 'expired',
    healthy: timeUntilExpiry > 5 * 60 * 1000, // At least 5 min remaining
    expiresIn: Math.floor(timeUntilExpiry / 1000),
    expiresAt: new Date(expiresAt),
  };
}
```

## Common Patterns

### Session-Based Redirect

```typescript
// app/page.tsx - Root page that redirects based on session
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // Redirect authenticated users to dashboard
    redirect('/dashboard');
  } else {
    // Redirect unauthenticated users to login
    redirect('/login');
  }
}
```

### Protected API Route

```typescript
// app/api/user/profile/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // Validate session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Fetch user data
  const { data, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (fetchError) {
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
```

### Session Context Provider

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    setSession(session);
    setUser(session?.user ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <SessionContext.Provider value={{ session, user, loading, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return context;
}
```

## Troubleshooting

### Session Not Persisting Across Page Reloads

**Problem:** User is signed out on page refresh

**Solutions:**
1. Check that `persistSession: true` is set
2. Verify cookies are enabled in browser
3. Check cookie settings (domain, path, sameSite)
4. Ensure HTTPS in production
5. Check browser console for cookie errors

```typescript
// Verify persistence is enabled
const supabase = createBrowserClient(url, anonKey, {
  auth: {
    persistSession: true, // Must be true
  },
});
```

### Session Expires Too Quickly

**Problem:** Users are logged out after 1 hour

**Solutions:**
1. Update JWT expiry in Supabase Dashboard (Auth → Policies)
2. Set to 604800 seconds (7 days) for admin dashboards
3. Verify auto-refresh is enabled

**Check Auto-Refresh:**

```typescript
// Should be true (default)
const supabase = createBrowserClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
  },
});
```

### Claims Not Updated After Refresh

**Problem:** Refreshed session still has old claims

**Solutions:**
1. Ensure you're calling `refreshSession()` not `getSession()`
2. Wait a few seconds after admin updates claims
3. Sign out and sign in again as fallback

```typescript
// ✅ Correct: Force refresh
await supabase.auth.refreshSession();

// ❌ Wrong: Just reads from storage
await supabase.auth.getSession();
```

### "Invalid Refresh Token" Error

**Problem:** Refresh token has expired or is invalid

**Solutions:**
1. User must sign in again
2. Increase refresh token expiry in Supabase Dashboard
3. Handle gracefully in UI

```typescript
const { data, error } = await supabase.auth.refreshSession();

if (error?.message.includes('refresh')) {
  // Refresh token expired
  alert('Your session has expired. Please sign in again.');
  router.push('/login');
}
```

### Session Works in Dev but Not Production

**Problem:** Session issues only in production

**Solutions:**
1. Ensure `NEXT_PUBLIC_SUPABASE_URL` is production URL
2. Check cookie secure flag (requires HTTPS)
3. Verify domain settings in cookie configuration
4. Check CORS settings in Supabase Dashboard

```bash
# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
# Should be your production Supabase URL

# Check if HTTPS is enabled
# Cookies require secure flag in production
```

### Session Lost After Deploy

**Problem:** All users signed out after deployment

**Solutions:**
1. This is expected if JWT secret changed
2. Don't rotate Supabase secrets unnecessarily
3. Notify users before rotating secrets
4. Keep same Supabase project (don't migrate mid-session)

## Related Documentation

- [Authentication Guide](/docs/authentication-guide) - Complete auth setup
- [Auth Quick Reference](/docs/auth-quick-reference) - Code snippets
- `docs/SESSION_CONFIGURATION.md` - Session tuning reference (repo file)

---

**Next Steps:**
- Implement session checks in your protected routes
- Set up session listeners for real-time updates
- Configure session duration in Supabase Dashboard
- Test session persistence across page reloads
- Handle session expiration gracefully in your UI

---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
