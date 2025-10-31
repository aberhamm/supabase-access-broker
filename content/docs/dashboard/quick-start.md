---
title: "Quick Start"
description: "Get started with the dashboard in 5 minutes"
category: "dashboard"
audience: "dashboard-admin"
order: 1
---

# Quick Start Guide

## 🚀 Get Started in 5 Minutes

This dashboard manages **Supabase Custom Claims** - user attributes stored in JWT tokens for high-performance authorization.

**New to custom claims?** See [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) for a complete guide.

### 1. Copy the Project
This folder (`supabase-claims-admin-dashboard/`) is ready to extract and use standalone.

### 2. Install Dependencies
```bash
cd supabase-claims-admin-dashboard
pnpm install
```

### 3. Configure Environment
Copy the example file and add your credentials:
```bash
cp env.example .env.local
# Then edit .env.local with:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY (⚠️ required for listing users)
# - NEXT_PUBLIC_APP_URL (for production - see note below)
```

**⚠️ Production Note:** If deploying to production or using Docker, you MUST set `NEXT_PUBLIC_APP_URL` to your actual domain. See [Environment Configuration Guide](../integration/environment-configuration.md) for details.

### 4. Bootstrap an Admin User
In your Supabase SQL Editor:
```sql
-- Replace with your actual user ID from auth.users
select set_claim('your-user-id-here', 'claims_admin', 'true');
```

### 5. Run the App
```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in!

---

## 📦 What's Included

✅ Complete Next.js 14 app with TypeScript
✅ Supabase authentication & RPC integration
✅ Beautiful UI with shadcn/ui components
✅ User management dashboard
✅ Claims CRUD operations
✅ Admin access control
✅ Mobile responsive
✅ Production ready

## 📚 Documentation

### Dashboard Setup
- **[Setup Guide](./setup.md)** - Detailed setup instructions
- **[README](../../../README.md)** - Full documentation

### For Implementers
- **[Environment Configuration](../integration/environment-configuration.md)** - Production deployment & environment variables
- **[Authentication Guide](../integration/authentication-guide.md)** - Implementing auth in your apps
- **[Session Management](../integration/session-management.md)** - Managing user sessions
- **[Complete Integration Guide](../integration/complete-integration-guide.md)** - Full integration walkthrough

## 🐛 Troubleshooting

**"Access Denied" when logging in?**
→ Make sure you've granted yourself `claims_admin` access (step 4 above)

**Build fails?**
→ The build script includes placeholder env vars, so it should work without configuration

**Can't connect to Supabase?**
→ Double-check your `.env.local` file has the correct URL and anon key

## 🚢 Deployment

### Vercel (Easiest)
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

### Other Platforms
Works on: Railway, Netlify, Digital Ocean, AWS, or any Node.js host

---

**Need help?** Check the README.md for detailed documentation.
