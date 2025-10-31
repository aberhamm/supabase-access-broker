# Supabase Claims Admin Dashboard

A modern Next.js 14 admin dashboard for managing Supabase users and their custom claims. Built with TypeScript, Tailwind CSS, and shadcn/ui components.

## Features

- 🔐 **Secure Authentication** - Magic link authentication with claims_admin verification
- 📊 **Dashboard Overview** - View user statistics, recent activity, and claims distribution
- 👥 **User Management** - Search, filter, and manage all users
- 🏷️ **Claims Management** - Add, edit, and delete custom claims with type safety
- 🎨 **Modern UI** - Beautiful, responsive interface built with shadcn/ui
- 🚀 **Server Components** - Leverages Next.js App Router and Server Components for optimal performance
- 📱 **Mobile Friendly** - Fully responsive design

## What This Dashboard Does

This is an admin dashboard for managing **Supabase Custom Claims** - special attributes attached to users that control access to your application. Claims are stored in JWT tokens for high-performance authorization without database queries.

**Learn more:** See [Claims Guide](./content/docs/core/claims-guide.md) for complete documentation on what custom claims are and how to use them.

## Prerequisites

Before you begin, ensure you have:

1. **Supabase Project** with custom claims functions installed
   - **Option A - Automated (Recommended):** Use our migration system
     ```bash
     # Set up .env.local with your credentials first
     pnpm migrate
     ```
   - **Option B - Manual:** Open your [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
     - Copy and run the contents of [install.sql](./install.sql)
     - This creates the necessary PostgreSQL functions for managing claims

2. **Bootstrap an Admin User**
   - ⚠️ **Important**: The login page does NOT create new users (`shouldCreateUser: false`)
   - Users must be created manually by an administrator first
   - To create and grant admin access:
     1. Create user in Supabase Dashboard: **Authentication → Users → Add User**
     2. Copy the user ID
     3. Run this in SQL Editor to grant claims_admin:
        ```sql
        select set_claim('YOUR-USER-ID', 'claims_admin', 'true');
        ```

3. **Node.js** - Version 18+ recommended
4. **pnpm** - Version 8+ recommended

## Installation

1. **Clone and navigate to this directory:**
   ```bash
   cd supabase-claims-admin-dashboard
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Required for migrations

   # Production only - set your production domain for auth redirects
   # Example: https://admin.yourdomain.com
   # NEXT_PUBLIC_APP_URL=https://your-production-domain.com
   ```

   You can find the Supabase values in your Supabase project settings under API.

   **⚠️ Production Note:** `NEXT_PUBLIC_APP_URL` is **required** in production to ensure magic links and password reset emails redirect to the correct domain. Without it, they may redirect to `localhost`.

4. **Run database migrations:**

   ```bash
   # Check migration status
   pnpm migrate:status

   # Run all pending migrations
   pnpm migrate
   ```

   See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration documentation.

## Development

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building for Production

```bash
pnpm build
pnpm start
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

### Core Guides

- **[Quick Start](./content/docs/dashboard/quick-start.md)** - Get started in 5 minutes
- **[Setup Guide](./content/docs/dashboard/setup.md)** - Detailed setup instructions
- **[Magic Link Setup](./content/docs/dashboard/magic-link-setup.md)** - Implement passwordless auth ⭐
- **[Claims Guide](./content/docs/core/claims-guide.md)** - Understanding custom claims ⭐
- **[Multi-App Guide](./content/docs/core/multi-app-guide.md)** - Multi-app architecture

### Integration

- **[Authentication Guide](./content/docs/integration/authentication-guide.md)** - Auth setup and patterns
- **[App Auth Integration](./content/docs/integration/app-auth-integration.md)** - Real-world integration examples
- **[Complete Integration Guide](./content/docs/integration/complete-integration-guide.md)** - End-to-end integration
- **[API Keys Guide](./content/docs/integration/api-keys-guide.md)** - API key management
- **[Auth Quick Reference](./content/docs/integration/auth-quick-reference.md)** - Code snippets ⚡
- **[RLS Policies](./content/docs/integration/rls-policies.md)** - Row level security patterns

### Technical Reference

- **[Migration Guide](./docs/MIGRATION_GUIDE.md)** - Database migration system
- **[External API Contract](./docs/EXTERNAL_API_CONTRACT.md)** - API documentation
- **[Session Configuration](./docs/SESSION_CONFIGURATION.md)** - Auth session setup

### Deployment

- **[Docker Deployment](./DOCKER_DEPLOYMENT.md)** - Docker & Docker Compose deployment
- **[Docker Quick Start](./DOCKER_QUICK_START.md)** - Quick Docker setup

### SQL Functions

- **[install.sql](./install.sql)** - Install claims management functions
- **[uninstall.sql](./uninstall.sql)** - Remove claims functions

## Contributing

This dashboard is part of the [supabase-custom-claims](https://github.com/supabase-community/supabase-custom-claims) project. Feel free to submit issues and pull requests.

## License

MIT License - see the main project repository for details.
