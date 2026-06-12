---
id: 028
title: Shared auth layout, error-page UX, and /sso/continue fixes
status: pending
blocked-by: [026]
goal: sso-security-ux-audit-findings
allows-migrations: false
needs-review: none
created: 2026-06-12
---

## Requirements

The SSO flow is visually inconsistent mid-journey: `/login` has a gradient
mesh background, floating orbs, grid overlay, and a glass card with
`shadow-2xl`, while `/sso/error` and `/sso/continue` — pages users hit
seconds later in the same flow — are plain cards on a flat background. Card
widths disagree (`max-w-md` on login/continue, `max-w-lg` on error), loading
states disagree (pulsing "Loading..." text vs. a border spinner), and no
spinner has an accessible label.

The error page also leads with jargon ("SSO Error") and offers "Try Again"
even for deterministically non-retryable errors (`access_denied`,
`unauthorized_client`).

`/sso/continue` (the account-chooser interstitial that middleware routes
authenticated users to — see `middleware.ts:293,341` and
`e2e/auth-gating.spec.ts`) has three bugs: `router.push('/login')` is called
during render when params are missing (a side effect in the render body), the
auth-methods fetch interpolates `appId` into the URL path without
`encodeURIComponent`, and the subtitle renders a dangling "as" via
`You're already signed in{email ? ' as' : ''}` while the title flashes
"Continue to application" before the app name loads.

**Acceptance criteria:**

- [ ] A shared auth-layout component renders the login page's background treatment (gradient, orbs, grid overlay) and centered glass card; `/login`, `/sso/error`, and `/sso/continue` all use it
- [ ] All three pages use the same card width (`max-w-md`)
- [ ] All loading states use the same spinner component with an `sr-only` label (Suspense fallbacks included)
- [ ] Error page title is user-friendly (e.g. "Couldn't sign you in") with the mapped message (from plan 026) as the lead text; error code and app id remain available in the technical-details box
- [ ] Error page render order is exactly: (1) friendly title + mapped message, (2) action buttons, (3) "What you can do" hints, (4) technical-details box last (design-review D3 — actions must not be buried below the hint list)
- [ ] Continue page: if the auth-methods fetch fails or returns a non-ok status, the header falls back to "Continue" (no app name) and the account chooser remains fully functional — the name is cosmetic and must never block the flow (design-review D4)
- [ ] Continue page: if `getUser` resolves with no user (signed out in another tab), redirect to `/login` with the SSO params preserved instead of rendering an account-less chooser (design-review D4)
- [ ] AuthShell keeps the login wrapper's `overflow-hidden`; the float animations are disabled under `prefers-reduced-motion` (add the media-query guard to the `animate-float-*` classes in `app/globals.css`); all buttons on both SSO pages use `h-11` to match the login page's 44px touch targets (design-review D5)
- [ ] "Try Again" is hidden when `error` is `access_denied` or `unauthorized_client`; "Sign in with a different account" becomes the primary action in those cases
- [ ] `/sso/continue`: the missing-params redirect happens in a `useEffect`, not during render
- [ ] `/sso/continue`: `appId` is `encodeURIComponent`-ed in the auth-methods fetch path
- [ ] `/sso/continue`: no dangling "as" copy; the header shows a loading state until the app name and email have resolved (no "Continue to application" flash)
- [ ] `e2e/auth-gating.spec.ts` and `e2e/sso-simple.spec.ts` still pass

## Design

Extract, don't redesign: lift the existing background JSX from
`app/login/page.tsx` (lines ~490-510) and the glass-card classes into a
shared component, e.g. `components/auth/AuthShell.tsx`, taking `children`.
The login page becomes the first consumer (visual no-op there); the two SSO
pages adopt it. Add a small `components/auth/AuthSpinner.tsx` (border
spinner + `<span className="sr-only">Loading</span>`) used by all three
pages' loading and Suspense states.

Error page: retryability is a property of the code — add a
`NON_RETRYABLE_CODES` set (`access_denied`, `unauthorized_client`) next to
the existing `ERROR_MESSAGES` map. Keep the technical-details box (it serves
admins) but it stays secondary.

