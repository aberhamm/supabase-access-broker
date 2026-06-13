---
id: 027
title: Hash SSO auth codes at rest (SHA-256)
status: done
blocked-by: [025]
goal: sso-security-ux-audit-findings
allows-migrations: true
needs-review: none
created: 2026-06-12
completed: 2026-06-13
reviewed: false
qa: automated
---

## Requirements

SSO auth codes are stored in plaintext in `access_broker_app.auth_codes.code`
(created in migration 007). Hashing them means a database read is not
sufficient to redeem an in-flight code. Unsalted SHA-256 is appropriate here
because the plaintext is 32 random bytes (256-bit entropy) — there is no
dictionary to attack, unlike a user-chosen password. (Client secrets in this
codebase use the same construction for the same reason.) Codes are single-use
with a 5-minute expiry, which bounds the exposure but doesn't remove it.

**Acceptance criteria:**

- [ ] `createAuthCode` in `lib/sso-service.ts` stores `sha256Hex(code)` in the `code` column and returns the plaintext code to the caller (the redirect URL contract is unchanged)
- [ ] `consumeAuthCode` hashes the presented code with `sha256Hex` before calling the `consume_auth_code` RPC; the RPC itself is unchanged (it compares whatever values it is given)
- [ ] A new migration `028_hash_auth_codes.sql` deletes all existing `auth_codes` rows (active ones are redeemable for at most 5 minutes, but stale plaintext rows may have persisted indefinitely — the wipe removes both), updates the column comment, and adds a CHECK constraint `auth_codes_code_is_sha256 CHECK (code ~ '^[0-9a-f]{64}$')` so plaintext inserts fail loudly (eng-review D9)
- [ ] The full SSO flow (mint via `/sso/complete`, exchange via `/api/auth/exchange`) works end to end with hashed storage
- [ ] OIDC plan 015's coordination edits (already applied at planning time: `blocked-by: [014, 027]`, migration filename bumped to `029_oidc_auth_code_fields.sql`, hashed-codes design note) are intact — do not revert them
- [ ] Unit tests prove the property with three explicit assertions (eng-review D10): (a) the `.from('auth_codes').insert()` mock receives `sha256Hex(<returned plaintext>)`, (b) the `consume_auth_code` RPC mock receives `p_code: sha256Hex(<input code>)`, (c) the plaintext value is never passed to either mock. Existing expectations in `tests/unit/sso-service.test.ts` that assert plaintext `p_code` values are updated accordingly

## Design

Hash in the application layer only. `sha256Hex` already exists in
`lib/sso-service.ts`. Because the `consume_auth_code` RPC does an opaque
equality match (`ac.code = p_code`), hashing both at insert and at lookup
requires **no SQL function change** — only the two TypeScript functions
change. Entropy is unaffected (the plaintext stays 32 random bytes,
base64url).

**Deploy behavior (explicit):** any auth code minted before the deploy and
not yet exchanged becomes unredeemable, because the new code compares a hash
against a stored plaintext. With a 5-minute code lifetime and immediate-use
semantics (the client app exchanges the code on callback, sub-second), the
real-world impact is a failed login for at most a handful of mid-flight users
who retry once. No transition/backfill path is needed; the migration's
row-wipe just makes the cutover clean. This is accepted.

**Deploy mode assumption:** this cutover analysis assumes a non-rolling
deploy (the current single-instance docker-compose setup). A mixed-version
fleet would mint/consume inconsistently — if the deployment model ever moves
to rolling updates, this plan needs dual-read support instead. The CHECK
constraint makes a mixed-version deploy fail fast rather than half-work.

**Re-run caveat:** the migration is idempotent but not operationally free —
re-running it wipes active auth codes (≤5 min of failed logins). The
migration header should say `-- Safe to re-run: YES (idempotent; NOTE:
re-running invalidates in-flight logins for up to 5 minutes)`.

