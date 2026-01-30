---
title: "API Keys Guide"
description: "Secure your webhooks and external integrations with app-specific API keys"
category: "advanced"
audience: "dashboard-admin"
---

# API Keys Guide

Learn how to create and manage API keys for webhooks, n8n workflows, and other external integrations using your multi-app authentication system.

## Overview

API keys provide a secure way to authenticate external services like n8n, Zapier, or custom webhooks without requiring user authentication. Each API key:

- Is **app-specific** - scoped to a single application
- Can be assigned a **role** for permission control
- Has optional **expiration dates** for security
- Is **hashed** in the database (can't be retrieved after creation)
- Tracks **last usage** for monitoring

## Creating API Keys

### Via Dashboard

1. Navigate to **Apps** in the dashboard
2. Click on the app you want to create a key for
3. Go to the **API Keys** tab
4. Click **Create API Key**
5. Fill in the details:
   - **Name** (required): Descriptive name (e.g., "n8n Production Webhook")
   - **Description** (optional): What this key is used for
   - **Role** (optional): Assign permissions via a role
   - **Expiration** (optional): When the key should stop working
6. Click **Create API Key**
7. **⚠️ Important**: Copy the key immediately - you won't see it again!

### Key Format

API keys follow this format:

```
sk_[64 hexadecimal characters]
```

Example:
```
sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

## Using API Keys

### In HTTP Requests

API keys can be sent in two ways:

#### Option 1: X-API-Key Header (Recommended)

```bash
curl -X POST https://your-domain.com/api/webhooks/your-app-id \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"event": "user.created", "data": {...}}'
```

#### Option 2: Authorization Bearer Token

```bash
curl -X POST https://your-domain.com/api/webhooks/your-app-id \
  -H "Authorization: Bearer sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"event": "user.created", "data": {...}}'
```

### In n8n

1. Create a **Webhook** node or **HTTP Request** node
2. Under **Authentication**, choose:
   - **Header Auth** with name `X-API-Key` and value `{{your_api_key}}`
   - Or **Generic Credential Type** with Authorization `Bearer {{your_api_key}}`
3. Set the URL to `https://your-domain.com/api/webhooks/{app_id}`

### In Zapier

1. Choose **Webhooks by Zapier**
2. Select **POST** action
3. Add **Headers**:
   - `X-API-Key`: `your_api_key_here`
   - `Content-Type`: `application/json`
4. Set URL to your webhook endpoint

### In Make (Integromat)

1. Use the **HTTP** module
2. Choose **Make a request**
3. Add header `X-API-Key` with your key
4. Configure your payload and URL

## Webhook Endpoint

Your API keys work with the built-in webhook endpoint:

```
POST /api/webhooks/{app_id}
```

The middleware automatically:
- ✅ Validates the API key
- ✅ Checks expiration
- ✅ Verifies the key belongs to the requested app
- ✅ Records usage timestamp
- ✅ Injects app context into the request

### Response on Success

```json
{
  "success": true,
  "message": "Webhook received successfully",
  "context": {
    "app_id": "your-app-id",
    "key_id": "uuid-of-the-key",
    "role": "webhook-role"
  },
  "received_at": "2024-01-15T10:30:00.000Z"
}
```

### Response on Error

```json
{
  "error": "Invalid or expired API key"
}
```

Status codes:
- `401` - Missing or invalid API key
- `403` - API key not valid for this app
- `500` - Server error

## Security Best Practices

### 1. Store Keys Securely

**Never** commit API keys to version control. Use:

- Environment variables in production
- Secret managers (AWS Secrets Manager, HashiCorp Vault)
- Password managers for manual access
- n8n/Zapier credential storage

### 2. Use Expiration Dates

Set expiration dates for:
- **Development/testing keys**: 7-30 days
- **Production keys**: 90-365 days
- **Temporary access**: As short as needed

### 3. Rotate Keys Regularly

1. Create a new key
2. Update services to use the new key
3. Monitor the old key's last usage
4. Delete the old key when no longer used

### 4. Assign Minimal Roles

Only assign roles with the minimum permissions needed:

```
✅ "webhook-receiver" role with read-only permissions
❌ "admin" role with full access
```

### 5. Monitor Usage

Check the **Last Used** column in the API Keys dashboard to:
- Identify unused keys for deletion
- Detect suspicious activity
- Verify integrations are working

### 6. Disable Instead of Delete

When investigating issues:
1. **Disable** the key first (using the toggle)
2. Verify nothing breaks
3. Delete after confirming it's unused

## Managing API Keys

### View All Keys

Navigate to: **Apps → [Your App] → API Keys**

The table shows:
- **Name & Description**: What the key is for
- **Role**: Assigned permissions
- **Key Reference**: Partial hash for identification
- **Expiration**: When the key expires
- **Last Used**: Most recent usage timestamp
- **Status**: Enabled/disabled toggle
- **Actions**: Delete button

### Update a Key

You can update:
- ✅ Name and description
- ✅ Role assignment
- ✅ Expiration date
- ✅ Enabled/disabled status
- ❌ The actual key (create a new one instead)

### Delete a Key

⚠️ **Warning**: Deletion is immediate and cannot be undone.

1. Click the delete icon (trash can)
2. Confirm the deletion
3. The key is immediately revoked

Any requests using this key will fail with `401 Unauthorized`.

## Troubleshooting

### "API key required" Error

**Cause**: No API key in request headers

**Solution**: Add either:
```
X-API-Key: sk_your_key
```
or
```
Authorization: Bearer sk_your_key
```

### "Invalid or expired API key" Error

**Causes**:
1. Key was deleted
2. Key is disabled
3. Key has expired
4. Wrong key value (typo)

**Solution**:
- Check the key is enabled in dashboard
- Verify expiration date hasn't passed
- Double-check you copied the full key
- Create a new key if needed

### "API key not valid for this app" Error

**Cause**: The API key belongs to a different app

**Solution**:
- Verify you're using the correct app_id in the URL
- Check which app the key was created for
- Create a new key for the correct app

### Key Not Recording Usage

**Cause**: The request might be failing before reaching the endpoint

**Solution**:
- Check response status codes
- Verify the full request URL is correct
- Look at server logs for errors

## Advanced: Building Custom Webhook Handlers

The middleware sets these headers for your webhook handlers:

```typescript
// In your API route handler
export async function POST(request: NextRequest) {
  const appId = request.headers.get('x-app-id');
  const keyId = request.headers.get('x-key-id');
  const roleName = request.headers.get('x-role-name');

  // Your webhook logic here
  // You already know which app and what permissions
}
```

Example custom endpoint:

```typescript
// app/api/webhooks/[app_id]/custom-action/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app_id: string }> }
) {
  const { app_id } = await params;
  const appId = request.headers.get('x-app-id');

  // Verify app match
  if (appId !== app_id) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const body = await request.json();

  // Process your webhook
  // ...

  return NextResponse.json({ success: true });
}
```

## Integration Examples

### n8n Workflow

1. **Trigger**: Schedule, manual, or another service
2. **HTTP Request Node**:
   - Method: POST
   - URL: `https://your-app.com/api/webhooks/myapp`
   - Authentication: Header Auth
   - Header Name: `X-API-Key`
   - Header Value: `{{$credentials.apiKey}}`
3. **Process Response**

### GitHub Actions

```yaml
- name: Send Webhook
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }} \
      -H "X-API-Key: ${{ secrets.API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"event": "deployment", "status": "success"}'
```

### Node.js Application

```javascript
const axios = require('axios');

async function sendWebhook(data) {
  try {
    const response = await axios.post(
      'https://your-app.com/api/webhooks/myapp',
      data,
      {
        headers: {
          'X-API-Key': process.env.API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Webhook sent:', response.data);
  } catch (error) {
    console.error('Webhook failed:', error.message);
  }
}
```

## Next Steps

- [Complete Integration Guide](/docs/complete-integration-guide) - Full authentication setup
- [Authentication Guide](/docs/authentication-guide) - User authentication patterns
- [RLS Policies](/docs/rls-policies) - Secure your database with Row Level Security

## Need Help?

Check the webhook endpoint logs or create an issue if you encounter problems not covered in this guide.


---

## What's Next

- **Complete integration:** [/docs/complete-integration-guide](/docs/complete-integration-guide)
- **Auth quick reference:** [/docs/auth-quick-reference](/docs/auth-quick-reference)
- **Authorization patterns:** [/docs/authorization-patterns](/docs/authorization-patterns)
- **Production config:** [/docs/environment-configuration](/docs/environment-configuration)
