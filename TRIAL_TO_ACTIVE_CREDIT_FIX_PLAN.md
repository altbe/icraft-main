# Trial-to-Active Credit Allocation Fix - Comprehensive Plan

**Created**: 2025-11-07
**Status**: ✅ **COMPLETED** - Deployed 2025-11-07
**See**: `TRIAL_TO_ACTIVE_CREDIT_FIX_IMPLEMENTATION_COMPLETE.md` for full deployment details

**Issue**: Users transitioning from trial to paid subscriptions are not receiving their monthly credits
**Root Cause**: Two bugs - (1) Missing clerk_user_id metadata in Stripe, (2) Edge Function doesn't allocate credits on subscription.updated

---

## ✅ Implementation Complete (2025-11-07)

**Deployed Components**:
- ✅ Migration 020: `process_subscription_webhook_update()` function (both environments)
- ✅ Edge Function Update: `stripe-webhook` v10 with status transition detection (both environments)
- ✅ Migration 021: Removed legacy `verify_and_create_subscription` overload (both environments)
- ✅ User 1 Remediation: 30 credits allocated to desiree@p2musa.com

**Results**:
- Zero stuck trials in production
- Automated credit allocation working
- Full audit trail in credit_transactions
- Zero overloaded functions (clean codebase)

**See**: `TRIAL_TO_ACTIVE_CREDIT_FIX_IMPLEMENTATION_COMPLETE.md` for:
- Deployment summary
- Verification results
- Monitoring queries
- Testing procedures

---

## Original Plan (Below)

## Executive Summary

**Problem**: When a trial subscription converts to active (paid), the system fails to allocate monthly subscription credits to the user.

**Impact**: 2 users affected as of 2025-11-07
- **User 1**: desiree@p2musa.com - missing 30 credits (individual plan)
- **User 2**: Unknown (sub_1SPDwqAdM2PoHEKvLMRoEA7k) - test subscription, no user record in database

**Root Causes**:
1. Stripe subscriptions missing required `clerk_user_id` metadata (webhook validation fails)
2. Edge Function `handleSubscriptionUpdated()` doesn't allocate credits for status transitions
3. Edge Function doesn't call existing database state machine that handles transitions

**Solution**: Leverage existing database function `process_subscription_state_change()` which already:
- ✅ Handles trial-to-active transitions with credit allocation
- ✅ **Automatically looks up credits from subscription_plans table** (no hardcoding)
- ✅ Creates credit_transactions records automatically
- ✅ Provides full transactional guarantees

---

## Current System Architecture

### Webhook Flow (Current - BROKEN)
```
Stripe → Edge Function (stripe-webhook/index.ts)
  ↓
  1. log_stripe_event() - Idempotency check ✅
  2. validateSubscriptionMetadata() - Check clerk_user_id ✅
  3. handleSubscriptionUpdated() - Update cache only ❌ NO CREDITS
  4. mark_stripe_event_processed() ✅
```

### Database Functions (Existing - WORKING)
```sql
-- Already implements trial-to-active credit allocation ✅
-- Already does automated credit lookup from subscription_plans ✅
-- Already creates credit_transactions records ✅
process_subscription_state_change(
  p_subscription_id uuid,
  p_new_status text,
  p_new_plan_id text,  -- Stripe product ID or plan_type
  ...
)

-- Credit lookup logic (lines 89-116):
-- 1. Try stripe_product_id lookup: prod_SR7syuRxrJPy2y → 30 credits
-- 2. Fallback to plan_type lookup: 'individual' → 30 credits
-- 3. Fallback to old subscription plan_id
-- 4. Final fallback to individual plan

-- Credit allocation (lines 139-153):
IF v_transition_type = 'trial_to_active' THEN
  SELECT allocate_credits(
    v_old_subscription.user_id,
    v_monthly_credits,  -- From database lookup, NOT hardcoded
    'subscription_renewal',
    'allocations.subscription_renewal',
    jsonb_build_object(...)
  ) INTO v_credit_result;
END IF;
```

