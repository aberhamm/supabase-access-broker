---
id: 023
title: Upgrade audit logging to structured format with OIDC events
status: pending
blocked-by: []
needs-review: none
created: 2026-06-05
---

## Requirements

The current audit logging (`lib/audit-service.ts`) is fire-and-forget to a
database RPC with a flat event type enum. It lacks structured fields for OIDC
events, has no log levels, and provides no way to correlate events across a
request lifecycle. This plan upgrades the audit service to support structured
logging with OIDC event types, request correlation, and richer metadata.

**Acceptance criteria:**

- [ ] New OIDC event types added: `oidc_authorize_success`, `oidc_authorize_error`, `oidc_token_success`, `oidc_token_error`, `oidc_userinfo_success`, `oidc_userinfo_error`, `refresh_token_issued`, `refresh_token_rotated`, `refresh_token_revoked`, `refresh_token_reuse_detected`
- [ ] Each audit event includes `request_id` for cross-event correlation
- [ ] The audit service supports structured metadata with typed fields: `client_id`, `grant_type`, `scope`, `token_type`, `error_code`
- [ ] Audit events are also written to structured console output (JSON) in addition to the database, so they can be picked up by log aggregation
- [ ] The `logSSOEvent` function accepts the new event types without breaking existing callers
- [ ] The migration adds the new event types to the `sso_event_type` enum (or removes the enum constraint in favor of text)
- [ ] A `lib/audit-service.ts` overhaul that maintains full backward compatibility

## Design

Upgrade path:

1. **Event type handling:** Instead of adding to a Postgres enum (which
   requires ALTER TYPE and is annoying to migrate), change the column to `text`
   if it's currently an enum, or use a CHECK constraint that's easy to extend.
   If already text, just add the new values to the TypeScript union type.

2. **Structured console logging:** Add a parallel stdout output using the
   existing `lib/logger.ts` structured logger. Each audit event gets logged
   as a structured JSON line with `event_type`, `request_id`, `user_id`,
   `app_id`, and relevant metadata.

3. **Request correlation:** Events already receive `request_id` via headers
   (set by middleware). Make `logSSOEvent` optionally accept `requestId` and
   include it in both DB and console output.

4. **Backward compatibility:** The existing `SSOEventType` union type is
   extended (not replaced). All existing callers continue to work.

**Files expected to change:**

- `lib/audit-service.ts`: add new event types, request_id parameter, structured console output
- `migrations/030_audit_oidc_events.sql` (new): extend event types in DB if needed
- `lib/logger.ts`: minor additions if needed for structured audit output

Testing approach: unit-only

**Out of scope:** Audit log querying UI, log rotation, external log shipping
(these are infrastructure concerns). OIDC endpoint instrumentation (each OIDC
plan already calls `logSSOEvent`; this plan makes the types available).

## Tasks

1. Extend the `SSOEventType` union in `lib/audit-service.ts` with OIDC event types
2. Add optional `requestId` parameter to `logSSOEvent` and include it in DB writes
3. Add structured console logging (JSON to stdout) alongside DB writes using `lib/logger.ts`
4. Create migration `030_audit_oidc_events.sql` to accommodate new event types in the database (alter column type or extend enum)
5. Add typed metadata fields (`OIDCAuditMetadata` interface) for OIDC-specific audit context
6. Add unit tests for the extended event types and structured output format
7. Update existing `logSSOEvent` call sites to pass `requestId` where available (grep for `logSSOEvent` across the codebase)

## Verification

- [cmd] pnpm run build
- [cmd] pnpm run test
- [assert] grep -q "oidc_token_success" lib/audit-service.ts
- [assert] grep -q "requestId\|request_id" lib/audit-service.ts
- [assert] test -f migrations/030_audit_oidc_events.sql
