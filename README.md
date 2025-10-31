# Supabase Custom Claims System

**A complete system for implementing flexible, scalable user authorization in your Supabase applications.**

## What This Is

This project provides:

1. **Custom Claims System** - Add flexible user attributes (roles, permissions, metadata) to your Supabase users that are embedded in JWT tokens for high-performance authorization
2. **Admin Dashboard** - A Next.js application to manage users and their claims
3. **Integration Guides** - Complete documentation for implementing claims-based authorization in YOUR applications

## Why Use Custom Claims?

✅ **High Performance** - Claims are in the JWT token, no database queries needed
✅ **Flexible Authorization** - Define any roles, permissions, or attributes you need
✅ **Multi-App Support** - One user can have different roles in different apps
✅ **Works with RLS** - Integrate with Supabase Row Level Security policies
✅ **Type-Safe** - Full TypeScript support

## Quick Start for Implementers

**Want to add claims to YOUR application?**

1. **Understand Claims:** Read the [Claims Guide](./content/docs/core/claims-guide.md)
2. **Set Up the System:** Install the SQL functions (see below)
3. **Integrate into Your App:** Follow the [Integration Guide](./content/docs/integration/complete-integration-guide.md)
4. **Optional:** Deploy the admin dashboard to manage claims

## For Application Developers

**📚 [Start Here: Complete Integration Guide](./content/docs/integration/complete-integration-guide.md)**

### Essential Reading

1. **[Claims Guide](./content/docs/core/claims-guide.md)** - What are custom claims and how they work
2. **[Complete Integration Guide](./content/docs/integration/complete-integration-guide.md)** - Step-by-step implementation
3. **[Authentication Guide](./content/docs/integration/authentication-guide.md)** - Implementing auth with claims
4. **[Authorization Patterns](./content/docs/integration/authorization-patterns.md)** - Role-based access control
5. **[Environment Configuration](./content/docs/integration/environment-configuration.md)** - Production deployment

### Quick Reference

- **[Auth Quick Reference](./content/docs/integration/auth-quick-reference.md)** - Copy-paste code snippets
- **[API Documentation](./docs/EXTERNAL_API_CONTRACT.md)** - RPC function reference
- **[Session Management](./content/docs/integration/session-management.md)** - Working with sessions

## Installation (For Your Supabase Project)

### Step 1: Install SQL Functions

The custom claims system requires PostgreSQL functions in your Supabase project.

**Option A - Automated (Recommended):**
```bash
# Clone this repo
git clone <repo-url>
cd supabase-claims-admin-dashboard

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run migrations
pnpm migrate
```

