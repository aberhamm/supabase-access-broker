---
title: 'Which Doc Should I Read?'
description: 'Decision tree to find the right documentation fast'
category: 'getting-started'
audience: 'all'
order: 1
---

# Which Doc Should I Read?

Use this quick decision tree to find the most relevant documentation track.

```
What's your primary goal?

├─ Integrate my app with Access Broker
│  └─ → Go to Integrator Track (/docs/integrator)
│
├─ Deploy or manage the Access Broker platform
│  └─ → Go to Operator Track (/docs/operator)
│
└─ Understand how auth, claims, and roles work
   └─ → Go to Concepts (/docs/concepts)
```

## Documentation Tracks

### [Integrator Track](/docs/integrator)

**For:** App developers connecting their application to Access Broker

**You'll learn:**

- How to integrate SSO into your app
- How to read and use claims for authorization
- How to implement role-based UI patterns
- How to secure your app with RLS policies

**Start here if:**

- You're building a new app that needs authentication
- You want to connect an existing app to Access Broker
- You need to implement claims-based authorization

### [Operator Track](/docs/operator)

**For:** Platform administrators deploying and managing Access Broker

**You'll learn:**

- How to install and configure Access Broker
- How to set up the admin dashboard
- How to manage multiple apps and their users
- How to configure SSO and authentication providers

**Start here if:**

- You're setting up Access Broker for the first time
- You need to configure apps and roles
- You're managing users across multiple applications
- You need to deploy to production

### [Concepts](/docs/concepts)

**For:** Anyone who wants to understand the fundamentals

**You'll learn:**

- How authentication works in Access Broker
- What custom claims are and why they matter
- How roles and permissions are structured
- How RLS policies secure your database

**Start here if:**

- You're new to authentication and authorization concepts
- You want to understand the architecture before implementing
- You need to make informed decisions about your auth strategy
- You're troubleshooting and need deeper understanding

## Quick Navigation

Still not sure? Here are some common scenarios:

| I want to... | Go to |
| --- | --- |
| Connect my Next.js app to SSO | [SSO Integration Guide](/docs/integrator/sso-integration-guide) |
| Deploy the dashboard for the first time | [Dashboard Quick Start](/docs/operator/dashboard-quick-start) |
| Understand what claims are | [Claims Guide](/docs/concepts/claims-guide) |
| Set up role-based access control | [Authorization Patterns](/docs/concepts/authorization-patterns) |
| Manage multiple applications | [Multi-App Guide](/docs/operator/multi-app-guide) |
| Implement protected routes | [Complete Integration Guide](/docs/integrator/complete-integration-guide) |
