---
id: 008
title: Expand API e2e coverage for invite, roles, and rate limiting
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The existing `app-management-api.spec.ts` covers user listing and claims CRUD
via the HTTP API. Several API endpoints lack e2e coverage: the invite endpoint,
auth-methods toggle, roles CRUD, and rate-limit 429 behavior. These are
consumed by external apps and must be regression-tested.

**Acceptance criteria:**

- [ ] Test covers: `POST /api/apps/{appId}/invite` creates a new user and grants app access
- [ ] Test covers: `POST /api/apps/{appId}/invite` with existing user grants access without duplicating
- [ ] Test covers: `GET /api/apps/{appId}/auth-methods` returns current auth methods
- [ ] Test covers: `PATCH /api/apps/{appId}/auth-methods` toggles methods and persists
- [ ] Test covers: `GET /api/apps/{appId}/roles` returns roles list (uses session auth, not API key)
- [ ] Test covers: `POST /api/apps/{appId}/roles` creates a new role (uses session auth)
- [ ] Test covers: `DELETE /api/apps/{appId}/roles/{roleId}` removes a role (uses session auth)
- [ ] Test covers: rate limiting returns 429 after exceeding threshold (rapid-fire requests)
- [ ] Invite, auth-methods, and user endpoints use API key authentication (existing pattern from `app-management-api.spec.ts`)
- [ ] Roles endpoints use session auth via `signInAs` (roles route uses `getUser()`, not API key auth)

## Design

Extend or create a companion spec file `e2e/api-endpoints.spec.ts` (or add
sections to the existing `app-management-api.spec.ts`). Reuse the existing
API key creation helper and test app setup.

For rate limiting: send requests in a tight loop (60+ in under a minute for
read, or 30+ for write) and assert a 429 response. This test should be
tagged or isolated so it doesn't interfere with other tests' rate limit
buckets.

**Files expected to change:**

- `e2e/api-endpoints.spec.ts` — new file (or extend `e2e/app-management-api.spec.ts`)

**Out of scope:** Webhook event delivery testing (requires a listener
endpoint). Load testing / performance benchmarking. Testing every error
response variant.

## Tasks

1. Create `e2e/api-endpoints.spec.ts` with API key setup (reuse existing helper pattern)
2. Write tests for `POST /api/apps/{appId}/invite` — new user and existing user cases (API key auth)
3. Write tests for `GET` and `PATCH /api/apps/{appId}/auth-methods` (API key auth)
4. Write tests for roles CRUD: list, create, delete — these use session auth (cookie-based via `signInAs`), NOT API key auth. Use `page.request` or a signed-in context to make the requests.
5. Write test for rate limiting: send rapid requests, assert 429 after threshold
6. Clean up any created users/roles/apps in afterAll

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test:e2e -- api-endpoints` exits 0