### Credit Allocation Function (Existing)
```sql
-- Creates credit_transactions record automatically ✅
-- backend/sql/core-credit-procedures.sql:217-272
allocate_subscription_credits(p_user_id, p_amount, p_description)
  ↓
  INSERT INTO credit_transactions (
    user_id, team_id, amount, transaction_type,
    description, metadata, created_by
  ) VALUES (...);
  -- Returns: {success, transaction_id, credits_added, new_balance}
```

---

## Proposed Solution: Database-First Transactional Updates

### Strategy
**Wrap existing `process_subscription_state_change()` with webhook-friendly interface** - leverage battle-tested logic instead of reimplementing.

### Benefits
- ✅ **Automated credit lookup** from subscription_plans table
- ✅ **Automatic credit_transactions records** via allocate_credits()
- ✅ Transactional guarantees (ACID compliance)
- ✅ Comprehensive state machine (handles all transitions: trial-to-active, renewal, reactivation)
- ✅ Automatic audit trail (subscription_events table)
- ✅ Credit allocation with idempotency
- ✅ Rollback capability via database transactions

---

## Implementation Plan

### Phase 1: Create Database Helper Function (NEW)

**Purpose**: Bridge Edge Function and existing state machine with webhook-friendly interface

**File**: `backend/sql/migrations/020_trial_to_active_credit_fix.sql`

```sql
-- =====================================================
-- Migration 020: Trial-to-Active Credit Allocation Fix
-- Date: 2025-11-07
-- Purpose: Wrap process_subscription_state_change() for webhook processing
-- Ensures: Automated credit lookup from subscription_plans table
-- =====================================================

-- Helper function: Process subscription update from Stripe webhook
-- Wraps process_subscription_state_change() with webhook-friendly interface
-- CRITICAL: Uses database-driven credit lookup (subscription_plans table)
CREATE OR REPLACE FUNCTION public.process_subscription_webhook_update(
  p_stripe_subscription_id TEXT,
  p_clerk_user_id TEXT,
  p_new_status TEXT,
  p_stripe_product_id TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_previous_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
  v_old_status TEXT;
  v_result JSONB;
  v_credits_allocated INTEGER;
BEGIN
  -- Find internal subscription ID
  SELECT id, status
  INTO v_subscription_id, v_old_status
  FROM subscriptions
  WHERE external_subscription_id = p_stripe_subscription_id;

  IF v_subscription_id IS NULL THEN
    -- Subscription not in database yet - this shouldn't happen
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SUBSCRIPTION_NOT_FOUND',
      'message', format('Subscription %s not found in database', p_stripe_subscription_id),
      'stripe_subscription_id', p_stripe_subscription_id,
      'clerk_user_id', p_clerk_user_id
    );
  END IF;

  -- Use previous_status from webhook if provided, otherwise use DB status
  v_old_status := COALESCE(p_previous_status, v_old_status);

  -- Validate status transition
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged - no action needed',
      'old_status', v_old_status,
      'new_status', p_new_status,
      'subscription_id', v_subscription_id
    );
  END IF;

  -- Call existing state machine (handles trial-to-active + credit allocation)
  -- CRITICAL: This function does AUTOMATED credit lookup from subscription_plans
  -- based on p_new_plan_id (Stripe product ID)
  SELECT process_subscription_state_change(
    p_subscription_id := v_subscription_id,
    p_new_status := p_new_status,
    p_new_period_start := p_current_period_start,
    p_new_period_end := p_current_period_end,
    p_source := 'stripe_webhook',
    p_metadata := jsonb_build_object(
      'clerk_user_id', p_clerk_user_id,
      'stripe_product_id', p_stripe_product_id,
      'previous_status', v_old_status,
      'webhook_processed_at', NOW()
    ),
    p_new_plan_id := p_stripe_product_id  -- Used for credit lookup in subscription_plans
  ) INTO v_result;

  -- Extract credits allocated from result
  v_credits_allocated := COALESCE((v_result->>'credits_allocated')::INTEGER, 0);

  -- Log successful processing
  RAISE NOTICE 'Subscription webhook processed: % (% → %), credits: %',
    p_stripe_subscription_id, v_old_status, p_new_status, v_credits_allocated;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RAISE WARNING 'Subscription webhook processing failed: %, Error: %',
      p_stripe_subscription_id, SQLERRM;

    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'subscription_id', v_subscription_id,
      'stripe_subscription_id', p_stripe_subscription_id
    );
END;
$$;

COMMENT ON FUNCTION public.process_subscription_webhook_update IS
'Process subscription status updates from Stripe webhooks with automated credit lookup from subscription_plans table';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.process_subscription_webhook_update TO service_role;

-- =====================================================
-- Verification Query: Test Credit Lookup Logic
-- =====================================================

-- Verify subscription_plans contains correct credit amounts
DO $$
DECLARE
  v_individual_credits INTEGER;
  v_team_credits INTEGER;
BEGIN
  -- Check individual plan credits
  SELECT monthly_credits INTO v_individual_credits
  FROM subscription_plans
  WHERE stripe_product_id = 'prod_SR7syuRxrJPy2y';

  IF v_individual_credits IS NULL OR v_individual_credits = 0 THEN
    RAISE EXCEPTION 'Individual plan credits not configured correctly';
  END IF;

  -- Check team plan credits
  SELECT monthly_credits INTO v_team_credits
  FROM subscription_plans
  WHERE stripe_product_id = 'prod_SR7skD3oxkeBLS';

  IF v_team_credits IS NULL OR v_team_credits = 0 THEN
    RAISE EXCEPTION 'Team plan credits not configured correctly';
  END IF;

  RAISE NOTICE 'Credit configuration verified: Individual=%, Team=%',
    v_individual_credits, v_team_credits;
END;
$$;
```

