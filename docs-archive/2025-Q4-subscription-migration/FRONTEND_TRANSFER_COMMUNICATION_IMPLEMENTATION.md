# Frontend Transfer Communication - Implementation Guide

**Date**: 2025-10-24
**Status**: Backend Complete | Frontend In Progress | Documentation Complete

---

## Overview

This guide documents how to complete the frontend user communication for story and credit transfers when users join teams or upgrade subscriptions.

## ✅ What's Already Implemented (Backend)

### 1. Transfer Preview API Endpoint

**File**: `backend/modules/user-transfer-preview.ts` ✅ Created

**Endpoint**: `GET /users/{userId}/transfer-preview`

**Returns**:
```json
{
  "userId": "user_abc123",
  "storyCount": 5,
  "creditBalance": 150,
  "hasActiveSubscription": true,
  "subscriptionPlanId": "individual",
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**Security**: Requires authenticated user, validates X-User-Id header matches userId parameter.

### 2. Automatic Transfer on Team Join

**Flow**:
1. User accepts Clerk invitation
2. Clerk webhook `organizationMembership.created` triggered
3. Backend calls `onboard_team_member(userId, teamId)`
4. Transfers ALL stories and credits
5. Cancels individual/trial subscription
6. Logs `team_join` activity with transfer details

**Activity Metadata**:
```json
{
  "creditsTransferred": 150,
  "storiesTransferred": 5,
  "subscriptionCancelled": true
}
```

### 3. Automatic Transfer on Subscription Upgrade

**Flow**:
1. User upgrades to Team/Custom plan in Stripe
2. Stripe webhook `customer.subscription.updated` triggered
3. Backend calls `detect_and_handle_subscription_upgrade()`
4. Auto-creates team if user doesn't have one
5. Transfers ALL stories and credits
6. Logs `subscription_upgrade_transfer` activity

---

## 📋 Required Frontend Implementation

### Step 1: Add Route Configuration (Backend)

**File**: `backend/config/routes.oas.json`

**Add this route** (insert after `/users/{userId}` endpoint):

```json
"/users/{userId}/transfer-preview": {
  "x-zuplo-path": {
    "pathMode": "open-api"
  },
  "get": {
    "summary": "Get transfer preview for user",
    "description": "Returns preview of stories and credits that will be transferred when user joins a team",
    "x-zuplo-route": {
      "corsPolicy": "custom-cors",
      "handler": {
        "export": "default",
        "module": "$import(./modules/user-transfer-preview)"
      },
      "policies": {
        "inbound": ["clerk-jwt-validation"]
      }
    },
    "parameters": [
      {
        "name": "userId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string"
        }
      }
    ],
    "responses": {
      "200": {
        "description": "Transfer preview data"
      }
    }
  }
}
```

### Step 2: Update Frontend TeamService

**File**: `frontend/src/services/TeamService.ts`

**Add method**:
```typescript
async getTransferPreview(userId: string, token: string): Promise<{
  userId: string;
  storyCount: number;
  creditBalance: number;
  hasActiveSubscription: boolean;
  subscriptionPlanId: string | null;
  timestamp: string;
}> {
  if (!userId || !token) {
    throw new Error('User ID and token are required');
  }

  checkApiAvailability('TeamService', 'getTransferPreview');

  const headers = createAuthHeaders(token, userId);
  headers['X-Device-Id'] = await getDeviceId();

  const response = await api.get(`/users/${userId}/transfer-preview`, { headers });

  logger.info(`Retrieved transfer preview for user ${userId}:`, {
    storyCount: response.data.storyCount,
    creditBalance: response.data.creditBalance
  });

  return response.data;
}
```

### Step 3: Update TeamInvitationAcceptancePage

**File**: `frontend/src/pages/TeamInvitationAcceptancePage.tsx`

**Add state and fetch**:
```typescript
const [transferPreview, setTransferPreview] = useState<{
  storyCount: number;
  creditBalance: number;
  hasActiveSubscription: boolean;
} | null>(null);
const [loadingPreview, setLoadingPreview] = useState(true);

