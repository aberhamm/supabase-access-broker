---
id: 005
title: E2E tests for app CRUD and claims management
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

App management in the dashboard (create, edit, configure auth methods, manage
roles, assign claims to users) has no e2e coverage. The existing
`app-management-api.spec.ts` covers the HTTP API but not the UI flows.

**Acceptance criteria:**

- [ ] Test covers: create a new app via the UI (AppFormDialog)
- [ ] Test covers: edit app settings (name, description, color)
- [ ] Test covers: configure auth methods toggles on an app
- [ ] Test covers: create and delete a custom role on an app
- [ ] Test covers: assign a claim to a user for an app
- [ ] Test covers: delete an app via the UI (DeleteAppConfirmDialog)
- [ ] All tests use factory-created apps and users for isolation
- [ ] No test data leaks between runs

## Design

Create `e2e/dashboard-apps.spec.ts`. Sign in as a global admin via
`signInAs`. Create a test app through the UI form, then exercise the tabs
(Overview, Roles, API Keys, Auth Methods). Use `createTestUser` for users
to assign claims to.

The app management grid is at `/` (dashboard root) or `/apps`. App detail
pages are at `app/(dashboard)/apps/[id]/page.tsx` and the create form is at
`app/(dashboard)/apps/create/page.tsx`. The components are in `components/apps/`.

**Files expected to change:**

- `e2e/dashboard-apps.spec.ts` — new file

**Out of scope:** API key creation/deletion UI (covered by existing
`app-management-api.spec.ts`). SSO settings card. External sources
management.

## Tasks

1. Create `e2e/dashboard-apps.spec.ts` with admin sign-in and cleanup scaffolding
2. Write test: click "New App" button, fill form, submit, verify app appears in grid
3. Write test: open app detail, edit name/description, save, verify changes persist
4. Write test: toggle auth methods on/off, verify toggles persist after page reload
5. Write test: create a custom role, verify it appears in the roles list, then delete it
6. Write test: assign a claim to a test user, verify claim appears on user's detail
7. Write test: delete the test app via confirm dialog, verify it's removed from grid

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test:e2e -- dashboard-apps` exits 0
