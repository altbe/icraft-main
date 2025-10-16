# Credit Purchase Implementation Review

## Date: 2025-10-16

## Executive Summary

Reviewed the end-to-end implementation of credit purchase functionality across frontend, backend, Stripe integration, and database layers. Found a critical discrepancy between the current implementation and actual Stripe product configuration that prevents credit packages from being purchased correctly.

## Architecture Overview

### Flow Diagram

```
User (Frontend)
  → Click "Purchase Credits"
  → subscriptionService.purchaseCredits()
  → POST /subscriptions/purchase-credits
    → Backend: stripe-service.ts::purchaseCredits()
    → StripeService.createCreditPurchaseSession()
    → Stripe Checkout Session created
  → Redirect to Stripe Checkout
  → User completes payment
  → Stripe Webhook: checkout.session.completed
    → webhook-manager.ts::processCheckoutCompleted()
    → Database: process_credit_purchase_webhook()
    → Credits allocated to user account
  → Redirect back to success URL
```

## Component Review

### 1. Frontend Implementation ✅

**File:** `frontend/src/components/subscription/CreditPurchase.tsx`

**Functionality:**
- Displays credit package options (500, 1000, 2000, 5000, custom)
- Calculates pricing at $0.01 per credit (hardcoded)
- Calls `subscriptionService.purchaseCredits(userId, amount, token, successUrl, cancelUrl)`
- Redirects to Stripe Checkout URL returned from backend

**Strengths:**
- Clean UI with RadioGroup for package selection
- Custom amount input supported
- Proper error handling with toast notifications
- Loading state management with `isProcessing`

**Issues:**
- **CRITICAL**: Hardcoded credit packages don't match Stripe products
- **CRITICAL**: Pricing calculation ($0.01/credit) doesn't match Stripe pricing ($0.10-$0.14/credit)
- Missing integration with actual Stripe credit package products
- No display of volume discounts or savings percentages

**Current Hardcoded Packages:**
```typescript
{ id: 'small', credits: 500, price: 4.99 },   // $0.0098/credit
{ id: 'medium', credits: 1000, price: 9.99 }, // $0.0099/credit
{ id: 'large', credits: 2000, price: 18.99 }, // $0.0095/credit
{ id: 'xlarge', credits: 5000, price: 39.99 }, // $0.0080/credit
```

**Actual Stripe Products:**
```typescript
prod_SmQazgSsu6blaG: 25 credits at $3.50 ($0.14/credit) - 16% savings
prod_SmQai616DcpZjP: 75 credits at $9.00 ($0.12/credit) - 28% savings
prod_SmQam9GbEZUIve: 150 credits at $15.00 ($0.10/credit) - 40% savings
```

---

### 2. Backend API Endpoint ⚠️

**File:** `backend/modules/stripe-service.ts`

**Endpoint:** `POST /subscriptions/purchase-credits`

**Handler:** `export async function purchaseCredits()`

**Functionality:**
- Validates user authentication via `requireUserWithProfile()`
- Validates request body: `{ amount, success_url, cancel_url }`
- Checks for active subscription (required to purchase credits)
- Gets or creates Stripe customer
- Creates Stripe Checkout session via `createCreditPurchaseSession()`

**createCreditPurchaseSession() Issues:**

**CRITICAL ISSUE #1: Hardcoded Price ID**
```typescript
priceId: 'price_1NTCEwLb9KjCLYxs8JrWU2JV', // Hardcoded - likely invalid
```
- This price ID doesn't match any actual Stripe credit package prices
- No dynamic lookup of credit package prices from Stripe
- No mapping of credit amounts to appropriate Stripe products

**CRITICAL ISSUE #2: Incorrect Pricing Calculation**
```typescript
const unitPrice = 1; // $1 per credit, adjust as needed
const price = amount * unitPrice;
```
- Assumes $1 per credit (100x more expensive than frontend expects!)
- Doesn't use actual Stripe pricing tiers
- Ignores volume discounts

**CRITICAL ISSUE #3: Quantity Usage**
```typescript
quantity: amount  // Passes credit amount as quantity
```
- If `amount = 1000` credits, Stripe interprets this as 1000 quantity of the product
- With a price of (e.g.) $3.50, this would charge $3,500 instead of ~$10
- Fundamentally misunderstands Stripe pricing model

