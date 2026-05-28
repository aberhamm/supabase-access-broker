---
id: 007
title: E2E tests for auth edge cases and access gating
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The middleware enforces auth gating (redirect to `/login` when unauthenticated,
redirect to `/access-denied` for non-admins). These critical security boundaries
have no dedicated e2e coverage. A regression here would either lock out admins
or expose the dashboard to unauthorized users.

**Acceptance criteria:**

- [ ] Test covers: unauthenticated request to `/` redirects to `/login`
- [ ] Test covers: unauthenticated request to `/login` renders the login page (no redirect loop)
- [ ] Test covers: authenticated non-admin user accessing `/` is redirected to `/access-denied`
- [ ] Test covers: `/access-denied` page renders with appropriate messaging
- [ ] Test covers: authenticated admin user can access `/` (dashboard loads)
- [ ] Test covers: `/login` with SSO params (`app_id`, `redirect_uri`) and authenticated user redirects to `/sso/continue`
- [ ] Test covers: `/login?next=/some-page` preserves the `next` param through the login flow
- [ ] All tests use factory-created users for isolation

## Design

Create `e2e/auth-gating.spec.ts`. Use `createTestUser` to create users with
different permission levels:
- A global admin (for positive access tests)
- A non-admin user with no app access (for access-denied tests)
- An app-scoped admin (for app admin access tests)

Use fresh browser contexts (no prior cookies) for unauthenticated tests.

Note: `/access-denied` is in `PORTAL_ROUTE_PREFIXES` (see `lib/auth-routes.ts`),
meaning it requires authentication but NOT admin access. A non-admin user
can reach it. An unauthenticated user hitting `/access-denied` would be
redirected to `/login` first — test accordingly.

**Files expected to change:**

- `e2e/auth-gating.spec.ts` — new file

**Out of scope:** Testing actual session expiry mid-flow (would require
manipulating Supabase JWT lifetimes). Testing MFA step-up modal triggering
(complex, covered by unit tests if any). Testing the `/refresh-session` page.

## Tasks

1. Create `e2e/auth-gating.spec.ts` with user factory setup
2. Write test: fresh context (no cookies), goto `/`, verify redirect to `/login`
3. Write test: fresh context, goto `/login`, verify login page renders (no redirect loop)
4. Write test: sign in as non-admin, goto `/`, verify redirect to `/access-denied`
5. Write test: verify `/access-denied` page content
6. Write test: sign in as global admin, goto `/`, verify dashboard loads
7. Write test: sign in as app admin (not global admin), goto `/`, verify dashboard loads
8. Write test: sign in, goto `/login?app_id=demo-app&redirect_uri=...`, verify redirect to `/sso/continue`
9. Write test: unauthenticated goto `/?foo=bar`, verify `/login?next=...` includes original path

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test:e2e -- auth-gating` exits 0
