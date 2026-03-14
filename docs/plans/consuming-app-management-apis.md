# Proposal: App-Facing User & Claims Management APIs

**Requested by:** next-chat-umbrella-app (ai-somm chatbot platform)
**Date:** 2026-03-14
**Priority:** Medium
**Goal:** Expose HTTP APIs that allow consuming apps to manage their own users and claims programmatically, without requiring access to the broker dashboard or direct database calls

---

## Context

The Access Broker currently exposes two app-facing HTTP endpoints:
- `POST /api/auth/exchange` — SSO code exchange (used during login)
- `POST /api/users/lookup` — user lookup by email/user_id/telegram_id

For anything beyond login and lookup, consuming apps must either:
1. Direct their admins to the broker dashboard, or
2. Call broker RPCs directly via the shared Supabase instance (couples them to internal implementation)

As more apps integrate with the broker, they need a clean HTTP API surface to manage users within their own app scope — listing users, setting claims, inviting new users, and reacting to user lifecycle events. These APIs should be scoped so that an app can only manage its own users and claims (never another app's).

---

## Authentication

All proposed endpoints use the existing app authentication pattern:

```json
{
  "app_id": "<app_id>",
  "app_secret": "<plaintext_secret>"
}
```

Alternatively, these could use the existing API key infrastructure (`Authorization: Bearer sk_...`) with a role that grants user management permissions. This would be cleaner for server-to-server calls and avoids sending the app_secret on every request.

**Recommendation:** Support both. App secret for simple integrations, API key for production deployments with finer-grained access control.

---

## Proposed Endpoints

### 1. List App Users

List all users who have access to this app. The internal `list_app_users` RPC already does this — this endpoint wraps it as HTTP.

```
GET /api/apps/{app_id}/users
Authorization: Bearer sk_... (or app_secret in body)
```

**Query parameters:**
| Param | Required | Default | Notes |
|---|---|---|---|
| `page` | No | 1 | Page number |
| `limit` | No | 50 | Max 100 |
| `search` | No | — | Filter by email (partial match) |
| `since` | No | — | ISO 8601 timestamp — only users whose claims changed after this date (for incremental sync) |

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "app_claims": {
        "enabled": true,
        "role": "admin",
        "permissions": ["read", "write"],
        "metadata": {}
      },
      "created_at": "2026-01-15T10:30:00Z",
      "last_sign_in_at": "2026-03-14T09:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

**Why:** Consuming apps need to know which users have access to them — for admin UIs, sync jobs, and onboarding flows. Currently the only way is direct RPC or building a separate user table.

---

### 2. Get User App Claims

Get a specific user's claims for this app.

```
GET /api/apps/{app_id}/users/{user_id}/claims
Authorization: Bearer sk_...
```

**Response:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "app_claims": {
    "enabled": true,
    "role": "admin",
    "permissions": ["read", "write"],
    "metadata": { "org_hint": "vinotopia" }
  }
}
```

---

### 3. Set User App Claims

Set or update claims for a user within this app's scope. Cannot modify other apps' claims or global claims like `claims_admin`.

```
PATCH /api/apps/{app_id}/users/{user_id}/claims
Authorization: Bearer sk_...
Content-Type: application/json

