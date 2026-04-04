---
title: 'Configuring Self-Service Signup'
description: 'Enable and configure self-service signup so new users can register for apps without admin intervention'
category: 'operator'
audience: 'dashboard-admin'
order: 5
---

# Configuring Self-Service Signup

By default, users can only access an app when an admin explicitly grants them access. Self-service signup changes this — when enabled for an app, new users can sign up and receive access automatically.

## Enabling self-signup

Self-signup is configured per-app via two columns on the `apps` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `allow_self_signup` | boolean | `false` | Whether new users can self-register for this app |
| `self_signup_default_role` | text | `'user'` | The role automatically granted to self-signup users |

### Via the dashboard

In the app settings, toggle **Allow self-signup** under the **Authentication Methods** card. You can also set the default role from the same panel.

### Via SQL

```sql
UPDATE access_broker_app.apps
SET allow_self_signup = true,
    self_signup_default_role = 'user'
WHERE id = 'myapp';
```

## How it works

When self-signup is enabled for an app:

1. The app links users to `/signup?app_id=<app_id>&redirect_uri=<uri>`
2. The user creates an account using any enabled auth method (password, OTP, magic link, social login)
3. After authentication, the `autoGrantAppAccess` server action:
   - Verifies the app exists and is enabled
   - Confirms `allow_self_signup` is `true`
   - Calls `set_app_claims_batch` to grant `{ enabled: true, role: <default_role> }` in the user's `app_metadata`
4. The user is redirected back to the consuming app via the standard SSO flow

## What gets granted

Self-signup users receive the minimum claims needed to access the app:

```json
{
  "apps": {
    "myapp": {
      "enabled": true,
      "role": "user"
    }
  }
}
```

The role is determined by `self_signup_default_role`. Common choices:

| Role | Use case |
|------|----------|
| `user` | Standard access — suitable for most apps |
| `viewer` | Read-only access — for apps where new users shouldn't modify data |
| `trial` | Trial tier — if your app has tiered access |

After signup, admins can promote users to higher roles from the dashboard as needed.

## Existing users

If a user already has an Access Broker account (from another app) but visits the signup page, they see a prompt to grant themselves access with their existing account. This avoids duplicate account creation and preserves their identity across apps.

If the user already has access to the app (`enabled: true`), the grant is a no-op.

## Security considerations

- **Self-signup does not bypass auth methods.** Users must still authenticate via one of the app's enabled methods.
- **The granted role should be low-privilege.** Use `user` or `viewer` as the default — never grant `admin` via self-signup.
- **Self-signup respects the `enabled` flag.** If an app is disabled, self-signup is blocked regardless of the `allow_self_signup` setting.
- **Audit trail.** Self-signup grants are logged the same as admin-initiated grants.

## Disabling self-signup

Set `allow_self_signup` to `false` to stop new self-registrations. Existing users who already received access are not affected.

```sql
UPDATE access_broker_app.apps
SET allow_self_signup = false
WHERE id = 'myapp';
```

## Related

- [Self-Service Signup Integration](/docs/integrator/self-signup-integration) — integrator guide for linking to the signup page
- [Multi-App Architecture Guide](/docs/operator/multi-app-guide) — managing multiple apps and their access controls
- [Auth Portal (SSO + Passkeys)](/docs/operator/auth-portal-sso-passkeys) — configuring global auth methods
