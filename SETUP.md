# Setup Guide

## What You're Setting Up

This dashboard manages **Supabase Custom Claims** - special user attributes stored in JWT tokens for high-performance authorization.

👉 **New to custom claims?** Read [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) first to understand what they are and how they work.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file and add your credentials:

```bash
cp env.example .env.local
```

Then edit `.env.local` with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these values:**
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the "Project URL" as `NEXT_PUBLIC_SUPABASE_URL`
5. Copy the "anon public" key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Copy the "service_role" key as `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **Important**: The service role key is required for admin operations (listing users)
   - This key bypasses Row Level Security, so keep it secret!
   - It's only used server-side and never exposed to the client

### 3. Install Custom Claims Functions

If you haven't already, you need to install the custom claims functions in your Supabase project:

1. Open your Supabase SQL Editor: https://app.supabase.com/project/YOUR-PROJECT/sql
2. Copy the contents of [`install.sql`](./install.sql) (in this directory)
3. Paste and run it

This creates the PostgreSQL functions needed for managing claims. See [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) for details on what these functions do.

### 4. Bootstrap an Admin User

To grant yourself claims_admin access, run this in your Supabase SQL Editor:

```sql
select set_claim('YOUR-USER-ID', 'claims_admin', 'true');
```

**To find your User ID:**
1. Sign up for an account in your app (or use magic link to sign in)
2. Go to Authentication → Users in your Supabase dashboard
3. Find your email and copy the User ID
4. Use that ID in the SQL command above

### 5. Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your email.

## Troubleshooting

### Can't sign in / Access Denied

Make sure you've:
1. ✅ Installed the custom claims functions (`install.sql`)
2. ✅ Granted yourself claims_admin access (step 4 above)
3. ✅ Set the correct environment variables
4. ✅ Restarted your dev server after adding .env.local

### Still having issues?

Try these steps:
1. Verify your Supabase URL and anon key are correct
2. Check that you can sign in to your Supabase project in the dashboard
3. Verify the claims functions are installed by running:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name LIKE '%claim%';
   ```
4. Make sure your user appears in Authentication → Users in Supabase dashboard

## Next Steps

Once you're signed in:
- View the dashboard to see user statistics
- Click "View All Users" to see all registered users
- Click on any user to manage their custom claims
- Add, edit, or delete claims as needed

Refer to the [README.md](./README.md) for more detailed documentation.
