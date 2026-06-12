# TODOS

## Create DESIGN.md (auth design system reference)

- **What:** One-page design system doc capturing what the login page established — glass tokens, gradient/orb background recipe, type scale, button sizing (`h-11`), spacing, motion rules (incl. the `prefers-reduced-motion` guard from plan 028).
- **Why:** Design reviews currently calibrate against "whatever `app/login/page.tsx` does"; every future UI plan re-derives the system from code archaeology.
- **Pros:** Authoritative reference for future design reviews and autonomous workers; `/design-consultation` has an output slot for it.
- **Cons:** ~30 min effort; risks drifting from code if unmaintained.
- **Context:** Surfaced during plan 028's design review (2026-06-13). De-facto system lives in `app/login/page.tsx` + `app/globals.css`. Write it after 028 ships so `AuthShell` is the documented primitive.
- **Depends on / blocked by:** Best after plan 028 completes.

## Resolve duplicate-email ambiguity in `lookup_user_by_identifier`

- **What:** `lookup_user_by_identifier` (migrations/011) matches `lower(email)` with `LIMIT 1`; on duplicate emails it silently picks one account. Still used by `/api/users/lookup` (app/api/users/lookup/route.ts:73) and the invite endpoint (app/api/apps/[appId]/invite/route.ts:57,91).
- **Why:** Plan 025 removed the SSO auth-code consumer of this ambiguity, but two privileged app-authenticated API paths still resolve users by email non-deterministically.
- **Pros:** Deterministic lookup/invite behavior; closes the root cause (e.g. raise on multiple matches instead of `LIMIT 1`).
- **Cons:** Needs a migration plus an external-API contract decision (what do clients receive on ambiguity — 409? distinct error code?); Supabase largely enforces email uniqueness already, so this defends a rare state.
- **Context:** Surfaced by the Codex outside voice during plan 025's eng review (2026-06-12). Start at `migrations/011_user_lookup_function.sql` and the two callers. See `docs/EXTERNAL_API_CONTRACT.md` for the affected contract.
- **Depends on / blocked by:** Nothing; independent of plans 025–028.
