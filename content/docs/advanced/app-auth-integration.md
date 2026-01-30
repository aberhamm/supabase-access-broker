---
title: "App Authentication Integration Guide"
description: "Advanced integration patterns for authentication"
category: "advanced"
audience: "app-developer"
order: 2
---

# App-Based Authentication Integration Guide

**Context:** This guide is part of the Supabase Access Broker documentation. It provides practical, production-ready patterns for integrating app-based roles and permissions into your authentication flow.

**Scope:** Client app integration with Access Broker claims/roles.
If you're operating the Access Broker portal itself, see [Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys).

**Technology Stack:** Next.js 14+ App Router, Supabase Auth, TypeScript, PostgreSQL

**Prerequisites:**
- Read AUTHENTICATION_GUIDE.md first
- Supabase project with custom claims functions installed
- Understanding of Next.js App Router and Server Components

**What This Guide Covers:** Real-world authentication patterns including self-service sign up, invite systems, multi-tenancy, and more.

**Key Concepts:**
- **Self-Service Sign Up**: Users choose which apps to access during registration
- **Invite-Only**: Users need an invitation code/link to sign up
- **Multi-Tenancy**: Multiple organizations/companies using the same system
- **Organization**: A tenant/company in a multi-tenant system
- **App Access**: Permission to use a specific application (stored as `apps.{app_id}.enabled`)
- **App-Specific Role**: User's role within a particular app
- **Global Claim**: Claim available to all apps (stored at `app_metadata` root)

## Table of Contents

