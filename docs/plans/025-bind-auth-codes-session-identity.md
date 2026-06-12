---
id: 025
title: Bind SSO auth codes to session identity and rate-limit /sso/complete
status: done
blocked-by: []
goal: sso-security-ux-audit-findings
allows-migrations: false
needs-review: none
created: 2026-06-12
completed: 2026-06-13
reviewed: false
qa: automated
---

## Requirements

`app/sso/complete/route.ts` currently looks the authenticated user up by email
(`lookupUserByEmail`, lines ~156-176) and, when the looked-up ID differs from
the session's user ID, **mints the SSO auth code for the looked-up user
instead of the session user**. The lookup (`lookup_user_by_identifier`,
migration 011) matches `lower(email)` across all of `auth.users` with
`LIMIT 1`. If two accounts ever share an email (unconfirmed signups, OAuth
identity merges, admin-created duplicates), a session for one account gets an
auth code minted for the other — an account-impersonation vector. Auth codes
must always be bound to the authenticated session's user ID.

Separately, `/sso/complete` has no rate limit on its main path — only the
self-signup auto-grant branch is limited. A logged-in user can mint auth codes
in a tight loop.

**Acceptance criteria:**

- [ ] The `lookupUserByEmail` call and the user-ID substitution block are removed from `app/sso/complete/route.ts`; the auth code is always created with the session's `user.id`
- [ ] `lookupUserByEmail` is deleted from `lib/sso-service.ts` (it has no other callers — verify with `grep -rn lookupUserByEmail app lib`)
- [ ] The `sso_user_id_mismatch` audit event type is removed from `lib/audit-service.ts` (no remaining emitters; the separate `token_exchange_user_id_mismatch` event in `app/api/auth/exchange/route.ts` stays)
- [ ] `lib/auth-rate-limit.ts` gains a new `AuthLimitAction` value `'sso-complete'` with per-IP and per-identifier limits (suggested: ip 30/min, id 10/min — match the style of existing entries)
- [ ] `/sso/complete` enforces `enforceAuthLimit({ action: 'sso-complete', ip, identifier: user.id })` AFTER `validateRedirectUri` passes and BEFORE any auto-grant or code-minting work (eng-review D4: invalid-param requests must not burn the user's budget — prevents crafted-link griefing); when limited, it redirects to the error page with `error=temporarily_unavailable`
- [ ] Rate-limit denials are audit-logged: `logSSOEvent({ eventType: 'sso_complete_error', errorCode: 'temporarily_unavailable', metadata: { reason: 'rate_limited' } })` (eng-review D6)
- [ ] `getClientIp` in `lib/auth-rate-limit.ts` checks `cf-connecting-ip` (before the `x-forwarded-for` fallback chain, matching `extractClientIP` in `lib/audit-service.ts`) so per-IP buckets work behind Cloudflare (eng-review D5)
- [ ] Existing unit tests pass; new unit tests cover the rate-limit action config
- [ ] **REGRESSION (critical):** a route-level unit test (`tests/unit/sso-complete-route.test.ts`) asserts BOTH `createAuthCode` AND the self-signup `set_app_claims_batch` RPC receive the session's `user.id` exactly — proving the lookup-substitution behavior is gone from both consumers (eng-review D3). Mock at the service boundary (`@/lib/sso-service` functions) for route behavior; deep Supabase-chain mocks stay in the sso-service tests
- [ ] Route-level unit tests also cover: the new rate-limited branch (redirects to error page with `error=temporarily_unavailable`), the missing-params branch (`invalid_request` redirect), and the no-claims branch (`access_denied` redirect) — full machine-checked branch coverage without a live Supabase (eng-review decision D1: backfill)

## Design

Two independent hardenings to the same route handler.

**Identity binding:** delete the substitution, don't "fix" it. There is no
legitimate reason for the session user ID and an email lookup to disagree;
the original code papered over a duplicate-user condition. After removal,
`authUserId` is simply `user.id` from `supabase.auth.getUser()`. Do not add a
replacement consistency check — the session is the source of truth.

**Rate limit:** use `enforceAuthLimit` from `lib/auth-rate-limit.ts` (the
portal-path limiter that composes per-IP + per-identifier checks), NOT
`enforceRateLimit` from `lib/app-api-rate-limit.ts` (which is keyed for
app-API requests). Identifier is the authenticated `user.id`. Place the check
inside the `try` block immediately after `validateRedirectUri` succeeds and
before the auto-grant/minting work — invalid-param requests must NOT consume
the user's budget (crafted-link griefing, eng-review D4); unauthenticated
requests are unaffected either way. On limit, reuse the existing `buildErrorPageUrl` with
`temporarily_unavailable` and a "Too many requests" description, mirroring how
the existing signup-grant limit responds. Keep the existing
`enforceRateLimit('signup:...')` call in the auto-grant branch untouched.

**Testing note:** the `LIMITS` table is module-private — test the new action
through `enforceAuthLimit` with a mocked `checkRateLimit` (see
`tests/unit/sso-service.test.ts` for the established `vi.mock` pattern); do
not export `LIMITS`.

**Signup flow:** `/signup` round-trips through `/sso/complete` (`signup=1`),
hitting the route once or twice per legitimate signup — the 10/min per-user
limit leaves ample headroom. The limiter is Postgres-backed
(`consume_rate_limit` RPC, migration 026) and fails open on DB error, so CI
environments without the table are unaffected.

**Files expected to change:**

- `app/sso/complete/route.ts`: remove lookup/substitution; add rate-limit check
- `lib/sso-service.ts`: delete `lookupUserByEmail`
- `lib/auth-rate-limit.ts`: add `'sso-complete'` action + limits
- `lib/audit-service.ts`: remove `sso_user_id_mismatch` event type

Testing approach: unit-only for the verification gate (route + limiter unit tests with service-boundary mocks); the existing Playwright SSO specs cover the live flow when a Supabase environment is available

**Deploy prerequisite:** the limiter is a no-op (fails open) if migration 026
(`rate_limits` table + `consume_rate_limit` RPC) is not applied in the target
environment — verify with `pnpm migrate:status` before relying on it.

**Out of scope:** error-message contents (plan 026), auth-code hashing
(plan 027), any change to `lookup_user_by_identifier` SQL (still used by
`/api/users/lookup`), the OIDC endpoints (plans 014-022).

## Tasks

1. Remove the `lookupUserByEmail` import, call, and substitution block from `app/sso/complete/route.ts`; use `user.id` directly as the auth-code user ID. Also remove the now-dead `else` branch (`debugWarn` "Session user missing email; using session ID", lines ~177-182)
2. Delete `lookupUserByEmail` from `lib/sso-service.ts`; confirm no remaining references with grep
3. Remove `sso_user_id_mismatch` from the event-type union in `lib/audit-service.ts`
4. Add `'sso-complete'` to `AuthLimitAction` and the `LIMITS` table in `lib/auth-rate-limit.ts`
5. Extend `getClientIp` in `lib/auth-rate-limit.ts` to check `cf-connecting-ip` first (mirror `extractClientIP` in `lib/audit-service.ts`)
5b. Wire `enforceAuthLimit({ action: 'sso-complete', ip: getClientIp(...), identifier: user.id })` into the route inside the `try` block after `validateRedirectUri` succeeds; on limit, audit-log the denial (`reason: 'rate_limited'`) and redirect to the error page with `temporarily_unavailable`
6. Add/extend unit tests for the new rate-limit action (via `enforceAuthLimit` with mocked `checkRateLimit`)
7. Create `tests/unit/sso-complete-route.test.ts` covering: session-binding regression (createAuthCode receives `user.id`), rate-limited redirect, missing-params redirect, access-denied redirect; run the full unit suite

## Verification

- [cmd] pnpm lint
- [cmd] pnpm test
- [cmd] pnpm build
- [assert] ! grep -rn "lookupUserByEmail" app lib
- [assert] grep -q "sso-complete" lib/auth-rate-limit.ts
- [assert] grep -q "sso-complete" app/sso/complete/route.ts
- [manual] Full SSO round-trip against a live Supabase instance: sign in, hit /sso/complete with a registered redirect_uri, confirm the code exchanges for the session user's ID
- [manual] `pnpm migrate:status` in the target environment confirms migration 026 (rate_limits) is applied — the limiter fails open without it

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | RAN (outside voice) | 8 findings: 4 accepted (D3–D6), 2 mechanical fixes, 1 → TODOS.md, 1 informational |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 1 test gap (resolved, D1 backfill); 0 architecture/quality/perf issues |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not applicable (no UI scope) |

- **CODEX:** limiter placement moved after redirect-URI validation; cf-connecting-ip added to getClientIp; rate-limit denials audit-logged; regression test extended to set_app_claims_batch.
- **CROSS-MODEL:** no contradictions — Codex extended this review's findings rather than disputing them.
- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready for autonomous execution (status flipped to pending, 2026-06-12).

## Implementation Notes

Removed the email lookup substitution path from `/sso/complete`, so both self-signup claim grants and SSO auth-code creation now use the authenticated session user ID directly. Added a new `sso-complete` auth limiter keyed by Cloudflare-aware client IP plus session user ID, enforced only after redirect URI validation succeeds, and audit-logged limiter denials with `temporarily_unavailable`. Deleted the dead `lookupUserByEmail` helper and `sso_user_id_mismatch` audit event type. Added route-level and limiter unit tests covering session binding, rate-limit denial, missing/invalid request handling, and access denial.

**Files changed:**

- `app/sso/complete/route.ts` (modified)
- `lib/audit-service.ts` (modified)
- `lib/auth-rate-limit.ts` (modified)
- `lib/sso-service.ts` (modified)
- `tests/unit/auth-rate-limit.test.ts` (created)
- `tests/unit/sso-complete-route.test.ts` (created)

**Commit:** `01febc8` — `fix(sso): bind auth codes to session user`
