---
id: 017
title: Add token expiry management and refresh token support
status: blocked
blocked-by: [016]
allows-migrations: true
needs-review: eng
created: 2026-06-05
---

## Requirements

The current exchange endpoint returns an `expires_in: 300` field but there is no
actual token expiry enforcement or refresh mechanism. OIDC clients expect
refresh tokens to maintain sessions without re-authentication. This plan adds
refresh token issuance, storage, rotation, and revocation.

**Acceptance criteria:**

- [ ] When `scope` includes `offline_access`, the token endpoint returns a `refresh_token` alongside access and ID tokens
- [ ] Refresh tokens are opaque strings (not JWTs), stored in a new `access_broker_app.refresh_tokens` table with `user_id`, `app_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`
- [ ] `POST /api/oidc/token` with `grant_type=refresh_token` and a valid refresh token returns a new access token, ID token, and rotated refresh token
- [ ] Refresh token rotation: each use invalidates the old token and issues a new one (prevents replay)
- [ ] Refresh tokens expire after 30 days (configurable via env var `OIDC_REFRESH_TOKEN_LIFETIME_DAYS`)
- [ ] Access token lifetime is configurable via `OIDC_ACCESS_TOKEN_LIFETIME_SECONDS` (default 3600)
- [ ] Revoked or expired refresh tokens return `{ error: "invalid_grant" }` with HTTP 400
- [ ] A refresh token reuse attempt (using an already-rotated token) revokes the entire token family for that user+app as a security measure
- [ ] Rate limiting is applied to refresh token requests

## Design

Refresh token design follows OAuth 2.0 best practices (RFC 6749 Section 1.5,
OAuth 2.0 Security BCP Section 4.13):

1. **Storage:** New `refresh_tokens` table in `access_broker_app` schema. Tokens
   are stored as SHA-256 hashes (never plaintext). Each row has a `family_id`
   (UUID) linking rotated tokens together for reuse detection.

2. **Rotation:** On each refresh, the old token is marked revoked and a new
   token is issued with the same `family_id`. If a revoked token is presented,
   all tokens in that family are revoked (breach detection).

3. **Token format:** Opaque `rt_` prefixed base64url strings (64 bytes of
   randomness). The prefix makes them easily distinguishable from access tokens
   in logs and debugging.

4. **Cleanup:** Expired tokens are cleaned up by a SQL function that can be
   called periodically (or via pg_cron if available).

**Files expected to change:**

- `migrations/030_refresh_tokens.sql` (new): refresh_tokens table, indexes, cleanup function
- `lib/oidc/refresh-tokens.ts` (new): refresh token issuance, rotation, revocation, validation
- `app/api/oidc/token/route.ts`: add `grant_type=refresh_token` handling
- `lib/oidc/token-response.ts`: include `refresh_token` in response when applicable
- `.env.example`: add `OIDC_REFRESH_TOKEN_LIFETIME_DAYS`, `OIDC_ACCESS_TOKEN_LIFETIME_SECONDS`

Testing approach: E2E

**Out of scope:** Token introspection endpoint (RFC 7662), token revocation
endpoint (RFC 7009) -- these can be added later if needed.

## Tasks

1. Create migration `030_refresh_tokens.sql` with the `refresh_tokens` table (id, family_id, token_hash, user_id, app_id, scope, expires_at, revoked_at, created_at), indexes on token_hash and family_id, and a cleanup function for expired tokens
2. Create `lib/oidc/refresh-tokens.ts` with functions: `issueRefreshToken`, `consumeRefreshToken` (with rotation and family revocation), `revokeTokenFamily`
3. Update `app/api/oidc/token/route.ts` to handle `grant_type=refresh_token` requests and include `refresh_token` in responses when `offline_access` scope is requested
4. Update `lib/oidc/token-response.ts` to conditionally include `refresh_token` field
5. Update `.env.example` with configurable token lifetimes
6. Add unit tests for refresh token issuance, rotation, reuse detection, and expiry

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -f migrations/030_refresh_tokens.sql
- [assert] test -f lib/oidc/refresh-tokens.ts
- [assert] grep -q "refresh_token" app/api/oidc/token/route.ts
- [assert] grep -q "OIDC_REFRESH_TOKEN_LIFETIME_DAYS" .env.example