**Required Fix:**
```typescript
async createCreditPurchaseSession(
  userId: string,
  customerId: string,
  desiredCreditAmount: number,
  successUrl: string,
  cancelUrl: string,
  teamId?: string
): Promise<{ checkoutUrl: string, sessionId: string, amount: number, price: number }> {
  // 1. Query Stripe for active credit package products
  const creditProducts = await this.stripe.products.list({
    active: true,
    limit: 100
  });

  // 2. Filter for credit packages
  const packages = creditProducts.data.filter(
    p => p.metadata?.product_type === 'credit_package'
  );

  // 3. Find best matching package for desired amount
  const selectedPackage = this.selectBestCreditPackage(packages, desiredCreditAmount);

  if (!selectedPackage) {
    throw new StripeServiceError("No suitable credit package found", HttpStatusCode.BAD_REQUEST);
  }

  // 4. Get the price for the selected package
  const prices = await this.stripe.prices.list({
    product: selectedPackage.id,
    active: true,
    type: 'one_time'
  });

  const price = prices.data[0];
  if (!price) {
    throw new StripeServiceError("No active price found for credit package", HttpStatusCode.INTERNAL_SERVER_ERROR);
  }

  // 5. Create checkout session with correct price ID and quantity 1
  const metadata = {
    user_id: userId,
    credit_amount: selectedPackage.metadata.credit_amount,
    credit_purchase: 'true',
    team_id: teamId || '',
    product_id: selectedPackage.id
  };

  const session = await this.createCheckoutSession(
    customerId,
    userId,
    {
      priceId: price.id,           // ✅ Actual price ID from Stripe
      mode: 'payment',              // ✅ One-time payment
      successUrl: successUrl,
      cancelUrl: cancelUrl,
      metadata: metadata,
      quantity: 1                   // ✅ Always 1 for credit packages
    }
  );

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    amount: parseInt(selectedPackage.metadata.credit_amount),
    price: price.unit_amount / 100  // Convert cents to dollars
  };
}
```

---

### 3. Stripe Webhook Processing ✅

**File:** `backend/modules/webhook-manager.ts`

**Event:** `checkout.session.completed`

**Handler:** `processCheckoutCompleted()`

**Functionality:**
- Receives Stripe webhook event
- Calls database function: `process_credit_purchase_webhook()`
- Passes event data, idempotency key, webhook event ID

**Strengths:**
- Delegates credit allocation to database for transactional integrity
- Proper idempotency key handling
- Structured error handling

**Dependencies:**
- Requires `process_credit_purchase_webhook()` database function
- Must parse metadata to determine credit amount and user

---

### 4. Database Credit Allocation ✅

**Function:** `public.process_credit_purchase_webhook()`

**Verified Existence:** ✅ Function exists in non-prod database

**Related Functions Found:**
- `add_reward_credits()` - Add bonus credits
- `add_team_credits()` - Add credits to team pool
- `allocate_monthly_credits()` - Monthly subscription credit allocation
- `allocate_team_credits()` - Team credit allocation
- `allocate_trial_credits()` - Trial credit allocation
- `get_user_credit_balance()` - Fetch user credit balance
- `get_user_credit_history()` - Fetch transaction history
- `transfer_credits_to_team()` - Transfer user credits to team
- `use_credits()` - Deduct credits for operations
- `validate_credit_balance_consistency()` - Audit trail validation

**Expected Behavior:**
1. Extract `metadata.user_id` and `metadata.credit_amount` from Stripe event
2. Verify checkout session was successful
3. Check idempotency (prevent duplicate credit allocation)
4. Create credit transaction record
5. Update user's credit balance
6. Log webhook event for audit

---

### 5. Frontend Credit Display Components ✅

**File:** `frontend/src/components/subscription/CreditPackageCard.tsx`

**Functionality:**
- Displays credit package information
- Shows badges for "Popular" and "Best Value"
- Calculates price per credit
- Handles package selection

