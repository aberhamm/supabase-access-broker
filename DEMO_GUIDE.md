# Demo Guide: Testing SSO Integration

This guide shows you how to test the Auth Portal SSO flow using the included demo page.

## Quick Start (Local Testing)

### Step 1: Start the Dashboard

```bash
pnpm dev
```

The dashboard will run at `http://localhost:3050`

### Step 2: Create a Demo App

1. Sign in to the dashboard as an admin
2. Go to **Apps** → **Create New App**
3. Fill in:
   - **App ID**: `demo-app`
   - **Name**: `Demo Application`
   - **Description**: `Test app for SSO integration`
4. Click **Create App**

### Step 3: Configure the Demo App

In the Supabase SQL Editor, run:

```sql
-- Allowlist the demo callback URL
UPDATE public.apps
SET allowed_callback_urls = ARRAY['http://localhost:3050/demo/sso-demo.html']
WHERE id = 'demo-app';
```

### Step 4: Create a Test User

**Option A: From the dashboard**
1. Go to **Users** → **Create User**
2. Enter email and password
3. Enable access for `demo-app`

**Option B: Sign up directly**
1. Sign out from the dashboard
2. Go to `/login` and create a new account
3. As admin, grant the user access to `demo-app`

### Step 5: Enable Self-Service Signup (Optional)

To test the signup flow, enable self-signup on the demo app:

**Option A: From the dashboard**
1. Go to **Apps** → **demo-app** settings
2. Under **Authentication Methods**, toggle **Allow self-signup**
3. Set the default role (e.g., `user`)

**Option B: Via SQL**
```sql
UPDATE access_broker_app.apps
SET allow_self_signup = true,
    self_signup_default_role = 'user'
WHERE id = 'demo-app';
```

### Step 6: Open the Demo Page

Navigate to:
```
http://localhost:3050/demo/sso-demo.html
```

### Step 7: Test the Flows

The demo page has two buttons:

#### Sign In Flow
1. Click **"Sign In with Auth Portal"**
2. You'll be redirected to the login page
3. Sign in with your test credentials
4. You'll be redirected back to the demo page

#### Sign Up Flow
1. Click **"Sign Up with Auth Portal"**
2. You'll be redirected to the signup page
3. Create a new account (password, OTP, magic link, or social)
4. Access is automatically granted with the default role
5. You'll be redirected back to the demo page

Both flows end the same way — the demo page will:
   - Exchange the auth code
   - Display user information
   - Show access status and role
   - Display the full payload

## What to Test

### ✅ Successful Login Flow
- [ ] Click "Sign In" redirects to `/login` with SSO params
- [ ] After signing in, redirects back to demo page with `?code=...&state=...`
- [ ] Code is exchanged successfully
- [ ] User info is displayed
- [ ] Access badge shows "Granted"

### ✅ Successful Signup Flow
- [ ] Click "Sign Up" redirects to `/signup` with SSO params
- [ ] Signup page shows available auth methods for the app
- [ ] After creating account, user is auto-granted the default role
- [ ] Redirects back to demo page with `?code=...&state=...`
- [ ] Code is exchanged and user info displayed with correct role

### ✅ Self-Signup States
- [ ] With `allow_self_signup = false`: signup page shows "contact your administrator"
- [ ] With `allow_self_signup = true`: signup page shows auth forms
- [ ] Existing logged-in user sees "Continue with this account" prompt
- [ ] "Sign in" link on signup page preserves SSO params

### ✅ Access Control
- [ ] User with `app_claims.enabled = true` shows "Access Granted"
- [ ] User without access shows "Access Denied"
- [ ] Role is displayed correctly

### ✅ Security Features
- [ ] State parameter is validated (CSRF protection)
- [ ] Code can only be used once
- [ ] Code expires after 5 minutes

### ✅ Different Auth Methods

Test each authentication method by enabling its feature flag:

```bash
# In .env.local
NEXT_PUBLIC_AUTH_PASSKEYS=true
NEXT_PUBLIC_AUTH_GOOGLE=true
NEXT_PUBLIC_AUTH_GITHUB=true
NEXT_PUBLIC_AUTH_EMAIL_OTP=true
NEXT_PUBLIC_AUTH_PASSWORD=true
```