### Phase 2: Update Edge Function

**File**: `backend/supabase/functions/stripe-webhook/index.ts`

**Changes to `handleSubscriptionUpdated()`**:

```typescript
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`Subscription updated: ${subscription.id}`);

  // Validate metadata (throws if missing required fields)
  validateSubscriptionMetadata(subscription);

  const clerkUserId = subscription.metadata.clerk_user_id;

  // Extract previous status if available (Stripe includes this in webhook data)
  const previousStatus = (subscription as any).previous_attributes?.status || null;
  const currentStatus = subscription.status;

  // Log transition for debugging
  console.log(`Subscription ${subscription.id} status transition: ${previousStatus || 'unknown'} → ${currentStatus}`);

  // Call database function to handle status transition
  // CRITICAL: This function does AUTOMATED credit lookup from subscription_plans
  // No hardcoded credit amounts - all driven by database configuration
  const stripeProductId = subscription.items.data[0]?.price?.product as string;

  const { data: result, error } = await supabase.rpc(
    'process_subscription_webhook_update',
    {
      p_stripe_subscription_id: subscription.id,
      p_clerk_user_id: clerkUserId,
      p_new_status: currentStatus,
      p_stripe_product_id: stripeProductId,  // Used for credit lookup
      p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      p_previous_status: previousStatus
    }
  );

  if (error) {
    console.error('Failed to process subscription update:', error);
    throw new Error(`Subscription update processing failed: ${error.message}`);
  }

  if (!result || !result.success) {
    console.error('Database function returned failure:', result);
    throw new Error(`Subscription update failed: ${result?.error || 'Unknown error'}`);
  }

  console.log('Subscription update processed successfully:', {
    subscription_id: subscription.id,
    transition_type: result.transition_type,
    credits_allocated: result.credits_allocated || 0,
    old_status: result.old_status,
    new_status: result.new_status
  });

  // Update cache with new subscription state (existing logic)
  await updateSubscriptionCache(subscription, clerkUserId);

  return {
    success: true,
    subscription_id: subscription.id,
    status: currentStatus,
    transition_type: result.transition_type,
    credits_allocated: result.credits_allocated || 0,
    processed_by_state_machine: true,
    automated_credit_lookup: true  // Flag indicating database-driven credits
  };
}
```

### Phase 3: Fix Metadata Bug in Checkout Flow

**File**: Find and update checkout session creation (likely `backend/modules/stripe-checkout-service.ts`)

**Required Change**: Ensure `clerk_user_id` is ALWAYS set in subscription metadata

