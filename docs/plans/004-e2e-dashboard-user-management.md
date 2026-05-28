---
id: 004
title: E2E tests for dashboard user management
status: done
completed: 2026-05-28
reviewed: false
qa: automated
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The admin dashboard user management flows (user table, search, detail page,
toggle admin, delete user) have no e2e coverage. These are the most-used
admin workflows and regressions here are high-impact.

**Acceptance criteria:**

- [ ] Test spec covers: user table renders with at least one user
- [ ] Test covers: search/filter narrows the user list
- [ ] Test covers: clicking a user row navigates to the user detail page
- [ ] Test covers: user detail page shows email, status, and claims
- [ ] Test covers: toggle admin button changes admin status (using a disposable test user)
- [ ] Test covers: delete user removes user from the table (using a disposable test user)
- [ ] All tests use the `createTestUser` factory for isolation
- [ ] All tests clean up created users via the existing global teardown

## Design

Create `e2e/dashboard-users.spec.ts`. Use `createTestUser` with
`globalAdmin: true` to create an admin who can access the dashboard, and
additional `createTestUser` calls for target users to manipulate. Use
`signInAs` to skip the login form.

The user table is rendered by `components/users/EnhancedUserTable.tsx`. The
detail page is at `/users/[id]` (inferred from dashboard layout). Search is
likely a client-side filter or server action.

**Files expected to change:**

- `e2e/dashboard-users.spec.ts` — new file

**Out of scope:** Testing pagination (requires 50+ users). Testing CSV
export. Testing the user insights panel.

## Tasks

1. Create `e2e/dashboard-users.spec.ts` with test scaffolding and `beforeAll` user setup
2. Write test: admin signs in, dashboard loads, user table is visible with rows
3. Write test: search input filters the table (type test user email, verify row appears)
4. Write test: click user row, verify detail page renders with correct email
5. Write test: create disposable user, toggle admin, verify change reflected
6. Write test: create disposable user, delete via UI, verify removal from table
7. Ensure teardown cleans up all factory-created users

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test:e2e -- dashboard-users` exits 0
