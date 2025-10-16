# Documentation Index

Welcome to the Supabase Claims Admin Dashboard documentation! All documentation is now available on the website at `/docs`.

## 📚 Browse Documentation

Visit [http://localhost:3000/docs](http://localhost:3000/docs) (or your deployed URL + `/docs`) to browse all documentation with:
- Markdown rendering with syntax highlighting
- Copy buttons on all code blocks
- "Copy for LLM" button to paste entire docs into AI assistants
- Table of contents for easy navigation
- Related documentation suggestions

## 🗂️ Documentation Categories

### Dashboard Setup
**For:** Setting up and configuring the admin dashboard
**Docs:**
- Quick Start - Get started in 5 minutes
- Setup Guide - Detailed setup instructions

### App Integration
**For:** Building apps that use your Supabase Auth instance
**Docs:**
- **Complete Integration Guide** - Everything you need to integrate into your app (START HERE)
- Authentication Setup Guide - Detailed auth setup with automatic role assignment
- App Authentication Integration - Advanced integration patterns
- RLS Policies Guide - Set up Row Level Security policies
- Authentication Quick Reference - Copy-paste ready code snippets

### Core Concepts
**For:** Understanding the system architecture and features
**Docs:**
- Supabase Custom Claims Guide - Complete guide to custom claims
- Multi-App Architecture Guide - Managing multiple applications

## 🗺️ Recommended Reading Order

### For Setting Up the Dashboard:
1. `/docs/quick-start` - Get the dashboard running
2. `/docs/setup` - Detailed setup if you need help
3. `/docs/claims-guide` - Understand what you're managing

### For Building Your Own App:
1. `/docs/complete-integration-guide` - **Complete step-by-step integration (START HERE)**
2. `/docs/authentication-guide` - Detailed authentication setup
3. `/docs/rls-policies` - Secure your database
4. `/docs/auth-quick-reference` - Quick code snippets reference

### For Understanding the System:
1. `/docs/claims-guide` - What are custom claims?
2. `/docs/multi-app-guide` - Multi-app architecture
3. `/docs/authentication-guide` - How auth works

## 💡 Using with LLMs

Each documentation page has a "Copy for LLM" button at the top. Click it to copy the entire markdown content with all context annotations, then paste into:
- Claude
- ChatGPT
- GitHub Copilot Chat
- Any other AI assistant

The documentation is optimized for LLM understanding with:
- Clear context headers
- Inline code comments
- File location tags
- Security annotations
- Use case descriptions

## 📂 File Structure

Documentation files are organized in `content/docs/`:

```
content/docs/
├── dashboard/
│   ├── quick-start.md
│   └── setup.md
├── integration/
│   ├── complete-integration-guide.md    ← NEW: Complete guide for app integration
│   ├── authentication-guide.md
│   ├── app-auth-integration.md
│   ├── rls-policies.md
│   └── auth-quick-reference.md
└── core/
    ├── claims-guide.md
    └── multi-app-guide.md
```

## 🔗 Quick Access

- **Web Documentation:** `/docs`
- **GitHub:** [supabase-community/supabase-custom-claims](https://github.com/supabase-community/supabase-custom-claims)
- **Install SQL:** `install.sql` (in project root)
- **Example Environment:** `env.example` (in project root)

## 🆘 Need Help?

1. Visit `/docs` and browse by category
2. Use "Copy for LLM" to get help from AI assistants
3. Check troubleshooting sections in each guide
4. Review example code in the repository

---

**TL;DR:**
- All docs are at `/docs` on the website
- Dashboard setup docs help you configure the admin interface
- Integration docs help you build apps that use your auth instance
- Core docs explain the underlying concepts
- Use "Copy for LLM" buttons to get AI assistance
