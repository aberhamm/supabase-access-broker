# Security Audit Report — Supabase Access Broker

**Date**: 2026-03-26
**Scope**: Full codebase audit — SSO flows, API routes, middleware, database/RLS, secret handling, client SDK
**Risk Level**: High (3 Critical, 7 High, 10 Medium, 5 Low)

---

## CRITICAL

### 1. Webhook header spoofing bypasses auth context

**Files**: `middleware.ts:74-86`, `app/api/webhooks/[app_id]/route.ts:11-13`

The middleware sets validated auth context (`x-app-id`, `x-key-id`, `x-role-name`) on the **response** headers (line 80-83), but the webhook route reads from **request** headers (lines 11-13). In Next.js middleware, `webhookResponse.headers.set(...)` does NOT propagate to the route handler's `request.headers`. The route handler reads the original client-supplied headers instead. An attacker with a valid API key for app "A" can set `x-app-id: B` and `x-role-name: admin` to impersonate a different app or escalate their role. The `appId !== app_id` check (line 16) is trivially bypassed by matching both.

### 2. Auth code consumption is not atomic — race condition

**File**: `lib/sso-service.ts:279-296`

`consumeAuthCode` does a SELECT (line 279-287) then a separate UPDATE (line 292-296). Between these, a concurrent request can SELECT the same unused code and also consume it, yielding the same user identity twice. This violates the OAuth requirement that authorization codes are single-use. Should be a single `UPDATE ... WHERE used_at IS NULL RETURNING *`.

### 3. Auth code exchange does not verify `redirect_uri`

**File**: `app/api/auth/exchange/route.ts:40-42`

Per RFC 6749 Section 4.1.3, the exchange endpoint MUST verify that `redirect_uri` matches what was used during authorization. The exchange endpoint accepts `code` and `app_id` but never checks `redirect_uri`. The stored `redirect_uri` in the `auth_codes` table is ignored at exchange time.

---

## HIGH

### 4. `passkey_challenges` table readable by all authenticated users

**Files**: `migrations/007_auth_and_passkeys.sql:78-80`, `migrations/010_move_to_access_broker_schema.sql:45`

RLS is explicitly **disabled** on `passkey_challenges`, while migration 010 grants `SELECT ON ALL TABLES` to `authenticated`. Any authenticated user can read unexpired passkey challenges via PostgREST, potentially enabling challenge replay.

### 5. `validate_api_key()` RPC callable without auth

**File**: `migrations/010_move_to_access_broker_schema.sql:454-480`

This `SECURITY DEFINER` function has no `is_claims_admin()` check and defaults to `PUBLIC` execute permission. Any unauthenticated caller can probe for valid API key hashes and get back `app_id`, `role_name`, and `permissions`.

### 6. `log_sso_event()` writable by all authenticated users

**File**: `migrations/009_sso_audit_logs.sql:100`

`GRANT EXECUTE ON FUNCTION public.log_sso_event TO authenticated` + no internal auth check = any authenticated user can insert fabricated audit log entries, poisoning the audit trail.

### 7. Passkey login returns raw magic link in HTTP response

**File**: `app/api/auth/passkey/login/verify/route.ts:44`

After passkey verification, the server returns the raw Supabase magic link (`action_link`) in the JSON body. This link grants a full session. If intercepted by XSS, a browser extension, or network MITM, the attacker gets an authenticated session.

### 8. Auth callback `next` parameter not sanitized

**File**: `app/auth/callback/page.tsx:18,59,95`

`next` is read from `searchParams.get('next')` and passed directly to `router.push(next)` without `safeNextPath()` validation. Same-origin open redirect after authentication.

### 9. Roles endpoint missing authorization — any authenticated user can read any app's roles

**File**: `app/api/apps/[appId]/roles/route.ts:10-23`

Checks `getUser()` (authentication) but never checks admin status. The route is under `/api/apps/` which bypasses middleware auth. Any authenticated portal user can enumerate roles for any app.

### 10. `anon` role granted USAGE on `access_broker_app` schema

**File**: `migrations/010_move_to_access_broker_schema.sql:43,58`

