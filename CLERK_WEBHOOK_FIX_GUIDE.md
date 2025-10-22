# Clerk Webhook Configuration Fix Guide

**Issue**: Team member onboarding fails because Clerk organization webhooks are not firing
**Root Cause**: Missing webhook route in `routes.oas.json` + webhooks not configured in Clerk Dashboard
**Status**: Route added, pending deployment and Clerk configuration
**Date**: 2025-01-22

---

## Problem Summary

When users accept team invitations via Clerk:
1. ✅ Clerk adds user to organization (works)
2. ❌ `organizationMembership.created` webhook doesn't fire (missing route)
3. ❌ Database `team_members` record not created
4. ❌ Onboarding doesn't run (no credit/story transfer, no subscription cancellation)
5. ❌ User appears in Clerk organization but NOT in database

**Impact**: Users accepting team invitations don't get properly onboarded.

---

## Fix Applied (Backend Code)

### ✅ Added Missing Webhook Route

**File**: `backend/config/routes.oas.json`
**Lines**: 222-242

```json
"/icraft-clerk-organization-webhook": {
  "x-zuplo-path": {
    "pathMode": "open-api"
  },
  "post": {
    "summary": "ICraft - Clerk Organization webhook",
    "description": "Webhook endpoint for receiving Clerk organization events...",
    "x-zuplo-route": {
      "corsPolicy": "custom-cors",
      "handler": {
        "export": "default",
        "module": "$import(./modules/clerk-organization-webhooks)"
      },
      "policies": {
        "inbound": []
      }
    },
    "operationId": "7f3c8a9e-1b4d-4c6f-a2e5-9d8b7f6e5c4d"
  }
}
```

**Module**: `backend/modules/clerk-organization-webhooks.ts` (already exists)
**Onboarding**: `backend/sql/team-member-onboarding.sql` (already applied to databases)

---

## Deployment Steps

### Step 1: Deploy Backend Changes

```bash
cd backend

# Verify route is in routes.oas.json
grep -A 10 "icraft-clerk-organization-webhook" config/routes.oas.json

# Commit changes
git add config/routes.oas.json
git commit -m "fix(webhooks): Add missing Clerk organization webhook route

Problem:
- organizationMembership.created webhooks not firing
- Users accepting team invitations not onboarded to database
- Team members missing from database despite being in Clerk org

Solution:
- Added /icraft-clerk-organization-webhook route
- Routes to clerk-organization-webhooks.ts module
- Enables automatic member onboarding via webhook

Events handled:
- organizationMembership.created (triggers onboard_team_member)
- organizationMembership.deleted
- organizationMembership.updated
- organizationInvitation.accepted
- organizationInvitation.revoked"

git push origin develop
```

### Step 2: Wait for Zuplo Deployment

Zuplo automatically deploys `develop` branch to **Development** environment.

**Development URL**: `https://unico-api-develop-<hash>.zuplo.app`

Verify deployment:
```bash
# Check if route is live
curl -X POST https://unico-api-develop-<hash>.zuplo.app/icraft-clerk-organization-webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{}}'

# Should return 200 OK (even for invalid payload, means endpoint exists)
```

---

## Clerk Dashboard Configuration

### Required Webhooks for Each Environment

You need to configure webhooks in **TWO separate Clerk instances**:

#### 1. **Non-Production Clerk** (for development/QA)

**Clerk Dashboard**: https://dashboard.clerk.com (switch to non-prod instance)

**Webhook Configuration**:
- Navigate to: **Developers** → **Webhooks** → **Add Endpoint**
- **Endpoint URL**: `https://unico-api-develop-<hash>.zuplo.app/icraft-clerk-organization-webhook`
- **Subscribe to events**:
  - `organizationMembership.created` ⭐ **CRITICAL**
  - `organizationMembership.deleted`
  - `organizationMembership.updated`
  - `organizationInvitation.accepted`
  - `organizationInvitation.revoked`
- **Description**: "Non-prod team onboarding webhook"
- **Status**: Active ✅

#### 2. **Production Clerk** (for production)

**Clerk Dashboard**: https://dashboard.clerk.com (switch to production instance)

