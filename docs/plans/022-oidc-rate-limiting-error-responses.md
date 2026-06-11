---
id: 022
title: Add rate limiting and standard error responses to OIDC endpoints
status: blocked
blocked-by: [016, 017, 018]
allows-migrations: false
needs-review: none
created: 2026-06-05
---

## Requirements

The OIDC endpoints from plans 016-018 need consistent rate limiting and
OAuth 2.0-compliant error responses. While individual plans apply basic rate
limiting, this plan standardizes the approach across all OIDC endpoints and
ensures error responses conform to RFC 6749 Section 5.2 and OpenID Connect
Core error formats.

**Acceptance criteria:**

- [ ] All OIDC endpoints (`/api/oidc/authorize`, `/api/oidc/token`, `/api/oidc/userinfo`) have rate limiting with appropriate per-endpoint thresholds
- [ ] Token endpoint: 20 requests/minute per client_id, 5 requests/minute per IP for failed attempts
- [ ] Userinfo endpoint: 60 requests/minute per access token subject
- [ ] Authorization endpoint: 30 requests/minute per IP
- [ ] Rate limit responses include `Retry-After` header per RFC 6585
- [ ] Token endpoint errors follow RFC 6749 Section 5.2 format: `{ error, error_description, error_uri }`
- [ ] Authorization endpoint errors redirect with `error` and `error_description` query params (when redirect_uri is valid) or show error page (when redirect_uri is invalid)
- [ ] Userinfo endpoint errors use `WWW-Authenticate` header per RFC 6750 Section 3
- [ ] All error responses include a `request_id` for debugging
- [ ] Error types are exhaustive: `invalid_request`, `invalid_client`, `invalid_grant`, `unauthorized_client`, `unsupported_grant_type`, `invalid_scope`, `access_denied`, `server_error`, `temporarily_unavailable`

## Design

Build a shared OIDC error handling module that all endpoints use:

1. **`lib/oidc/errors.ts`:** Typed error classes for each OAuth error code.
   Factory functions that produce the correct HTTP response for each endpoint
   type (redirect vs JSON vs WWW-Authenticate).

2. **Rate limit integration:** Wrap the existing `checkRateLimit` with
   OIDC-specific bucket naming and response formatting. Add `Retry-After`
   headers.

3. **Error response middleware:** A helper that catches thrown OIDC errors
   and formats them correctly based on the endpoint type.

**Files expected to change:**

- `lib/oidc/errors.ts` (new): OIDC error types, response builders
- `lib/oidc/rate-limit.ts` (new): OIDC-specific rate limit configuration and response formatting
- `app/api/oidc/token/route.ts`: use standardized error responses and rate limiting
- `app/api/oidc/authorize/route.ts`: use standardized error responses and rate limiting
- `app/api/oidc/userinfo/route.ts`: use standardized error responses and rate limiting

Testing approach: unit-only

**Out of scope:** Rate limiting for non-OIDC endpoints (already handled by
existing `lib/rate-limit.ts` and `lib/app-api-rate-limit.ts`).

## Tasks

1. Create `lib/oidc/errors.ts` with typed OIDC error classes and response builder functions for each endpoint type (JSON, redirect, WWW-Authenticate)
2. Create `lib/oidc/rate-limit.ts` with per-endpoint rate limit configuration, bucket naming, and `Retry-After` header formatting
3. Update `app/api/oidc/token/route.ts` to use the standardized error handling and rate limit module
4. Update `app/api/oidc/authorize/route.ts` to use standardized error handling and rate limiting
5. Update `app/api/oidc/userinfo/route.ts` to use standardized error handling and rate limiting
6. Add unit tests for error response formatting and rate limit configuration

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -f lib/oidc/errors.ts
- [assert] test -f lib/oidc/rate-limit.ts
- [assert] grep -q "Retry-After" lib/oidc/rate-limit.ts
- [assert] grep -q "invalid_grant\|invalid_client" lib/oidc/errors.ts