```typescript
// When creating checkout session
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId,
  line_items: [{
    price: stripePriceId,
    quantity: 1,
  }],
  success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${frontendUrl}/checkout/cancel`,

  // CRITICAL: Set subscription metadata for webhook processing
  subscription_data: {
    metadata: {
      clerk_user_id: userId,          // ✅ REQUIRED for webhook validation
      user_email: userEmail,           // ✅ Recommended for debugging
      plan_type: planType,             // ✅ Recommended for audit trail
      created_via: 'checkout_session'  // ✅ Recommended for tracking
    },
    trial_period_days: isTrialEligible ? 3 : undefined,
  },

  metadata: {
    user_id: userId,
    transaction_type: 'subscription_create',
  }
});
```

---

## Credit Lookup Architecture (Database-Driven)

### subscription_plans Table (Source of Truth)

```sql
-- Current configuration (verified 2025-11-07)
SELECT plan_type, monthly_credits, stripe_product_id
FROM subscription_plans;

/*
plan_type   | monthly_credits | stripe_product_id
------------+-----------------+----------------------
individual  | 30             | prod_SR7syuRxrJPy2y
team        | 200            | prod_SR7skD3oxkeBLS
custom      | 0              | NULL
trial       | 0              | NULL (one_time_credits = 15)
none        | 0              | NULL
*/
```

### Automated Lookup Flow

```
Stripe Webhook → Edge Function → process_subscription_webhook_update()
  ↓
  process_subscription_state_change(p_new_plan_id = 'prod_SR7syuRxrJPy2y')
  ↓
  -- Lookup 1: Try Stripe product ID
  SELECT monthly_credits FROM subscription_plans
  WHERE stripe_product_id = 'prod_SR7syuRxrJPy2y'
  → Returns: 30 (individual plan)

  -- If not found, Lookup 2: Try plan_type
  SELECT monthly_credits FROM subscription_plans
  WHERE plan_type = 'individual'
  → Returns: 30

  -- If still not found, Lookup 3: Default to individual
  → Returns: 30
  ↓
  allocate_credits(user_id, 30, 'subscription_renewal')
  ↓
  INSERT INTO credit_transactions (amount = 30, ...)
```

### Benefits of Database-Driven Lookup

1. **No Hardcoding**: Credits configurable via subscription_plans table
2. **Easy Updates**: Change credits without code deployment
3. **Audit Trail**: subscription_plans.updated_at tracks configuration changes
4. **Consistency**: Same logic for all subscription operations
5. **Type Safety**: Database validates credit amounts (INTEGER NOT NULL)

---

## Transaction Guarantees

### Database Function ACID Compliance

```sql
BEGIN;  -- Implicit transaction in plpgsql function
  -- 1. Update subscription status
  UPDATE subscriptions
  SET status = 'active', updated_at = NOW()
  WHERE id = v_subscription_id;

  -- 2. Look up credits from subscription_plans (database-driven)
  SELECT monthly_credits INTO v_monthly_credits
  FROM subscription_plans
  WHERE stripe_product_id = 'prod_SR7syuRxrJPy2y';

  -- 3. Allocate credits (creates credit_transactions record)
  SELECT allocate_credits(user_id, v_monthly_credits, ...)
  INTO v_credit_result;

  -- 4. Record audit event
  INSERT INTO subscription_events (
    user_id, subscription_id, event_type,
    old_state, new_state, credits_allocated
  ) VALUES (...);

  -- 5. Update user profile
  UPDATE user_profiles
  SET subscription_status = 'active', updated_at = NOW()
  WHERE id = user_id;

COMMIT;  -- All-or-nothing: If any step fails, entire transaction rolls back
```

### Idempotency Guarantees

1. **Stripe Event Level**: `log_stripe_event()` prevents duplicate processing
2. **Credit Allocation Level**: Checks for existing allocation within period
3. **State Machine Level**: Detects if status unchanged

---

## Testing Plan

### Test Case 1: Trial-to-Active with Automated Credit Lookup

```sql
-- Setup: Create test subscription
INSERT INTO subscriptions (
  user_id, external_subscription_id, status,
  plan_type, stripe_product_id, current_period_start, current_period_end
) VALUES (
  'test_user_123', 'sub_test_trial', 'trialing',
  'individual', 'prod_SR7syuRxrJPy2y',
  NOW(), NOW() + INTERVAL '3 days'
);