**Webhook Configuration**:
- Navigate to: **Developers** → **Webhooks** → **Add Endpoint**
- **Endpoint URL**: `https://unico-api-main-<hash>.zuplo.app/icraft-clerk-organization-webhook`
  - **OR custom domain**: `https://api.icraftstories.com/icraft-clerk-organization-webhook`
- **Subscribe to events**:
  - `organizationMembership.created` ⭐ **CRITICAL**
  - `organizationMembership.deleted`
  - `organizationMembership.updated`
  - `organizationInvitation.accepted`
  - `organizationInvitation.revoked`
- **Description**: "Production team onboarding webhook"
- **Status**: Active ✅

---

## Finding Your Zuplo URLs

### Development (Non-Prod)
```bash
# From backend directory
git branch
# Shows: develop

# Zuplo deployment URL format:
# https://unico-api-develop-<unique-hash>.zuplo.app

# Find actual URL in Zuplo dashboard:
# 1. Go to https://portal.zuplo.com
# 2. Select your project
# 3. Click "develop" environment
# 4. Copy the URL shown at top
```

### Production
```bash
# From backend directory
git branch
# Switch to: main

# Zuplo deployment URL format:
# https://unico-api-main-<unique-hash>.zuplo.app
# OR custom domain:
# https://api.icraftstories.com
```

---

## Webhook Signing Secret (Optional but Recommended)

### Step 1: Get Signing Secret from Clerk

After creating webhook in Clerk Dashboard:
1. Click on the webhook endpoint you created
2. Copy the **Signing Secret** (starts with `whsec_...`)

### Step 2: Add to Zuplo Environment Variables

**Zuplo Dashboard** → **Your Project** → **Environment** (develop or main) → **Environment Variables**

Add:
```
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 3: Uncomment Verification Code

**File**: `backend/modules/clerk-organization-webhooks.ts`

**Lines 77-79** (currently commented out):
```typescript
// Verify webhook signature (if configured)
// const signature = request.headers.get('clerk-signature');
// TODO: Implement signature verification for production
```

**Uncomment and implement**:
```typescript
// Verify webhook signature
const signature = request.headers.get('svix-signature');
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

if (webhookSecret && signature) {
  // Clerk uses Svix for webhook signing
  const Webhook = require('svix').Webhook;
  const wh = new Webhook(webhookSecret);

  try {
    const body = await request.text();
    wh.verify(body, {
      'svix-id': request.headers.get('svix-id'),
      'svix-timestamp': request.headers.get('svix-timestamp'),
      'svix-signature': signature
    });
  } catch (err) {
    context.log.error('Webhook signature verification failed', err);
    return HttpProblems.unauthorized(request, context, {
      detail: 'Invalid webhook signature'
    });
  }
}
```

**Note**: Add `svix` package to dependencies:
```bash
npm install svix
```

---

## Testing the Fix

### Test 1: Send Test Webhook from Clerk Dashboard

1. Go to Clerk Dashboard → Webhooks
2. Click on your organization webhook endpoint
3. Click **"Send Test Event"**
4. Select event type: `organizationMembership.created`
5. Click **Send**
6. Check response (should be 200 OK)

### Test 2: Real Invitation Flow (Non-Prod)

```bash
# 1. Send invitation from g@altgene.net to a test email
# 2. Accept invitation with test user
# 3. Verify database

# Check team_members table
SELECT * FROM team_members WHERE email = 'test@example.com';
# Should show new record

# Check activities table
SELECT * FROM activities
WHERE user_id = '<test_user_id>'
  AND action_type = 'team_join';
# Should show onboarding activity with transfer details
```

### Test 3: Verify Onboarding Ran

```sql
-- Check onboarding metadata
SELECT
  a.metadata->>'creditsTransferred' as credits,
  a.metadata->>'storiesTransferred' as stories,
  a.metadata->>'subscriptionCancelled' as sub_cancelled,
  a.created_at
FROM activities a
WHERE a.action_type = 'team_join'
ORDER BY a.created_at DESC
LIMIT 1;

-- Expected: JSON showing transfer details
```

---

## Rollback Plan

If webhooks cause issues:

### 1. Disable Webhook in Clerk Dashboard
- Go to webhook endpoint
- Toggle **Status** to **Inactive**
- Users won't be auto-onboarded, but can be added manually

### 2. Revert Backend Code
```bash
cd backend
git revert <commit-hash>
git push origin develop
```

### 3. Manual Onboarding Script

If needed, manually onboard users:
```sql
-- Add team member
INSERT INTO team_members (team_id, user_id, role, email, can_use_credits, can_manage_credits)
VALUES ('<team_id>', '<user_id>', 'member', '<email>', true, false);

