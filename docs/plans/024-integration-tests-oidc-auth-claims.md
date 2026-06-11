---
id: 024
title: Add integration tests for OIDC endpoints, auth flow, and claims
status: blocked
blocked-by: [018, 020, 022]
allows-migrations: false
needs-review: none
created: 2026-06-05
---

## Requirements

The system is now critical auth infrastructure with OIDC endpoints, token
management, and a storage abstraction layer. It needs integration tests that
verify the end-to-end flows work correctly, including the OIDC authorization
code flow, token exchange, userinfo, refresh tokens, and claims management
through the storage layer.

**Acceptance criteria:**

- [ ] Integration test suite for the OIDC authorization code flow: authorize -> token -> userinfo (happy path)
- [ ] Tests for OIDC token endpoint error cases: invalid code, expired code, wrong client_secret, missing redirect_uri, unsupported grant_type
- [ ] Tests for refresh token flow: issue, use, rotation, reuse detection (family revocation)
- [ ] Tests for userinfo endpoint: valid token returns claims, expired token returns 401, insufficient scope returns 403
- [ ] Tests for OIDC discovery: well-known endpoint returns valid configuration, JWKS returns valid keys
- [ ] Tests for claims management through the storage layer: set, get, delete app claims via ClaimsStore
- [ ] Tests for rate limiting on OIDC endpoints (verify 429 response after exceeding limits)
- [ ] Tests verify that legacy `/api/auth/exchange` endpoint still works alongside new OIDC endpoints
- [ ] All tests run in CI with `pnpm run test` (vitest)
- [ ] Test helpers provide reusable utilities for generating test keys, creating test users, and mocking Supabase responses

## Design

The integration tests use vitest (already configured) and test at the HTTP
handler level by calling the Next.js route handlers directly (not via a running
server). This avoids needing a full running instance while still testing the
actual route handler logic.

Test organization:
```
tests/
  integration/
    oidc/
      discovery.test.ts    - well-known + JWKS
      authorize.test.ts    - authorization endpoint
      token.test.ts        - token endpoint (code exchange + refresh)
      userinfo.test.ts     - userinfo endpoint
    auth-flow/
      exchange.test.ts     - legacy exchange endpoint
      sso-complete.test.ts - SSO complete flow
    claims/
      claims-store.test.ts - ClaimsStore operations
      user-store.test.ts   - UserStore operations
    helpers/
      test-keys.ts         - RSA key pair generation for tests
      test-users.ts        - user creation and cleanup
      mock-supabase.ts     - Supabase client mocking
```

**Mocking strategy:** Mock the Supabase client at the module level to avoid
needing a live database for unit/integration tests. The e2e tests (Playwright)
already test against a live instance.

**Files expected to change:**

- `tests/integration/oidc/discovery.test.ts` (new)
- `tests/integration/oidc/authorize.test.ts` (new)
- `tests/integration/oidc/token.test.ts` (new)
- `tests/integration/oidc/userinfo.test.ts` (new)
- `tests/integration/auth-flow/exchange.test.ts` (new)
- `tests/integration/claims/claims-store.test.ts` (new)
- `tests/integration/claims/user-store.test.ts` (new)
- `tests/integration/helpers/test-keys.ts` (new)
- `tests/integration/helpers/test-users.ts` (new)
- `tests/integration/helpers/mock-supabase.ts` (new)
- `vitest.config.ts`: may need to add integration test paths

Testing approach: unit-only (these ARE the tests)

**Out of scope:** Browser-based e2e tests (Playwright). Performance/load
testing. Tests for the dashboard UI.

## Tasks

1. Create test helpers: `test-keys.ts` (RSA key pair generation), `test-users.ts` (user fixtures), `mock-supabase.ts` (Supabase client mock with configurable responses)
2. Write `discovery.test.ts` testing the well-known and JWKS endpoints return valid documents
3. Write `authorize.test.ts` testing OIDC authorization with valid/invalid params, unauthenticated redirect, and error responses
4. Write `token.test.ts` testing code exchange (happy path + error cases), client authentication methods, and JWT structure validation
5. Write `token.test.ts` refresh token tests: issuance, rotation, reuse detection, expiry
6. Write `userinfo.test.ts` testing valid access token, expired token, insufficient scope, and claim filtering by scope
7. Write `exchange.test.ts` testing the legacy exchange endpoint continues to work
8. Write `claims-store.test.ts` and `user-store.test.ts` testing the storage layer interfaces
9. Update `vitest.config.ts` if needed to include integration test paths

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -d tests/integration/oidc
- [assert] test -f tests/integration/oidc/token.test.ts
- [assert] test -f tests/integration/oidc/userinfo.test.ts
- [assert] test -f tests/integration/claims/claims-store.test.ts
- [assert] test -f tests/integration/helpers/mock-supabase.ts