**Data Source:**
- Expects `CreditPackage` type from `@/types`
- Currently NOT fetching from Stripe API
- Should call `subscriptionService.getPlansWithCreditPackages()`

**Missing Integration:**
- No API call to fetch actual Stripe credit packages
- Hardcoded packages in `CreditPurchase.tsx` instead of dynamic data

---

## Critical Issues Summary

### 🚨 HIGH Priority

1. **Hardcoded Price ID in Backend**
   - **Impact:** Credit purchases will fail or charge incorrect amounts
   - **Location:** `stripe-service.ts:createCreditPurchaseSession()`
   - **Fix:** Implement dynamic price lookup from Stripe API

2. **Pricing Mismatch Between Frontend and Stripe**
   - **Impact:** Users see incorrect prices, expectations mismatch reality
   - **Frontend:** $0.01/credit ($9.99 for 1000 credits)
   - **Stripe:** $0.10-$0.14/credit ($15.00 for 150 credits)
   - **Fix:** Fetch credit packages from Stripe API in frontend

3. **Incorrect Quantity Parameter**
   - **Impact:** Could charge 1000x the intended amount (e.g., $3,500 instead of $3.50)
   - **Location:** `stripe-service.ts:createCreditPurchaseSession()`
   - **Fix:** Always use `quantity: 1` for credit packages, price already includes credit amount

### ⚠️ MEDIUM Priority

4. **No Volume Discount Display**
   - **Impact:** Users don't see savings, reducing conversion
   - **Stripe Metadata:** `savings_vs_individual`, `savings_vs_team`
   - **Fix:** Display savings percentages in UI

5. **Missing Active Subscription Check in Frontend**
   - **Impact:** Users without subscriptions can attempt to purchase (will fail on backend)
   - **Fix:** Add `hasActiveSubscription` check before showing purchase UI

6. **No Credit Package Sync from Stripe**
   - **Impact:** Changes to Stripe products require frontend code changes
   - **Fix:** Implement `getPlansWithCreditPackages()` API call

### 💡 LOW Priority

7. **Custom Amount Pricing Calculation**
   - **Impact:** Users entering custom amounts see incorrect pricing
   - **Current:** `$0.01 * amount`
   - **Should:** Find nearest Stripe package or show "Contact us"
   - **Fix:** Disable custom amounts or implement dynamic pricing API

8. **Missing Translation Keys**
   - Several hardcoded strings in `CreditPurchase.tsx`
   - Example: "credits", "per credit"
   - **Fix:** Add to `subscription.json` translation file

---

## Recommendations

### Immediate Actions (This Sprint)

1. **Fix Backend Price ID Lookup**
   - Implement `selectBestCreditPackage()` method
   - Query Stripe API for credit packages dynamically
   - Use correct price ID and quantity in checkout session

2. **Sync Frontend with Stripe**
   - Remove hardcoded credit packages from `CreditPurchase.tsx`
   - Fetch packages from API: `subscriptionService.getPlansWithCreditPackages()`
   - Display actual Stripe pricing

3. **Add Integration Tests**
   - Test credit purchase flow end-to-end
   - Verify webhook processing
   - Validate credit allocation in database

### Short-term Improvements (Next Sprint)

4. **Enhance UI with Savings Display**
   - Show "Save 28%" badges
   - Display comparison to Individual/Team plan credit costs
   - Highlight "Best Value" package

5. **Add Subscription Check**
   - Disable purchase button for non-subscribers
   - Show upgrade prompt instead

6. **Implement Credit Package API Endpoint**
   ```typescript
   GET /credit-packages
   Response: {
     creditPackages: [
       {
         id: 'prod_SmQazgSsu6blaG',
         name: 'Credit Package (25)',
         creditAmount: 25,
         price: 3.50,
         pricePerCredit: 0.14,
         savingsVsIndividual: 16,
         savingsVsTeam: 7,
         isPopular: false
       },
       ...
     ]
   }
   ```

### Long-term Enhancements

7. **Dynamic Pricing for Custom Amounts**
   - Allow users to request custom credit amounts
   - Backend calculates pricing based on volume tiers
   - Generate custom Stripe checkout session

8. **Credit Usage Analytics**
   - Track which packages are most popular
   - A/B test pricing strategies
   - Optimize package sizes based on usage patterns

