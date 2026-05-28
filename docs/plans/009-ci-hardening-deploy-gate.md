---
id: 009
title: CI hardening with container smoke test and deploy gate
status: done
completed: 2026-05-28
reviewed: false
qa: automated,verified
blocked-by: [002, 003]
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The current CI pipeline (`ci.yml`) only builds the Docker image — it doesn't
verify the container starts or responds to requests. The e2e pipeline
(`e2e-tests.yml`) runs Playwright against a `pnpm build && pnpm start` but
never tests the actual Docker container. A misconfigured Dockerfile or missing
env var can produce a container that builds but crashes at startup.

**Acceptance criteria:**

- [ ] CI reuses the Docker image from the build job (no rebuild) and starts it with runtime env vars
- [ ] CI binds the smoke test container to a non-conflicting port (e.g. 3052) to avoid colliding with the production container on the self-hosted runner
- [ ] CI hits `/api/health` inside the running container and asserts 200
- [ ] CI stops the container after the smoke test
- [ ] E2E workflow uploads Playwright traces/screenshots as artifacts on failure
- [ ] E2E workflow sets a reasonable timeout per test (not just global 60min)
- [ ] CI workflow fails if the container health check doesn't pass within 60 seconds

## Design

Modify `.github/workflows/ci.yml` to add a `smoke-test` job after `build`.
This job reuses the already-built image (NOT `docker compose build` again)
and starts it via `docker run` on port 3052 (to avoid colliding with the
production container on port 3050 on the self-hosted runner). It waits for
the healthcheck, curls `/api/health`, and stops the container.

**Build args vs runtime env:** The Dockerfile validates and bakes in
`NEXT_PUBLIC_*` vars at build time — these are already in the image from
the build job. The smoke test only needs to pass runtime env vars
(`SUPABASE_SERVICE_ROLE_KEY`, `PORT=3052`). Since plan 003 makes the health
endpoint return 200 even when DB is degraded, the smoke test works with or
without a real service role key — it just checks the container starts and
responds.

Enhance `.github/workflows/e2e-tests.yml` with per-test timeout configuration
and ensure artifacts are always uploaded (they already have `if: always()`
but verify `continue-on-error` doesn't hide failures).

**Files expected to change:**

- `.github/workflows/ci.yml` — add smoke-test job
- `.github/workflows/e2e-tests.yml` — improve timeout and artifact config

**Out of scope:** Blue-green deployment automation. Staging environment
provisioning. CD pipeline (deploy is handled by cron poll on the server).

## Tasks

1. Add a `smoke-test` job to `ci.yml` that depends on `build` and runs the already-built image via `docker run -d -p 3052:3050 --name smoke-test-broker ...`
2. Pass runtime env vars only (`PORT=3050` is baked in; pass `SUPABASE_SERVICE_ROLE_KEY` from secrets for a real DB check, or omit it and accept `db: "misconfigured"`)
3. Wait for healthy: poll `curl http://localhost:3052/api/health` with retries (max 60s)
4. Assert the response and stop/remove the container in a cleanup step (use `if: always()`)
5. Add `timeout-minutes: 15` to the build job for safety
6. Review and tighten `e2e-tests.yml` artifact upload and timeout settings

## Verification

- [cmd] `yamllint .github/workflows/ci.yml` or manual YAML validation exits 0
- [assert] CI workflow YAML contains `docker run` and `curl.*health`
- [manual] Push to a branch and verify CI smoke test passes in GitHub Actions