-- Simulate trial-to-active webhook
SELECT process_subscription_webhook_update(
  p_stripe_subscription_id := 'sub_test_trial',
  p_clerk_user_id := 'test_user_123',
  p_new_status := 'active',
  p_stripe_product_id := 'prod_SR7syuRxrJPy2y',  -- Individual plan
  p_current_period_start := NOW(),
  p_current_period_end := NOW() + INTERVAL '30 days',
  p_previous_status := 'trialing'
);

-- Verify automated credit lookup worked
SELECT
  s.status,
  se.credits_allocated,
  ct.amount,
  ct.description
FROM subscriptions s
JOIN subscription_events se ON se.subscription_id = s.external_subscription_id
JOIN credit_transactions ct ON ct.user_id = s.user_id
WHERE s.external_subscription_id = 'sub_test_trial'
ORDER BY ct.created_at DESC
LIMIT 1;

-- Expected results:
-- status = 'active'
-- credits_allocated = 30 (from subscription_plans.monthly_credits)
-- credit_transactions.amount = 30
-- subscription_events record exists with event_type = 'trial_to_active'
```

### Test Case 2: Different Plan Types (Team vs Individual)

```sql
-- Test team plan (should allocate 200 credits, not 30)
SELECT process_subscription_webhook_update(
  p_stripe_subscription_id := 'sub_test_team',
  p_clerk_user_id := 'test_team_user',
  p_new_status := 'active',
  p_stripe_product_id := 'prod_SR7skD3oxkeBLS',  -- Team plan
  p_current_period_start := NOW(),
  p_current_period_end := NOW() + INTERVAL '30 days',
  p_previous_status := 'trialing'
);

-- Verify team plan credits
SELECT ct.amount
FROM credit_transactions ct
WHERE ct.user_id = 'test_team_user'
ORDER BY ct.created_at DESC
LIMIT 1;

-- Expected: amount = 200 (not 30)
```

### Test Case 3: Idempotency (Duplicate Webhook)

```sql
-- Call same function twice
SELECT process_subscription_webhook_update(...);  -- First call: allocates 30 credits
SELECT process_subscription_webhook_update(...);  -- Second call: should NOT duplicate

-- Verify only one allocation
SELECT COUNT(*), SUM(amount)
FROM credit_transactions
WHERE user_id = 'test_user_123'
  AND transaction_type = 'allocation'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Expected: count = 1, sum = 30
```

---

## Deployment Steps

### 1. Non-Prod Environment (jjpbogjufnqzsgiiaqwn)

```bash
# Step 1: Apply database migration
cd backend
npx supabase db push sql/migrations/020_trial_to_active_credit_fix.sql \
  --project-ref jjpbogjufnqzsgiiaqwn

# Step 2: Verify function exists
npx supabase db execute \
  --project-ref jjpbogjufnqzsgiiaqwn \
  --query "SELECT routine_name FROM information_schema.routines
           WHERE routine_name = 'process_subscription_webhook_update';"

# Step 3: Deploy Edge Function
cd supabase/functions
npx supabase functions deploy stripe-webhook \
  --project-ref jjpbogjufnqzsgiiaqwn

# Step 4: Test with Stripe CLI
stripe listen --forward-to https://jjpbogjufnqzsgiiaqwn.supabase.co/functions/v1/stripe-webhook

# In another terminal, trigger test event
stripe trigger customer.subscription.updated
```

### 2. Production Environment (lgkjfymwvhcjvfkuidis)

```bash
# Same steps as non-prod, but with production project ref
cd backend
npx supabase db push sql/migrations/020_trial_to_active_credit_fix.sql \
  --project-ref lgkjfymwvhcjvfkuidis

cd supabase/functions
npx supabase functions deploy stripe-webhook \
  --project-ref lgkjfymwvhcjvfkuidis
```

### 3. Verify Deployment

```sql
-- Check recent subscription events (should show credits allocated)
SELECT
  user_id,
  subscription_id,
  event_type,
  credits_allocated,
  new_state->>'plan_type' as plan_type,
  created_at
FROM subscription_events
WHERE event_type = 'trial_to_active'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check Stripe webhook logs
SELECT
  stripe_event_id,
  event_type,
  processed,
  error,
  created_at
