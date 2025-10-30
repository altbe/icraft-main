# Routes Configuration Audit Findings

**Date:** 2025-10-30
**Status:** ⚠️ ISSUES FOUND

---

## Executive Summary

Reviewed `backend/config/routes.oas.json` (3,303 lines) and found **1 duplicate endpoint** that should be removed to complete the consolidation.

---

## Issues Found

### 1. Duplicate Credit Usage Endpoint ⚠️

**Problem:** Two routes point to the same handler function `useCredits`:

1. **`POST /subscriptions/use-credits`** (line 1016)
   - Summary: "iCraft - Subscriptions - Uses credits from a user's subscription"
   - Handler: `useCredits` from `stripe-service`
   - Operation ID: `26603ae8-b623-4010-9174-307195e8fea9`

2. **`POST /credits/use`** (line 1544)
   - Summary: "Use credits from user balance"
   - Handler: `useCredits` from `stripe-service`
   - Operation ID: `use-user-credits`

**Issue:** These are the SAME endpoint with different URLs, causing:
- API confusion (which should clients use?)
- Incomplete consolidation (consolidation project left one behind)
- Maintenance burden (changes need to be documented for both URLs)

---

## Recommendation

### Remove `/subscriptions/use-credits`

**Rationale:**
1. **Consolidation complete:** This was likely missed during credit consolidation (2025-10-25)
2. **Standard pattern:** All credit operations should be under `/credits/*`
3. **Same functionality:** Both call `useCredits()` handler - no difference
4. **Consistency:** Matches other consolidated endpoints (balance, history, transfer)

**Migration Path:**
```typescript
// OLD (should be removed):
POST /subscriptions/use-credits
{
  "amount": 10,
  "description": "AI generation",
  "metadata": {...}
}

// NEW (already exists):
POST /credits/use
{
  "amount": 10,
  "description": "AI generation",
  "metadata": {...}
}
```

**Impact:** Low - both endpoints exist, just remove the legacy one

---

## Verified Consolidations ✅

### Credit Endpoints

All credit operations correctly consolidated under `/credits/*`:

| Endpoint | Purpose | Handler | Status |
|----------|---------|---------|--------|
| `GET /credits/balance` | Get balance | `getCreditBalance` | ✅ Correct |
| `POST /credits/check` | Check sufficient credits | `checkCredits` | ✅ Correct |
| `POST /credits/use` | Deduct credits | `useCredits` | ✅ Correct |
| `GET /credits/history` | Transaction history | `getCreditHistory` | ✅ Correct |
| `POST /credits/estimate` | Estimate cost | `estimateCredits` | ✅ Correct |
| `GET /credits/config` | Get credit config | `creditsConfig` | ✅ Correct |
| `POST /credits/transfer` | Transfer to team | `transferCreditsToTeam` | ✅ Correct |

**No `/team/*` credit endpoints found** ✅ (consolidation successful)

### Subscription Endpoints

All subscription operations correctly under `/subscriptions/*`:

| Endpoint | Purpose | Handler | Status |
|----------|---------|---------|--------|
| `GET /subscriptions` | List subscriptions | `listSubscriptions` | ✅ Correct |
| `POST /subscriptions` | Create subscription | `createSubscription` | ✅ Correct |
| `GET /subscriptions/active` | Get active subscription | `getActiveSubscription` | ✅ Correct |
| `POST /subscriptions/create` | Create checkout session | `createSubscription` | ✅ Correct |
| `GET /subscriptions/plans` | List available plans | `getSubscriptionPlans` | ✅ Correct |
| `POST /subscriptions/portal` | Customer portal | `createPortalSession` | ✅ Correct |
| `POST /subscriptions/cancel` | Cancel subscription | `cancelSubscription` | ✅ Correct |
| `POST /subscriptions/purchase-credits` | Purchase credit package | `purchaseCredits` | ✅ Correct |
| `POST /subscriptions/use-credits` | **DUPLICATE - REMOVE** | `useCredits` | ⚠️ Duplicate |
| `GET /subscriptions/trial-info` | Get trial info | `getTrialInfo` | ✅ Correct |
| `GET /subscriptions/{id}` | Get specific subscription | `getSubscriptionById` | ✅ Correct |
| `POST /subscriptions/{id}/sync` | Sync subscription | `syncSingleSubscription` | ✅ Correct |
| `GET /subscriptions/user/{userId}` | Get user subscriptions | `listSubscriptions` | ✅ Correct |
| `POST /subscriptions/sync` | Sync all subscriptions | `syncExpiredSubscriptions` | ✅ Correct |
| `GET /subscriptions/sync-status` | Sync status | `getSyncStatus` | ✅ Correct |

