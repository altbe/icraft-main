# Credit Purchase Bug Fix - 2025-10-16

## Issue Summary
Credit package purchases were failing with **400 Bad Request** on `dev.icraftstories.com`. The Stripe checkout flow could not be initiated for any credit package (25, 75, or 150 credits).

## Root Cause Analysis

### The Problem
The API endpoint `/subscriptions/purchase-credits` was **missing a requestBody schema** in the OpenAPI specification (`backend/config/routes.oas.json`).

### Why It Failed
1. **Zuplo validation layer** requires OpenAPI schemas to validate incoming requests
2. Without a `requestBody` definition, Zuplo **rejected ALL requests** with 400 Bad Request
3. The request never reached the backend handler code in `stripe-service.ts`

### What The Frontend Was Sending (Correctly)
```json
{
  "packageId": "small",
  "success_url": "https://dev.icraftstories.com/subscription?success=true&credits=true",
  "cancel_url": "https://dev.icraftstories.com/subscription?canceled=true"
}
```

### What The OpenAPI Spec Had
```json
{
  "post": {
    "summary": "iCraft - Subscriptions - purchase credits",
    "description": "...",
    "requestBody": null  // ❌ MISSING!
  }
}
```

## The Fix

### Added Complete RequestBody Schema
Location: `backend/config/routes.oas.json` line ~815-875

```json
{
  "requestBody": {
    "required": true,
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "required": ["packageId", "success_url", "cancel_url"],
          "properties": {
            "packageId": {
              "type": "string",
              "enum": ["small", "medium", "large"],
              "description": "Abstract package identifier"
            },
            "success_url": {
              "type": "string",
              "format": "uri",
              "description": "URL to redirect to after successful purchase"
            },
            "cancel_url": {
              "type": "string",
              "format": "uri",
              "description": "URL to redirect to if purchase is canceled"
            }
          }
        }
      }
    }
  },
  "responses": {
    "200": {
      "description": "Stripe checkout session created successfully",
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "properties": {
              "checkoutUrl": { "type": "string", "format": "uri" },
              "sessionId": { "type": "string" },
              "creditAmount": { "type": "number" },
              "price": { "type": "number" }
            }
          }
        }
      }
    },
    "400": { "description": "Invalid request parameters" },
    "401": { "description": "Unauthorized" }
  }
}
```

## Testing Evidence

### Before Fix
- **Endpoint**: `POST /subscriptions/purchase-credits`
- **Status**: `400 Bad Request`
- **Error**: "Failed to purchase credits - Request failed with status code 400"
- **Console**: API Response Error (Client) with undefined responseData

### After Fix
- Zuplo will now validate the request against the schema
- Valid requests pass through to the handler
- Stripe checkout session creation proceeds normally

## Deployment

### Commit
```
feb65ff - Fix: Add missing requestBody schema for /subscriptions/purchase-credits
```

### Branch
`develop` → Auto-deploys to **unico-api-develop-b2f4ce8.zuplo.app**

### Verification Steps
1. Navigate to https://dev.icraftstories.com
2. Go to Subscription Management page
3. Click "Purchase Credits" on any package (25, 75, or 150)
4. Should redirect to Stripe checkout (not 400 error)

## Related Files

### Backend
- ✅ `backend/config/routes.oas.json` - Added requestBody schema
- `backend/modules/stripe-service.ts:615-695` - Handler expects these params
- `backend/modules/stripe-service.ts:626-635` - Validation logic

### Frontend
- `frontend/src/services/SubscriptionService.ts:168-182` - Sends request
- `frontend/src/components/subscription/SubscriptionActionHandlers.tsx:194-245` - Purchase handler
- `frontend/src/components/subscription/CreditPurchase.tsx` - UI component

## Prevention

### OpenAPI Schema Checklist
When adding new POST/PUT endpoints:
1. ✅ Define `requestBody` with `required: true`
2. ✅ Add JSON schema with all required fields
3. ✅ Use enum for restricted values
4. ✅ Add format validators (uri, email, etc.)
5. ✅ Define response schemas for all status codes
6. ✅ Test with actual API calls before deploying

### Similar Endpoints to Review
Check these endpoints also have complete schemas:
- `/subscriptions/create` ✓
- `/subscriptions/upgrade` (if exists)
- `/credits/use` ✓
- Other POST/PUT endpoints in routes.oas.json
