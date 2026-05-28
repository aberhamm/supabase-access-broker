---
id: 011
title: Add MFA step-up to claim deletion, ban, and admin profile update
status: in-progress
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

Several admin server actions that perform privilege-affecting operations skip the
MFA step-up check, creating inconsistency with peer actions that do require it.
A compromised AAL1 admin session can delete claims, ban users, or change another
user's email without MFA challenge.

CSO audit findings #2 and #3 (2026-05-28).

**Acceptance criteria:**

- [ ] `deleteClaimAction` in `app/actions/claims.ts` calls `requireStepUp(supabase)` after the `isClaimsAdmin` check, identical to `setClaimAction`
- [ ] `banUser` in `app/actions/users.ts` calls `requireClaimsAdmin({ stepUp: true })`
- [ ] `unbanUser` in `app/actions/users.ts` calls `requireClaimsAdmin({ stepUp: true })`
- [ ] `updateUserProfileAdmin` in `app/actions/users.ts` calls `requireClaimsAdmin({ stepUp: true })`
- [ ] Existing unit tests pass
- [ ] No other `requireClaimsAdmin()` calls that perform write operations are missing `{ stepUp: true }`

## Design

The fix follows established patterns already present in each file:

- `claims.ts`: `setClaimAction` (line 63) shows the exact `requireStepUp` pattern to replicate in `deleteClaimAction` (line 89)
- `users.ts`: `deleteUser` (line 173), `createUserWithPassword` (line 75), `resetUserPasswordAdmin` (line 293), and `unenrollMFAFactor` (line 402) all pass `{ stepUp: true }` — replicate in `banUser` (line 323), `unbanUser` (line 348), and `updateUserProfileAdmin` (line 199)

Also audit the remaining `requireClaimsAdmin()` calls without `{ stepUp: true }`:
- Line 147: `inviteUser` — creates an invitation, should have step-up (write operation creating user access)
- Line 257: `listMFAFactors` — read-only, no step-up needed
- Line 373: `confirmUserEmail` — write operation, should have step-up
- Line 440: `getApiKeysForUser` — read-only, no step-up needed

**Files expected to change:**

- `app/actions/claims.ts` — add `requireStepUp` + error return to `deleteClaimAction`
- `app/actions/users.ts` — add `{ stepUp: true }` to `banUser`, `unbanUser`, `updateUserProfileAdmin`, `inviteUser`, `confirmUserEmail`

**Out of scope:** Changing MFA enforcement mode (soft vs. hard). UI changes for step-up modal (already wired up). Adding step-up to read-only operations.

## Tasks

1. In `app/actions/claims.ts`, add `requireStepUp` call to `deleteClaimAction` after the `isClaimsAdmin` check, matching the pattern in `setClaimAction`
2. In `app/actions/users.ts`, change `requireClaimsAdmin()` to `requireClaimsAdmin({ stepUp: true })` in `banUser`, `unbanUser`, `updateUserProfileAdmin`, `inviteUser`, and `confirmUserEmail`
3. Verify no other write-operation calls to `requireClaimsAdmin()` are missing `{ stepUp: true }`
4. Run `pnpm build` and `pnpm test` to confirm no regressions

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test` exits 0
- [assert] `grep -c 'requireStepUp' app/actions/claims.ts` returns at least 4 (import + setClaimAction + setClaimsAdminAction + deleteClaimAction)
- [assert] `grep -c 'stepUp: true' app/actions/users.ts` returns at least 8 (all write operations)
