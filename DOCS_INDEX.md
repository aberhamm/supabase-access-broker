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

### Authentication & Integration

4. **[AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)** - 🔐 Authentication setup
   - **Complete guide to setting up Supabase Auth**
   - Sign up and sign in flows (email, password, magic link, OAuth)
   - Automatic role assignment during sign up
   - App-specific user access control
   - Database triggers for default roles
   - Server-side and client-side examples
   - Route protection with middleware

5. **[APP_AUTH_INTEGRATION_GUIDE.md](./APP_AUTH_INTEGRATION_GUIDE.md)** - 🚀 Advanced integration patterns
   - **Practical authentication patterns**
   - Self-service sign up with app selection
   - Invite-only sign up systems
   - Multi-tenant applications with organizations
   - Role-based onboarding flows
   - Dynamic app switching
   - Real-world scenario examples

6. **[MULTI_APP_GUIDE.md](./MULTI_APP_GUIDE.md)** - 🎯 Multi-app architecture
   - Managing multiple applications with one auth system
   - App-specific roles and permissions
   - Global vs app-specific claims
   - App admin hierarchy
   - Migration from single to multi-app

### Quick Reference

**[AUTH_QUICK_REFERENCE.md](./AUTH_QUICK_REFERENCE.md)** - ⚡ Code snippets cheat sheet
   - Copy-paste ready authentication code
   - Common patterns and solutions
   - RPC function examples
   - All authentication tasks in one place

### Using the Dashboard

7. **[README.md](./README.md)** - 📘 Main documentation
   - Dashboard features overview
   - Complete usage guide
   - Deployment instructions
   - Technologies used
   - Project structure

### Technical Details

8. **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - 🏗️ Architecture overview
   - Technical implementation details
   - Code organization
   - Architecture decisions
   - Development notes
   - Future enhancement ideas

## 🗄️ SQL Files

### Installation

9. **[install.sql](./install.sql)** - 💾 Database functions
   - PostgreSQL functions for managing claims
   - Run this in your Supabase SQL Editor
   - Creates: `get_claims`, `set_claim`, `delete_claim`, `is_claims_admin`, etc.

### Uninstallation

10. **[uninstall.sql](./uninstall.sql)** - 🗑️ Remove functions
    - Removes all custom claims functions
    - Preserves existing claim data
    - Use if you need to uninstall

## 🔄 Configuration Files

11. **[env.example](./env.example)** - ⚙️ Environment variables template
    - Template for `.env.local`
    - Supabase credentials needed
    - Setup instructions included

## 🗺️ Recommended Reading Order

### For New Users:
1. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Understand what custom claims are
2. ⚡ [QUICK_START.md](./QUICK_START.md) - Get the dashboard running
3. 📘 [README.md](./README.md) - Learn how to use the dashboard

### For Building Your Own App:
1. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Understand custom claims
2. 🔐 [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) - Set up authentication
3. 🚀 [APP_AUTH_INTEGRATION_GUIDE.md](./APP_AUTH_INTEGRATION_GUIDE.md) - Integration patterns
4. 🎯 [MULTI_APP_GUIDE.md](./MULTI_APP_GUIDE.md) - Multi-app setup (if needed)

### For Developers:
1. 📘 [README.md](./README.md) - Overview and features
2. 🔧 [SETUP.md](./SETUP.md) - Detailed installation
3. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Claims API reference
4. 🔐 [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) - Auth implementation
5. 🏗️ [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Technical architecture

### For Troubleshooting:
1. 🔧 [SETUP.md](./SETUP.md) - Troubleshooting section
2. 📖 [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md) - Troubleshooting section
3. 🔐 [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) - Auth troubleshooting
4. 📘 [README.md](./README.md) - Common issues

## 💡 Quick Links

### Installation & Setup
- Install SQL functions: [install.sql](./install.sql)
- Configure environment: [env.example](./env.example)
- Setup guide: [SETUP.md](./SETUP.md)

### Learning
- What are custom claims? [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#what-are-custom-claims)
- Usage examples: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#usage)
- RLS examples: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#in-row-level-security-rls-policies)

### Authentication & Integration
- **Quick Reference:** [AUTH_QUICK_REFERENCE.md](./AUTH_QUICK_REFERENCE.md) ⚡
- Setting up Supabase Auth: [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md#initial-supabase-auth-setup)
- Sign up flows: [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md#sign-up-flow-with-automatic-role-assignment)
- Sign in methods: [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md#sign-in-flow)
- Self-service sign up: [APP_AUTH_INTEGRATION_GUIDE.md](./APP_AUTH_INTEGRATION_GUIDE.md#self-service-sign-up)
- Invite-only access: [APP_AUTH_INTEGRATION_GUIDE.md](./APP_AUTH_INTEGRATION_GUIDE.md#invite-only-sign-up)
- Multi-tenant apps: [APP_AUTH_INTEGRATION_GUIDE.md](./APP_AUTH_INTEGRATION_GUIDE.md#multi-tenant-applications)

### Reference
- Dashboard features: [README.md](./README.md#features)
- RPC functions: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#in-your-application-javascripttypescript)
- Security notes: [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#security)
- Multi-app architecture: [MULTI_APP_GUIDE.md](./MULTI_APP_GUIDE.md)

## 🆘 Need Help?

1. Check the troubleshooting sections in:
   - [SETUP.md](./SETUP.md#troubleshooting)
   - [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#troubleshooting)
   - [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md#troubleshooting)
   - [README.md](./README.md#troubleshooting)

2. Review common issues:
   - Can't sign in? [SETUP.md](./SETUP.md#cant-sign-in--access-denied)
   - Claims not updating? [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#claims-not-updating-in-my-app)
   - Permission errors? [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md#cant-set-claims-from-my-app)
   - Auth not working? [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md#troubleshooting)

3. GitHub: [supabase-community/supabase-custom-claims](https://github.com/supabase-community/supabase-custom-claims)

---

**TL;DR:**
- New to custom claims? Start with [CLAIMS_GUIDE.md](./CLAIMS_GUIDE.md)
- Ready to install the dashboard? See [QUICK_START.md](./QUICK_START.md)
- Building your own app? Check [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)