Continue page: move the `!appId || !redirectUri` guard into `useEffect`
with `router.replace('/login')`; render `null` meanwhile. Gate the header on
both fetches settling and fix the subtitle to a single coherent string
("Signed in as {email}" under "Continue to {appName}").

**Interaction states (design-review D4):**

| Page | Loading | Error/edge | Success |
|------|---------|-----------|---------|
| /sso/error | AuthSpinner Suspense fallback | unknown code → generic mapped fallback (plan 026) | title → message → actions → hints → details |
| /sso/continue | header skeleton until BOTH getUser and auth-methods settle | fetch fails → "Continue" header, chooser still works; no user → redirect to /login with SSO params | "Continue to {app}" + "Signed in as {email}" |

This plan only touches presentation and client-side page logic. The message
*contents* are owned by plan 026, which must land first (both plans edit
`app/sso/error/page.tsx`).

**Files expected to change:**

- `components/auth/AuthShell.tsx` (new): shared background + card shell (keeps `overflow-hidden`)
- `components/auth/AuthSpinner.tsx` (new): spinner with sr-only label
- `app/globals.css`: `prefers-reduced-motion` guard on `animate-float-slow`/`animate-float-slower`
- `app/login/page.tsx`: adopt AuthShell/AuthSpinner (no visual change)
- `app/sso/error/page.tsx`: AuthShell, friendly title, retryability gating, width
- `app/sso/continue/page.tsx`: AuthShell, effect-based redirect, encoded appId, copy fixes

**Out of scope:** error message wording (plan 026), the signup/account/
reset-password pages (candidates for AuthShell later, not now), middleware
routing changes, dashboard styling.

Testing approach: browser-based

## Tasks

1. Create `AuthShell` by extracting the login page's background + centering + glass card wrapper; create `AuthSpinner` with an sr-only label
2. Refactor `app/login/page.tsx` to use both (verify no visual regression) — including the inline border spinner in the `appMethodsReady` loading state (~line 578), which becomes AuthSpinner
3. Restyle `app/sso/error/page.tsx`: AuthShell, `max-w-md`, friendly title, D3 render order (title+message → actions → hints → details), hide Try Again for non-retryable codes, `h-11` buttons
4. Fix and restyle `app/sso/continue/page.tsx`: AuthShell, effect-based missing-params redirect, `encodeURIComponent(appId)` in the fetch path, header loading state with D4 fetch-failure fallback and signed-out redirect, corrected copy, `h-11` buttons
4b. Add the `prefers-reduced-motion` guard to the float animations in `app/globals.css`
5. Replace both pages' Suspense fallbacks with AuthSpinner
6. Run lint, unit tests, build, and the auth-gating + sso e2e specs

## Verification

- [cmd] pnpm lint
- [cmd] pnpm test
- [cmd] pnpm build
- [browse] /sso/error?error=server_error&app_id=demo-app&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback verify the page has the same gradient/glass background treatment as /login, a friendly title (not "SSO Error"), and both a retry button and a sign-in button (note: "Try Again" only renders when app_id and redirect_uri are present — the params are required for this check to be meaningful)
- [browse] /sso/error?error=access_denied&app_id=demo-app&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback verify no "Try Again" button is shown even though app_id/redirect_uri are present, and "Sign in with a different account" is the primary action
- [browse] /login verify the gradient background, glass card, and sign-in form still render as before
- [assert] grep -q "sr-only" components/auth/AuthSpinner.tsx
- [assert] grep -q "encodeURIComponent(appId)" app/sso/continue/page.tsx
- [manual] With an authenticated session, visit /login?app_id=...&redirect_uri=... and confirm the continue page renders the account-chooser with no copy glitches

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | outside voices skipped (D2: extraction task, target is shipped code) |
| Eng Review | `/plan-eng-review` | Architecture & tests | 0 | — | not required for this plan (presentational; doctor-validated) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score 7/10 → 9/10; 3 decisions (D3 hierarchy order, D4 state table, D5 a11y contract); mockups skipped per D1 (login page is the reference) |

- **UNRESOLVED:** 0
- **VERDICT:** DESIGN CLEARED — ready for autonomous execution behind plan 026 (status flipped to pending, 2026-06-13).