**Coordination with the OIDC backlog (already done at planning time):**
plan 015 extends the same `createAuthCode`/`consumeAuthCode` functions and
previously hardcoded `migrations/028_oidc_auth_code_fields.sql`, colliding
with this plan's migration number. `docs/plans/015-oidc-authorization-endpoint.md`
has already been amended (`blocked-by: [014, 027]`, migration bumped to 029,
hashed-codes note). The verification asserts below guard against regression.

**Files expected to change:**

- `lib/sso-service.ts`: hash in `createAuthCode` and `consumeAuthCode`
- `migrations/028_hash_auth_codes.sql` (new): wipe rows + column comment

**Out of scope:** hashing refresh tokens (plan 017 already specifies hashed
storage), the `passkey_challenges` table, rate limiting (plan 025), changing
code entropy or expiry.

Testing approach: unit-only

## Tasks

1. Update `createAuthCode` to insert `sha256Hex(code)` while returning the plaintext code
2. Update `consumeAuthCode` to hash the presented code before invoking the RPC
3. Write `migrations/028_hash_auth_codes.sql`: `DELETE FROM access_broker_app.auth_codes;`, `COMMENT ON COLUMN ... 'SHA-256 hex digest of the auth code (plaintext is never stored)'`, and the `auth_codes_code_is_sha256` CHECK constraint. Follow the conventions of migrations 026/027: `-- Migration:` header comment, re-run caveat from Design, `BEGIN;`/`COMMIT;` wrapper (no `NOTIFY pgrst` — no schema-cache change here)
4. Add unit tests with the three D10 assertions (insert receives the hash of the returned plaintext; RPC receives the hash of the input; plaintext never reaches either mock). Extend the existing `mockSchema` stub in `tests/unit/sso-service.test.ts` with a `.from('auth_codes').insert()` chain and update existing plaintext `p_code` expectations
5. Run lint, unit tests, build

## Verification

- [cmd] pnpm lint
- [cmd] pnpm test
- [cmd] pnpm build
- [assert] test -f migrations/028_hash_auth_codes.sql
- [assert] grep -q "auth_codes_code_is_sha256" migrations/028_hash_auth_codes.sql
- [cmd] pnpm test -- tests/unit/sso-service.test.ts
- [assert] grep -q "blocked-by: \[014, 027\]" docs/plans/015-oidc-authorization-endpoint.md
- [assert] grep -q "029_oidc_auth_code_fields" docs/plans/015-oidc-authorization-endpoint.md
- [manual] Against a live instance: complete an SSO login and exchange the code via /api/auth/exchange; inspect the auth_codes row and confirm the stored value is a 64-char hex digest, not the URL code

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | RAN (outside voice) | 10 findings: CHECK constraint added (D9), 8 mechanical fixes accepted (D10), 1 deploy-mode note |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 0 issues in architecture/quality/tests/perf sections |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not applicable (no UI scope) |

- **CODEX:** test spec rewritten to three property-proving assertions; CHECK constraint enforces the hash invariant at the DB; re-run caveat and entropy rationale corrected; plan 015 `allows-migrations` workflow bug fixed.
- **CROSS-MODEL:** no contradictions — the self-review's clean verdict held for architecture, but Codex tightened test precision and operational wording substantially.
- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready for autonomous execution behind plan 025 (status flipped to pending, 2026-06-12).

## Implementation Notes

Updated `createAuthCode` to store `sha256Hex(code)` while returning the plaintext redirect code, and updated `consumeAuthCode` to hash presented codes before calling the existing opaque `consume_auth_code` RPC. Added migration `028_hash_auth_codes.sql` to wipe existing auth-code rows, document the hashed column contract, and enforce a 64-character lowercase hex digest with `auth_codes_code_is_sha256`. Extended `sso-service` tests to prove inserts and RPC calls receive hashes and not plaintext values. Verified the OIDC coordination edits remained intact.

**Files changed:**

- `lib/sso-service.ts` (modified)
- `migrations/028_hash_auth_codes.sql` (created)
- `tests/unit/sso-service.test.ts` (modified)

**Commit:** `3ebf224` — `fix(sso): hash auth codes at rest`
