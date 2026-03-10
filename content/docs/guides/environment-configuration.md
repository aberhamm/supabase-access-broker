---
title: 'Environment Variables & Deployment'
description: 'Complete guide to environment configuration for development and production'
category: 'guides'
audience: 'dashboard-admin'
order: 10
---

# Environment Variables & Deployment Guide

**Context:** This guide covers all environment variables needed for Access Broker, with special focus on authentication redirects and production deployment.

**Critical for Production:** Improper environment configuration is the #1 cause of auth issues in production. Follow this guide carefully.

## Table of Contents

- [Overview](#overview)
- [Required Environment Variables](#required-environment-variables)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Docker Deployment](#docker-deployment)
- [Supabase Configuration](#supabase-configuration)
- [Common Issues](#common-issues)
- [Platform-Specific Guides](#platform-specific-guides)

## Overview

The dashboard requires different environment variables depending on where it's running:

| Environment | Required Variables | Optional Variables |
| --- | --- | --- |
| **Development** | `NEXT_PUBLIC_SUPABASE_URL`<br>`NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>`SUPABASE_SERVICE_ROLE_KEY` | `NEXT_PUBLIC_APP_URL` (auto-detects localhost) |
| **Production** | All development vars<br>**+ `NEXT_PUBLIC_APP_URL`** | `PORT`, `HOSTNAME` |

## Required Environment Variables

### Core Supabase Variables

#### `NEXT_PUBLIC_SUPABASE_URL`

- **Required:** Yes (all environments)
- **Type:** Public (client-side accessible)
- **Description:** Your Supabase project URL
- **Example:** `https://your-project.supabase.co`
- **Where to find:** Supabase Dashboard → Settings → API → Project URL

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- **Required:** Yes (all environments)
- **Type:** Public (client-side accessible)
- **Description:** Supabase anonymous/public key
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find:** Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

#### `SUPABASE_SERVICE_ROLE_KEY`

- **Required:** Yes (all environments)
- **Type:** Secret (server-side only)
- **Description:** Supabase service role key with admin privileges
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find:** Supabase Dashboard → Settings → API → Project API keys → `service_role`
- **⚠️ Security:** Never expose this key to clients. Used server-side only for admin operations.

### Auth Redirect Variable (Critical for Production)

#### `NEXT_PUBLIC_APP_URL`

- **Required:** **YES for Production** (optional for development)
- **Type:** Public (client-side accessible)
- **Description:** The full URL where your app is accessible
- **Why it's critical:** Without this, magic links and password reset emails will redirect to `localhost` or internal addresses like `0.0.0.0`
- **Examples:**
  - Development: `http://localhost:3050` (auto-detected)
  - Production: `https://admin.yourdomain.com`
  - Docker local: `http://localhost:3050`

**Common Production Values:**

```bash
# Vercel
NEXT_PUBLIC_APP_URL=https://access-broker.vercel.app

# Custom domain
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# Docker with nginx
NEXT_PUBLIC_APP_URL=https://auth.company.com

# Internal network
NEXT_PUBLIC_APP_URL=https://access-broker.home.arpa
```

### Optional Variables

#### `NEXT_PUBLIC_AUTH_PORTAL_URL`

- **Default:** Falls back to `NEXT_PUBLIC_APP_URL`
- **Type:** Public (client-side accessible)
- **Description:** The public-facing URL of the auth portal for SSO integrations
- **When to use:** Set this if the auth portal should be accessed via a different URL than the app itself (e.g., behind a reverse proxy with a dedicated `auth.` subdomain)
- **Examples:**
  - `https://access-broker.yourdomain.com` (dedicated auth subdomain)
  - `https://sso.company.com` (company SSO portal)
- **Where it's used:** Displayed on the SSO Settings page for external apps to use

#### `PORT`

- **Default:** `3050` (development), `3050` (Docker)
- **Description:** Port the app runs on

#### `HOSTNAME`

- **Default:** `localhost` (development), `0.0.0.0` (Docker)
- **Description:** Hostname to bind to

#### `NODE_ENV`

- **Default:** `development`
- **Production:** Set to `production`
- **Description:** Node environment mode

## Development Setup

### Local Development (.env.local)

Create `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Only needed if localhost auto-detection doesn't work
# NEXT_PUBLIC_APP_URL=http://localhost:3050

# Optional: Auth portal feature flags (default OFF; enable as you test)
NEXT_PUBLIC_AUTH_PASSKEYS=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
NEXT_PUBLIC_AUTH_EMAIL_OTP=false
NEXT_PUBLIC_AUTH_PASSWORD=false
NEXT_PUBLIC_AUTH_MAGIC_LINK=true

# Optional: Passkeys configuration
# - In production, NEXT_PUBLIC_APP_URL should be HTTPS
# - Passkeys (WebAuthn) are bound to an RP ID / origin
# NEXT_PUBLIC_AUTH_PASSKEY_RP_ID=access-broker.yourdomain.com
```

### Start Development Server

```bash
pnpm dev
```

The app will run on `http://localhost:3050` by default.

### Development with Custom Port

```bash
# Run on different port
PORT=3001 pnpm dev

# Set in .env.local
PORT=3001
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Production Setup

### Production Environment File (.env.production)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CRITICAL: Set your production domain
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# Node Configuration
NODE_ENV=production
PORT=3050
HOSTNAME=0.0.0.0
```

### Build for Production

```bash
# Build with environment variables
pnpm build

# Start production server
pnpm start
```

## Docker Deployment

### Docker Environment Setup

**File:** `.env` (for docker-compose)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CRITICAL: Set your actual domain or localhost for testing
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# These are set in docker-compose.yml
# PORT=3050
# HOSTNAME=0.0.0.0
# NODE_ENV=production
```

### Docker Compose

The `docker-compose.yml` is already configured to use environment variables:

```yaml
services:
  app:
    build:
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
    environment:
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      # ... other variables
```

### Deploy with Docker

```bash
# 1. Create/update .env file with your values
nano .env

# 2. Build containers
docker-compose build --no-cache

# 3. Start containers
docker-compose up -d

# 4. View logs
docker-compose logs -f app

# 5. Test
curl http://localhost:3050/api/health
```

### Docker Production with Nginx

For production with nginx reverse proxy:

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

See `DOCKER_DEPLOYMENT.md` (repo file) for the complete Docker guide.

## Supabase Configuration

### Required: Configure Redirect URLs

**Critical:** You must whitelist your redirect URLs in Supabase for magic links to work.

#### Steps:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to: **Authentication → URL Configuration**

#### Configure Site URL

Set your primary domain:

```
Site URL: https://admin.yourdomain.com
```

#### Configure Redirect URLs

Add **ALL** environments where your app runs:

**Development:**

```
http://localhost:3050/auth/callback
http://localhost:3050/**
```

**Docker Local:**

```
http://localhost:3050/auth/callback
http://localhost:3050/**
```

**Production:**

```
https://admin.yourdomain.com/auth/callback
https://admin.yourdomain.com/**
```

**Multiple Environments Example:**

```
✅ http://localhost:3050/**
✅ http://localhost:3050/**
✅ https://staging.yourdomain.com/**
✅ https://admin.yourdomain.com/**
```

### Auth Portal (SSO) configuration (this repo)

If you're using this dashboard as a central **auth portal** for other apps:

- **Database migration**: apply `migrations/007_auth_and_passkeys.sql`
- **Register allowed callback URLs** per app: `public.apps.allowed_callback_urls`
- (Optional) require an app secret by setting: `public.apps.sso_client_secret_hash`
- (Optional) set `NEXT_PUBLIC_AUTH_PORTAL_URL` if external apps should use a different URL than `NEXT_PUBLIC_APP_URL` (e.g., `https://access-broker.yourdomain.com`)

See: **[Auth Portal (SSO + Passkeys)](/docs/auth-portal-sso-passkeys)**.

### Why Wildcards (`/**`) Are Important

The `/**` pattern allows Supabase to redirect to any path on your domain after authentication, including:

- `/auth/callback?next=/users` - redirect to specific page
- `/auth/callback?next=/apps/123` - deep linking
- `/` - home page

Without the wildcard, only exact matches work.

## Common Issues

### Issue 1: Magic Link Redirects to Localhost in Production

**Symptom:** Email link shows correct domain but redirects to `http://localhost:3050` or `https://0.0.0.0:3050`

**Cause:** `NEXT_PUBLIC_APP_URL` not set

**Fix:**

```env
# Add to production environment
NEXT_PUBLIC_APP_URL=https://your-actual-domain.com
```

**For Docker:**

```bash
# Add to .env file
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Issue 2: "Invalid Redirect URL" Error

**Symptom:** After clicking magic link: `error=access_denied&error_code=invalid_redirect_url`

**Cause:** Redirect URL not whitelisted in Supabase

**Fix:**

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your domain to Redirect URLs:
   ```
   https://your-domain.com/auth/callback
   https://your-domain.com/**
   ```
3. Request a new magic link (old ones won't work)

### Issue 3: "OTP Expired" Error

**Symptom:** `error=access_denied&error_code=otp_expired`

**Causes:**

1. Link was clicked after expiration (default: 1 hour)
2. Incorrect redirect URL caused Supabase to reject it
3. User clicked an old link after requesting a new one

**Fix:**

1. Verify `NEXT_PUBLIC_APP_URL` is correct
2. Verify redirect URLs in Supabase
3. Request a fresh magic link
4. Click the link within 1 hour

### Issue 4: Environment Variables Not Working

**Symptom:** App still uses old values after updating `.env`

**Fixes:**

**Development:**

```bash
# Restart dev server
# Stop (Ctrl+C) then:
pnpm dev
```

**Docker:**

```bash
# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Production Build:**

```bash
# Rebuild app
pnpm build
pnpm start
```

**Vercel/Cloud:**

- Update environment variables in platform dashboard
- Trigger new deployment

### Issue 5: Different URLs for Different Environments

**Solution:** Use environment-specific files:

```bash
# Development
.env.local (or .env.development)

# Production
.env.production

# Docker
.env
```

Each can have different `NEXT_PUBLIC_APP_URL`:

```env
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3050

# .env.production
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com

# .env (Docker)
NEXT_PUBLIC_APP_URL=http://localhost:3050
```

## Platform-Specific Guides

### Vercel Deployment

1. **Add Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add all required variables
   - Set `NEXT_PUBLIC_APP_URL` to your Vercel URL or custom domain

2. **Example:**

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (Secret)
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

3. **Redeploy** after adding variables

4. **Update Supabase** redirect URLs:
   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app/**
   ```

### AWS/DigitalOcean/VPS

1. **Set environment variables** in your deployment config:

   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="https://..."
   export NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   export SUPABASE_SERVICE_ROLE_KEY="..."
   export NEXT_PUBLIC_APP_URL="https://your-domain.com"
   ```

2. **Or use a .env.production file:**

   ```bash
   # Copy to server
   scp .env.production user@server:/app/.env.production

   # Build and start
   pnpm build
   pnpm start
   ```

3. **Update Supabase** with your server's domain

### Kubernetes

Use ConfigMaps and Secrets:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: access-broker-config
data:
  NEXT_PUBLIC_SUPABASE_URL: 'https://your-project.supabase.co'
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'your-anon-key'
  NEXT_PUBLIC_APP_URL: 'https://admin.yourdomain.com'

---
apiVersion: v1
kind: Secret
metadata:
  name: access-broker-secrets
type: Opaque
stringData:
  SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key'
```

## Verification Checklist

Before deploying to production:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set correctly
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set and kept secret
- [ ] **`NEXT_PUBLIC_APP_URL` is set to your production domain**
- [ ] All redirect URLs are added to Supabase Dashboard
- [ ] Site URL is set in Supabase Dashboard
- [ ] Magic link tested in production
- [ ] Password reset tested (if using password auth)
- [ ] Environment variables are not committed to git

## Security Best Practices

### DO ✅

- Use `.env.local` for development (not committed to git)
- Use `.env.production` for production (not committed to git)
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret
- Use environment variables in CI/CD (GitHub Secrets, etc.)
- Rotate keys if exposed
- Use different Supabase projects for dev/staging/prod

### DON'T ❌

- Don't commit `.env` files to git
- Don't expose `SUPABASE_SERVICE_ROLE_KEY` to clients
- Don't use development keys in production
- Don't share keys in Slack/email/screenshots
- Don't use the same keys across multiple apps

## Related Documentation

- [Authentication Guide](/docs/authentication-guide) - Complete auth setup
- [Session Management](/docs/session-management) - Session handling
- `DOCKER_DEPLOYMENT.md` - Docker guide (repo file)
- `README.md` - Main repository documentation (repo file)

## Quick Reference

### Minimal Development Setup

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Minimal Production Setup

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com  # REQUIRED!
NODE_ENV=production
```

### Minimal Docker Setup

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.com  # or http://localhost:3050
```

---

**Next Steps:**

- Set up your environment variables
- Configure Supabase redirect URLs
- Test magic link authentication
- Deploy to production with confidence

---

## What's Next

- **Quick start:** [/docs/quick-start](/docs/quick-start)
- **Auth setup:** [/docs/authentication-guide](/docs/authentication-guide)
- **SSO integration:** [/docs/sso-integration-guide](/docs/sso-integration-guide)
- **Logout:** [/docs/logout-guide](/docs/logout-guide)