- [Overview](#overview)
- [Architecture Patterns](#architecture-patterns)
- [Self-Service Sign Up](#self-service-sign-up)
- [Invite-Only Sign Up](#invite-only-sign-up)
- [Multi-Tenant Applications](#multi-tenant-applications)
- [Role-Based Onboarding](#role-based-onboarding)
- [Dynamic App Selection](#dynamic-app-selection)
- [API Integration Examples](#api-integration-examples)
- [Real-World Scenarios](#real-world-scenarios)

## Overview

This dashboard supports app-based access control where users can have:
- Access to one or multiple applications
- Different roles in each application
- App-specific permissions and metadata
- Global claims that work across all apps

## Architecture Patterns

### Pattern 1: Single App with Roles

**Use Case:** Simple applications with one product
**Best For:** MVPs, single-product SaaS, simple applications
**Complexity:** Low

**Data Structure Example:**

```typescript
// On sign up, grant access to your single app
{
  "apps": {
    "my-app": {
      "enabled": true,
      "role": "user",
      "subscription_tier": "free"
    }
  }
}
```

### Pattern 2: Multiple Apps, Selective Access

**Use Case:** SaaS platforms with multiple products
**Best For:** Multi-product platforms, feature-based access control
**Complexity:** Medium

**Data Structure Example:**

```typescript
// User has access to some apps but not others
{
  "apps": {
    "analytics": {
      "enabled": true,
      "role": "viewer"
    },
    "crm": {
      "enabled": true,
      "role": "admin"
    },
    "billing": {
      "enabled": false  // No access
    }
  }
}
```

### Pattern 3: Organization-Based Multi-Tenancy

**Use Case:** B2B applications with organizations/tenants
**Best For:** Enterprise B2B, team-based applications
**Complexity:** High

**Data Structure Example:**

```typescript
// User belongs to organization with app access
{
  "organization_id": "org-123",
  "apps": {
    "main-app": {
      "enabled": true,
      "role": "member",
      "team_id": "team-456"
    }
  }
}
```

## Self-Service Sign Up

Allow users to sign up and choose which app(s) they want access to.

### Frontend: App Selection During Sign Up

**Context:** This component allows users to select which applications they want access to during sign up. It's a client component that collects user preferences and communicates with a server API.

**File Location:** `app/signup/page.tsx` (example)

**Flow:**
1. User enters email/password
2. User selects one or more apps
3. Component creates Supabase account
4. Component calls API to grant selected app access
5. User receives confirmation

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Configure your available apps
const AVAILABLE_APPS = [
  { id: 'analytics', name: 'Analytics Dashboard', icon: '📊' },
  { id: 'crm', name: 'CRM System', icon: '👥' },
  { id: 'project-mgmt', name: 'Project Management', icon: '📋' },
];

export default function SignUpWithAppSelection() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const toggleApp = (appId: string) => {
    setSelectedApps((prev) =>
      prev.includes(appId)
        ? prev.filter((id) => id !== appId)
        : [...prev, appId]
    );
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedApps.length === 0) {
      alert('Please select at least one application');
      return;
    }

    setLoading(true);

    try {
      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Grant access to selected apps
        const response = await fetch('/api/setup-user-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            appIds: selectedApps,
          }),
        });

        if (!response.ok) throw new Error('Failed to setup app access');

        alert('Account created! Check your email to confirm.');
        router.push('/check-email');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <h2>Create Your Account</h2>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label>Select Applications</label>
        <div className="space-y-2">
          {AVAILABLE_APPS.map((app) => (
            <label key={app.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedApps.includes(app.id)}
                onChange={() => toggleApp(app.id)}
              />
              <span>{app.icon} {app.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

### Backend: App Setup API Route

**Context:** This Next.js API route handles the server-side app access assignment. It uses the service role key to securely modify user claims.

**File Location:** `app/api/setup-user-apps/route.ts`

**Security:** Uses SUPABASE_SERVICE_ROLE_KEY - only accessible server-side

**What It Does:**
1. Receives userId and array of appIds
2. Validates input
3. For each app: enables access, sets default role, adds permissions
4. Returns success/error response

```typescript
// app/api/setup-user-apps/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, appIds } = await request.json();

    if (!userId || !Array.isArray(appIds)) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Grant access to each selected app
    for (const appId of appIds) {
      // Enable app access
      await supabase.rpc('set_app_claim', {
        uid: userId,
        app_id: appId,
        claim: 'enabled',
        value: true,
      });

      // Set default role (can be customized per app)
      await supabase.rpc('set_app_claim', {
        uid: userId,
        app_id: appId,
        claim: 'role',
        value: 'user',
      });

      // Add default permissions
      await supabase.rpc('set_app_claim', {
        uid: userId,
        app_id: appId,
        claim: 'permissions',
        value: ['read'],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error setting up user apps:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Invite-Only Sign Up

Restrict sign up to users who have been invited by an admin.

### Database: Invites Table

**Context:** This schema creates a database table to manage user invitations. It includes email tracking, expiration, and claim status.

**Run Location:** Supabase SQL Editor

**Schema Features:**
- Tracks who invited whom
- Supports app-specific invites with roles
- Has expiration dates
- Prevents double-claiming
- Includes Row Level Security policies

```sql
-- Create invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  app_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES auth.users(id),
  claimed BOOLEAN DEFAULT FALSE,
  claimed_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins can create invites
CREATE POLICY "Admins can create invites"
  ON public.invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (raw_app_meta_data->>'claims_admin')::boolean = true
        OR (raw_app_meta_data->'apps'->app_id->>'admin')::boolean = true
      )
    )
  );

-- Anyone can view their own invite
CREATE POLICY "Users can view invites for their email"
  ON public.invites
  FOR SELECT
  USING (email = auth.jwt()->>'email' OR invited_by = auth.uid());
```

### Frontend: Invite-Based Sign Up

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';

export default function InviteSignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const inviteId = searchParams.get('invite');

  useEffect(() => {
    // Load invite details
    async function loadInvite() {
      if (!inviteId) return;

      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('id', inviteId)
        .eq('claimed', false)
        .single();

      if (error || !data) {
        alert('Invalid or expired invite');
        router.push('/');
        return;
      }

      // Check if invite is expired
      if (new Date(data.expires_at) < new Date()) {
        alert('This invite has expired');
        router.push('/');
        return;
      }

      setInvite(data);
      setEmail(data.email);
    }

    loadInvite();
  }, [inviteId]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invite) {
      alert('No valid invite found');
      return;
    }

    setLoading(true);

    try {
      // Create account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Claim the invite and set up access
        const response = await fetch('/api/claim-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            inviteId: invite.id,
          }),
        });

        if (!response.ok) throw new Error('Failed to claim invite');

        alert('Account created! You can now sign in.');
        router.push('/login');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!invite) {
    return <div>Loading invite...</div>;
  }

  return (
    <form onSubmit={handleSignUp}>
      <h2>Complete Your Invitation</h2>
      <p>You've been invited to join {invite.app_id} as a {invite.role}</p>

      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          disabled
        />
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Complete Sign Up'}
      </button>
    </form>
  );
}
```

### Backend: Claim Invite API

```typescript
// app/api/claim-invite/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, inviteId } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', inviteId)
      .eq('claimed', false)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid invite' },
        { status: 400 }
      );
    }

    // Set up app access based on invite
    await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: invite.app_id,
      claim: 'enabled',
      value: true,
    });

    await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: invite.app_id,
      claim: 'role',
      value: invite.role,
    });

    // Mark invite as claimed
    await supabase
      .from('invites')
      .update({
        claimed: true,
        claimed_by: userId,
      })
      .eq('id', inviteId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error claiming invite:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Multi-Tenant Applications

Support for organizations with multiple users.

### Database: Organizations Table

```sql
-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add organization_id to user claims
-- This is done via app_metadata, not a table column

-- Function to get user's organization
CREATE OR REPLACE FUNCTION get_user_organization(user_id UUID)
RETURNS UUID AS $$
  SELECT (raw_app_meta_data->>'organization_id')::UUID
  FROM auth.users
  WHERE id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;
```

### Sign Up with Organization Creation

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function OrganizationSignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create organization and assign user
        const response = await fetch('/api/create-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authData.user.id,
            organizationName: orgName,
          }),
        });

        if (!response.ok) throw new Error('Failed to create organization');

        alert('Organization created! Check your email to confirm.');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <h2>Create Your Organization</h2>

      <div>
        <label>Organization Name</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
        />
      </div>

      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={loading}>
        Create Organization
      </button>
    </form>
  );
}
```

### Backend: Organization Creation

```typescript
// app/api/create-organization/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, organizationName } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Set organization_id as global claim
    await supabase.rpc('set_claim', {
      uid: userId,
      claim: 'organization_id',
      value: org.id,
    });

    // Grant access to apps with admin role (org owner)
    await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: 'main-app',
      claim: 'enabled',
      value: true,
    });

    await supabase.rpc('set_app_claim', {
      uid: userId,
      app_id: 'main-app',
      claim: 'role',
      value: 'owner',
    });

    return NextResponse.json({ success: true, organization: org });
  } catch (error: any) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Role-Based Onboarding

Different onboarding flows based on assigned role.

### Post-Login Role Detection

```typescript
// app/onboarding/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminOnboarding from '@/components/onboarding/AdminOnboarding';
import UserOnboarding from '@/components/onboarding/UserOnboarding';

const APP_ID = 'your-app-id';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const appData = user.app_metadata?.apps?.[APP_ID];
  const role = appData?.role;

  // Redirect based on role
  if (role === 'admin' || role === 'owner') {
    return <AdminOnboarding user={user} />;
  } else if (role === 'user') {
    return <UserOnboarding user={user} />;
  } else {
    // No access
    redirect('/access-denied');
  }
}
```

## Dynamic App Selection

Allow users to switch between apps they have access to.

### App Switcher Component

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AppSwitcher() {
  const [apps, setApps] = useState<any[]>([]);
  const [currentApp, setCurrentApp] = useState<string>('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadUserApps() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Get all apps user has access to
      const userApps = user.app_metadata?.apps || {};
      const enabledApps = Object.entries(userApps)
        .filter(([_, data]: [string, any]) => data.enabled === true)
        .map(([id, data]: [string, any]) => ({
          id,
          role: data.role,
        }));

      setApps(enabledApps);

      // Get current app from URL or localStorage
      const savedApp = localStorage.getItem('current_app');
      if (savedApp && enabledApps.some(app => app.id === savedApp)) {
        setCurrentApp(savedApp);
      } else if (enabledApps.length > 0) {
        setCurrentApp(enabledApps[0].id);
      }
    }

    loadUserApps();
  }, []);

  const switchApp = (appId: string) => {
    setCurrentApp(appId);
    localStorage.setItem('current_app', appId);
    // Redirect to app-specific dashboard
    router.push(`/apps/${appId}/dashboard`);
  };

  return (
    <div>
      <label>Select App</label>
      <select
        value={currentApp}
        onChange={(e) => switchApp(e.target.value)}
      >
        {apps.map((app) => (
          <option key={app.id} value={app.id}>
            {app.id} ({app.role})
          </option>
        ))}
      </select>
    </div>
  );
}
```

## API Integration Examples

### REST API with App-Based Auth

```typescript
// app/api/data/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const APP_ID = 'your-app-id';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check app access
  const appData = user.app_metadata?.apps?.[APP_ID];
  if (!appData?.enabled) {
    return NextResponse.json(
      { error: 'No access to this app' },
      { status: 403 }
    );
  }

  // Check role permissions
  const role = appData.role;
  if (role !== 'admin' && role !== 'viewer') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Fetch data based on user's access
  const { data, error } = await supabase
    .from('data_table')
    .select('*')
    .eq('app_id', APP_ID);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
```

## Real-World Scenarios

### Scenario 1: SaaS Platform with Free/Paid Tiers

```typescript
// Sign up with subscription tier
const handleSignUp = async (tier: 'free' | 'pro' | 'enterprise') => {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (data.user) {
    // Set subscription tier
    await fetch('/api/set-subscription', {
      method: 'POST',
      body: JSON.stringify({
        userId: data.user.id,
        tier,
        apps: tier === 'enterprise' ? ['app1', 'app2', 'app3'] : ['app1'],
      }),
    });
  }
};
```

### Scenario 2: Educational Platform with Student/Teacher Roles

```typescript
// Role selection during sign up
const handleEducationSignUp = async (userType: 'student' | 'teacher') => {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (data.user) {
    const apps = userType === 'teacher'
      ? ['classroom', 'grading', 'analytics']
      : ['classroom', 'assignments'];

    await fetch('/api/setup-education-user', {
      method: 'POST',
      body: JSON.stringify({
        userId: data.user.id,
        userType,
        apps,
      }),
    });
  }
};
```

### Scenario 3: Enterprise with Department-Based Access

```typescript
// Department selection during onboarding
const handleEnterpriseSignUp = async (department: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (data.user) {
    // Map departments to apps
    const departmentApps = {
      'sales': ['crm', 'analytics'],
      'marketing': ['analytics', 'campaigns'],
      'engineering': ['project-mgmt', 'code-review'],
      'hr': ['hr-portal', 'recruitment'],
    };

    await fetch('/api/setup-enterprise-user', {
      method: 'POST',
      body: JSON.stringify({
        userId: data.user.id,
        department,
        apps: departmentApps[department as keyof typeof departmentApps],
      }),
    });
  }
};
```

## Best Practices

1. **Always Validate on the Server**
   - Never trust client-side role checks
   - Verify permissions in API routes and server components

2. **Use Middleware for Route Protection**
   - Check app access at the middleware level
   - Redirect unauthorized users early

3. **Implement Proper Error Handling**
   - Show clear error messages
   - Log failures for debugging

4. **Keep Claims Small**
   - Don't store large objects in claims
   - Use references (IDs) instead of full objects

5. **Refresh Sessions After Changes**
   - Call `refreshSession()` after claim updates
   - Or force re-login for immediate effect

6. **Document Your Permission Model**
   - Document what each role can do
   - Keep role names consistent

## Related Documentation

- [AUTHENTICATION_GUIDE.md](/docs/authentication-guide) - Basic auth setup
- [MULTI_APP_GUIDE.md](/docs/multi-app-guide) - Multi-app architecture
- [CLAIMS_GUIDE.md](/docs/claims-guide) - Custom claims overview

## Next Steps

1. Choose an architecture pattern that fits your needs
2. Implement sign up flow with role assignment
3. Add middleware for route protection
4. Test different user scenarios
5. Monitor and refine permissions as needed

---

## What's Next

- **Multi-app architecture:** [/docs/multi-app-guide](/docs/multi-app-guide)
- **Claims:** [/docs/claims-guide](/docs/claims-guide)
- **Roles:** [/docs/role-management-guide](/docs/role-management-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