9. **Gift Credits Feature**
   - Allow users to purchase credits for others
   - Team admins can allocate credits to members
   - Credit vouchers/codes

---

## Testing Checklist

### Unit Tests
- [ ] `StripeService.selectBestCreditPackage()` - returns correct package
- [ ] `StripeService.createCreditPurchaseSession()` - creates valid session
- [ ] Frontend credit package selection logic
- [ ] Price calculation accuracy

### Integration Tests
- [ ] Full credit purchase flow (sandbox)
- [ ] Webhook processing with test events
- [ ] Database credit allocation
- [ ] Idempotency verification

### E2E Tests
- [ ] User can view credit packages
- [ ] User can select and purchase credits
- [ ] Redirect to Stripe works
- [ ] Return from Stripe processes correctly
- [ ] Credits appear in user balance

### Edge Cases
- [ ] Purchase with no active subscription → error
- [ ] Duplicate webhook events → idempotent
- [ ] Invalid credit amount → validation error
- [ ] Cancelled checkout → no credit allocation
- [ ] Failed payment → proper error handling

---

## Migration Plan

### Phase 1: Backend Fix (Critical)
1. Implement dynamic Stripe product/price lookup
2. Fix quantity parameter usage
3. Add validation for credit amounts
4. Deploy to development environment
5. Test with Stripe test mode

### Phase 2: Frontend Integration
1. Remove hardcoded credit packages
2. Add API call to fetch packages from backend
3. Update pricing display
4. Add savings badges
5. Deploy to QA environment
6. UAT testing

### Phase 3: Production Deployment
1. Verify Stripe products configured correctly in live mode
2. Deploy backend changes
3. Deploy frontend changes
4. Monitor webhook processing
5. Verify credit allocations

### Rollback Plan
- If issues detected, revert to previous version
- Stripe webhook events are retained, can replay if needed
- Database transactions allow audit of all credit allocations
- No risk of lost payments (Stripe is source of truth)

---

## Monitoring and Observability

### Key Metrics
- Credit purchase success rate
- Average credit package size purchased
- Conversion rate by package
- Webhook processing latency
- Credit allocation errors

### Alerts
- Failed webhook processing
- Credit allocation mismatches
- Stripe API errors
- Checkout session failures

### Logs to Monitor
- `StripeService: Creating credit purchase session`
- `WebhookManager: Processing checkout.session.completed`
- `process_credit_purchase_webhook: Credits allocated`
- Backend errors in `/subscriptions/purchase-credits`

---

## Security Considerations

### Current Implementation ✅
- User authentication required (`requireUserWithProfile`)
- Active subscription validation
- Webhook signature verification (standard Zuplo)
- Idempotency keys prevent duplicate charges

### Recommendations
- Rate limiting on credit purchase endpoint
- Maximum credit amount validation
- Fraud detection for unusual patterns
- Team credit transfer limits

---

## Documentation Updates Needed

1. **API Documentation**
   - Document `/subscriptions/purchase-credits` endpoint
   - Add request/response examples
   - Document error codes

2. **User Guide**
   - How to purchase credits
   - Available credit packages
   - Volume discount tiers

3. **Developer Guide**
   - Credit purchase flow diagram
   - Webhook event handling
   - Database function documentation

---

## Conclusion

The credit purchase functionality has a **solid architectural foundation** with proper separation of concerns:
- Frontend handles UI/UX
- Backend orchestrates Stripe API
- Database ensures transactional integrity
- Webhooks handle asynchronous payment confirmation

However, **critical implementation gaps** prevent it from functioning correctly:
1. Hardcoded price ID doesn't match Stripe configuration
2. Frontend pricing doesn't match Stripe products
3. Incorrect use of quantity parameter

**Estimated Effort to Fix:**
- Backend fixes: 4-6 hours
- Frontend integration: 2-3 hours
- Testing: 3-4 hours
- **Total: 1-2 days**

**Risk Level:** HIGH - Users attempting to purchase credits will encounter errors or be charged incorrect amounts.

**Priority:** CRITICAL - Must be fixed before enabling credit purchase feature in production.
