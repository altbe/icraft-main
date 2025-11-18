# Offline Status Issue - Root Cause and Fix

**Date**: 2025-11-18
**Environment**: Development (dev.icraftstories.com)
**Status**: Fixed

## Problem

The application was showing "You are currently offline" notification even though:
- `navigator.onLine` reported `true`
- Service worker was active and registered
- Network requests were succeeding
- Browser had full internet connectivity

## Root Cause

The issue was caused by an interaction between two systems:

1. **Cloudflare WWW Redirect**: The site redirects between `dev.icraftstories.com` and `www.dev.icraftstories.com`
2. **Connectivity Check Logic**: The `useOffline` hook performs HEAD requests to `/index.html` with `redirect: 'manual'`

When `redirect: 'manual'` is set in a fetch request, the browser returns an **opaque redirect response** for any redirect (3xx):
- `status: 0` (not the actual 307 status code)
- `type: 'opaqueredirect'`
- `ok: false`

The original connectivity check logic in `frontend/src/hooks/useOffline.ts:36` was:

```typescript
const isConnected = response.ok || (response.status >= 300 && response.status < 400);
```

This evaluated to `false` because:
- `response.ok` = `false`
- `response.status` = `0` (not in the 300-400 range)

## Evidence

Network requests showed:
```
[HEAD] https://dev.icraftstories.com/index.html?connectivity-check=... => [307] Temporary Redirect
```

But the fetch API with `redirect: 'manual'` returned:
```javascript
{
  status: 0,
  type: "opaqueredirect",
  ok: false
}
```

Console also showed a timeout on `/subscriptions/plans`:
```
Network timeout detected, retrying request (1/3) after 2000ms
```

## Solution

Updated the connectivity check logic to handle opaque redirect responses:

```typescript
const isConnected = response.ok ||
                   (response.status >= 300 && response.status < 400) ||
                   (response.status >= 500 && response.status < 600) ||
                   response.type === 'opaqueredirect'; // Handle redirects
```

**File**: `frontend/src/hooks/useOffline.ts:37-40`

## Verification

After the fix:
- Opaque redirects are correctly treated as "online"
- No false "offline" notifications
- Connectivity checks pass correctly

## Related Files

- `frontend/src/hooks/useOffline.ts` - Connectivity check hook (FIXED)
- `public/serviceWorkerExtension.js` - Service worker extension with WWW subdomain bypass

## Alternative Considered

We could have removed `redirect: 'manual'` to get the actual status code, but this would cause the browser to follow redirects and download the full HTML page for each connectivity check, wasting bandwidth. The current solution maintains the efficient HEAD request pattern while correctly handling the redirect case.

## Testing

To reproduce the original issue:
1. Navigate to https://dev.icraftstories.com
2. Observe connectivity checks in Network tab (HEAD requests to `/index.html?connectivity-check=...`)
3. See 307 redirects
4. Before fix: "You are currently offline" notification appears
5. After fix: No offline notification, app works correctly