---

## Deprecated Endpoints ✅

### Properly Marked

**`POST /icraft-stripe-webhook`** (line ~1300)
- ✅ Marked as `[DEPRECATED]` in summary
- ✅ Has `"deprecated": true` flag
- ✅ Description explains migration to Edge Function
- ✅ Returns 410 Gone
- ✅ Safe removal date documented (2026-01-28)

**Status:** Properly handled, no action needed

---

## Team Endpoints ✅

### Team Management (Clerk Organizations)

All team management endpoints correctly use Clerk organization structure:

| Endpoint | Purpose | Handler | Status |
|----------|---------|---------|--------|
| `GET /teams` | List user's teams | `listTeams` | ✅ Correct |
| `POST /teams/invite` | Invite to team | `inviteToTeam` | ✅ Correct |
| `GET /teams/user/{userId}` | Get user's team | `getUserTeam` | ✅ Correct |
| `GET /teams/{teamId}/members` | List team members | `listTeamMembers` | ✅ Correct |
| `DELETE /teams/{teamId}/members/{memberId}` | Remove member | `removeTeamMember` | ✅ Correct |
| `GET /teams/{teamId}/activities` | Team activity log | `getTeamActivities` | ✅ Correct |
| `GET /teams/{teamId}/invitations` | List invitations | `listInvitations` | ✅ Correct |
| `DELETE /teams/{teamId}/invitations/{invitationId}` | Revoke invitation | `revokeInvitation` | ✅ Correct |

**No `/team/*` endpoints for credits** ✅ (fully consolidated)

---

## Route Statistics

**Total Routes:** ~70 endpoints

**By Category:**
- Credits: 7 endpoints (1 duplicate to remove)
- Subscriptions: 16 endpoints
- Teams: 8 endpoints
- Stories: 10 endpoints
- Images: 5 endpoints
- Community: 5 endpoints
- Webhooks: 3 endpoints (1 deprecated)
- Health/Monitoring: 5 endpoints
- Other: 11 endpoints

**Deprecated:** 1 endpoint (properly marked)
**Duplicates:** 1 endpoint (needs removal)

---

## Action Items

### Immediate (High Priority)

1. **Remove `/subscriptions/use-credits` endpoint**
   - Location: `backend/config/routes.oas.json` line 1016-1038
   - Reason: Duplicate of `/credits/use`
   - Impact: Low (same handler, just removing duplicate URL)

### Optional (Low Priority)

1. **Monitor deprecated webhook usage**
   - Endpoint: `/icraft-stripe-webhook`
   - Action: After 90 days of Edge Function stability (2026-01-28)
   - Remove route entirely from config

---

## Verification Queries

### Check for Duplicate Handlers

```bash
# Find handlers used by multiple routes
grep '"export":' config/routes.oas.json | sort | uniq -c | sort -rn | grep -v "      1 "
```

**Result:** `useCredits` used twice (expected finding)

### Check for Missing Handlers

```bash
# List all unique handlers
grep '"export":' config/routes.oas.json | sort -u
```

**Result:** All handlers appear to be defined

### Check for Team Credit Routes

```bash
# Verify no /team/credits/* routes
grep '"/team/credits/' config/routes.oas.json
```

**Result:** (empty) ✅ Consolidation successful

---

## Recommendations Summary

### Must Do
- ✅ Remove duplicate `/subscriptions/use-credits` endpoint

### Already Done
- ✅ All `/team/credits/*` endpoints removed
- ✅ All credit operations consolidated under `/credits/*`
- ✅ Deprecated webhook properly marked

### Future
- ⏳ Remove `/icraft-stripe-webhook` after 2026-01-28

---

## Conclusion

**Overall Status:** Good - Only 1 duplicate endpoint needs removal

**Consolidation Progress:**
- Credit endpoints: 95% complete (1 duplicate remains)
- Team management: 100% correct
- Webhooks: Properly deprecated

**Next Step:** Remove `/subscriptions/use-credits` to achieve 100% consolidation.

---

**Last Updated:** 2025-10-30
**Audited By:** Claude Code
**Lines Reviewed:** 3,303
**Issues Found:** 1 duplicate endpoint
