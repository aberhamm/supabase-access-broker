# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