-- Run onboarding
SELECT onboard_team_member('<user_id>', '<team_id>');
```

---

## Monitoring & Verification

### Check Webhook Logs (Zuplo)

**Zuplo Dashboard** → **Runtime Logs**

Filter for:
- `organizationMembership.created`
- `Successfully onboarded team member`
- `Error onboarding team member`

### Check Database Logs (Supabase)

```sql
-- Recent team joins
SELECT
  a.user_id,
  a.metadata->>'teamName' as team,
  a.metadata->>'creditsTransferred' as credits,
  a.created_at
FROM activities a
WHERE a.action_type = 'team_join'
  AND a.created_at >= NOW() - INTERVAL '7 days'
ORDER BY a.created_at DESC;

-- Onboarding errors
SELECT *
FROM system_logs
WHERE log_type LIKE '%team%'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## Success Criteria

- [ ] Webhook route added to `routes.oas.json`
- [ ] Backend deployed to develop environment
- [ ] Backend deployed to main environment (production)
- [ ] Clerk webhook configured for non-prod instance
- [ ] Clerk webhook configured for production instance
- [ ] Test webhook succeeds from Clerk Dashboard
- [ ] Real invitation flow creates team_members record
- [ ] Real invitation flow runs onboarding (activity logged)
- [ ] Webhook signing secret configured (optional)
- [ ] Signature verification implemented (optional)
- [ ] No errors in Zuplo runtime logs
- [ ] No errors in Supabase system_logs

---

## Next Actions (Immediate)

### 1. ✅ Backend Code (DONE)
- Route added to routes.oas.json
- Ready to commit and deploy

### 2. ⏳ Deploy to Development
```bash
cd /home/g/_zdev/icraft-main/backend
git add config/routes.oas.json
git commit -m "fix(webhooks): Add missing Clerk organization webhook route"
git push origin develop
```

### 3. ⏳ Configure Clerk Webhooks (Non-Prod)
- Get Zuplo develop URL
- Add webhook in Clerk non-prod dashboard
- Test with Send Test Event

### 4. ⏳ Test Real Flow (Non-Prod)
- Send invitation to test user
- Accept invitation
- Verify database records

### 5. ⏳ Deploy to Production
```bash
# After non-prod success
cd backend
npm run promote:qa  # develop → preview
npm run release:production  # preview → main
```

### 6. ⏳ Configure Clerk Webhooks (Production)
- Get Zuplo production URL
- Add webhook in Clerk production dashboard
- Test with Send Test Event

### 7. ⏳ Monitor
- Watch Zuplo logs for webhook events
- Watch database for team_join activities
- Verify no errors for 24 hours

---

## Additional Notes

### Why This Wasn't Caught Earlier

1. **Code existed** (`clerk-organization-webhooks.ts`) but **route was missing**
2. **No automated tests** for webhook endpoints
3. **Manual testing** relied on Clerk webhook firing (which couldn't fire without route)
4. **onboard_team_member()** stored procedure was tested in isolation, not end-to-end

### Preventing Future Issues

1. **Add route validation tests**: Check all webhook modules have corresponding routes
2. **Add end-to-end webhook tests**: Mock Clerk webhook calls in test suite
3. **Add monitoring alerts**: Alert if no `organizationMembership.created` events received in 7 days
4. **Document webhook configuration**: This guide should be in onboarding docs

---

## Reference Links

- **Clerk Webhooks Docs**: https://clerk.com/docs/integrations/webhooks/overview
- **Clerk Organization Events**: https://clerk.com/docs/integrations/webhooks/webhook-events#organization-events
- **Zuplo Webhooks**: https://zuplo.com/docs/articles/webhooks
- **Svix (Clerk's webhook provider)**: https://docs.svix.com/receiving/verifying-payloads/how

---

## Contact

If issues persist after following this guide:
- Check Zuplo runtime logs for webhook errors
- Check Supabase system_logs for database errors
- Verify Clerk webhook status in dashboard (should show successful deliveries)