Restart the server and test:
- [ ] Passkey login (Face ID / Touch ID)
- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] Email OTP code
- [ ] Password login
- [ ] Magic link

## Testing Error Cases

### Unauthorized App
```sql
-- Remove the callback URL
UPDATE public.apps
SET allowed_callback_urls = ARRAY[]::text[]
WHERE id = 'demo-app';
```

Expected: Portal rejects the redirect with "Invalid redirect_uri"

### Disabled User Access
```sql
-- Disable user access
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  raw_app_meta_data,
  '{apps,demo-app,enabled}',
  'false'
)
WHERE email = 'test@example.com';
```

Expected: Code exchange succeeds but shows "Access Denied"

### Expired Code
1. Start the login flow
2. Wait 6 minutes before completing
3. Expected: Code exchange fails with 401

### Reused Code
1. Complete a successful login
2. Try to use the same code again
3. Expected: Code exchange fails with 401

## Production Testing

For production testing, you'll need:

1. **Deploy the dashboard** to a public URL (e.g., `https://auth.yourdomain.com`)
2. **Update the demo** with your production URL
3. **Configure OAuth** providers (Google, GitHub) in Supabase dashboard
4. **Set up custom domain** for auth portal (recommended for passkeys)

## Creating Your Own Demo App

Want to build a real integration? Here's the minimal code:

### Simple Node.js Express Example

```bash
# Create a new project
mkdir my-demo-app && cd my-demo-app
npm init -y
npm install express
```

```js
// server.js
const express = require('express');
const app = express();

const PORTAL_URL = 'http://localhost:3050';
const APP_ID = 'demo-app';
const CALLBACK_URL = 'http://localhost:4000/auth/callback';

app.get('/', (req, res) => {
  res.send(`
    <h1>My Demo App</h1>
    <a href="/login">Sign In</a>
  `);
});

app.get('/login', (req, res) => {
  const url = new URL(\`\${PORTAL_URL}/login\`);
  url.searchParams.set('app_id', APP_ID);
  url.searchParams.set('redirect_uri', CALLBACK_URL);
  url.searchParams.set('state', Math.random().toString(36));
  res.redirect(url.toString());
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  const response = await fetch(\`\${PORTAL_URL}/api/auth/exchange\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, app_id: APP_ID }),
  });

  const payload = await response.json();

  res.send(\`
    <h1>Welcome!</h1>
    <p>Email: \${payload.user.email}</p>
    <p>Access: \${payload.app_claims?.enabled ? 'Granted' : 'Denied'}</p>
    <pre>\${JSON.stringify(payload, null, 2)}</pre>
  \`);
});

app.listen(4000, () => {
  console.log('Demo app running at http://localhost:4000');
});
```

Then:
```bash
# Allowlist the callback
psql $DATABASE_URL -c "UPDATE public.apps SET allowed_callback_urls = ARRAY['http://localhost:4000/auth/callback'] WHERE id = 'demo-app';"

# Run the demo app
node server.js
```

## Next Steps

- **[SSO Integration Guide](./content/docs/guides/sso-integration-guide.md)** - Simple integration instructions
- **[Auth Portal Technical Spec](./content/docs/authentication/auth-portal-sso-passkeys.md)** - API contracts
- **[Agent Instructions](./content/docs/reference/auth-portal-agent-instructions.md)** - Copy/paste tasks

## Troubleshooting

### Demo page won't load
- Ensure dev server is running (`pnpm dev`)
- Check browser console for errors

### "Invalid redirect_uri" error
- Verify callback URL is allowlisted in `public.apps.allowed_callback_urls`
- URL must match exactly (including protocol, port)

### Code exchange fails
- Check that `demo-app` exists in the database
- Verify the portal is running at `http://localhost:3050`
- Check browser console for network errors

### User has no access
- Verify user has `app_metadata.apps.demo-app.enabled = true`
- Run: `SELECT raw_app_meta_data FROM auth.users WHERE email = 'user@example.com';`
