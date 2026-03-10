# Agent Delegation Sessions

Give an AI agent (or any automated client) access to your account across applications via the existing SSO portal — without sharing credentials, and with full revocation and audit control.

## Problem

The SSO portal is designed for interactive human login (passkeys, OAuth, OTP). An AI agent operating a browser needs to authenticate as you across multiple applications via the same redirect-based SSO flow, without access to your credentials.

## Design

You log into the dashboard and create a **delegation session**. The system generates a **one-time activation URL**. You give that URL to the agent. The agent's browser opens it, receives a valid portal session as you, and from that point on every SSO flow works exactly like it does for a human — redirect out, redirect back, code exchange, done.

Apps don't change. The SSO flow doesn't change. The agent just has a portal session.

## Flow

```
Agent browser                    Access Broker Portal              App
---------------------------------------------------------------------

  |  0. Open activation URL       |
  |------------------------------->|
  |  Set session cookies,          |
  |  redirect to /delegation-ok    |
  |<-------------------------------|
  |
  |  1. Navigate to app
  |---------------------------------------------------------------->|
  |                                                                 |
  |  2. App redirects to portal /login?app_id=...&redirect_uri=... |
  |<----------------------------------------------------------------|
  |
  |  3. Portal sees valid session — skips login screen
  |------------------------------->|
  |                                |  Issues auth code
  |  4. Redirect back to app with code
  |<-------------------------------|
  |---------------------------------------------------------------->|
  |                                                                 |
  |  5. App exchanges code, gets your identity + claims             |
  |  6. App creates session — agent is now you                      |
  |<----------------------------------------------------------------|
```

Step 0 happens once. Steps 1-6 repeat for every app, automatically, with no human interaction.

## Database

### `delegation_sessions` table

```sql
CREATE TABLE access_broker.delegation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  label TEXT NOT NULL,                    -- "claude-agent-march-10"
  activation_token_hash TEXT NOT NULL,    -- SHA-256 of one-time activation URL token
  activated_at TIMESTAMPTZ,              -- NULL until agent opens the link
  refresh_token_hash TEXT,               -- captured on activation, for targeted revocation
  allowed_app_ids TEXT[],                -- NULL = all your apps, or a subset
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,               -- set when you click "revoke"
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  use_count INT DEFAULT 0               -- how many SSO exchanges have occurred
);
```

## Endpoints

### `POST /api/auth/delegate` (authenticated, you call this from the dashboard)

**Request:**

```json
{
  "label": "claude-agent",
  "allowed_app_ids": ["app-1", "app-2"],
  "ttl_hours": 8
}
```

**Backend logic:**

1. Generate a random activation token.
2. Store the SHA-256 hash in `delegation_sessions`.
3. Return the activation URL (shown to you once, never stored in plaintext).

**Response:**

```json
{
  "activation_url": "https://access-broker.yourdomain.com/api/auth/delegate/activate?token=<activation_token>",
  "expires_at": "2026-03-10T22:00:00Z",
  "delegation_id": "uuid",
  "apps": ["app-1", "app-2"]
}
```

### `GET /api/auth/delegate/activate?token=...` (agent's browser opens this)

**Backend logic:**

1. Hash the token, look up the delegation.
2. Verify: not already activated, not expired, not revoked.
3. Call `supabase.auth.admin.generateLink({ type: 'magiclink', email: user.email })` to create a magic link for your user.
4. Redirect the agent's browser through the magic link flow. Supabase sets session cookies on the portal domain.
5. Record `activated_at` and capture the refresh token hash for targeted revocation.
6. Mark the activation token as consumed (one-time use).
7. Redirect to a confirmation page.

After this, the agent's browser has valid Supabase auth cookies on the portal domain. It is you.

### `POST /api/auth/delegate/revoke` (authenticated, from dashboard)

**Request:**

```json
{
  "delegation_id": "uuid"
}
```

**Backend logic:**

1. Set `revoked_at` on the delegation record.
2. Call `supabase.auth.admin.signOut()` with the stored refresh token to kill the Supabase session immediately.

## Portal SSO Middleware Changes

Modify the existing SSO complete handler (`/sso/complete`) to check if the current session belongs to a delegation:

```typescript
const refreshToken = getRefreshTokenFromSession();
const delegation = await db.query(
  `SELECT id, label, allowed_app_ids, revoked_at, expires_at
   FROM access_broker.delegation_sessions
   WHERE refresh_token_hash = $1`,
  [sha256(refreshToken)]
);

if (delegation) {
  // Enforce revocation and expiry
  if (delegation.revoked_at || delegation.expires_at < now()) {
    await supabase.auth.signOut();
    return redirectToLogin("Session revoked");
  }

  // Enforce app scope
  if (delegation.allowed_app_ids && !delegation.allowed_app_ids.includes(appId)) {
    return redirectWithError("access_denied", "Agent not authorized for this app");
  }

  // Track usage
  await db.query(
    `UPDATE access_broker.delegation_sessions
     SET last_used_at = now(), use_count = use_count + 1
     WHERE id = $1`,
    [delegation.id]
  );

  // Tag the auth code with delegation metadata
  storeCodeMetadata(code, { delegated_by: delegation.label });
}
```

## Exchange Response

Apps receive the same payload as a normal SSO exchange, with one optional addition:

```json
{
  "user": { "id": "your-uuid", "email": "you@yourdomain.com" },
  "app_id": "app-1",
  "app_claims": { "enabled": true, "role": "admin", "permissions": ["read", "write"] },
  "delegated_by": "claude-agent",
  "expires_in": 300
}
```

`delegated_by` is the only new field. Apps can ignore it or use it for audit logging. The agent is you in every other respect.

## Dashboard UI

A page in the admin console for managing delegations:

| Label | Status | Apps | Created | Last Used | Uses | Actions |
|---|---|---|---|---|---|---|
| claude-agent | Active | app-1, app-2 | 10 min ago | 2 min ago | 14 | **Revoke** |

Features:

- Create new delegation (label, app scope, TTL)
- View activation status, last use, total use count
- One-click revoke (kills session immediately)
- Expired delegations shown as inactive

## Security Properties

| Property | How |
|---|---|
| Agent never sees your credentials | Activation uses an admin-generated magic link under the hood |
| One-time activation | Token is consumed on first use |
| Time-limited | Hard expiry enforced on every SSO request |
| App-scoped | `allowed_app_ids` checked before issuing auth codes |
| Instantly revocable | Revoke kills the Supabase session and blocks future SSO |
| Auditable | Every SSO exchange is counted and timestamped; `delegated_by` flows to apps |
| Apps don't change | Same exchange response shape, same claims, same user identity |

## Agent Instructions

From the agent's perspective, usage is trivial:

1. Open a browser (Playwright, Puppeteer, etc.).
2. Navigate to the activation URL (once).
3. Navigate to any app URL — SSO happens automatically through redirects.
4. Authenticated.

No credentials to manage, no tokens to refresh manually, no custom auth logic. Just a browser with cookies.