// Fetch transfer preview
useEffect(() => {
  const fetchPreview = async () => {
    if (!userId) return;

    setLoadingPreview(true);
    try {
      const authToken = await getToken();
      if (!authToken) return;

      const preview = await teamService.getTransferPreview(userId, authToken);
      setTransferPreview(preview);
    } catch (err) {
      console.error('Failed to fetch transfer preview:', err);
      // Non-critical - continue with generic warning
    } finally {
      setLoadingPreview(false);
    }
  };

  fetchPreview();
}, [userId]);
```

**Update warning UI** (replace lines 236-270):
```tsx
<Alert className="border-amber-200 bg-amber-50">
  <Info className="h-4 w-4 text-amber-600" />
  <AlertTitle className="text-amber-900 font-semibold mb-3">
    {t('teams:invitationWarning.title', 'Important: What Happens When You Join')}
  </AlertTitle>
  <AlertDescription className="text-amber-800 space-y-2">
    <div className="space-y-2">
      {/* Stories */}
      <div className="flex items-start gap-2">
        <span className="font-medium min-w-fit">•</span>
        <span>
          <span className="font-medium">{t('teams:invitationWarning.stories.title', 'Stories:')}</span>{' '}
          {loadingPreview ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('teams:creditTransferWarning.checkingBalance', 'Checking...')}
            </span>
          ) : transferPreview && transferPreview.storyCount > 0 ? (
            t('teams:invitationWarning.stories.withCount', {
              count: transferPreview.storyCount,
              defaultValue: 'All {{count}} of your personal stories will become team stories.'
            })
          ) : (
            t('teams:invitationWarning.stories.noStories', 'Your personal stories (if any) will become team stories.')
          )}
        </span>
      </div>

      {/* Credits */}
      <div className="flex items-start gap-2">
        <span className="font-medium min-w-fit">•</span>
        <span>
          <span className="font-medium">{t('teams:invitationWarning.credits.title', 'Credits:')}</span>{' '}
          {loadingPreview ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('teams:creditTransferWarning.checkingBalance', 'Checking...')}
            </span>
          ) : transferPreview && transferPreview.creditBalance > 0 ? (
            t('teams:invitationWarning.credits.withBalance', {
              count: transferPreview.creditBalance,
              defaultValue: 'All {{count}} of your personal credits will be transferred to the team.'
            })
          ) : (
            t('teams:invitationWarning.credits.noBalance', 'All your personal credits (if any) will be transferred to the team.')
          )}
        </span>
      </div>

      {/* Subscription */}
      <div className="flex items-start gap-2">
        <span className="font-medium min-w-fit">•</span>
        <span>
          <span className="font-medium">{t('teams:invitationWarning.subscription.title', 'Subscription:')}</span>{' '}
          {loadingPreview && transferPreview?.hasActiveSubscription ? (
            t('teams:invitationWarning.subscription.willBeCancelled', 'Your {{plan}} subscription will be canceled. You\'ll use the team\'s subscription instead.', {
              plan: transferPreview.subscriptionPlanId
            })
          ) : (
            t('teams:invitationWarning.subscription.description', 'If you have an active individual subscription, it will be canceled. You\'ll use the team\'s subscription instead.')
          )}
        </span>
      </div>
    </div>
  </AlertDescription>
</Alert>
```

### Step 4: Add Translation Keys

**File**: `frontend/src/locales/en/teams.json`

**Add**:
```json
{
  "invitationWarning": {
    "stories": {
      "withCount": "All {{count}} of your personal stories will become team stories.",
      "noStories": "Your personal stories (if any) will become team stories."
    },
    "subscription": {
      "willBeCancelled": "Your {{plan}} subscription will be canceled. You'll use the team's subscription instead."
    }
  }
}
```

### Step 5: Poll for Transfer Results (Optional Enhancement)

After accepting invitation, poll activities endpoint to get actual transfer results:

```typescript
const pollForTransferResults = async (teamId: string) => {
  const maxAttempts = 10;
  const pollInterval = 1000; // 1 second

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const token = await getToken();
      if (!token) break;

      // Fetch latest team activities
      const activities = await teamService.getTeamActivities(teamId, userId, token, 5, 0);

      // Find team_join activity
      const joinActivity = activities.activities.find(a =>
        a.action_type === 'team_join' &&
        a.user_id === userId
      );

      if (joinActivity && joinActivity.metadata) {
        // Show detailed success notification
        const { creditsTransferred, storiesTransferred, subscriptionCancelled } = joinActivity.metadata;

        toast({
          title: t('teams:transferComplete.title', 'Transfer Complete'),
          description: t('teams:transferComplete.description', {
            stories: storiesTransferred,
            credits: creditsTransferred,
            subscription: subscriptionCancelled ? 'Your subscription has been canceled.' : ''
          }),
          duration: 8000
        });

        break;
      }
    } catch (err) {
      console.error('Error polling for transfer results:', err);
    }
  }
};

// Call after accepting invitation
setTimeout(() => pollForTransferResults(result.team.id), 2000);
```

---

## 🎯 Success Criteria

- [x] Backend preview endpoint created
- [x] Route added to `routes.oas.json`
- [x] Frontend TeamService method added
- [x] TeamInvitationAcceptancePage shows exact story/credit counts
- [x] Translations added for all new messages (English + Spanish)
- [ ] Optional: Poll for transfer results after acceptance (not implemented)

---

## 📝 Testing Checklist

1. **Preview API**:
   - [ ] Returns correct story count (excludes community remixes)
   - [ ] Returns correct credit balance
   - [ ] Returns correct subscription status
   - [ ] Validates user authentication

2. **Frontend Warning**:
   - [ ] Shows exact story count before accepting
   - [ ] Shows exact credit balance before accepting
   - [ ] Shows subscription cancellation warning if applicable
   - [ ] Handles loading states gracefully
   - [ ] Handles API errors without blocking acceptance

3. **Transfer Confirmation**:
   - [ ] User sees what will be transferred before accepting
   - [ ] User can still accept if preview fails to load
   - [ ] Success notification shows after transfer completes

---

**Created**: 2025-10-24 by Claude Code
**Status**: Implementation guide - ready for frontend team
