---
id: 026
title: Sanitize SSO and login error messages (code-mapped only)
status: done
blocked-by: [025]
goal: sso-security-ux-audit-findings
allows-migrations: false
needs-review: none
created: 2026-06-12
completed: 2026-06-13
reviewed: false
qa: automated
---

## Requirements

Two related problems from the SSO audit:

1. **Reflected attacker-controlled text.** `app/sso/error/page.tsx`
   (`getErrorMessage`) renders the `error_description` query param verbatim,
   preferring it over the friendly `ERROR_MESSAGES` map. Anyone can craft
   `/sso/error?error=access_denied&error_description=Your+account+is+locked.+Call+...`
   and have the trusted portal domain render phishing copy inside an
   official-looking alert. `app/login/page.tsx` (`getLoginErrorMessage`) has
   the same fall-through to the raw description.

2. **Internal error leakage.** The catch block in `app/sso/complete/route.ts`
   forwards raw `error.message` (potentially Supabase/Postgres internals) as
   `error_description` both in redirects back to client apps and to the
   portal's own error page.

Fix: error codes are the contract. The server sends codes plus generic
per-code descriptions; the pages render only their own mapped copy for known
codes and a generic fallback otherwise. Detailed messages stay in audit logs.

**Acceptance criteria:**

- [ ] `app/sso/complete/route.ts` no longer passes raw `error.message` to `buildClientErrorRedirect` or `buildErrorPageUrl`; it sends a fixed generic description per `SSOErrorCode` instead
- [ ] The detailed `error.message` is still captured in `logSSOEvent` metadata (unchanged) so debugging is not degraded
- [ ] `getErrorMessage` in `app/sso/error/page.tsx` resolves from `ERROR_MESSAGES[error]` with a generic fallback; the `error_description` query param is never rendered
- [ ] `getLoginErrorMessage` in `app/login/page.tsx` resolves from `LOGIN_ERROR_MESSAGES[error]` with a generic fallback; the raw description is never rendered (it may be logged via `debugLog` for diagnosis)
- [ ] Visiting `/sso/error?error=access_denied&error_description=INJECTED_TEXT` renders the mapped access-denied copy and does not display `INJECTED_TEXT` anywhere
- [ ] Existing mapped messages (e.g. `otp_expired`, `access_denied`) still render their friendly copy on /login and /sso/error
- [ ] The login page parses Supabase's `error_code` hash param (Supabase delivers expired links as `#error=access_denied&error_code=otp_expired&error_description=...`) and prefers it over `error` when resolving the mapped message — an expired link shows the otp_expired copy, not the access-denied copy
- [ ] `app/auth/callback/route.ts` forwards only error codes (`error`, and `error_code` when present) in redirect URLs — raw provider `error_description` is no longer forwarded (defense-in-depth at the source)

## Design

Keep the change mechanical: the maps already exist on both pages; this plan
changes precedence (code wins, description ignored) and stops the server from
shipping internals.

In `app/sso/complete/route.ts`, add a small
`Record<SSOErrorCode, string>` of generic descriptions (the strings already
used for the happy-path error redirects are the right register) and use it in
the catch block for both the client redirect and the portal error page.
Validation errors thrown by `validateRedirectUri` keep their mapping via
`mapErrorToCode` — only the *description text* becomes generic.

On the login page, note that Supabase puts provider errors in the URL hash;
the existing hash-parsing stays (extended to also read `error_code`), but the
parsed description is only fed to `debugLog`, not the banner. Unknown codes
get the existing generic fallback sentence.

**Copy fixes required by the precedence change** (since descriptions no
longer disambiguate):

- Error page `unauthorized_client` copy must also cover the
  "no auth methods configured" branch (route.ts:297-305), which today relies
  on its description. Use copy like: "This application isn't set up for SSO
  sign-in. Contact your administrator."
- Login page `access_denied` copy must also cover OAuth provider cancellation
  (forwarded as `error=access_denied` by `app/auth/callback/route.ts`). Use
  copy like: "Sign-in was cancelled or this account doesn't have access. Try
  again or contact your administrator."

**Files expected to change:**

- `app/sso/complete/route.ts`: generic per-code descriptions in catch block
- `app/sso/error/page.tsx`: ignore `error_description`; map by code
- `app/login/page.tsx`: ignore raw description in banner; map by code (incl. `error_code` hash param)
- `app/auth/callback/route.ts`: stop forwarding raw `error_description` in redirects

**Out of scope:** visual redesign of the error page (plan 028), the
`/api/auth/exchange` JSON error responses (already generic), the OIDC error
module planned in 022.

Testing approach: browser-based

## Tasks

1. Add a `Record<SSOErrorCode, string>` of generic user-facing descriptions in `app/sso/complete/route.ts` and use it in the catch block for both `buildClientErrorRedirect` and `buildErrorPageUrl`; keep `error.message` only in `logSSOEvent` metadata
2. Change `getErrorMessage` in `app/sso/error/page.tsx` to ignore `error_description` and resolve purely from `ERROR_MESSAGES` + fallback
3. Change `getLoginErrorMessage` in `app/login/page.tsx` to ignore the description for rendering; route the description to `debugLog`; parse `error_code` from the URL hash and prefer it over `error` when both are present; apply the copy fixes from Design
4. Update `app/auth/callback/route.ts` to forward only `error` (and `error_code` when present), dropping `error_description` from redirect URLs
5. Update or add unit tests for both message-resolution helpers (exported or extracted as needed for testability)
6. Run lint, unit tests, and the e2e suite (note: no existing specs assert `error_description` rendering — the access-denied assertion in `e2e/auth-gating.spec.ts` targets the static /access-denied page and is unaffected)

## Verification

- [cmd] pnpm lint
- [cmd] pnpm test
- [cmd] pnpm build
- [browse] /sso/error?error=access_denied&error_description=INJECTED_PHISHING_TEXT verify the page shows the mapped "do not have permission" message and the string INJECTED_PHISHING_TEXT appears nowhere on the page
- [browse] /sso/error?error=temporarily_unavailable verify the friendly "temporarily unavailable" message renders
- [browse] /login?error=otp_expired verify the "verification code has expired" banner renders

## Implementation Notes

Moved SSO/login error copy into a pure helper module and changed both pages to render only mapped messages by machine-readable code, never raw `error_description` text. `/sso/complete` catch redirects now use generic per-code descriptions while preserving detailed errors in audit metadata, and `/auth/callback` forwards only `error` plus `error_code`. Added `/sso/error` to public routes after browser verification exposed that middleware otherwise redirected to `/login` and preserved injected text in the `next` URL. Added unit tests for message mapping, Supabase `error_code` hash precedence, callback redirect sanitization, and `/sso/complete` catch sanitization.

**Files changed:**

- `app/auth/callback/route.ts` (modified)
- `app/login/page.tsx` (modified)
- `app/sso/complete/route.ts` (modified)
- `app/sso/error/page.tsx` (modified)
- `lib/auth-error-messages.ts` (created)
- `lib/auth-routes.ts` (modified)
- `tests/unit/auth-callback-route.test.ts` (created)
- `tests/unit/error-message-sanitization.test.ts` (created)
- `tests/unit/sso-complete-route.test.ts` (modified)

**Commit:** `PENDING` — `fix(auth): sanitize SSO error descriptions`
