# TODOS

Deferred work from app-facing API review (2026-03-16).

## P1: Enforce API key expiry in validate_api_key RPC

**What:** Verify that the `validate_api_key` RPC checks `expires_at` and returns `is_valid: false` for expired keys. Fix if not.

**Why:** The `api_keys` table stores `expires_at` but it's unclear if the validation RPC enforces it. An expired key could still authenticate.

**Context:** Pre-existing issue surfaced during app-facing API review. All new endpoints use `validateApiKey()` via `authenticateAppRequest()`. Check the RPC in `migrations/003_api_keys.sql`. If it doesn't check expiry, add `AND (expires_at IS NULL OR expires_at > now())` to the WHERE clause.

**Effort:** S | **Depends on:** Nothing

---

## P2: DB-level pagination for list_app_users

**What:** Create `list_app_users_paginated(app_id, p_offset, p_limit, p_search)` RPC that handles pagination and search at the database level.

**Why:** `GET /api/apps/{appId}/users` currently loads ALL users from `list_app_users` into memory, then paginates in-memory. Works for <500 users but will OOM or degrade for 10K+ users.

**Context:** The current `list_app_users` RPC returns all rows. The route handler in `app/api/apps/[appId]/users/route.ts` does `allUsers.filter()` and `.slice()` in JS. Replace with a new RPC that accepts offset/limit/search params and uses SQL WHERE + LIMIT + OFFSET. Update the route handler to pass through query params.

**Effort:** M | **Depends on:** Nothing

---

## P2: Rate limiting for app-facing APIs

**What:** Implement rate limiting for the app-facing API endpoints (60 req/min reads, 30 req/min writes).

**Why:** No rate limiting exists. A compromised API key can hammer Supabase RPCs unbounded. Needed before exposing APIs to third-party apps.

**Context:** No rate limiting infrastructure exists in the project. Options: (a) Supabase edge function rate limiting, (b) Redis-backed token bucket in middleware, (c) DB-backed rate counter via RPC. Start with option (c) as simplest — a `check_rate_limit(key_hash, max_requests, window_seconds)` RPC that counts recent requests in `api_key_usage_logs`.

**Effort:** L | **Depends on:** Nothing

---

## P3: Add `since` parameter to GET /users for incremental sync

**What:** Add `since` ISO 8601 query param to `GET /api/apps/{appId}/users` that filters users whose claims changed after the given timestamp.

**Why:** Consuming apps that sync user lists need incremental sync to avoid fetching all users every time.

**Context:** Requires tracking when app claims were last modified per user. Options: (a) Add `claims_updated_at` column to a new table, updated by `set_app_claim`/`set_app_claims_batch`. (b) Use Supabase `auth.users.updated_at` as a proxy (less accurate). Implement in the paginated RPC (depends on P2 DB-level pagination).

**Effort:** M | **Depends on:** P2 (DB-level pagination)