FROM stripe_events
WHERE event_type = 'customer.subscription.updated'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Affected User Remediation

### User 1: desiree@p2musa.com (KNOWN USER)

**Current State**:
- User ID: `user_34z0ou38WMG64H549OQuXmrvzMD`
- Subscription: `sub_1SPVHMAdM2PoHEKvjx1Mb3Pq`
- Plan: Individual (`prod_SR7syuRxrJPy2y`)
- Status: `trialing` (should be `active`)
- Credits: 32 (should be 62 after adding 30 monthly credits)

**Remediation Script** (After deploying new function):

```sql
BEGIN;

-- Use new helper function (automated credit lookup)
SELECT process_subscription_webhook_update(
  p_stripe_subscription_id := 'sub_1SPVHMAdM2PoHEKvjx1Mb3Pq',
  p_clerk_user_id := 'user_34z0ou38WMG64H549OQuXmrvzMD',
  p_new_status := 'active',
  p_stripe_product_id := 'prod_SR7syuRxrJPy2y',  -- Lookup returns 30 credits
  p_current_period_start := '2025-11-06 21:27:10'::timestamptz,
  p_current_period_end := ('2025-11-06 21:27:10'::timestamptz + INTERVAL '30 days'),
  p_previous_status := 'trialing'
);

-- Mark webhook as processed (prevent retry)
UPDATE stripe_events
SET
  processed = true,
  processed_at = NOW(),
  error = 'Manually remediated via process_subscription_webhook_update()',
  updated_at = NOW()
WHERE stripe_event_id = 'evt_1SQaiZAdM2PoHEKvlDy92Dou';

COMMIT;

-- Verify results
SELECT
  s.status as subscription_status,
  up.subscription_status as profile_status,
  (SELECT SUM(amount) FROM credit_transactions WHERE user_id = s.user_id AND team_id IS NULL) as balance,
  se.credits_allocated,
  se.new_state->>'plan_type' as plan_type
FROM subscriptions s
JOIN user_profiles up ON up.id = s.user_id
LEFT JOIN subscription_events se ON se.subscription_id = s.external_subscription_id
  AND se.event_type IN ('trial_to_active', 'manual_remediation_trial_to_active')
WHERE s.external_subscription_id = 'sub_1SPVHMAdM2PoHEKvjx1Mb3Pq';

-- Expected:
-- subscription_status = 'active'
-- profile_status = 'active'
-- balance = 62 (32 existing + 30 from database lookup)
-- credits_allocated = 30 (from subscription_plans, not hardcoded)
```

### User 2: Unknown (TEST SUBSCRIPTION)

**Current State**:
- Subscription: `sub_1SPDwqAdM2PoHEKvLMRoEA7k`
- Customer: `cus_TLvoX90nDGHt1z`
- Status: No user record in database
- Assessment: Likely test data created directly in Stripe

**Remediation Options**:

**Option A: Identify Real User (if exists)**
```bash
# Check Stripe Dashboard
# Navigate to: Customers → cus_TLvoX90nDGHt1z
# Look for: Email address, metadata

# If real user found, create user record first:
```

```sql
-- Create missing user profile (if real user)
INSERT INTO user_profiles (
  id,  -- From Clerk dashboard
  email,  -- From Stripe customer
  stripe_customer_id,
  subscription_status,
  created_at
) VALUES (
  'user_xxxxx',  -- Lookup in Clerk by email
  'email@example.com',
  'cus_TLvoX90nDGHt1z',
  'active',
  NOW()
);

-- Create subscription record
INSERT INTO subscriptions (
  user_id,
  external_subscription_id,
  status,
  plan_type,
  stripe_product_id,
  current_period_start,
  current_period_end,
  payment_provider,
  created_at
) VALUES (
  'user_xxxxx',
  'sub_1SPDwqAdM2PoHEKvLMRoEA7k',
  'active',
  'individual',
  'prod_SR7syuRxrJPy2y',
  to_timestamp(1762138606),
  to_timestamp(1762138606) + INTERVAL '30 days',
  'stripe',
  NOW()
);

-- Allocate credits (uses automated lookup)
SELECT process_subscription_webhook_update(
  p_stripe_subscription_id := 'sub_1SPDwqAdM2PoHEKvLMRoEA7k',
  p_clerk_user_id := 'user_xxxxx',
  p_new_status := 'active',
  p_stripe_product_id := 'prod_SR7syuRxrJPy2y',  -- Lookup returns 30 credits
  p_current_period_start := to_timestamp(1762138606),
  p_current_period_end := to_timestamp(1762138606) + INTERVAL '30 days',
  p_previous_status := 'trialing'
);
```