No clear reason for unauthenticated users to access the schema. Combined with `validate_api_key()` being callable by `PUBLIC` (finding #5), this expands attack surface.

---

## MEDIUM

### 11. `is_claims_admin()` returns TRUE for non-authenticator sessions

**File**: `install.sql:26-28`

When `session_user != 'authenticator'`, the function returns `true`. Any direct Postgres connection (compromised app, misconfigured pooler) bypasses all admin gates.

### 12. Cookies set without `httpOnly`

**Files**: `middleware.ts:137`, `lib/supabase/server.ts:37`

Intentional for Supabase SSR, but means any XSS anywhere leaks session tokens via `document.cookie`. Combined with finding #7 (magic link in response), XSS impact is elevated.

### 13. In-memory rate limiter resets per instance

**File**: `lib/rate-limit.ts:13`

Serverless cold starts or horizontal scaling gives each instance a fresh rate limit map. Attacker gets `N * limit` requests across N instances.

### 14. Rate limiting keyed on `appId`, not per-caller

**Files**: `app/api/apps/[appId]/users/route.ts:16`, `app/api/apps/[appId]/users/[userId]/claims/route.ts:22`, `app/api/apps/[appId]/invite/route.ts:24`

All callers sharing an `app_secret` or different API keys for the same app share a single rate limit bucket. One caller can exhaust the budget for all others.

### 15. `X-Forwarded-For` trusted without proxy verification

**File**: `lib/audit-service.ts:60-78`

Audit log IP addresses are trivially forgeable. Undermines forensic investigation.

### 16. Login error fallback reflects raw URL parameter

**File**: `app/login/page.tsx:96`

`LOGIN_ERROR_MESSAGES[error] || error` — unknown error codes are displayed verbatim. React escapes HTML, but attacker-crafted URLs can display misleading text for phishing.

### 17. SSO audit log RLS policy checks wrong JWT path

**File**: `migrations/009_sso_audit_logs.sql:48-50`

Policy checks `jwt.claims.claims_admin` but the actual claim is at `jwt.claims.app_metadata.claims_admin`. SELECT policy never matches for admin users via PostgREST.

### 18. Logout CSRF — no anti-CSRF on GET-based logout

**File**: `app/auth/logout/route.ts`

`<img src="/auth/logout">` on any page forces user logout. Combined with `next` parameter, can set up phishing.

### 19. Webhook endpoint has no rate limiting

**File**: `app/api/webhooks/[app_id]/route.ts`

Every other app-facing endpoint enforces rate limits. Webhooks can be called at unbounded rate.

### 20. `x-forwarded-proto` trusted for cookie `Secure` flag

**File**: `middleware.ts:104`

If no proxy strips this header, attacker can influence whether cookies get the `Secure` flag.

---

## LOW

### 21. Auth codes stored in plaintext

**File**: `lib/sso-service.ts:262`

DB compromise leaks usable codes within their 5-minute window. Best practice per OAuth spec is to store only a hash.

### 22. `get_app_api_keys()` returns `key_hash` to admins

**File**: `migrations/010_move_to_access_broker_schema.sql:322`

Unnecessary exposure of hashed API keys even to admin users.

### 23. Health endpoint leaks `NODE_ENV` and uptime

**File**: `app/api/health/route.ts:9`

Minor reconnaissance information.

### 24. Migration backup table `_migration_012_admin_backup` may lack RLS

**File**: `migrations/012_migrate_admin_flag_to_role.sql:15`

Table created via `CREATE TABLE AS` does not have RLS enabled. Contains user IDs, emails, and app metadata.

### 25. Webhook logs full payload to console

**File**: `app/api/webhooks/[app_id]/route.ts:27-32`

Sensitive data from webhook payloads could leak into log aggregation systems.

---

## Recommended Fix Order

1. **Critical #1** — Webhook header spoofing: move auth validation into the route handler
2. **Critical #2** — Auth code race condition: atomic `UPDATE ... WHERE used_at IS NULL RETURNING *`
3. **Critical #3** — Redirect URI verification: require and check at exchange time
4. **High #4-10** — RLS fixes, function grants, passkey magic link, callback sanitization
5. **Medium** items as a follow-up pass

---

## Security Strengths

- Timing-safe secret comparison (`timingSafeEqualHex`) for SSO client secrets
- Strong auth code entropy (256-bit via `crypto.randomBytes(32)`)
- Short auth code TTL (5-minute expiry)
- Redirect URI allowlist validation with HTTPS enforcement
- Open redirect protection on login (`safeNextPath()`)
- Service role client isolation (no session persistence)
- Credential stripping (app_secret removed from body immediately after reading)
- Comprehensive audit logging with IP and user agent
- Generic error responses avoid leaking internals
- Parameterized queries throughout (no raw SQL interpolation)
- Client SDK forces server-side code exchange
