---
id: 010
title: Structured error logging and request-id propagation
status: in-progress
blocked-by: [003]
allows-migrations: false
needs-review: none
created: 2026-05-28
---

## Requirements

The application logs errors via `console.error` with ad-hoc formatting.
There's no request-id correlation, making it difficult to trace a user's
report to specific log entries. The `global-error.tsx` boundary exists but
doesn't capture structured error data for monitoring.

**Acceptance criteria:**

- [ ] Every response includes an `X-Request-Id` header (UUID generated in middleware)
- [ ] Server-side error logs include the request-id for correlation
- [ ] `global-error.tsx` renders the request-id to the user (read from a `<meta name="x-request-id">` tag injected by the root layout)
- [ ] API error responses include a `request_id` field in the JSON body
- [ ] A centralized error logging utility (`lib/logger.ts`) exists that all server actions and API routes can use — must be edge-runtime compatible (no `fs`, no Node-only modules)
- [ ] A shared `apiError(status, message, requestId)` helper exists for consistent API error responses with request-id
- [ ] Key `console.error` / `console.warn` calls in middleware (2 errors, 3 warns) are migrated to the structured logger

## Design

Generate a request-id in middleware (already sets `x-nonce`, add `x-request-id`
alongside it). Pass it via request headers so server components and API routes
can read it via `headers()`.

Create `lib/logger.ts` with a minimal structured logger that outputs JSON
lines with `{ level, message, request_id, timestamp, ...extra }`. This is
Sentry/Datadog/CloudWatch compatible — any log aggregator can parse JSON lines.

Pass the request-id to the client by injecting a `<meta name="x-request-id"
content={requestId}>` tag in the root layout (`app/layout.tsx`), which is a
server component and can read the header via `headers()`. Then in
`global-error.tsx` (client component), read it from the DOM:
`document.querySelector('meta[name="x-request-id"]')?.content`. Do NOT use
`error.digest` — that's an internal Next.js hash for error deduplication,
not controllable.

The structured logger must use only edge-runtime compatible APIs (no `fs`,
no Node-only builtins). `crypto.randomUUID()` and `JSON.stringify` are fine.

Create a shared `apiError(status, message, requestId)` helper to produce
consistent `{ error, request_id }` JSON responses across all API routes,
rather than patching each route individually.

**Files expected to change:**

- `middleware.ts` — generate and set `x-request-id`, migrate console.error/warn calls
- `lib/logger.ts` — new structured logging utility (edge-runtime compatible)
- `lib/api-error.ts` — new shared `apiError()` helper for consistent error responses
- `app/layout.tsx` — inject `<meta name="x-request-id">` tag from request headers
- `app/global-error.tsx` — render request-id from meta tag to user
- API route files — replace bare `NextResponse.json({ error })` with `apiError()` helper

**Out of scope:** Sentry SDK integration (adds a dependency and requires a
DSN). Log shipping to a remote service. Performance tracing / spans.

## Tasks

1. Create `lib/logger.ts` with `error()`, `warn()`, `info()` functions that output JSON lines — must be edge-runtime compatible (no `fs`, no Node-only modules)
2. Generate `x-request-id` UUID in middleware and set it on request + response headers
3. Create `lib/api-error.ts` with a shared `apiError(status, message, requestId)` helper
4. Inject `<meta name="x-request-id">` in `app/layout.tsx` via `headers()` so client components can read it
5. Update `global-error.tsx` to read request-id from the meta tag and display it to the user
6. Update API error responses (at least health, webhook, and app API routes) to use `apiError()` helper
7. Migrate the 2 `console.error` and 3 `console.warn` calls in middleware to use the structured logger
8. Add a unit test for the logger output format

## Verification

- [cmd] `pnpm build` exits 0
- [cmd] `pnpm test` exits 0
- [assert] `curl -sI http://localhost:3050/ | grep -i 'x-request-id'` contains a UUID pattern
- [assert] `curl -s http://localhost:3050/api/health | jq .request_id` is not null
