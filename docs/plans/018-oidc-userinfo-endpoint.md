---
id: 018
title: Add OIDC userinfo endpoint
status: blocked
blocked-by: [016, 017]
allows-migrations: false
needs-review: none
created: 2026-06-05
---

## Requirements

OIDC clients use the userinfo endpoint to fetch identity claims for the
authenticated user using an access token. NextAuth/Auth.js automatically calls
this endpoint after token exchange. This plan implements the standard userinfo
endpoint per OpenID Connect Core Section 5.3.

**Acceptance criteria:**

- [ ] `GET /api/oidc/userinfo` returns user claims when presented with a valid access token in the `Authorization: Bearer` header
- [ ] `POST /api/oidc/userinfo` also works (per spec, both methods must be supported)
- [ ] Response includes standard claims: `sub`, `email`, `email_verified`
- [ ] When `profile` scope was requested, response also includes `name`, `preferred_username`, `picture`, `updated_at` (sourced from `access_broker_app.profiles`)
- [ ] Invalid or expired access tokens return HTTP 401 with `WWW-Authenticate: Bearer error="invalid_token"` header
- [ ] Missing access token returns HTTP 401 with `WWW-Authenticate: Bearer` header (no error parameter)
- [ ] Access tokens with insufficient scope return HTTP 403 with `WWW-Authenticate: Bearer error="insufficient_scope"`
- [ ] Response `Content-Type` is `application/json`
- [ ] Rate limiting is applied using existing infrastructure

## Design

The userinfo endpoint validates the access token JWT issued by plan 016/017,
extracts the `sub` claim, and fetches user data.

1. **Token validation:** Verify the JWT signature using the public key from
   `lib/oidc/keys.ts`. Check `exp`, `iss`, `aud`. Extract `sub` and `scope`.

2. **Claim sources:** Combine data from:
   - Supabase Auth Admin API (`getUserById`) for `email`, `email_verified`
   - `access_broker_app.profiles` table for `display_name`, `first_name`,
     `last_name`, `avatar_url`

3. **Scope filtering:** Only return claims that match the requested scopes
   stored in the access token.

**Files expected to change:**

- `app/api/oidc/userinfo/route.ts` (new): userinfo endpoint (GET + POST)
- `lib/oidc/token-validation.ts` (new): access token JWT validation
- `lib/oidc/userinfo-claims.ts` (new): claim assembly from user data + profile

Testing approach: E2E

**Out of scope:** Claims aggregation from external sources, signed/encrypted
userinfo responses (plain JSON is sufficient for our use case).

## Tasks

1. Create `lib/oidc/token-validation.ts` with JWT verification (RS256 signature, exp, iss, aud checks) using the public key from `lib/oidc/keys.ts`
2. Create `lib/oidc/userinfo-claims.ts` that maps user + profile data to OIDC standard claims, filtered by scope
3. Create `app/api/oidc/userinfo/route.ts` handling both GET and POST, validating the Bearer token, fetching user data, and returning filtered claims
4. Apply rate limiting to the userinfo endpoint
5. Add unit tests for token validation and claim mapping

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -f app/api/oidc/userinfo/route.ts
- [assert] test -f lib/oidc/token-validation.ts
- [assert] test -f lib/oidc/userinfo-claims.ts
- [assert] grep -q "userinfo" app/api/oidc/userinfo/route.ts
