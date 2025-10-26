# Credit Purchase Bug Investigation & Fix
## Date: 2025-10-16

## Executive Summary

**Status**: ✅ **FIXED**

**Root Cause**: Frontend code had incomplete implementation of credit purchase handler. The function showed a toast message but never called the API or redirected to Stripe checkout.

**Fix Applied**: Implemented complete credit purchase flow in `SubscriptionActionHandlers.tsx`

**Deployment Status**:
- ✅ Backend: No changes needed (API already works correctly)
- ✅ Frontend: Fixed and committed to `main` branch (commit `2c191ec`)
- ⏳ Frontend: Needs tag-based deployment to dev/qa/prod environments

---

## Investigation Timeline

### Issue Reported
User tried to purchase credits in `dev.icraftstories.com` as `g@altgene.net`, but credits were not added after payment attempt.

### Phase 1: Backend Investigation
**Hypothesis**: Backend API has bugs in credit purchase flow

**Findings**:
1. ✅ Stripe wrapper exists in both prod and non-prod databases
2. ✅ Stripe wrapper works correctly (verified with SQL queries)
3. ✅ Credit package products exist in Stripe test mode:
   - `prod_SmQazgSsu6blaG` - 25 credits ($3.50)
   - `prod_SmQai616DcpZjP` - 75 credits ($9.00)
   - `prod_SmQam9GbEZUIve` - 150 credits ($15.00)
4. ✅ API endpoint `/subscriptions/purchase-credits` exists and compiles
5. ✅ Backend code (both methods) are correct:
   - `getCreditPackageDetails()` - Uses Stripe SDK (more reliable)
   - `createCreditPurchaseSession()` - Uses Supabase wrapper (works fine)

**Conclusion**: Backend is NOT the problem

### Phase 2: Stripe Investigation via MCP
**Checked**: Payment intents for customer `cus_SmpAcX3UCW0xBT`

**Findings**:
1. Found 3 successful payments - ALL are subscription renewals ($4.99)
2. ALL payment intents have EMPTY metadata `{}`
3. NO payment intents with `credit_purchase: "true"` metadata
4. NO checkout sessions found
5. NO webhook events for `checkout.session.completed`

**Conclusion**: Stripe checkout was NEVER created

### Phase 3: Frontend Investigation
**Checked**: How credit purchases are triggered in the UI

**Component Flow**:
1. `SubscriptionManagement.tsx` → Shows credit packages with "Select" buttons
2. On click → Calls `subscriptionActions.handleCreditPackageSelect(packageId)`
3. Handler defined in `SubscriptionActionHandlers.tsx`

**Bug Found** (lines 194-229):
```typescript
const handleCreditPackageSelect = async (packageId: string) => {
  setIsProcessing(true);
  try {
    const token = await getToken();
    const { successUrl, cancelUrl } = getUrlParams('credits');

    // Shows toast
    toast({
      title: t('credits.purchaseTitle'),
      description: t('credits.processing'),
    });

    // Logs package ID
    logger.info('Credit package selected:', packageId);

    // ❌ MISSING: No API call to create checkout session!
    // ❌ MISSING: No redirect to Stripe checkout!

  } catch (error) {
    // error handling...
  } finally {
    setIsProcessing(false);  // Immediately clears "processing" state
  }
};
```

**Impact**:
- User clicks "Purchase Credits" button
- Toast shows "Processing..."
- `isProcessing` briefly sets to true, then false
- Button becomes clickable again
- NO checkout session created
- NO redirect to Stripe
- User thinks nothing happened

---

## Fix Applied

**File**: `frontend/src/components/subscription/SubscriptionActionHandlers.tsx`

**Changes**:
```typescript
const handleCreditPackageSelect = async (packageId: string) => {
  setIsProcessing(true);
  try {
    const token = await getToken();
    const { successUrl, cancelUrl } = getUrlParams('credits');

    // Validate package ID
    const validPackageIds = ['small', 'medium', 'large'];
    if (!validPackageIds.includes(packageId)) {
      throw new Error(`Invalid package ID: ${packageId}`);
    }

    logger.info('Credit package selected:', packageId);

    // ✅ Call API to create Stripe checkout session
    const result = await subscriptionService.purchaseCredits(
      user.id,
      packageId as 'small' | 'medium' | 'large',
      token,
      successUrl,
      cancelUrl
    );

    // ✅ Redirect to Stripe checkout
    if (result && result.checkoutUrl) {
      logger.info('Redirecting to Stripe checkout:', result.sessionId);
      window.location.href = result.checkoutUrl;
    } else {
      throw new Error('No checkout URL returned from credit purchase');
    }

  } catch (error) {
    logger.error('Error purchasing credits:', error);
    toast({
      title: t('error.purchaseFailed'),
      description: error instanceof Error ? error.message : t('error.purchaseFailed'),
      variant: 'destructive',
    });
    setIsProcessing(false);
  }
};
```

