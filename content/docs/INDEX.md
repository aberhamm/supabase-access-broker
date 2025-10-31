---
title: "Documentation Index"
description: "Complete guide to integrating Supabase custom claims"
category: "overview"
audience: "all"
order: 0
---

# Supabase Custom Claims - Documentation Index

Welcome to the Supabase Custom Claims documentation. This system allows you to add flexible authorization (roles, permissions, attributes) to your Supabase applications.

**Primary Focus:** Integrating custom claims into YOUR applications
**Secondary:** Managing claims via the admin dashboard

## 🎯 Quick Navigation

### I want to...

- **Understand what custom claims are** → [Claims Guide](./core/claims-guide.md) ⭐ **START HERE**
- **Integrate claims into my app** → [Complete Integration Guide](./integration/complete-integration-guide.md)
- **Implement authentication** → [Authentication Guide](./integration/authentication-guide.md)
- **Add role-based access control** → [Authorization Patterns](./integration/authorization-patterns.md)
- **Deploy to production** → [Environment Configuration](./integration/environment-configuration.md)
- **Get copy-paste code examples** → [Auth Quick Reference](./integration/auth-quick-reference.md)
- **Manage user sessions** → [Session Management](./integration/session-management.md)
- **Set up the admin dashboard** → [Dashboard Quick Start](./dashboard/quick-start.md)
- **Fix auth redirect issues** → [Environment Configuration - Troubleshooting](./integration/environment-configuration.md#common-issues)

## 📚 Documentation by Category

### Core Concepts (Start Here)

**Understanding the custom claims system**

| Guide | Description | Audience |
|-------|-------------|----------|
| **[Claims Guide](./core/claims-guide.md)** ⭐ | What are custom claims and how they work | **Everyone - Start Here** |
| [Multi-App Guide](./core/multi-app-guide.md) | Multi-application architecture | All |

### Integration Guides (For Your Applications)

**How to integrate custom claims into YOUR apps**

#### Essential Guides (Read in Order)

| # | Guide | Description | Why Read |
|---|-------|-------------|----------|
| 1 | **[Complete Integration Guide](./integration/complete-integration-guide.md)** ⭐ | **Full walkthrough** of integrating claims | Your main implementation guide |
| 2 | [Authentication Guide](./integration/authentication-guide.md) | Complete auth setup for your apps | Implementing sign-up/sign-in |
| 3 | [Authorization Patterns](./integration/authorization-patterns.md) | Role-based access control patterns | Implementing permissions |
| 4 | [Session Management](./integration/session-management.md) | Managing user sessions | Working with sessions |
| 5 | [Environment Configuration](./integration/environment-configuration.md) | Environment variables & deployment | Before deploying to production |

#### Authentication Methods

| Guide | Description | When to Read |
|-------|-------------|--------------|
| [Passwordless Auth](./integration/passwordless-auth.md) | Magic link authentication | Implementing magic links |
| [Password Auth](./integration/password-auth.md) | Password-based authentication | Implementing passwords |
| [Auth Quick Reference](./integration/auth-quick-reference.md) | Copy-paste code snippets | Quick lookups |

#### Advanced Topics

| Guide | Description | When to Read |
|-------|-------------|--------------|
| [Authorization Patterns](./integration/authorization-patterns.md) | Role-based access control patterns | Implementing permissions |
| [RLS Policies](./integration/rls-policies.md) | Row Level Security with claims | Database security |
| [API Keys Guide](./integration/api-keys-guide.md) | Managing API keys | Server-to-server auth |
| [App Auth Integration](./integration/app-auth-integration.md) | Integrating apps with the system | Multi-app setup |

### Dashboard Administration (Optional)

**For people running the admin dashboard to manage claims**

| Guide | Description | Audience |
|-------|-------------|----------|
| [Dashboard Quick Start](./dashboard/quick-start.md) | Get the dashboard running | Dashboard Admins |
| [Dashboard Setup Guide](./dashboard/setup.md) | Detailed setup instructions | Dashboard Admins |

## 🚀 Getting Started Paths

### Path 1: Application Developer (Most Common) ⭐

**Goal:** Integrate custom claims into your Supabase app

1. **[Claims Guide](./core/claims-guide.md)** - Understand what claims are and why they're useful
2. **[Complete Integration Guide](./integration/complete-integration-guide.md)** - Step-by-step implementation in your app
3. **[Authentication Guide](./integration/authentication-guide.md)** - Implement sign-up/sign-in with claims
4. **[Authorization Patterns](./integration/authorization-patterns.md)** - Implement role-based access control
5. **[Session Management](./integration/session-management.md)** - Handle user sessions properly
6. **[Environment Configuration](./integration/environment-configuration.md)** - Deploy to production

**Time estimate:** 2-4 hours for basic integration

### Path 2: Quick Implementation

**Goal:** Get claims working in your app ASAP

1. Install SQL functions (see main [README](../../README.md))
2. Use [Auth Quick Reference](./integration/auth-quick-reference.md) for copy-paste code
3. Read [Authorization Patterns](./integration/authorization-patterns.md) for access control
4. Deploy using [Environment Configuration](./integration/environment-configuration.md)

**Time estimate:** 30-60 minutes for basic setup

### Path 3: Dashboard Administrator

**Goal:** Set up the admin dashboard to manage users/claims

1. [Dashboard Quick Start](./dashboard/quick-start.md) - Get dashboard running
2. [Dashboard Setup Guide](./dashboard/setup.md) - Detailed configuration
3. [Environment Configuration](./integration/environment-configuration.md) - Production deployment

**Time estimate:** 15-30 minutes

### Path 4: DevOps/Deployment

**Goal:** Deploy the dashboard or your app to production

1. **[Environment Configuration](./integration/environment-configuration.md)** - **Critical: Read this**
2. [Docker Deployment](../../DOCKER_DEPLOYMENT.md) - Docker setup (if using Docker)
3. [Session Configuration](../../docs/SESSION_CONFIGURATION.md) - Session tuning

**Time estimate:** 1-2 hours

## 🔧 Troubleshooting Guides

### Common Issues

| Issue | Solution |
|-------|----------|
| Magic links redirect to localhost | [Environment Configuration - Issue 1](./integration/environment-configuration.md#issue-1-magic-link-redirects-to-localhost-in-production) |
| Invalid redirect URL error | [Environment Configuration - Issue 2](./integration/environment-configuration.md#issue-2-invalid-redirect-url-error) |
| OTP expired error | [Environment Configuration - Issue 3](./integration/environment-configuration.md#issue-3-otp-expired-error) |
| Session not persisting | [Session Management - Troubleshooting](./integration/session-management.md#troubleshooting) |
| Access denied on login | [Setup Guide - Troubleshooting](./dashboard/setup.md#troubleshooting) |

## 📖 By Use Case

### Use Case 1: Adding Auth to a New App ⭐

**Most common scenario**

1. [Claims Guide](./core/claims-guide.md) - Understand the foundation
2. Install SQL functions (see [README](../../README.md#installation-for-your-supabase-project))
3. [Complete Integration Guide](./integration/complete-integration-guide.md) - Implement step-by-step
4. [Authentication Guide](./integration/authentication-guide.md) - Add sign-up/sign-in
5. [Authorization Patterns](./integration/authorization-patterns.md) - Add permissions
6. [Environment Configuration](./integration/environment-configuration.md) - Deploy

### Use Case 2: Adding Claims to Existing App

**You already have Supabase auth, want to add claims**

1. [Claims Guide](./core/claims-guide.md) - Understand what you're adding
2. Install SQL functions (see [README](../../README.md#installation-for-your-supabase-project))
3. [Authorization Patterns](./integration/authorization-patterns.md) - Implement patterns
4. [Session Management](./integration/session-management.md) - Update session handling
5. [Auth Quick Reference](./integration/auth-quick-reference.md) - Code examples

### Use Case 3: Multi-App Setup

**One Supabase project, multiple applications**

1. [Multi-App Guide](./core/multi-app-guide.md) - Architecture overview
2. [Complete Integration Guide](./integration/complete-integration-guide.md) - Per-app integration
3. [Authorization Patterns](./integration/authorization-patterns.md) - Cross-app patterns
4. [API Keys Guide](./integration/api-keys-guide.md) - Server-to-server communication

### Use Case 4: Deploying to Production

**Your app is ready, time to deploy**

1. **[Environment Configuration](./integration/environment-configuration.md)** - **Critical - start here**
2. [Session Configuration](../../docs/SESSION_CONFIGURATION.md) - Tune sessions
3. [Docker Deployment](../../DOCKER_DEPLOYMENT.md) - If using Docker
4. [RLS Policies](./integration/rls-policies.md) - Secure your database

### Implementing Specific Features

**Magic Link Authentication:**
- [Passwordless Auth Guide](./integration/passwordless-auth.md)
- [Auth Quick Reference](./integration/auth-quick-reference.md)

**Password Authentication:**
- [Password Auth Guide](./integration/password-auth.md)
- [Auth Quick Reference](./integration/auth-quick-reference.md)

**Role-Based Access Control:**
- [Authorization Patterns](./integration/authorization-patterns.md)
- [Claims Guide](./core/claims-guide.md)

**API Key Management:**
- [API Keys Guide](./integration/api-keys-guide.md)

**Database Security:**
- [RLS Policies](./integration/rls-policies.md)

## 🎓 Learning Order

### Beginner (New to Custom Claims)

**Goal:** Understand the system and get it working

1. **[Claims Guide](./core/claims-guide.md)** ⭐ - What are custom claims? Why use them?
2. **[Complete Integration Guide](./integration/complete-integration-guide.md)** - Implement in your app
3. [Authentication Guide](./integration/authentication-guide.md) - Add auth to your app
4. [Auth Quick Reference](./integration/auth-quick-reference.md) - Copy-paste examples

**Outcome:** Working app with basic claims-based auth

### Intermediate (Building Production Apps)

**Goal:** Implement robust authorization and deploy

1. [Authorization Patterns](./integration/authorization-patterns.md) - Role-based access control
2. [Multi-App Guide](./core/multi-app-guide.md) - Multi-app architecture
3. [Session Management](./integration/session-management.md) - Session handling
4. **[Environment Configuration](./integration/environment-configuration.md)** - Production deployment
5. [RLS Policies](./integration/rls-policies.md) - Database security

**Outcome:** Production-ready app with proper authorization

### Advanced (Optimization & Integration)

**Goal:** Advanced patterns and integrations

1. [API Keys Guide](./integration/api-keys-guide.md) - Server-to-server auth
2. [RLS Policies](./integration/rls-policies.md) - Advanced database security
3. [External API Contract](../../docs/EXTERNAL_API_CONTRACT.md) - Direct RPC usage
4. [Docker Deployment](../../DOCKER_DEPLOYMENT.md) - Container deployment

**Outcome:** Optimized, scalable authorization system

## 🔍 Quick Reference Cards

### Environment Variables

See: [Environment Configuration - Quick Reference](./integration/environment-configuration.md#quick-reference)

**Development:**
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Production (add):**
```env
NEXT_PUBLIC_APP_URL=https://your-domain.com  # REQUIRED!
```

### Auth Code Snippets

See: [Auth Quick Reference](./integration/auth-quick-reference.md)

### Session Management

See: [Session Management - Common Patterns](./integration/session-management.md#common-patterns)

## 📋 Documentation Checklist

### Before Integrating Claims into Your App

- [ ] Read [Claims Guide](./core/claims-guide.md) - Understand the concept
- [ ] Install SQL functions in your Supabase project
- [ ] Read [Complete Integration Guide](./integration/complete-integration-guide.md)
- [ ] Choose auth method ([Passwordless](./integration/passwordless-auth.md) or [Password](./integration/password-auth.md))
- [ ] Implement basic auth following [Authentication Guide](./integration/authentication-guide.md)
- [ ] Add authorization using [Authorization Patterns](./integration/authorization-patterns.md)
- [ ] Test with real users

### Before Production Deploy

- [ ] Read [Environment Configuration](./integration/environment-configuration.md) - **Critical**
- [ ] Set `NEXT_PUBLIC_APP_URL` environment variable
- [ ] Configure Supabase redirect URLs (add your domain)
- [ ] Test magic link authentication in production
- [ ] Review [Session Configuration](../../docs/SESSION_CONFIGURATION.md)
- [ ] Test all authorization patterns work
- [ ] Set up RLS policies ([RLS Policies Guide](./integration/rls-policies.md))

### Before Deploying Admin Dashboard (Optional)

- [ ] Read [Dashboard Quick Start](./dashboard/quick-start.md)
- [ ] Configure environment variables
- [ ] Grant yourself `claims_admin` access
- [ ] Test dashboard locally
- [ ] Deploy using [Environment Configuration](./integration/environment-configuration.md) guide

## 🆘 Still Stuck?

1. **Check the troubleshooting section** in the relevant guide
2. **Review [Environment Configuration - Common Issues](./integration/environment-configuration.md#common-issues)**
3. **Check the [README](../../README.md)** for general information
4. **Review logs** in your deployment platform
5. **Check Supabase logs** in the Supabase Dashboard

## 📝 Documentation Maintenance

This documentation is organized by:
- **Audience:** Dashboard admins vs. app developers
- **Experience level:** Quick start vs. complete guides
- **Use case:** Setup vs. integration vs. deployment

All guides include:
- Table of contents
- Code examples
- Troubleshooting sections
- Cross-references to related guides

---

**Last Updated:** 2025-10-31

**Contribution:** Found an issue or want to improve the docs? Submit a PR or open an issue.
