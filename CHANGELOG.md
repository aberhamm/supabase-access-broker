# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — 2026-06-13

### Security
- SSO authorization codes are now stored as SHA-256 hashes instead of plaintext while still allowing client apps to redeem the original one-time code.
- SSO completion now binds issued auth codes to the authenticated session user, avoiding email-based lookup during code issuance.
- Login and SSO error pages now render only mapped, safe error messages instead of raw provider or query-string descriptions.

### Changed
- The login, SSO error, and SSO continue pages now share the same glass-card auth layout, loading spinner, card width, and reduced-motion-safe background treatment.
- The SSO error page now leads with friendlier copy, keeps technical details secondary, and hides “Try Again” for deterministic non-retryable errors.

### Fixed
- The SSO continue page now redirects missing or signed-out sessions through safe effect-based navigation while preserving SSO parameters.
- SSO continue URLs now encode `app_id` correctly and avoid dangling or flashing copy while app/user details are loading.
- The SSO e2e fixtures now insert hashed auth-code values to match the storage contract.

### Internal
- Added focused regression coverage for SSO URL construction, retryability rules, shared auth UI rendering, continue-page loading copy, and auth-code exchange behavior.
- Added reviewed implementation plans for the SSO security/UX audit fixes and coordinated the OIDC backlog around the new auth-code hashing migration.
- Added project agent guidance files for Codex/Claude portability.

<!-- commits: 09472cb, 784983e, 607ba82, bd81377, 8cbd829, f92ea9a, 869c084, 3ebf224, 7880163, f6102ef, 0555564, cb23d3a, adb5f7c, c0ae734, 01f465f, 09b0c2a, cead4d5, eefe7ba, c4388e9, 4efa25b -->

## [Unreleased] — 2026-06-04

### Security
- App-facing API endpoints are now rate-limited per app: 30 writes/minute and 60 reads/minute. Limits are stored in Postgres so they survive restarts and apply consistently across replicas; exceeding a limit returns `429` with a `Retry-After` header. (Previously the limiter was defined but inactive in production, so no limits were actually enforced.)

### Fixed
- The app **Roles** tab no longer crashes when an app has a custom role. Role permissions were stored double-encoded, which broke the roles list rendering; roles now save and display correctly.

### Internal
- Restored the end-to-end test suite to green (98 passing) after it was fully broken in CI — fixed pnpm setup on the self-hosted runner, pinned pnpm v10 / Node 22, and resolved strict-mode locators, stale assertions, and test-isolation issues (including rate-limiter bucket contamination between tests).
- App updates now also revalidate the app detail route cache.

<!-- commits: 1161dff, 17c0c97, 7f14ca8, a2cf350, 1dfe6dc, 70daa63, 8c102fb, 5f4bef6, c9007c2, 8f17d65, 9e870e6, f78e3c4, 1d4ef9c, 69c4255, f377ac0, 4f91909 -->

## [Unreleased] — 2026-05-30

### Added
- Every response now includes `X-Request-Id` header for request tracing — if you hit an error, the displayed request ID helps support trace the issue in logs
- Health endpoint (`/api/health`) now checks database connectivity and reports `healthy`/`degraded` status with DB state, version, and timestamp — always returns 200 to keep Docker stable
- Structured JSON logging (`lib/logger.ts`) for server-side error correlation, compatible with any log aggregator
- Consistent API error responses now include `request_id` for cross-referencing with server logs
- Error page now displays the request ID so you can reference it when reporting issues
- CODEOWNERS file protects CI/CD workflows, Dockerfile, and deploy configs with mandatory review
- CI smoke test verifies the Docker container starts and responds before marking the build green

### Changed
- Deployment SSH now uses a dedicated `deploy` user instead of `root`, with explicit `sudo` for privileged operations
- E2E test pipeline uploads Playwright traces on failure and enforces per-test timeouts

### Fixed
- Claim deletion, user bans, email changes, invites, and email confirmation now require MFA step-up verification — a compromised session can no longer perform these operations without re-authenticating

### Security
- OWASP security headers added to all responses: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS (HTTPS only)
- Five admin operations (`deleteClaimAction`, `banUser`, `unbanUser`, `updateUserProfileAdmin`, `inviteUser`, `confirmUserEmail`) now enforce MFA step-up, closing CSO audit findings #2 and #3
- SSH deployment hardened from root to least-privilege deploy user (CSO finding #5)
- CODEOWNERS added for mandatory review on security-sensitive files (CSO finding #4)

### Internal
- 6 new e2e test suites: dashboard user management, app CRUD/claims, account settings/MFA, auth gating, API endpoints (invite/roles/rate-limit), and health endpoint
- ~1,700 lines of new e2e test coverage across 40+ test cases

<!-- commits: fc6700c, ec8bb08, f5c7efc, 8eb866d, b3ca50f, 8828c21, 153a282, 4f4f5ca, 3536739, 3196b01, c531526, c84790b -->