**Key Improvements**:
1. ✅ Calls `subscriptionService.purchaseCredits()` API
2. ✅ Redirects to Stripe checkout URL
3. ✅ Validates package ID before API call
4. ✅ Logs session ID for debugging
5. ✅ Better error handling with user feedback

---

## Deployment Instructions

### Frontend Deployment (Required)
The fix has been committed to `main` branch but needs tag-based deployment:

```bash
cd frontend

# Create deployment tag for dev environment
npm run tag:create
# Select: dev
# Version will be: dev-YYYY-MM-DD-N

# Check deployment status
npm run tag:status
```

**GitHub Actions will automatically**:
1. Build frontend with fix
2. Deploy to Cloudflare Workers (dev environment)
3. Update https://icraft-frontend-dev.altgene.workers.dev

### Backend Deployment (Not Required)
Backend is already correct and deployed. No changes needed.

---

## Testing Instructions

### 1. Wait for Frontend Deployment
```bash
cd frontend
npm run tag:status
# Wait until status shows "deployed" for dev environment
```

### 2. Test Credit Purchase Flow

**Steps**:
1. Go to https://dev.icraftstories.com
2. Sign in as `g@altgene.net` (or any user with active subscription)
3. Navigate to "Subscription Management" or "Profile"
4. Scroll to "Credit Packages" section
5. Click "Select" on any credit package (e.g., 25 credits)
6. **Expected**: Redirect to Stripe checkout page
7. Complete test payment with card `4242 4242 4242 4242`
8. **Expected**: Redirect back to success URL
9. **Expected**: Credits added to account

### 3. Verify in Database

```sql
-- Check credit purchases
SELECT * FROM credit_purchases
WHERE user_id = 'user_...'
ORDER BY created_at DESC
LIMIT 5;

-- Check credit transactions
SELECT * FROM credit_transactions
WHERE user_id = 'user_...'
ORDER BY created_at DESC
LIMIT 5;

-- Check webhook events
SELECT event_type, status, created_at
FROM webhook_events
WHERE event_type = 'checkout.session.completed'
ORDER BY created_at DESC
LIMIT 5;
```

### 4. Verify in Stripe Dashboard

1. Go to Stripe Dashboard → Test Mode
2. Navigate to "Payments" → "Payment Intents"
3. Look for payment with metadata:
   ```json
   {
     "credit_purchase": "true",
     "credit_amount": "25",
     "user_id": "user_...",
     "package_id": "small"
   }
   ```

---

## Architecture Notes

### Why the Bug Existed

**Likely Scenario**: The code was refactored from direct component implementation to shared action handlers, and the implementation was left incomplete (stub).

**Evidence**:
1. `CreditPurchase.tsx` exists with COMPLETE implementation but is never imported/used
2. `SubscriptionActionHandlers.tsx` has INCOMPLETE implementation
3. No compilation errors (stub was syntactically valid)
4. No runtime errors (toast + log worked fine)

### Prevention

**Recommendations**:
1. Remove unused `CreditPurchase.tsx` to avoid confusion
2. Add integration tests for purchase flows
3. Add monitoring/alerts for abandoned purchase attempts
4. Consider feature flags for incomplete features

---

## Related Files

### Frontend
- ✅ **Fixed**: `src/components/subscription/SubscriptionActionHandlers.tsx` (commit `2c191ec`)
- ⚠️ **Unused**: `src/components/subscription/CreditPurchase.tsx` (can be deleted)
- ✅ **Correct**: `src/services/SubscriptionService.ts` (has `purchaseCredits` method)
- ✅ **Correct**: `src/components/SubscriptionManagement.tsx` (shows credit packages)

### Backend
- ✅ **Correct**: `modules/stripe-service.ts` (commit `8e00c0e`)
  - `getCreditPackageDetails()` - Uses Stripe SDK
  - `createCreditPurchaseSession()` - Uses Supabase wrapper
  - `purchaseCredits()` - API endpoint handler
- ✅ **Correct**: `modules/webhook-manager.ts` (handles `checkout.session.completed`)
- ✅ **Correct**: `config/routes.oas.json` (endpoint configured)

---

## Commits

### Frontend
- `2c191ec` - Fix: Implement credit purchase API call in handleCreditPackageSelect
- `caff5f6` - Update PricingPlans to call secure endpoints directly

### Backend
- `8e00c0e` - Fix: Use Stripe SDK directly instead of Supabase wrapper
- `dd8b65d` - Update frontend security audit: PricingPlans loading issue fixed

---

## Summary

**What Happened**:
- User tried to purchase credits
- Frontend showed "Processing..." toast
- NO API call was made
- NO checkout session created
- NO payment processed
- User confused about what happened

**What Was Fixed**:
- Frontend now calls `subscriptionService.purchaseCredits()` API
- Frontend redirects to Stripe checkout
- Backend code was already correct (no changes needed)

**Next Steps**:
1. Deploy frontend fix to dev environment
2. Test end-to-end credit purchase flow
3. Deploy to QA and production when confirmed working
4. Consider cleanup: Remove unused `CreditPurchase.tsx`
