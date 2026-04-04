---
title: 'Self-Service Signup Integration'
description: 'Let new users sign up for your app directly from a signup link — no admin intervention required'
category: 'integrator'
audience: 'app-developer'
order: 6
---

# Self-Service Signup Integration

Self-service signup allows new users to create an account and gain access to your app in one step — without an admin manually granting access. When enabled, users who sign up through your app's signup link are automatically granted the default role for your app.

**Prerequisites:** Your app must be registered in Access Broker and an operator must have enabled self-signup for it. See [Configuring Self-Service Signup](/docs/operator/self-signup-configuration) for the operator-side setup.

## How it works

1. Your app redirects the user to the Access Broker signup page with your `app_id`
2. The user creates an account (password, OTP, magic link, or social login)
3. Access Broker automatically grants your app's default role (e.g. `user`)
4. The user is redirected back to your app with an auth code, just like SSO login

The signup flow uses the same SSO redirect mechanism as regular login — the only difference is the entry URL.

## Building the signup link

The signup URL follows the same pattern as the [SSO login redirect](/docs/integrator/sso-integration-guide), but points to `/signup` instead of `/login`:

```
https://<access-broker-url>/signup?app_id=<your-app-id>&redirect_uri=<your-callback>&state=<csrf-token>
```

| Parameter      | Required | Description |
|---------------|----------|-------------|
| `app_id`      | Yes      | Your registered app ID |
| `redirect_uri` | Yes      | Where to redirect after signup (must be in your app's allowed redirect URIs) |
| `state`       | Recommended | CSRF token to verify the callback |

### Example

```html
<a href="https://auth.example.com/signup?app_id=myapp&redirect_uri=https://myapp.com/auth/callback&state=abc123">
  Create an account
</a>
```

## Handling the callback

After signup, the user is redirected back to your `redirect_uri` with an auth code — identical to the standard SSO flow:

```
https://myapp.com/auth/callback?code=<auth-code>&state=abc123
```

Exchange the code for user info using the same [SSO code exchange](/docs/integrator/sso-integration-guide#step-2-exchange-the-auth-code) you use for login. No changes to your callback handler are needed.

## Existing users

If a user arrives at the signup page while already logged in to Access Broker, they see a prompt to grant your app access with their existing account — no re-registration needed. This handles the common case where a user has an account from another app in your organization but hasn't accessed yours yet.

## What gets granted

When a user completes self-signup, they receive the app's configured default role in their JWT claims:

```json
{
  "app_metadata": {
    "apps": {
      "myapp": {
        "enabled": true,
        "role": "user"
      }
    }
  }
}
```

The default role is configured by the operator (defaults to `"user"`). If your app needs different initial permissions, ask your operator to change the `self_signup_default_role` setting.

## Adding a signup link alongside login

Most apps will want both a login and a signup link. Keep the same `redirect_uri` and `state` parameters for both:

```javascript
const params = new URLSearchParams({
  app_id: 'myapp',
  redirect_uri: 'https://myapp.com/auth/callback',
  state: csrfToken,
});

const loginUrl = `https://auth.example.com/login?${params}`;
const signupUrl = `https://auth.example.com/signup?${params}`;
```

## Auth methods

The signup page respects the same per-app auth method configuration as the login page. If your app only allows Google login, the signup page will only show the Google button. See [App Auth Integration](/docs/integrator/app-auth-integration) for details on auth method configuration.

## When self-signup is disabled

If self-signup is not enabled for your app, users who visit the signup link will see a message directing them to contact their administrator. You may want to hide the signup link in your UI in this case, or point users to your own onboarding flow that involves an admin granting access.
