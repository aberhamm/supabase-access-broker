---
id: 016
title: Add OIDC token endpoint with JWT issuance
status: blocked
blocked-by: [014, 015]
allows-migrations: false
needs-review: eng
created: 2026-06-05
---

## Requirements

The current `/api/auth/exchange` endpoint returns raw JSON with user data and
claims. OIDC clients expect a token endpoint that returns `access_token`,
`id_token`, and `token_type` per RFC 6749 and OpenID Connect Core. This plan
adds a standard token endpoint that issues signed JWTs, while keeping the
existing exchange endpoint working for legacy clients.

**Acceptance criteria:**

- [ ] `POST /api/oidc/token` accepts `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, and `client_secret` (form-encoded or JSON body)
- [ ] Supports `client_secret_post` (secret in body) and `client_secret_basic` (Authorization header) authentication methods
- [ ] On success, returns `{ access_token, id_token, token_type: "Bearer", expires_in, scope }` per OIDC Core Section 3.1.3.3
- [ ] `id_token` is a signed JWT (RS256) containing standard claims: `iss`, `sub`, `aud`, `exp`, `iat`, `nonce` (if provided during authorization), `email`, `email_verified`
- [ ] `access_token` is a signed JWT (RS256) containing `iss`, `sub`, `aud`, `exp`, `iat`, `scope`, and app-specific claims under a namespaced key
- [ ] Token expiry defaults to 3600 seconds (1 hour) for access tokens, 3600 seconds for ID tokens
- [ ] Invalid/expired codes return `{ error: "invalid_grant", error_description: "..." }` with HTTP 400 per RFC 6749 Section 5.2
- [ ] Missing/invalid client credentials return `{ error: "invalid_client" }` with HTTP 401
- [ ] Unsupported `grant_type` returns `{ error: "unsupported_grant_type" }` with HTTP 400
- [ ] The existing `/api/auth/exchange` endpoint continues to work unchanged
- [ ] Rate limiting is applied using the existing `checkRateLimit` infrastructure

## Design

The token endpoint is the core of OIDC compliance. Key design decisions:

1. **JWT signing:** Use the RSA key pair from plan 014 (`lib/oidc/keys.ts`).
   Sign with RS256, include `kid` in the JWT header.

2. **Client authentication:** Reuse existing `authenticateAppRequest` logic
   but adapt it for OIDC conventions. `client_secret_post` maps to the existing
   `app_secret` body field. `client_secret_basic` maps to the existing Bearer
   auth path but with Base64-decoded client_id:client_secret.

3. **Auth code consumption:** Reuse `consumeAuthCode` from `lib/sso-service.ts`
   which now returns `nonce` and `scope` (from plan 015).

4. **JWT library:** Use Node.js built-in `crypto.sign` with the RSA key, or
   a minimal JWT helper. Avoid adding jose/jsonwebtoken as a dependency if
   possible -- the signing logic is straightforward for RS256.

5. **Claim mapping:** The `id_token` gets identity claims. The `access_token`
   gets authorization claims (app roles, permissions) under a namespaced key
   like `https://auth.matthew.systems/claims`.

**Files expected to change:**

- `app/api/oidc/token/route.ts` (new): token endpoint
- `lib/oidc/jwt.ts` (new): JWT creation and signing utilities
- `lib/oidc/token-response.ts` (new): token response builder
- `lib/oidc/client-auth.ts` (new): OIDC client authentication (client_secret_basic, client_secret_post)

Testing approach: E2E

**Out of scope:** Refresh tokens (plan 017), userinfo (plan 018). This plan
issues access + ID tokens only.

## Tasks

1. Create `lib/oidc/jwt.ts` with RS256 JWT signing using the key from `lib/oidc/keys.ts`, supporting standard JWT header and payload construction
2. Create `lib/oidc/client-auth.ts` adapting existing `authenticateAppRequest` for OIDC client_secret_basic and client_secret_post methods
3. Create `lib/oidc/token-response.ts` that builds the OIDC token response object (access_token, id_token, token_type, expires_in, scope)
4. Create `app/api/oidc/token/route.ts` as a POST handler that validates grant_type, authenticates client, consumes auth code, builds and signs JWT tokens, and returns the token response
5. Apply rate limiting to the token endpoint using existing `checkRateLimit`
6. Add unit tests for JWT signing, claim mapping, and token response structure
7. Add unit tests for client authentication methods (basic, post)

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -f app/api/oidc/token/route.ts
- [assert] test -f lib/oidc/jwt.ts
- [assert] test -f lib/oidc/client-auth.ts
- [assert] grep -q "id_token" lib/oidc/token-response.ts
