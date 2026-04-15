# Locking signups to Apple and Google only

The portal's `/signup` page has been restricted to OAuth via Apple and Google.
The goal is to delegate real-identity verification to those providers.

This is a two-layer change:

1. **Portal UI** (already applied). `/signup` only renders Apple and Google
   buttons; password / OTP / magic-link / GitHub forms are removed from the
   signup flow. Login (`/login`) is unchanged so existing users keep working.
2. **Supabase GoTrue config** (you must apply these in the Supabase dashboard
   or in `supabase/config.toml` for self-hosted installs). Without these
   server-side changes, a client could still hit the GoTrue API directly and
   create an email/password account.

## Supabase changes to apply

### Disable non-OAuth signups

```
GOTRUE_DISABLE_SIGNUP=true
```

This blocks email/password/OTP/magic-link account creation while still
allowing existing users to sign in. OAuth signups are **not** blocked by this
flag, so enabled OAuth providers continue to create accounts on first login.

### Restrict OAuth providers

Disable any OAuth provider you don't want to act as an identity arbiter.
For this project that means:

- `GOTRUE_EXTERNAL_APPLE_ENABLED=true`
- `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true`
- `GOTRUE_EXTERNAL_GITHUB_ENABLED=false`  (GitHub is not a signup-worthy verifier for us)

### Apple provider credentials (stubbed — fill in before enabling)

Sign in with Apple requires:

- Apple Developer account with an App ID configured for "Sign In with Apple"
- A Services ID (OAuth client ID) with the return URL set to
  `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- A Sign-In-with-Apple key (p8 file) with its Key ID
- Your Apple Team ID

Supabase vars:

```
GOTRUE_EXTERNAL_APPLE_CLIENT_ID=<services id>       # e.g. com.example.signin
GOTRUE_EXTERNAL_APPLE_SECRET=<generated JWT>        # regenerate every <= 6 months
GOTRUE_EXTERNAL_APPLE_REDIRECT_URI=https://<project>.supabase.co/auth/v1/callback
```

Supabase hosts a helper to mint the `APPLE_SECRET` JWT from your Team ID,
Services ID, Key ID and p8 private key — see the Supabase docs for
"Login with Apple". Rotate it on the Apple-enforced schedule.

### Portal env flag

Set the public-side feature flag so the Apple button actually renders:

```
NEXT_PUBLIC_AUTH_APPLE=true
```

Rebuild the Next.js image after changing this (it's baked in at build time).

## Per-app configuration

Each app still controls which methods are available via
`apps.auth_methods`. To allow an app's users to self-sign-up, enable
`apple` and/or `google` on that app. The new DB migration
(`025_add_apple_auth_method.sql`) adds the `apple` key with a default of
`false`. Run:

```
pnpm migrate
```

(or apply `migrations/025_add_apple_auth_method.sql` manually) to pick it
up on existing databases.

## What remains possible

- Existing users can still sign in via password / OTP / magic link / GitHub
  on `/login` — only account *creation* is restricted.
- OAuth signups still go through the app-level `allow_self_signup` gate
  in `/sso/complete`. If an app has self-signup off, OAuth new-account flow
  succeeds at the Supabase layer but the access-grant step will refuse and
  the user will see "Your account has not been granted access."
