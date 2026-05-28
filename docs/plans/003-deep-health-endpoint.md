---
id: 003
title: Upgrade health endpoint with DB connectivity check
status: done
completed: 2026-05-28
reviewed: false
qa: automated,verified
blocked-by: []
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The current `/api/health` endpoint returns a static `{ status: "healthy" }`
regardless of whether the application can actually reach Supabase. Docker and
external monitors use this endpoint — a false-positive healthy status delays
incident detection.

**Acceptance criteria:**

- [ ] `/api/health` performs a lightweight DB round-trip (e.g. `SELECT 1` or an RPC ping)
- [ ] Response includes `{ status: "healthy" | "degraded", db: "ok" | "unreachable", timestamp, version }`
- [ ] Always returns HTTP 200 (both healthy and degraded) so Docker HEALTHCHECK doesn't restart-loop on transient DB blips
- [ ] DB check has a timeout (2-3 seconds) so a slow DB doesn't hang the health check
- [ ] `version` field is read by importing `package.json` at module scope (NOT `process.env.npm_package_version`, which doesn't work with standalone Next.js output)
- [ ] Docker HEALTHCHECK continues to work (it checks for 200 from this endpoint)
- [ ] If `SUPABASE_SERVICE_ROLE_KEY` is empty/missing, return `db: "misconfigured"` instead of attempting a broken client call
- [ ] Existing e2e or a new test verifies the 200 happy path

## Design

Use `createAdminClient()` to make a lightweight query (e.g.
`.from('apps').select('id').limit(1)`). Wrap in a `Promise.race` with a
2-second timeout. If the call fails or times out, return `status: "degraded"`
with HTTP 200 (NOT 503 — a non-2xx status causes Docker to restart the
container after 3 retries, which is destructive during transient DB blips).

Before calling `createAdminClient()`, check that `SUPABASE_SERVICE_ROLE_KEY`
is non-empty. If missing, return `db: "misconfigured"` without attempting
the call.

Read the version by importing package.json: `import pkg from '@/../package.json'`
at module scope. Do NOT use `process.env.npm_package_version` — it's not
injected in standalone Next.js output (the runtime is a bare Node process,
not pnpm).

**Files expected to change:**

- `app/api/health/route.ts` — rewrite with DB check and version
- `e2e/security-hardening.spec.ts` or a new `e2e/health.spec.ts` — assert 200 and response shape

**Out of scope:** Readiness vs. liveness probe split (unnecessary for single-container deploy). Prometheus metrics endpoint.

## Tasks

1. Guard: check `SUPABASE_SERVICE_ROLE_KEY` is non-empty; if missing, short-circuit to `db: "misconfigured"`
2. Rewrite `app/api/health/route.ts` to call the DB with a 2s timeout and return the enriched response (always 200)
3. Import version from package.json at module scope
4. Add a test that hits `/api/health` and asserts the response shape and 200 status
5. Verify Docker HEALTHCHECK still works (200 for both healthy and degraded)

## Verification

- [cmd] `pnpm build` exits 0
- [status] `GET /api/health` returns 200
- [assert] `curl -s http://localhost:3050/api/health | jq .status` contains `healthy`
- [assert] `curl -s http://localhost:3050/api/health | jq .db` contains `ok`
