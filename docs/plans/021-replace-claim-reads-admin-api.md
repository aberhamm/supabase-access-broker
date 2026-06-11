---
id: 021
title: Replace claim read and user list RPCs with storage layer
status: blocked
blocked-by: [019, 020]
allows-migrations: false
needs-review: none
created: 2026-06-05
---

## Requirements

After write operations are migrated (plan 020), the read path still uses
direct RPCs for listing app users, reading claims, and user lookups. This plan
migrates the remaining read operations to use the `UserStore` and `ClaimsStore`
interfaces, completing the storage abstraction.

**Acceptance criteria:**

- [ ] `getUserById`, `getUserByEmail`, `listUsers` operations use `UserStore` instead of direct Supabase calls or RPCs
- [ ] `getAppClaims`, `getMyClaims`, `isClaimsAdmin`, `isAppAdmin` operations use `ClaimsStore` or `UserStore` instead of direct RPCs
- [ ] Server actions in `app/actions/users.ts` use `UserStore`
- [ ] The `app/api/auth/exchange/route.ts` token exchange uses `UserStore` for user lookup
- [ ] The `app/api/users/lookup/route.ts` user lookup API uses `UserStore`
- [ ] The dashboard pages that list users use `UserStore`
- [ ] `getAllUsers` in `lib/claims.ts` is replaced with `UserStore.listUsers`
- [ ] All existing e2e and unit tests pass
- [ ] No direct `supabase.auth.admin` or `supabase.rpc` calls remain in consuming code outside of the storage layer implementations

## Design

This is a mechanical migration: replace each call site with the equivalent
`UserStore` or `ClaimsStore` method. The implementations in
`supabase-user-store.ts` and `supabase-claims-store.ts` handle the actual
Supabase interactions.

The user listing in the dashboard currently uses a paginated RPC
(`list_app_users_paginated`). The `UserStore.listUsers` method should accept
pagination parameters and the Supabase implementation delegates to that RPC
(for now -- it can be changed to Admin API later without touching consuming
code).

**Files expected to change:**

- `app/actions/users.ts`: use UserStore
- `app/actions/claims.ts`: use ClaimsStore for read operations
- `app/api/auth/exchange/route.ts`: use UserStore for user lookup
- `app/api/users/lookup/route.ts`: use UserStore
- `app/api/apps/[appId]/users/route.ts`: use UserStore
- `app/api/apps/[appId]/users/[userId]/claims/route.ts`: use ClaimsStore for reads
- `app/(dashboard)/users/page.tsx` and related: use UserStore
- `lib/claims.ts`: deprecation comments on remaining read functions

Testing approach: E2E

**Out of scope:** Removing deprecated RPCs from the database. Changing the
underlying Supabase implementation (this plan only routes through the
abstraction).

## Tasks

1. Ensure `supabase-user-store.ts` implements all read methods including paginated user listing
2. Migrate `app/actions/users.ts` to use `getUserStore()` for all user operations
3. Migrate `app/actions/claims.ts` remaining read operations to use `getClaimsStore()`
4. Migrate `app/api/auth/exchange/route.ts` to use `getUserStore().getUserById()` instead of `supabase.auth.admin.getUserById()`
5. Migrate `app/api/users/lookup/route.ts` to use `getUserStore().getUserByEmail()`
6. Migrate `app/api/apps/[appId]/users/route.ts` to use `getUserStore()`
7. Add deprecation JSDoc comments to remaining read functions in `lib/claims.ts`
8. Run full test suite to verify behavioral equivalence

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] grep -q "UserStore\|getUserStore" app/actions/users.ts
- [assert] grep -q "UserStore\|getUserStore" app/api/auth/exchange/route.ts
- [assert] grep -q "UserStore\|getUserStore" app/api/users/lookup/route.ts