**Option B - Manual:**
1. Open your [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
2. Copy and run the contents of [install.sql](./install.sql)
3. This creates the PostgreSQL functions for managing claims

**What gets installed:**
- `set_claim(user_id, claim, value)` - Set a user claim
- `get_claim(user_id, claim)` - Get a user claim
- `delete_claim(user_id, claim)` - Delete a user claim
- `set_app_claim(user_id, app_id, claim, value)` - Set app-specific claim
- And more... see [API Documentation](./docs/EXTERNAL_API_CONTRACT.md)

### Step 2: Start Using Claims in Your App

See the [Complete Integration Guide](./content/docs/integration/complete-integration-guide.md) for step-by-step instructions.

**Quick Example:**

```typescript
// In your Next.js app
import { createClient } from '@supabase/supabase-js';

// After user signs in
const { data: { user } } = await supabase.auth.getUser();

// Access claims from JWT
const userRole = user?.app_metadata?.role;
const hasAccess = user?.app_metadata?.apps?.['my-app']?.enabled;

// Use for authorization
if (userRole === 'admin') {
  // Show admin features
}
```

### Step 3: (Optional) Deploy Admin Dashboard

The admin dashboard provides a UI for managing users and claims.

**Quick Setup:**
```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit with your credentials

# Start dev server
pnpm dev
```

**Production Deployment:**
- See [Docker Deployment Guide](./DOCKER_DEPLOYMENT.md) for Docker
- See [Environment Configuration](./content/docs/integration/environment-configuration.md) for all platforms

**Grant yourself admin access:**
```sql
-- In Supabase SQL Editor
select set_claim('your-user-id', 'claims_admin', 'true');
```

## Project Structure

```
supabase-claims-admin-dashboard/
├── app/
│   ├── layout.tsx              # Root layout with Toaster
│   ├── page.tsx                # Dashboard home page
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── access-denied/
│   │   └── page.tsx            # Access denied page
│   ├── users/
│   │   ├── page.tsx            # Users list page
│   │   └── [id]/
│   │       └── page.tsx        # User detail page
│   └── actions/
│       └── claims.ts           # Server actions for claims
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── claims/
│   │   ├── ClaimsList.tsx      # Display claims table
│   │   ├── ClaimEditor.tsx     # Add/edit claim dialog
│   │   ├── ClaimBadge.tsx      # Type badge component
│   │   ├── DeleteClaimDialog.tsx
│   │   └── AddClaimButton.tsx
│   └── users/
│       ├── UserTable.tsx       # Users list table
│       ├── UserStatsCards.tsx  # Dashboard stats
│       ├── UserActivityList.tsx
│       ├── ToggleAdminButton.tsx
│       └── CopyButton.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   └── server.ts           # Server Supabase client
│   ├── claims.ts               # Claims utility functions
│   └── utils.ts                # General utilities
├── types/
│   └── claims.ts               # TypeScript types
└── middleware.ts               # Auth middleware
```

## Usage

### Dashboard

The main dashboard shows:
- Total users, claims admins, total claims, and recent signups
- Recent user activity
- Claims distribution chart

### Users List

- View all users in a searchable table
- See user email, ID, claims count, and last sign in
- Click on any user to view details

### User Details

For each user you can:
- View user information (email, ID, status, dates)
- See all custom claims with their types
- Add new claims with proper JSON validation
- Edit existing claims
- Delete claims
- Toggle claims_admin status
- Copy user ID to clipboard

### Adding/Editing Claims

When adding or editing claims, enter values in JSON format:
- **Number**: `100`
- **String**: `"MANAGER"` (note: include quotes)
- **Boolean**: `true` or `false`
- **Array**: `["item1", "item2"]`
- **Object**: `{"level": 5, "active": true}`

The editor validates JSON and shows the detected type.

## Security

### Access Control

- Only users with `claims_admin: true` can access the dashboard
- Non-admin users are redirected to an access denied page
- All routes are protected by middleware

### Best Practices

1. **Limit claims_admin access** - Only grant to trusted administrators
2. **Use descriptive claim names** - Avoid reserved names like `provider` and `providers`
3. **Validate claim values** - The dashboard validates JSON, but consider app-level validation
4. **Session refresh** - Users must refresh their session to see updated claims

## Deployment

### Docker (Recommended for Production)

**Production-ready Docker configuration included!**

#### Quick Start

```bash
# 1. Setup environment
cp .env.docker.example .env.production

# 2. Build and deploy
docker-compose up -d

# 3. Access at http://localhost:3000
```

#### Production with Nginx + SSL

```bash
# Deploy with nginx reverse proxy
docker-compose -f docker-compose.prod.yml up -d

# Access at http://localhost (or your domain)
```

**Documentation:**
- [🚀 Quick Start Guide](./DOCKER_QUICK_START.md) - Get running in 5 minutes
- [📚 Complete Deployment Guide](./DOCKER_DEPLOYMENT.md) - Full production setup with SSL, monitoring, and troubleshooting

**Features:**
- Multi-stage optimized builds
- Nginx reverse proxy with SSL/TLS support
- Health checks and monitoring
- Security hardening
- Easy updates and maintenance
- Make commands for convenience

### Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

This is a standard Next.js 14 app and can be deployed to any platform that supports Node.js:
- Netlify
- Railway
- Digital Ocean App Platform
- AWS (Amplify, ECS, etc.)
- Fly.io
- Render

## Technologies

- **[Next.js 14](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[shadcn/ui](https://ui.shadcn.com/)** - Component library
- **[Supabase](https://supabase.com/)** - Backend and authentication
- **[Recharts](https://recharts.org/)** - Charts (for future enhancements)
- **[date-fns](https://date-fns.org/)** - Date formatting
- **[Lucide Icons](https://lucide.dev/)** - Icon library

## Database Migrations

This project uses an automated migration system to safely manage database changes.

### Quick Commands

```bash
# Check what migrations need to be run
pnpm migrate:status

# Run all pending migrations
pnpm migrate

# Force re-run a specific migration
pnpm migrate:force 001_multi_app_support
```

### Available Migrations

- `001_multi_app_support` - Multi-app support functions
- `002_app_configuration_tables` - App and role management
- `003_api_keys` - API key management system
- `004_external_key_sources` - External key source integration
- `006_performance_optimizations` - Database performance improvements

📚 **See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete migration documentation.**

## Troubleshooting

### "Access Denied" after login

Make sure your user has the `claims_admin` claim set to `true`. Run this in your Supabase SQL Editor:

```sql
select set_claim('YOUR-USER-ID', 'claims_admin', 'true');
```

### Can't see updated claims

Users need to refresh their session. Either:
- Log out and back in
- Call `supabase.auth.refreshSession()` in your app

### "Unauthorized" errors

Ensure:
1. Your environment variables are correct
2. The custom claims functions are installed in your Supabase project
3. Your user has claims_admin access

### Migration Issues

See [Migration Guide](./docs/MIGRATION_GUIDE.md#troubleshooting) for detailed troubleshooting steps.

## Documentation

**📚 [Complete Documentation Index](./content/docs/INDEX.md)** - Full documentation navigation

### For Application Developers (Primary Audience) ⭐

**Goal:** Integrate custom claims into YOUR Supabase applications

| Step | Guide | Purpose |
|------|-------|---------|
| 1 | **[Claims Guide](./content/docs/core/claims-guide.md)** | Understand what custom claims are |
| 2 | **[Complete Integration Guide](./content/docs/integration/complete-integration-guide.md)** | Step-by-step implementation |
| 3 | **[Authentication Guide](./content/docs/integration/authentication-guide.md)** | Implement auth with claims |
| 4 | **[Authorization Patterns](./content/docs/integration/authorization-patterns.md)** | Role-based access control |
| 5 | **[Environment Configuration](./content/docs/integration/environment-configuration.md)** | Production deployment |

**Quick Reference:**
- **[Auth Quick Reference](./content/docs/integration/auth-quick-reference.md)** - Copy-paste code snippets
- **[API Documentation](./docs/EXTERNAL_API_CONTRACT.md)** - RPC function reference
- **[Session Management](./content/docs/integration/session-management.md)** - Session handling

### For Dashboard Administrators (Optional)

**Goal:** Deploy and manage the admin dashboard

- **[Dashboard Quick Start](./content/docs/dashboard/quick-start.md)** - Get dashboard running in 5 minutes
- **[Dashboard Setup Guide](./content/docs/dashboard/setup.md)** - Detailed configuration

### Additional Integration Resources

| Category | Guides |
|----------|--------|
| **Auth Methods** | [Passwordless Auth](./content/docs/integration/passwordless-auth.md), [Password Auth](./content/docs/integration/password-auth.md) |
| **Advanced** | [Multi-App Guide](./content/docs/core/multi-app-guide.md), [RLS Policies](./content/docs/integration/rls-policies.md), [API Keys](./content/docs/integration/api-keys-guide.md) |
| **Examples** | [App Auth Integration](./content/docs/integration/app-auth-integration.md) |

### Deployment Resources

| Resource | Purpose |
|----------|---------|
| **[Environment Configuration](./content/docs/integration/environment-configuration.md)** | **Critical** - Production environment setup |
| [Docker Deployment](./DOCKER_DEPLOYMENT.md) | Complete Docker deployment guide |
| [Docker Quick Start](./DOCKER_QUICK_START.md) | Quick Docker setup |
| [Session Configuration](./docs/SESSION_CONFIGURATION.md) | Session tuning and configuration |

### Technical Reference

| Resource | Purpose |
|----------|---------|
| [External API Contract](./docs/EXTERNAL_API_CONTRACT.md) | RPC function documentation |
| [Migration Guide](./docs/MIGRATION_GUIDE.md) | Database migration system |
| [install.sql](./install.sql) | SQL functions installation script |
| [uninstall.sql](./uninstall.sql) | SQL functions removal script |

## Contributing

This dashboard is part of the [supabase-custom-claims](https://github.com/supabase-community/supabase-custom-claims) project. Feel free to submit issues and pull requests.

## License

MIT License - see the main project repository for details.
