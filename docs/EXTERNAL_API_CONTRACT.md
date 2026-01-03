# External API Key Contract

This document defines the API contract that external systems (n8n, Django, etc.) should implement to allow Supabase Access Broker to fetch and display their API keys.

## Overview

External systems can expose their API keys through a standardized REST API. The admin dashboard will periodically fetch these keys to provide unified visibility across all systems.

## Authentication

External APIs should support one of these authentication methods:

1. **API Key** (via header)
2. **Bearer Token**
3. **Basic Auth**
4. **No Auth** (for internal networks only)

Configure the authentication in the "Manage External Sources" dialog in the admin dashboard.

## Endpoints

### GET /api/keys

Fetch all API keys for a specific app.

**Query Parameters:**
- `app_id` (optional): Filter keys by app ID

**Headers:**
```
Authorization: Bearer {token}
# OR
X-API-Key: {key}
# OR
Authorization: Basic {base64_credentials}
```

**Response (200 OK):**
```json
{
  "keys": [
    {
      "id": "unique-key-id",
      "name": "Production Webhook Key",
      "description": "Used for webhook integrations",
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2025-01-15T10:30:00Z",
      "last_used_at": "2024-01-20T14:22:00Z",
      "enabled": true,
      "role": "webhook",
      "created_by": "admin@example.com"
    }
  ],
  "source": "n8n Production",
  "total": 1
}
```

**Response Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | array | ✅ | Array of API key objects |
| `keys[].id` | string | ✅ | Unique identifier for the key |
| `keys[].name` | string | ✅ | Human-readable name |
| `keys[].description` | string | ❌ | Optional description |
| `keys[].created_at` | string | ✅ | ISO 8601 timestamp |
| `keys[].expires_at` | string | ❌ | ISO 8601 timestamp (null = never expires) |
| `keys[].last_used_at` | string | ❌ | ISO 8601 timestamp of last use |
| `keys[].enabled` | boolean | ✅ | Whether the key is active |
| `keys[].role` | string | ❌ | Role or permission level |
| `keys[].created_by` | string | ❌ | User who created the key |
| `source` | string | ✅ | Name of the source system |
| `total` | number | ❌ | Total count of keys |

**Error Responses:**

```json
// 401 Unauthorized
{
  "error": "Invalid credentials"
}

// 403 Forbidden
{
  "error": "Insufficient permissions"
}

// 500 Internal Server Error
{
  "error": "Failed to fetch keys",
  "details": "Database connection error"
}
```

## Phase 2: Remote Actions (Optional)

These endpoints can be implemented to allow remote management from the admin dashboard.

### POST /api/keys/{id}/revoke

Revoke (delete) an API key.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "API key revoked"
}
```

### POST /api/keys/{id}/toggle

Enable or disable an API key.

**Request Body:**
```json
{
  "enabled": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "API key disabled"
}
```

## Implementation Examples

### n8n Workflow

Create an n8n workflow that exposes an HTTP endpoint:

1. **HTTP Request Trigger** - Listen on `/api/keys`
2. **Function Node** - Query your API key storage
3. **Return Response** - Format as JSON per contract

### Django View

```python
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .models import APIKey

@require_http_methods(["GET"])
def list_api_keys(request):
    app_id = request.GET.get('app_id')

    keys = APIKey.objects.all()
    if app_id:
        keys = keys.filter(app_id=app_id)

    return JsonResponse({
        "keys": [
            {
                "id": str(key.id),
                "name": key.name,
                "description": key.description,
                "created_at": key.created_at.isoformat(),
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
                "enabled": key.enabled,
                "role": key.role,
                "created_by": key.created_by.email if key.created_by else None
            }
            for key in keys
        ],
        "source": "Django Scraper",
        "total": keys.count()
    })
```

### Node.js/Express

```javascript
app.get('/api/keys', async (req, res) => {
  const { app_id } = req.query;

  let keys = await db.apiKeys.findAll();

  if (app_id) {
    keys = keys.filter(k => k.app_id === app_id);
  }

  res.json({
    keys: keys.map(key => ({
      id: key.id,
      name: key.name,
      description: key.description || null,
      created_at: key.createdAt.toISOString(),
      expires_at: key.expiresAt ? key.expiresAt.toISOString() : null,
      last_used_at: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
      enabled: key.enabled,
      role: key.role || null,
      created_by: key.createdBy || null
    })),
    source: 'My Service',
    total: keys.length
  });
});
```

## Security Considerations

1. **Always use HTTPS** in production
2. **Implement rate limiting** to prevent abuse
3. **Never expose actual API key values** - only metadata
4. **Use proper authentication** - don't rely on security through obscurity
5. **Log access** to the keys endpoint for auditing
6. **Consider IP whitelisting** for added security

## Testing

Use curl to test your implementation:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-service.com/api/keys?app_id=myapp"
```

Expected response should match the contract above.

## Support

If you need help implementing this contract or have questions about the format, refer to the example implementations or contact the admin dashboard maintainers.