**Option B: Cancel Test Subscription (if test data)**
```bash
# Cancel subscription in Stripe Dashboard
stripe subscriptions cancel sub_1SPDwqAdM2PoHEKvLMRoEA7k

# Mark webhook as processed to stop retries
```

```sql
UPDATE stripe_events
SET
  processed = true,
  processed_at = NOW(),
  error = 'Test subscription - no user record - cancelled in Stripe',
  updated_at = NOW()
WHERE object_id = 'sub_1SPDwqAdM2PoHEKvLMRoEA7k';
```

---

## Monitoring & Alerts

### Post-Deployment Monitoring Queries

**Query 1: Failed Webhooks (Check Every Hour)**
```sql
-- Alert if any customer.subscription.updated webhooks failed
SELECT
  stripe_event_id,
  event_type,
  object_id as subscription_id,
  error,
  retry_count,
  created_at
FROM stripe_events
WHERE event_type = 'customer.subscription.updated'
  AND processed = false
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Expected: 0 rows (all webhooks processing successfully)
```

**Query 2: Trial-to-Active Transitions (Daily Summary)**
```sql
-- Verify all trial-to-active transitions allocated correct credits
SELECT
  date_trunc('day', created_at) as date,
  COUNT(*) as transitions,
  SUM(credits_allocated) as total_credits,
  AVG(credits_allocated) as avg_credits,
  jsonb_agg(DISTINCT new_state->>'plan_type') as plan_types
FROM subscription_events
WHERE event_type = 'trial_to_active'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY date_trunc('day', created_at)
ORDER BY date DESC;

-- Expected: avg_credits matches subscription_plans configuration
-- Individual: 30, Team: 200
```

**Query 3: Missing Metadata (Alert Immediately)**
```sql
-- Alert on any new subscriptions without clerk_user_id
SELECT
  stripe_event_id,
  object_id as subscription_id,
  data->'object'->>'customer' as stripe_customer_id,
  data->'object'->'metadata' as metadata,
  created_at
FROM stripe_events
WHERE event_type IN ('customer.subscription.created', 'customer.subscription.updated')
  AND data->'object'->'metadata'->>'clerk_user_id' IS NULL
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Expected: 0 rows (all subscriptions have clerk_user_id after fix)
```

**Query 4: Credit Allocation Verification**
```sql
-- Verify credits match subscription_plans configuration
WITH recent_allocations AS (
  SELECT
    se.user_id,
    se.subscription_id,
    se.credits_allocated,
    se.new_state->>'plan_type' as plan_type,
    se.new_state->>'stripe_product_id' as stripe_product_id,
    se.created_at
  FROM subscription_events se
  WHERE se.event_type = 'trial_to_active'
    AND se.created_at > NOW() - INTERVAL '24 hours'
)
SELECT
  ra.*,
  sp.monthly_credits as expected_credits,
  CASE
    WHEN ra.credits_allocated = sp.monthly_credits THEN '✅ Correct'
    ELSE '❌ Mismatch'
  END as validation
FROM recent_allocations ra
LEFT JOIN subscription_plans sp
  ON sp.stripe_product_id = ra.stripe_product_id
ORDER BY ra.created_at DESC;

-- Expected: All rows show '✅ Correct'
```

---

## Rollback Strategy

### If Edge Function Fails

1. **Automatic Rollback** (Supabase keeps previous versions):
   ```bash
   # Rollback via Supabase Dashboard:
   # Edge Functions → stripe-webhook → Versions → Select previous → Deploy
   ```

2. **Manual Rollback** (restore previous code):
   ```bash
   git checkout HEAD~1 -- supabase/functions/stripe-webhook/index.ts
   npx supabase functions deploy stripe-webhook
   ```

