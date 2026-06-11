---
id: 019
title: Create storage abstraction layer for auth data access
status: pending
blocked-by: []
needs-review: eng
created: 2026-06-05
---

## Requirements

The codebase directly accesses `auth.users` through ~30 SECURITY DEFINER RPCs
and raw Supabase queries. If Supabase changes their auth schema (which they
have done in the past), multiple code paths break simultaneously. This plan
introduces a storage abstraction layer that centralizes all auth data access
behind a typed interface, making it possible to swap the underlying
implementation (direct SQL, Admin API, or future providers) without touching
consuming code.

**Acceptance criteria:**

- [ ] A `lib/storage/user-store.ts` module exports a `UserStore` interface with methods for all user data operations: `getUserById`, `getUserByEmail`, `listUsers`, `updateUserMetadata`, `createUser`, `banUser`, `unbanUser`
- [ ] A `lib/storage/supabase-user-store.ts` implements `UserStore` using the current Supabase patterns (Admin API + RPCs) as the default implementation
- [ ] A `lib/storage/claims-store.ts` module exports a `ClaimsStore` interface for all claims operations: `getAppClaims`, `setAppClaims`, `setAppClaimsBatch`, `deleteAppClaim`, `getAppMetadataClaim`, `setAppMetadataClaim`, `deleteAppMetadataClaim`
- [ ] A `lib/storage/supabase-claims-store.ts` implements `ClaimsStore` using the current RPC-based approach as the default
- [ ] A `lib/storage/index.ts` exports factory functions (`getUserStore()`, `getClaimsStore()`) that return the default implementations
- [ ] The interfaces use domain types (not Supabase-specific types) so consuming code has no Supabase imports
- [ ] All existing tests continue to pass (no behavioral changes in this plan)

## Design

The abstraction layer follows the repository pattern. Each store interface
defines the contract; implementations can be swapped.

Key principle: **this plan only creates the abstraction layer and the default
implementations that wrap the current code.** It does NOT migrate consuming code
to use the new interfaces -- that's plan 020 and 021.

Domain types go in `lib/storage/types.ts`:
- `StoredUser`: id, email, email_verified, app_metadata, created_at, etc.
- `AppClaims`: enabled, role, permissions, metadata
- `PaginatedResult<T>`: data, total, page, pageSize

The Supabase implementations delegate to existing RPCs and Admin API calls,
providing a thin adapter layer.

**Files expected to change:**

- `lib/storage/types.ts` (new): domain types
- `lib/storage/user-store.ts` (new): UserStore interface
- `lib/storage/claims-store.ts` (new): ClaimsStore interface
- `lib/storage/supabase-user-store.ts` (new): Supabase UserStore implementation
- `lib/storage/supabase-claims-store.ts` (new): Supabase ClaimsStore implementation
- `lib/storage/index.ts` (new): factory exports

Testing approach: unit-only

**Out of scope:** Migrating consuming code to use the stores (plans 020, 021).
Replacing RPCs with Admin API calls (plan 020). This plan is purely additive.

## Tasks

1. Create `lib/storage/types.ts` with domain types (`StoredUser`, `AppClaims`, `PaginatedResult`, etc.) independent of Supabase types
2. Create `lib/storage/user-store.ts` defining the `UserStore` interface
3. Create `lib/storage/claims-store.ts` defining the `ClaimsStore` interface
4. Create `lib/storage/supabase-user-store.ts` implementing `UserStore` by wrapping existing Supabase Admin API calls and RPCs
5. Create `lib/storage/supabase-claims-store.ts` implementing `ClaimsStore` by wrapping existing RPC calls from `lib/claims.ts`
6. Create `lib/storage/index.ts` with factory functions
7. Add unit tests verifying the interfaces are properly typed and the factory functions return correct implementations

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] test -f lib/storage/types.ts
- [assert] test -f lib/storage/user-store.ts
- [assert] test -f lib/storage/claims-store.ts
- [assert] test -f lib/storage/supabase-user-store.ts
- [assert] test -f lib/storage/supabase-claims-store.ts
- [assert] test -f lib/storage/index.ts
