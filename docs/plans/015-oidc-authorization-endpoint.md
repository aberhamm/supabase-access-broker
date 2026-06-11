---
id: 015
title: Make authorization endpoint OIDC-compatible
status: blocked
blocked-by: [014]
allows-migrations: false
needs-review: eng
created: 2026-06-05
---

## Requirements

Standard OIDC clients (NextAuth/Auth.js) send authorization requests with
`client_id`, `response_type=code`, `scope=openid`, `redirect_uri`, `state`, and
`nonce`. The existing `/sso/complete` endpoint uses `app_id` instead of
`client_id` and doesn't understand `response_type`, `scope`, or `nonce`. This
plan makes the authorization endpoint understand both the standard OIDC parameter
set and the legacy `app_id` parameter set, so existing clients continue to work
while new clients can use NextAuth/Auth.js out of the box.

**Acceptance criteria:**

- [ ] `GET /api/oidc/authorize` accepts standard OIDC parameters: `client_id`, `response_type`, `redirect_uri`, `scope`, `state`, `nonce`
- [ ] `client_id` maps to an existing app ID in the `access_broker_app.apps` table
- [ ] `response_type=code` is the only supported response type; other values return `unsupported_response_type` error
- [ ] `scope` must include `openid`; also supports `profile` and `email` scopes
- [ ] `nonce` is stored alongside the auth code and passed through to the ID token (plan 016)
- [ ] The endpoint redirects unauthenticated users to `/login` with OIDC params preserved, then back after authentication
- [ ] The existing `/sso/complete` endpoint continues to work for legacy clients (backward compatibility)
- [ ] Error responses follow OAuth 2.0 error format (redirect with `error` and `error_description` query params when redirect_uri is valid)
- [ ] The `auth_codes` table stores `nonce` and `scope` alongside the existing code data

## Design

Two approaches considered:

1. **Modify `/sso/complete`** to accept both parameter sets -- risky because
   the existing flow is complex (self-signup, auth method checks, user lookup)
   and well-tested.

2. **New `/api/oidc/authorize` endpoint** that handles OIDC parameter
   validation, then delegates to the same core logic -- cleaner separation,
   backward compatible by construction.

Choose approach 2. The new endpoint validates OIDC params, maps `client_id` to
`app_id`, stores `nonce`/`scope` on the auth code, then reuses existing
`createAuthCode` and redirect logic.

The `auth_codes` table needs two new nullable columns: `nonce` (text) and
`scope` (text). These are nullable so legacy flows that don't set them continue
to work. The `createAuthCode` function in `lib/sso-service.ts` gets optional
`nonce` and `scope` parameters.

**Files expected to change:**

- `app/api/oidc/authorize/route.ts` (new): OIDC authorization endpoint
- `lib/sso-service.ts`: add `nonce` and `scope` params to `createAuthCode` and `consumeAuthCode`
- `lib/oidc/params.ts` (new): OIDC parameter validation and mapping
- `lib/auth-routes.ts`: add `/api/oidc/` to `PUBLIC_ROUTE_PREFIXES`
- `migrations/028_oidc_auth_code_fields.sql` (new): add `nonce`, `scope` columns to `auth_codes`

Testing approach: E2E

**Out of scope:** Token issuance with ID tokens (plan 016). This plan only
handles the authorization request and code issuance with OIDC metadata attached.

## Tasks

1. Create migration `028_oidc_auth_code_fields.sql` adding `nonce` (text, nullable) and `scope` (text, nullable) columns to `access_broker_app.auth_codes`
2. Update `createAuthCode` in `lib/sso-service.ts` to accept optional `nonce` and `scope` parameters and store them
3. Update `consumeAuthCode` and the `consume_auth_code` RPC to return `nonce` and `scope` alongside `user_id` and `redirect_uri`
4. Create `lib/oidc/params.ts` with validation for OIDC authorization request parameters (client_id, response_type, scope, nonce, redirect_uri)
5. Create `app/api/oidc/authorize/route.ts` that validates OIDC params, checks user session, handles login redirect, creates auth code with nonce/scope, and redirects to callback
6. Add `/api/oidc/` to `PUBLIC_ROUTE_PREFIXES` in `lib/auth-routes.ts`
7. Add unit tests for OIDC parameter validation

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -f app/api/oidc/authorize/route.ts
- [assert] test -f lib/oidc/params.ts
- [assert] test -f migrations/028_oidc_auth_code_fields.sql
- [assert] grep -q "nonce" lib/sso-service.ts