3. **Impact**: Webhooks continue working, just no credit allocation until fix redeployed

### If Database Migration Fails

- **Automatic**: Migration is transactional - rollback automatic on error
- **Manual** (if needed):
  ```sql
  DROP FUNCTION IF EXISTS public.process_subscription_webhook_update;
  ```

### If Remediation Fails

```sql
-- Rollback transaction (if wrapped in BEGIN/COMMIT)
ROLLBACK;

-- Or manually revert specific changes:
-- 1. Delete incorrect credit_transactions record
DELETE FROM credit_transactions
WHERE id = 'incorrect_transaction_id';

-- 2. Revert subscription status
UPDATE subscriptions
SET status = 'trialing', updated_at = NOW()
WHERE external_subscription_id = 'sub_xxx';

-- 3. Revert user profile status
UPDATE user_profiles
SET subscription_status = 'trialing', updated_at = NOW()
WHERE id = 'user_xxx';
```

---

## Success Criteria

- [ ] **Database migration** applied successfully (both environments)
- [ ] **Edge Function** deployed successfully (both environments)
- [ ] **Test Case 1**: Trial-to-active transition allocates 30 credits (individual) ✅
- [ ] **Test Case 2**: Trial-to-active transition allocates 200 credits (team) ✅
- [ ] **Test Case 3**: Duplicate webhooks don't duplicate credits ✅
- [ ] **User 1 remediated**: desiree@p2musa.com has 62 total credits ✅
- [ ] **User 2 remediated**: Test subscription cancelled OR user record created ✅
- [ ] **Monitoring**: Zero failed webhooks for 48 hours ✅
- [ ] **Monitoring**: All credits match subscription_plans configuration ✅
- [ ] **Metadata fix**: All new subscriptions have clerk_user_id ✅

---

## Timeline Estimate

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Create database migration | 30 min |
| 2 | Update Edge Function | 1 hour |
| 3 | Fix checkout metadata | 30 min |
| 4 | Test in non-prod | 1 hour |
| 5 | Deploy to production | 30 min |
| 6 | User remediation | 30 min |
| 7 | Monitoring (active) | 48 hours |

**Total**: ~4 hours active work + 48 hours monitoring

---

## Risk Assessment

### Low Risk ✅

- Using existing, battle-tested database function
- Transactional updates (rollback on failure)
- Idempotency guarantees
- Comprehensive audit trail
- Automated credit lookup (no hardcoding)

### Mitigation Strategies

1. **Deploy to non-prod first** - catch issues before production
2. **Test with Stripe CLI** - verify webhook processing
3. **Monitor for 48 hours** - detect any edge cases
4. **Rollback plan ready** - can revert in minutes if needed

---

## Key Architecture Decisions

### ✅ Database-Driven Credit Configuration

**Decision**: Store all credit amounts in subscription_plans table, NOT in code

**Rationale**:
- Easy to update without deployment
- Single source of truth
- Audit trail via updated_at
- Type safety (INTEGER NOT NULL)
- Consistent across all operations

**Example**:
```sql
-- Update individual plan credits from 30 → 50
UPDATE subscription_plans
SET monthly_credits = 50, updated_at = NOW()
WHERE plan_type = 'individual';

-- Next trial-to-active transition automatically uses 50 credits
-- No code changes needed ✅
```

### ✅ Reuse Existing State Machine

**Decision**: Wrap `process_subscription_state_change()` instead of reimplementing

**Rationale**:
- Already handles all transitions correctly
- Already does automated credit lookup
- Already creates audit records
- Reduces code duplication
- Leverages transaction guarantees

---

## References

- **Database State Machine**: `backend/sql/migrations/013_fix_subscription_plan_lookup.sql:6-208`
- **Credit Allocation**: `backend/sql/core-credit-procedures.sql:217-272`
- **Edge Function**: `backend/supabase/functions/stripe-webhook/index.ts:262-287`
- **Credit System Docs**: `backend/CREDIT_SYSTEM_CONSOLIDATED.md`
- **Subscription Plans**: `subscription_plans` table (verified 2025-11-07)
