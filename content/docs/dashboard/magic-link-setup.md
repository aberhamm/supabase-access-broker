---
title: "Magic Link Authentication Setup"
description: "Complete guide to implementing magic link authentication"
category: "dashboard"
audience: "admin"
order: 3
---

# Magic Link Authentication Setup

This guide shows you how to implement magic link (passwordless) authentication using Supabase Auth.

## Overview

Magic links allow users to sign in by clicking a link sent to their email. This eliminates the need for passwords and provides a better user experience.

## How It Works

1. User enters their email address
2. `signInWithOtp()` sends a magic link email
3. User clicks the link in their email
4. Supabase exchanges the auth code for a session
5. User is redirected to your app (authenticated)

## Security Considerations

### Admin Dashboards vs User Apps

**Admin Dashboards** should use `shouldCreateUser: false` to prevent unauthorized access:
- Only existing users can request magic links
- New users must be created by administrators
- Prevents self-registration to admin interfaces

**User-Facing Apps** can use `shouldCreateUser: true` to allow sign-ups:
- New users can self-register
- Appropriate for public-facing applications
- Still control access via claims/roles

## Implementation

### 1. Client Configuration

Create `lib/supabase/client.ts` with **default Supabase configuration**:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Use Supabase defaults - no custom configuration needed
  return createBrowserClient(supabaseUrl, supabaseKey);
}
```

**Important:** Don't override `flowType` or `detectSessionInUrl`. Supabase SSR handles PKCE automatically.

### 2. Login Page (Admin Dashboard)

For admin dashboards where only existing users should login:

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false, // Security: Only existing users
        },
      });

      if (error) throw error;

      toast.success('Check your email for the magic link!');
    } catch (error) {
      const err = error as { message?: string };
      const errorMessage = err.message || '';

      // Provide helpful error messages
      if (errorMessage.toLowerCase().includes('user not found')) {
        toast.error('This email is not registered. Contact an administrator.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold">Admin Login</h2>
          <p className="text-gray-600">
            Sign in with your email to access the dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={loading}
              required
              className="mt-1 block w-full rounded-md border px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-md py-2 px-4 hover:bg-blue-700"
          >
            {loading ? 'Sending magic link...' : 'Send magic link'}
          </button>
        </form>

        <div className="space-y-1">
          <p className="text-sm text-gray-600 text-center">
            Only existing users with admin access can sign in
          </p>
          <p className="text-xs text-gray-500 text-center">
            New users must be created by an administrator
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 3. Login Page (User-Facing App)

For apps where new users can self-register:

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function UserLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true, // Allow new user creation
        },
      });

      if (error) throw error;

      toast.success('Check your email for the magic link!');
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {/* ... form UI ... */}
    </form>
  );
}
```

### 4. Auth Callback Route (Required)

Create `app/auth/callback/route.ts`:

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
      // Optional: Check user has required access
      const { data: { user } } = await supabase.auth.getUser();
      const isAdmin = user?.app_metadata?.claims_admin === true;

      if (!isAdmin) {
        return NextResponse.redirect(new URL('/access-denied', requestUrl.origin));
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
```

## Creating Admin Users

Since admin dashboards use `shouldCreateUser: false`, you must manually create the first admin user:

### Step 1: Create User in Supabase

1. Open Supabase Dashboard
2. Go to **Authentication** → **Users**
3. Click **Add User**
4. Enter email and generate password
5. Copy the user ID

### Step 2: Grant Admin Access

Run this in Supabase SQL Editor:

```sql
-- Replace with your user ID
SELECT set_claim('USER-ID-HERE', 'claims_admin', 'true');
```

### Step 3: Test Login

1. Go to your login page
2. Enter the email address
3. Check email for magic link
4. Click link to sign in

## Supabase Dashboard Configuration

### URL Configuration

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (dev) or `https://yourdomain.com` (prod)
3. Add to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://yourdomain.com/auth/callback` (prod)

### Email Templates (Optional)

Customize the magic link email:

1. Go to **Authentication** → **Email Templates**
2. Select **Magic Link**
3. Customize the email content

Default template works fine - no changes needed!

## Common Issues

### "User not found" Error

**Cause:** `shouldCreateUser: false` and email not registered

**Solution:** Create user in Supabase Dashboard first

### Magic Link Not Working

**Cause:** Callback URL not in allowed redirect URLs

**Solution:** Add callback URL to Supabase → Authentication → URL Configuration

### Session Not Persisting

**Cause:** Missing callback route or incorrect implementation

**Solution:** Ensure `app/auth/callback/route.ts` exists and calls `exchangeCodeForSession()`

### "Code verifier" Error

**Cause:** Custom `flowType` configuration interfering with PKCE

**Solution:** Remove any custom `flowType` config - use Supabase defaults

## Best Practices

1. ✅ **Use Supabase defaults** - Don't override `flowType` or `detectSessionInUrl`
2. ✅ **Admin dashboards** - Set `shouldCreateUser: false` for security
3. ✅ **User apps** - Set `shouldCreateUser: true` for convenience
4. ✅ **Error handling** - Provide clear messages for unregistered emails
5. ✅ **Callback route** - Always implement server-side callback handler
6. ✅ **URL configuration** - Add all callback URLs to Supabase settings

## Security Notes

- Magic links expire after 1 hour (Supabase default)
- Each magic link can only be used once
- Rate limit: 1 magic link per 60 seconds per email (configurable in Supabase)
- `shouldCreateUser: false` prevents unauthorized user creation
- Session tokens stored in httpOnly cookies (secure)

## Next Steps

- [Setup Guide](./setup.md) - Complete dashboard setup
- [Authentication Guide](../integration/authentication-guide.md) - Full auth patterns
- [Claims Guide](../core/claims-guide.md) - Understanding custom claims
