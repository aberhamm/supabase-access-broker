---
title: "Contributing"
description: "How to contribute changes to the admin dashboard and docs"
category: "contributing"
audience: "all"
order: 3
---

# Contributing

## What to contribute

- **Docs improvements** (clarity, correctness, better examples, broken links)
- **Bug fixes** in the dashboard UI
- **Improvements to claims operations** (safety, validation, better errors)

## Guidelines

- Keep implementer docs **implementation-focused** (avoid codebase internals in non-contributing pages)
- Never add examples that expose secrets (service role key must remain server-only)
- Prefer **copy/paste runnable examples** over fragments

## Pull request checklist

- Docs render correctly and internal links use `/docs/<slug>`
- New docs have frontmatter: `title`, `description`, `category`, `audience`, `order`
- UI changes are consistent with shadcn + existing patterns

---

## What’s Next

- **Architecture:** [Architecture](/docs/architecture)
- **Dev setup:** [Development](/docs/development)


---

## What's Next

- **Docs home:** [/docs](/docs)
- **App Quick Start:** [/docs/quick-start](/docs/quick-start)
- **Auth patterns:** [/docs/authentication-guide](/docs/authentication-guide)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
