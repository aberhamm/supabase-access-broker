---
id: 014
title: Add OIDC discovery document and JWKS endpoint
status: blocked
blocked-by: []
allows-migrations: false
needs-review: eng
created: 2026-06-05
---

## Requirements

Client applications currently integrate with the Access Broker via custom
exchange code. Standard libraries like NextAuth/Auth.js expect an OpenID Connect
discovery document at `/.well-known/openid-configuration` and a JWKS endpoint to
validate tokens. This plan adds both, along with the RSA key pair management that
all subsequent OIDC plans depend on.

**Acceptance criteria:**

- [ ] `GET /.well-known/openid-configuration` returns a valid OpenID Provider Configuration document per RFC 8414 / OpenID Connect Discovery 1.0
- [ ] The discovery document includes `issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `jwks_uri`, `response_types_supported`, `subject_types_supported`, `id_token_signing_alg_values_supported`, `scopes_supported`, `token_endpoint_auth_methods_supported`, `claims_supported`
- [ ] `GET /.well-known/jwks.json` returns a valid JWK Set containing the broker's public signing key(s) in RS256 format
- [ ] An RSA key pair is generated and stored securely (env var or file-based, not hardcoded), with a `lib/oidc/keys.ts` module that loads and caches the key
- [ ] The `issuer` value matches the canonical `NEXT_PUBLIC_APP_URL` (e.g., `https://auth.matthew.systems`)
- [ ] Both endpoints respond with correct `Content-Type: application/json` and appropriate `Cache-Control` headers
- [ ] Existing `/api/auth/exchange` and `/sso/complete` routes continue to work unchanged (backward compatibility)

## Design

This is the foundation for all subsequent OIDC plans. The key design decisions:

1. **Key management:** Use an RSA-2048 key pair stored as PEM in environment
   variables (`OIDC_SIGNING_KEY` for private, derived public key). A
   `lib/oidc/keys.ts` module handles loading, parsing, and caching the JWK
   representation. Include a `scripts/generate-oidc-keys.ts` helper to generate
   a new key pair for operators.

2. **Discovery document:** Static JSON built at request time from env vars.
   The `authorization_endpoint` will initially point to the existing
   `/sso/complete` path (plan 015 makes it OIDC-compatible). The `token_endpoint`
   and `userinfo_endpoint` will point to paths that don't exist yet (plans 016,
   018 will create them) -- this is fine per the spec; discovery documents
   advertise the provider's capabilities.

3. **JWKS endpoint:** Returns the public key(s) in JWK format. Support key
   rotation by allowing multiple keys with `kid` (key ID) identifiers.

**Files expected to change:**

- `lib/oidc/keys.ts` (new): RSA key loading, JWK conversion, caching
- `lib/oidc/discovery.ts` (new): discovery document builder
- `app/.well-known/openid-configuration/route.ts` (new): discovery endpoint
- `app/.well-known/jwks.json/route.ts` (new): JWKS endpoint
- `scripts/generate-oidc-keys.ts` (new): key generation helper
- `.env.example`: add `OIDC_SIGNING_KEY` placeholder
- `lib/auth-routes.ts`: add `/.well-known/` to `PUBLIC_ROUTE_PREFIXES`

Testing approach: E2E

**Out of scope:** Token issuance (plan 016), authorization endpoint changes
(plan 015), userinfo (plan 018). This plan only provides the foundation.

## Tasks

1. Create `scripts/generate-oidc-keys.ts` that generates an RSA-2048 key pair and outputs the private key PEM for `OIDC_SIGNING_KEY` env var
2. Create `lib/oidc/keys.ts` with functions to load the private key from env, derive the public key, convert to JWK format with `kid`, and cache the result
3. Create `lib/oidc/discovery.ts` that builds the discovery document JSON from the issuer URL and advertised endpoints
4. Create `app/.well-known/openid-configuration/route.ts` as a GET handler returning the discovery document
5. Create `app/.well-known/jwks.json/route.ts` as a GET handler returning the JWK Set
6. Add `/.well-known/` to `PUBLIC_ROUTE_PREFIXES` in `lib/auth-routes.ts`
7. Update `.env.example` with `OIDC_SIGNING_KEY` placeholder and documentation comment
8. Add unit tests for key loading, JWK conversion, and discovery document structure

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] grep -r "openid-configuration" app/.well-known/ | grep -q "route.ts"
- [assert] grep -r "jwks" app/.well-known/ | grep -q "route.ts"
- [assert] grep -q "OIDC_SIGNING_KEY" .env.example
- [assert] grep -q ".well-known" lib/auth-routes.ts
