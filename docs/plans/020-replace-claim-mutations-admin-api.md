---
id: 020
title: Replace claim mutation RPCs with Admin API via storage layer
status: blocked
blocked-by: [019]
allows-migrations: false
needs-review: none
created: 2026-06-05
---

## Requirements

The claim write path currently uses SECURITY DEFINER RPCs that directly mutate
`auth.users.raw_app_meta_data` via SQL. This is fragile (Supabase schema
changes break it) and a security concern (SECURITY DEFINER runs as the
defining role). This plan migrates all claim write operations to use the
Supabase Admin API through the storage abstraction layer from plan 019.

**Acceptance criteria:**

- [ ] `setAppClaim`, `setAppClaimsBatch`, `deleteAppClaim`, `setAppMetadataClaim`, `deleteAppMetadataClaim` operations in `supabase-claims-store.ts` use `supabase.auth.admin.updateUserById()` instead of RPC calls
- [ ] All server actions that write claims (`app/actions/claims.ts`, `app/actions/app-users.ts`) use the `ClaimsStore` interface instead of direct RPC calls
- [ ] The API routes that write claims (`app/api/apps/[appId]/users/[userId]/claims/route.ts`) use `ClaimsStore`
- [ ] The SSO complete flow's self-signup auto-grant (`app/sso/complete/route.ts`) uses `ClaimsStore`
- [ ] The `set_app_claim`, `set_app_claims_batch`, `delete_app_claim`, `set_app_metadata_claim`, `delete_app_metadata_claim` RPCs are preserved but deprecated (not removed, to avoid breaking any external callers or the access token hook)
- [ ] All existing e2e and unit tests pass with the new write path
- [ ] Claim writes via Admin API produce the same `raw_app_meta_data` structure as the RPCs did

## Design

The Admin API approach for claim mutations:

1. **Read-modify-write:** `getUserById()` to get current `app_metadata`, modify
   the relevant app's claims, then `updateUserById({ app_metadata })`. This is
   the same pattern Supabase recommends.

2. **Atomicity concern:** The RPC approach uses SQL-level atomicity. The Admin
   API approach has a read-modify-write race window. Mitigate with optimistic
   concurrency: compare the `updated_at` timestamp before and after, retry once
   on conflict.

3. **Migration approach:** Update `supabase-claims-store.ts` to use Admin API
   for writes, then update consuming code to use `ClaimsStore` instead of
   direct RPC calls.

**Files expected to change:**

- `lib/storage/supabase-claims-store.ts`: rewrite write methods to use Admin API
- `app/actions/claims.ts`: replace direct RPC calls with ClaimsStore
- `app/actions/app-users.ts`: replace claim-writing RPCs with ClaimsStore
- `app/api/apps/[appId]/users/[userId]/claims/route.ts`: use ClaimsStore
- `app/sso/complete/route.ts`: use ClaimsStore for self-signup auto-grant
- `lib/claims.ts`: deprecation comments on write functions

Testing approach: E2E

**Out of scope:** Removing the old RPCs (they may be used by the access token
hook or external callers). Read-path migration (plan 021).

## Tasks

1. Update `supabase-claims-store.ts` write methods to use `supabase.auth.admin.updateUserById()` with read-modify-write pattern and optimistic concurrency retry
2. Migrate `app/actions/claims.ts` to use `getClaimsStore()` for all write operations
3. Migrate `app/actions/app-users.ts` to use `getClaimsStore()` for claim writes (user invite, grant access, revoke access)
4. Migrate `app/api/apps/[appId]/users/[userId]/claims/route.ts` PATCH and DELETE handlers to use `getClaimsStore()`
5. Migrate the self-signup auto-grant in `app/sso/complete/route.ts` to use `getClaimsStore()`
6. Add deprecation JSDoc comments to write functions in `lib/claims.ts`
7. Run existing e2e tests to verify behavioral equivalence

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] grep -q "ClaimsStore\|getClaimsStore" app/actions/claims.ts
- [assert] grep -q "ClaimsStore\|getClaimsStore" app/api/apps/*/users/*/claims/route.ts
- [assert] grep -q "@deprecated" lib/claims.ts