{
  "enabled": true,
  "role": "user",
  "permissions": ["read"],
  "metadata": { "org_hint": "vinotopia" }
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "app_claims": { /* updated claims */ },
  "updated_at": "2026-03-14T13:00:00Z"
}
```

**Validation:**
- Only the fields provided are updated (merge, not replace)
- `role` must match a role defined in `access_broker_app.roles` for this app (if role validation is desired)
- Cannot set `claims_admin` or modify other apps' claims
- Returns 404 if user doesn't exist
- Returns 403 if app_secret/API key is invalid

**Why:** Apps need to programmatically enable/disable users, change roles, and update permissions — especially for admin UIs that want to manage app-level roles without sending admins to the broker dashboard.

---

### 4. Invite User to App

Create a new user (if they don't exist) and grant them access to this app. Combines user creation + app claim assignment in a single call.

```
POST /api/apps/{app_id}/invite
Authorization: Bearer sk_...
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "user",
  "permissions": ["read"],
  "send_email": true
}
```

**Behavior:**
- If user exists in `auth.users`: set app claims (enable access to this app)
- If user doesn't exist: create via `inviteUserByEmail()` + set app claims
- If `send_email: true`: send the broker's standard invitation email
- If `send_email: false`: create silently (app handles its own notification)

**Response:**
```json
{
  "user_id": "uuid",
  "email": "newuser@example.com",
  "created": true,         // false if user already existed
  "app_claims": { /* assigned claims */ }
}
```

**Why:** The most common cross-app workflow is "add a user to my app." Currently this requires two steps in the broker dashboard (create user + set app claims). This endpoint makes it a single API call from the consuming app's admin UI.

---

### 5. Revoke User App Access

Remove a user's access to this app (set `enabled: false` and clear role/permissions).

```
DELETE /api/apps/{app_id}/users/{user_id}/claims
Authorization: Bearer sk_...
```

**Response:**
```json
{
  "user_id": "uuid",
  "app_id": "my-app",
  "revoked": true,
  "revoked_at": "2026-03-14T13:00:00Z"
}
```

**Why:** When a consuming app needs to off-board a user (account deletion, compliance request), it should be able to revoke its own app access cleanly.

---

## Future: Webhook Events

The broker has a placeholder webhook system (`POST /api/webhooks/[app_id]`). Extending this to push events to consuming apps would eliminate polling and enable real-time reactions.

### Proposed Events

| Event | Trigger | Payload |
|---|---|---|
| `user.claims_changed` | Any app claim updated for this app | `{ user_id, email, old_claims, new_claims }` |
| `user.disabled` | User's app access set to `enabled: false` | `{ user_id, email, disabled_by }` |
| `user.created` | New user created with access to this app | `{ user_id, email, app_claims }` |
| `user.deleted` | User deleted from `auth.users` | `{ user_id, email }` |
| `user.password_reset` | Password reset completed | `{ user_id, email }` |

### Webhook Registration

```
POST /api/apps/{app_id}/webhooks
Authorization: Bearer sk_...

{
  "url": "https://my-app.example.com/api/webhooks/broker",
  "events": ["user.claims_changed", "user.disabled"],
  "secret": "webhook_signing_secret"
}
```

Events would be signed with HMAC-SHA256 using the webhook secret, following the standard pattern (signature in `X-Webhook-Signature` header).

**Why:** Without webhooks, consuming apps either poll or remain unaware of user changes made in the broker dashboard. This matters for: session invalidation, real-time admin UIs, compliance workflows, and multi-app coordination.

---

## Implementation Notes

- All endpoints are scoped to a single app — an app can never read or modify another app's users/claims
- The internal RPCs (`list_app_users`, `set_app_claim`, `get_app_claim`, `delete_app_claim`) already implement the core logic — these endpoints are thin HTTP wrappers with auth validation
- Consider rate limiting: 60 req/min for list/read, 30 req/min for writes
- All mutations should be logged to `sso_audit_logs`

---

## Priority

| # | Endpoint | Priority | Effort | Notes |
|---|---|---|---|---|
| 1 | `GET /api/apps/{app_id}/users` | High | Small | Wraps `list_app_users` |
| 2 | `PATCH /api/apps/{app_id}/users/{uid}/claims` | High | Small | Wraps `set_app_claim` |
| 3 | `POST /api/apps/{app_id}/invite` | High | Medium | Combines user creation + claims |
| 4 | `GET /api/apps/{app_id}/users/{uid}/claims` | Medium | Tiny | Wraps `get_app_claim` |
| 5 | `DELETE /api/apps/{app_id}/users/{uid}/claims` | Medium | Tiny | Wraps `delete_app_claim` |
| 6 | Webhook event system | Low | Large | New infrastructure |
