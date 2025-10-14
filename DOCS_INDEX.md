# Documentation Index

Welcome to the Supabase Claims Admin Dashboard documentation! This guide helps you navigate all available documentation.

## 📚 Documentation Files

### Getting Started

1. **[QUICK_START.md](./QUICK_START.md)** - ⚡ Start here!
   - Get the dashboard running in 5 minutes
   - Quick setup steps
   - Minimal explanation

2. **[SETUP.md](./SETUP.md)** - 🔧 Detailed setup guide
   - Step-by-step installation
   - Environment configuration
   - Troubleshooting common issues
   - Bootstrap admin user

### Understanding Custom Claims

3. **[CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md)** - 📖 Complete claims documentation
   - **Start here if you're new to custom claims!**
   - What are custom claims and why use them?
   - Installation instructions for SQL functions
   - Usage examples in SQL, JavaScript, and RLS policies
   - Best practices and troubleshooting
   - Security considerations
   - Performance benefits

### Using the Dashboard

4. **[README.md](./README.md)** - 📘 Main documentation
   - Dashboard features overview
   - Complete usage guide
   - Deployment instructions
   - Technologies used
   - Project structure

### Technical Details

5. **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - 🏗️ Architecture overview
   - Technical implementation details
   - Code organization
   - Architecture decisions
   - Development notes
   - Future enhancement ideas

## 🗄️ SQL Files

### Installation

6. **[install.sql](./install.sql)** - 💾 Database functions
   - PostgreSQL functions for managing claims
   - Run this in your Supabase SQL Editor
   - Creates: `get_claims`, `set_claim`, `delete_claim`, `is_claims_admin`, etc.

### Uninstallation

7. **[uninstall.sql](./uninstall.sql)** - 🗑️ Remove functions
   - Removes all custom claims functions
   - Preserves existing claim data
   - Use if you need to uninstall

## 🔄 Configuration Files

8. **[env.example](./env.example)** - ⚙️ Environment variables template
   - Template for `.env.local`
   - Supabase credentials needed
   - Setup instructions included

## 🗺️ Recommended Reading Order

### For New Users:
1. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Understand what custom claims are
2. ⚡ [QUICK_START.md](./QUICK_START.md) - Get the app running
3. 📘 [README.md](./README.md) - Learn how to use the dashboard

### For Developers:
1. 📘 [README.md](./README.md) - Overview and features
2. 🔧 [SETUP.md](./SETUP.md) - Detailed installation
3. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Claims API reference
4. 🏗️ [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Technical architecture

### For Troubleshooting:
1. 🔧 [SETUP.md](./SETUP.md) - Troubleshooting section
2. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Troubleshooting section
3. 📘 [README.md](./README.md) - Common issues

## 💡 Quick Links

### Installation & Setup
- Install SQL functions: [install.sql](./install.sql)
- Configure environment: [env.example](./env.example)
- Setup guide: [SETUP.md](./SETUP.md)

### Learning
- What are custom claims? [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#what-are-custom-claims)
- Usage examples: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#usage)
- RLS examples: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#in-row-level-security-rls-policies)

### Reference
- Dashboard features: [README.md](./README.md#features)
- RPC functions: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#in-your-application-javascripttypescript)
- Security notes: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#security)

## 🆘 Need Help?

1. Check the troubleshooting sections in:
   - [SETUP.md](./SETUP.md#troubleshooting)
   - [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#troubleshooting)
   - [README.md](./README.md#troubleshooting)

2. Review common issues:
   - Can't sign in? [SETUP.md](./SETUP.md#cant-sign-in--access-denied)
   - Claims not updating? [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#claims-not-updating-in-my-app)
   - Permission errors? [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#cant-set-claims-from-my-app)

3. GitHub: [supabase-community/supabase-custom-claims](https://github.com/supabase-community/supabase-custom-claims)

---

**TL;DR:** New to custom claims? Start with [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md). Ready to install? See [QUICK_START.md](./QUICK_START.md).
