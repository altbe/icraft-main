# Subscription Redesign Proposal
**Date**: 2025-11-03 (Complete Investigation & Implementation Plan)
**Author**: Claude Code
**Status**: ✅ READY FOR IMPLEMENTATION
**Last Updated**: 2025-11-03 00:30 UTC
**Last Validated**: 2025-11-03 via Supabase MCP + database queries

---

## Executive Summary

Complete investigation of subscription system reveals:
- ✅ **Core sync infrastructure works perfectly** (hourly pg_cron, `sync_expired_subscriptions()`)
- ❌ **Architecture flaw**: Using separate `plan_type='trial'` instead of `status='trialing'`
- ❌ **Credit allocation bugs**: Wrong amounts (30 instead of 15), hardcoded values
- 🔴 **CRITICAL production error**: `use_credits_for_operation()` function missing

**Implementation Strategy**: Database-first architecture with comprehensive Migration 019

---

## Table of Contents

1. [Requirements](#requirements)
2. [Current State Analysis](#current-state-analysis)
3. [Complete Investigation Findings](#complete-investigation-findings)
4. [Database-First Architecture Decision](#database-first-architecture-decision)
5. [Migration 019: Comprehensive Fix](#migration-019-comprehensive-fix)
6. [Backend Code Updates](#backend-code-updates)
7. [Implementation Plan](#implementation-plan)
8. [Testing Strategy](#testing-strategy)
9. [Risks & Mitigations](#risks--mitigations)

---

## Requirements

### Subscription Lifecycle (User-Specified)

```
1. User signs up → NOT subscribed (no subscription record)

2. User subscribes (Individual or Team plan) → Start 3-day trial
   - Allocate 15 credits immediately (one-time)
   - User can: use credits, purchase more credits, cancel trial
   - User CANNOT: start new subscription (trial already active)

3. After 3 days (trial ends) → Automatic conversion to paid
   - Stripe charges payment method
   - Allocate monthly credits (30 for individual, 200 for team)
   - User keeps remaining trial credits

4. Monthly/annual billing cycles
   - Monthly plans: Allocate credits every month
   - Annual plans: Billed once/year, allocate credits every month
```

### Credit Amounts (User-Specified)

| Plan Type  | Trial Credits | Monthly Credits | Annual Billing |
|------------|---------------|-----------------|----------------|
| Trial      | 15 (one-time) | 0               | N/A            |
| Individual | 15 (trial)    | 30              | $49.99/year    |
| Team       | 15 (trial)    | 200             | $299.99/year   |

**Key Points**:
- Trial credits: **15** (NOT 30)
- Individual monthly: **30** (NOT 300)
- Team monthly: **200** (NOT 1000)

---

## Current State Analysis

### Database Schema (Production - Verified 2025-11-03)

#### `subscription_plans` Table
| plan_type  | stripe_product_id      | monthly_credits | one_time_credits | requires_payment |
|------------|------------------------|-----------------|------------------|------------------|
| none       | NULL                   | 0               | 0                | false            |
| **trial**  | **NULL**               | 0               | **30** ❌        | false            |
| individual | prod_SR7syuRxrJPy2y    | 30              | 0                | true             |
| team       | prod_SR7skD3oxkeBLS    | 200             | 0                | true             |
| custom     | NULL                   | 0               | 0                | false            |

**Issues**:
- ❌ Trial credits: 30 (should be 15)
- ❌ Separate `plan_type='trial'` (should use `status='trialing'` with individual/team plan_type)

#### `subscriptions` Table Schema
```sql
user_id TEXT NOT NULL
status TEXT NOT NULL                   -- 'trialing', 'active', 'canceled', 'expired'
plan_type TEXT NOT NULL                -- 'individual', 'team' (NOT 'trial')
stripe_product_id TEXT                 -- Stripe product ID (e.g., prod_SR7syuRxrJPy2y)
external_subscription_id TEXT UNIQUE   -- Stripe subscription ID
current_period_start TIMESTAMP
current_period_end TIMESTAMP
metadata JSONB
```

### Stripe Configuration (Verified 2025-11-03)

#### Products
- **Individual Plan** (`prod_SR7syuRxrJPy2y`): 30 monthly credits
- **Team Plan** (`prod_SR7skD3oxkeBLS`): 200 monthly credits

#### Prices (All have `trial_period_days=3`)
| Price ID                   | Product    | Interval | Amount   | Trial Days |
|----------------------------|------------|----------|----------|------------|
| price_1RWFdBAdM2PoHEKv3b9i6GEP | Individual | month    | $4.99    | 3          |
| price_1RWFdBAdM2PoHEKvErSvcmH5 | Individual | year     | $49.99   | 3          |
| price_1RWFdCAdM2PoHEKv1LIbN1Ql | Team       | month    | $29.99   | 3          |
| price_1RWFdCAdM2PoHEKvsl27wE7O | Team       | year     | $299.99  | 3          |

✅ **Correct**: All prices already have 3-day trial configured in Stripe

---

## Complete Investigation Findings

### Investigation Summary (2025-11-03)

**Method**: Supabase MCP queries + backend code review + production error analysis

#### Database Functions - All Verified ✅

| Function Name                        | Status | Last Verified | Usage                          |
|--------------------------------------|--------|---------------|--------------------------------|
| `sync_expired_subscriptions()`       | ✅ EXISTS | 2025-11-03    | Hourly pg_cron job             |
| `scheduled_subscription_sync()`      | ✅ EXISTS | 2025-11-03    | Cron wrapper (100% success)    |
| `process_subscription_state_change()`| ✅ EXISTS | 2025-11-03    | State machine transitions      |
| `verify_and_create_subscription()`   | ✅ EXISTS | 2025-11-03    | Checkout completion            |
| `allocate_credits()`                 | ✅ EXISTS | 2025-11-03    | Core credit allocation         |
| `use_credits()`                      | ✅ EXISTS | 2025-11-03    | Core credit deduction          |
| `use_credits_for_operation()`        | 🔴 **MISSING** | 2025-11-03    | Backend calls this (BROKEN)    |

**Key Finding**: All core functions exist EXCEPT `use_credits_for_operation()` which backend code calls but was never deployed.

#### Production Error Analysis 🔴

**Error Message**:
```
Transactional story copy failed: {
  "error": "transaction_failed",
  "message": "function use_credits_for_operation(text, unknown, text, integer, jsonb) does not exist",
  "success": false
}
```

**Broken Operations**:
1. Community story copy - `copy_community_story_transactional()`
2. AI story generation - `icraft-genAi.ts:1736`
3. AI image generation - `icraft-genAi.ts:2475`

**Root Cause**: Migrations creating `use_credits_for_operation()` were never applied to any environment:
- `20251027130632_refactor_use_credits_for_operation.sql` - NOT applied
- `20251027140000_consolidate_credit_functions.sql` - NOT applied

#### Backend Hardcoding Issues 🟡

**File**: `backend/modules/stripe-service.ts:12-18`
```typescript
const CREDIT_AMOUNTS = {
  trial: 30,          // ❌ Hardcoded - should be 15, should query database
  individual: 30,
  team: 200,
  custom: 0,
  none: 0
} as const;
```

**Usage**: `stripe-service.ts:1335-1342`
```typescript
if (subscription.status === 'trialing') {
  const amount = CREDIT_AMOUNTS.trial;  // ❌ Uses hardcoded 30
  await supabase.rpc('allocate_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_source: 'trial_signup',
    ...
  });
}
```

**Also Hardcoded**: `backend/supabase/migrations/20251102000007_fix_subscription_sync_use_modern_credit_functions.sql:162`
```sql
SELECT allocate_credits(
  v_old_subscription.user_id,
  30,  -- ❌ Hardcoded (should read from subscription_plans or use 15)
  'trial_signup',
  ...
);
```

#### Architecture Flaw Analysis 🟡

**Current (Wrong) Design**:
```
Trial: plan_type='trial', status='trialing', stripe_product_id='prod_SR7syuRxrJPy2y'
After trial: plan_type='individual', status='active', stripe_product_id='prod_SR7syuRxrJPy2y'
```

**Issues**:
1. `plan_type` changes from 'trial' → 'individual' (state machine violation)
2. Database has separate 'trial' plan type that doesn't match Stripe products
3. `stripe_product_id` is already 'individual' during trial (conflict)
4. Frontend display logic doesn't handle 'trial' plan_type

**Correct Design**:
```
Trial: plan_type='individual', status='trialing', stripe_product_id='prod_SR7syuRxrJPy2y'
After trial: plan_type='individual', status='active', stripe_product_id='prod_SR7syuRxrJPy2y'
```

**Why Better**:
1. `plan_type` stays constant (Individual/Team)
2. `status` indicates trial vs active (Stripe-native field)
3. `stripe_product_id` always matches plan_type
4. Frontend display logic already handles 'individual'/'team'

---

## Database-First Architecture Decision

### Industry Best Practices Research (2025-11-03)

**Consensus from SaaS subscription system design**:
1. **Data Integrity** → Database layer (stored procedures, constraints, triggers)
2. **Business Logic** → Application layer (API endpoints, webhooks)
3. **Configuration** → Database tables (not hardcoded in code)

**Applied to Credit System**:
- ✅ **Data integrity**: Pure ledger model in `credit_transactions` table
- ✅ **Business logic**: Application queries database for credit amounts
- ✅ **Configuration**: `subscription_plans` table stores credit amounts
- ✅ **Deployment flexibility**: Change credit amounts via SQL (no code deployment)

### Architecture Pattern: `allocate_credits_for_operation()`

**Proposed Function** (Database-First Design):
```sql
CREATE OR REPLACE FUNCTION allocate_credits_for_operation(
  p_user_id TEXT,
  p_operation_type TEXT,  -- 'trial_signup', 'subscription_renewal', 'subscription_start'
  p_plan_type TEXT,       -- 'trial', 'individual', 'team'
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_amount INTEGER;
BEGIN
  -- Look up credit amount from subscription_plans table
  IF p_operation_type = 'trial_signup' THEN
    SELECT one_time_credits INTO v_amount
    FROM subscription_plans
    WHERE plan_type = 'trial';
  ELSIF p_operation_type IN ('subscription_renewal', 'subscription_start') THEN
    SELECT monthly_credits INTO v_amount
    FROM subscription_plans
    WHERE plan_type = p_plan_type;
  ELSE
    RAISE EXCEPTION 'Unknown operation type: %', p_operation_type;
  END IF;

  -- Allocate credits using core function
  RETURN allocate_credits(
    p_user_id := p_user_id,
    p_amount := v_amount,
    p_source := p_operation_type,
    p_description := format('%s credits - %s plan', p_operation_type, p_plan_type),
    p_metadata := p_metadata
  );
END;
$$ LANGUAGE plpgsql;
```

**Benefits**:
1. Application code doesn't need to know credit amounts
2. Change credit amounts via SQL UPDATE (no deployment)
3. Single source of truth (subscription_plans table)
4. Semantic operation names ('trial_signup' vs raw numbers)

**User Decision**: "Let's keep the allocate_credits_for_operation design. Changing data is easier than frontend"

---

## Migration 019: Comprehensive Fix

### Migration Overview

**File**: `backend/sql/migrations/019_subscription_redesign_comprehensive_fix.sql`

**Goals**:
1. Fix trial credit amount (30→15)
2. Remove `plan_type='trial'` architecture (use `status='trialing'` instead)
3. Fix hardcoded values in database functions
4. Create `use_credits_for_operation()` (missing function)
5. Update existing user to correct state

### Migration SQL

```sql
-- Migration 019: Comprehensive Subscription Redesign Fix
-- Date: 2025-11-03
-- Issues Fixed:
--   1. Trial credits: 30 → 15
--   2. Architecture: plan_type='trial' → status='trialing' with individual/team plan_type
--   3. Hardcoded values in functions → database-driven
--   4. Missing function: use_credits_for_operation()
--   5. Existing user fix: user_34w6diCnJofh5C9fPAIiCNNfu0o

-- =============================================================================
-- PART 1: Fix subscription_plans Table
-- =============================================================================

-- Update trial credits from 30 → 15
UPDATE subscription_plans
SET one_time_credits = 15,
    description = '15 credits to try iCraftStories for 3 days',
    updated_at = NOW()
WHERE plan_type = 'trial';

-- =============================================================================
-- PART 2: Fix verify_and_create_subscription() - NO plan_type='trial' Override
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_and_create_subscription(
  p_session_id text,
  p_user_id text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_stripe_product_id text,
  p_price_interval text,
  p_status text,
  p_current_period_start timestamp with time zone DEFAULT NULL,
  p_current_period_end timestamp with time zone DEFAULT NULL,
  p_trial_start timestamp with time zone DEFAULT NULL,
  p_trial_end timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_existing_sub_id uuid;
  v_subscription_id uuid;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
  v_plan_type text;
  v_billing_period text;
  v_is_trial boolean;
BEGIN
  -- Idempotency check
  SELECT id INTO v_existing_sub_id
  FROM subscriptions
  WHERE metadata->>'checkout_session_id' = p_session_id;

  IF v_existing_sub_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'subscription_id', v_existing_sub_id,
      'message', 'Subscription already created for this session'
    );
  END IF;

  -- Look up plan_type from stripe_product_id
  SELECT plan_type INTO v_plan_type
  FROM subscription_plans
  WHERE stripe_product_id = p_stripe_product_id;

  -- If not found, default to individual
  IF v_plan_type IS NULL THEN
    v_plan_type := 'individual';
    RAISE WARNING 'Unknown stripe_product_id %, defaulting to individual', p_stripe_product_id;
  END IF;

  -- NOTE: We do NOT override plan_type to 'trial' anymore
  -- Status='trialing' is sufficient to indicate trial state
  -- plan_type stays as 'individual' or 'team' throughout subscription lifecycle

  -- Determine billing period from price interval
  v_billing_period := CASE
    WHEN p_price_interval = 'year' THEN 'yearly'
    ELSE 'monthly'
  END;

  -- Determine if this is a trial
  v_is_trial := (p_status = 'trialing');

  -- Calculate period dates if missing
  IF p_current_period_start IS NULL THEN
    v_period_start := NOW();
  ELSE
    v_period_start := p_current_period_start;
  END IF;

  IF p_current_period_end IS NULL THEN
    -- Calculate based on trial status and billing period
    IF v_is_trial THEN
      v_period_end := v_period_start + INTERVAL '3 days';
    ELSIF v_billing_period = 'yearly' THEN
      v_period_end := v_period_start + INTERVAL '365 days';
    ELSE
      v_period_end := v_period_start + INTERVAL '30 days';
    END IF;
  ELSE
    v_period_end := p_current_period_end;
  END IF;

  -- Insert subscription with correct plan_type ('individual' or 'team')
  INSERT INTO subscriptions (
    user_id,
    external_subscription_id,
    plan_type,
    stripe_product_id,
    status,
    current_period_start,
    current_period_end,
    payment_provider,
    metadata
  ) VALUES (
    p_user_id,
    p_stripe_subscription_id,
    v_plan_type,  -- 'individual' or 'team' (NOT 'trial')
    p_stripe_product_id,
    p_status,  -- 'trialing' or 'active'
    v_period_start,
    v_period_end,
    'stripe',
    jsonb_build_object(
      'checkout_session_id', p_session_id,
      'stripe_customer_id', p_stripe_customer_id,
      'billing_period', v_billing_period,
      'trial_start', p_trial_start,
      'trial_end', p_trial_end,
      'periods_calculated', (p_current_period_start IS NULL OR p_current_period_end IS NULL),
      'plan_looked_up', true
    )
  )
  ON CONFLICT (external_subscription_id)
  DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    stripe_product_id = COALESCE(EXCLUDED.stripe_product_id, subscriptions.stripe_product_id),
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    metadata = subscriptions.metadata || EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;

  -- Update user_profiles.subscription_status
  UPDATE user_profiles
  SET
    subscription_status = p_status,
    stripe_customer_id = p_stripe_customer_id,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Allocate credits based on status (trial vs active)
  IF v_is_trial THEN
    -- Allocate trial credits (15 credits, one-time)
    PERFORM allocate_credits(
      p_user_id := p_user_id,
      p_amount := (SELECT one_time_credits FROM subscription_plans WHERE plan_type = 'trial'),
      p_source := 'trial_signup',
      p_description := 'Welcome trial credits - 3 days to explore iCraftStories',
      p_metadata := jsonb_build_object(
        'subscription_id', v_subscription_id,
        'plan_type', v_plan_type
      )
    );
  ELSE
    -- Allocate monthly subscription credits (for subscriptions that start active, not trialing)
    PERFORM allocate_credits(
      p_user_id := p_user_id,
      p_amount := (SELECT monthly_credits FROM subscription_plans WHERE plan_type = v_plan_type),
      p_source := 'subscription_start',
      p_description := 'Subscription credits - ' || v_billing_period || ' ' || v_plan_type || ' plan',
      p_metadata := jsonb_build_object(
        'subscription_id', v_subscription_id,
        'billing_period', v_billing_period
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'subscription_id', v_subscription_id,
    'plan_type', v_plan_type,
    'billing_period', v_billing_period,
    'is_trial', v_is_trial,
    'message', 'Subscription created successfully',
    'periods_calculated', (p_current_period_start IS NULL OR p_current_period_end IS NULL)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'session_id', p_session_id
    );
END;
$function$;

-- =============================================================================
-- PART 3: Fix sync_expired_subscriptions() - Remove Hardcoded 30
-- =============================================================================

-- Note: The existing migration 20251102000007 already has this hardcoded.
-- We need to replace the function to query from subscription_plans instead.

CREATE OR REPLACE FUNCTION public.sync_expired_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_expired_trials subscriptions[];
  v_expired_period subscriptions[];
  v_trial_count integer := 0;
  v_period_count integer := 0;
  v_success_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb[] := ARRAY[]::jsonb[];
  v_trial_credits integer;
BEGIN
  -- Get trial credit amount from database (NOT hardcoded)
  SELECT one_time_credits INTO v_trial_credits
  FROM subscription_plans
  WHERE plan_type = 'trial';

  -- Find trials that ended (need conversion to active)
  SELECT array_agg(s.*) INTO v_expired_trials
  FROM subscriptions s
  WHERE s.status = 'trialing'
    AND s.current_period_end < NOW()
    AND s.external_subscription_id IS NOT NULL;

  -- Find active subscriptions that ended (need renewal)
  SELECT array_agg(s.*) INTO v_expired_period
  FROM subscriptions s
  WHERE s.status = 'active'
    AND s.current_period_end < NOW()
    AND s.external_subscription_id IS NOT NULL;

  v_trial_count := COALESCE(array_length(v_expired_trials, 1), 0);
  v_period_count := COALESCE(array_length(v_expired_period, 1), 0);

  -- Process each expired trial
  IF v_trial_count > 0 THEN
    FOR i IN 1..v_trial_count LOOP
      BEGIN
        PERFORM sync_subscription_from_stripe(
          v_expired_trials[i].external_subscription_id,
          v_expired_trials[i].user_id
        );
        v_success_count := v_success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, jsonb_build_object(
          'subscription_id', v_expired_trials[i].id,
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END IF;

  -- Process each expired period
  IF v_period_count > 0 THEN
    FOR i IN 1..v_period_count LOOP
      BEGIN
        PERFORM sync_subscription_from_stripe(
          v_expired_period[i].external_subscription_id,
          v_expired_period[i].user_id
        );
        v_success_count := v_success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, jsonb_build_object(
          'subscription_id', v_expired_period[i].id,
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END IF;

  -- Log results
  INSERT INTO system_logs (log_type, log_message, metadata)
  VALUES (
    'subscription_sync',
    format('Synced %s expired trials and %s expired periods', v_trial_count, v_period_count),
    jsonb_build_object(
      'trial_count', v_trial_count,
      'period_count', v_period_count,
      'success_count', v_success_count,
      'error_count', v_error_count,
      'errors', v_errors,
      'trial_credits_allocated', v_trial_credits
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'trials_found', v_trial_count,
    'periods_found', v_period_count,
    'synced_successfully', v_success_count,
    'errors', v_error_count,
    'error_details', v_errors
  );

EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO system_logs (log_type, log_message, metadata)
    VALUES (
      'subscription_sync_error',
      'Failed to sync expired subscriptions',
      jsonb_build_object('error', SQLERRM)
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- =============================================================================
-- PART 4: Create use_credits_for_operation() - Missing Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.use_credits_for_operation(
  p_user_id TEXT,
  p_operation_type TEXT,  -- 'story_generation', 'image_generation', 'story_copy'
  p_description TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_cost_per_unit INTEGER;
  v_total_cost INTEGER;
  v_result JSONB;
BEGIN
  -- Determine cost per unit based on operation type
  v_cost_per_unit := CASE p_operation_type
    WHEN 'story_generation' THEN 10     -- 10 credits per page
    WHEN 'image_generation' THEN 5      -- 5 credits per image
    WHEN 'story_copy' THEN 1            -- 1 credit per copy
    ELSE RAISE EXCEPTION 'Unknown operation type: %', p_operation_type
  END;

  -- Calculate total cost
  v_total_cost := v_cost_per_unit * p_quantity;

  -- Use credits (will throw exception if insufficient balance)
  SELECT use_credits(
    p_user_id := p_user_id,
    p_amount := v_total_cost,
    p_description := p_description,
    p_metadata := p_metadata || jsonb_build_object(
      'operation_type', p_operation_type,
      'quantity', p_quantity,
      'cost_per_unit', v_cost_per_unit
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 5: Fix Existing User (user_34w6diCnJofh5C9fPAIiCNNfu0o)
-- =============================================================================

-- Update user's subscription: plan_type='trial' → plan_type='individual'
-- Keep status='trialing' (correct)
UPDATE subscriptions
SET plan_type = 'individual',
    updated_at = NOW()
WHERE user_id = 'user_34w6diCnJofh5C9fPAIiCNNfu0o'
  AND plan_type = 'trial';

-- Deduct excess trial credits (30 → 15)
-- User currently has 30 credits, should have 15
-- Deduct 15 credits to match new trial amount
INSERT INTO credit_transactions (
  user_id,
  team_id,
  amount,
  source,
  description,
  metadata
) VALUES (
  'user_34w6diCnJofh5C9fPAIiCNNfu0o',
  NULL,
  -15,  -- Deduct 15 credits
  'migration_019',
  'Adjusted trial credits from 30 to 15 (migration fix)',
  jsonb_build_object(
    'migration', '019',
    'reason', 'trial_credit_adjustment',
    'old_amount', 30,
    'new_amount', 15
  )
);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
```

---

## Backend Code Updates

### 1. Fix `stripe-service.ts` - Remove Hardcoding

**File**: `backend/modules/stripe-service.ts`

**Current (Lines 12-18)**:
```typescript
const CREDIT_AMOUNTS = {
  trial: 30,          // ❌ Hardcoded
  individual: 30,
  team: 200,
  custom: 0,
  none: 0
} as const;
```

**Replace with** (Database-First Design):
```typescript
// Helper function to get credit amount from database
async function getCreditAmountFromDatabase(
  operationType: 'trial_signup' | 'subscription_renewal' | 'subscription_start',
  planType: string
): Promise<number> {
  try {
    // Query subscription_plans table for credit amount
    if (operationType === 'trial_signup') {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('one_time_credits')
        .eq('plan_type', 'trial')
        .single();

      if (error) throw error;
      return data.one_time_credits;
    } else {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('monthly_credits')
        .eq('plan_type', planType)
        .single();

      if (error) throw error;
      return data.monthly_credits;
    }
  } catch (error) {
    logger.error('Failed to get credit amount from database', { error, operationType, planType });
    // Fallback to hardcoded values if database query fails
    const FALLBACK_AMOUNTS: Record<string, number> = {
      trial: 15,
      individual: 30,
      team: 200,
      custom: 0,
      none: 0
    };
    return FALLBACK_AMOUNTS[planType === 'trial' ? 'trial' : planType] || 0;
  }
}
```

**Update Usage** (Lines 1335-1342):
```typescript
// OLD CODE:
if (subscription.status === 'trialing') {
  const amount = CREDIT_AMOUNTS.trial;  // ❌ Hardcoded
  await supabase.rpc('allocate_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_source: 'trial_signup',
    ...
  });
}

// NEW CODE:
if (subscription.status === 'trialing') {
  const amount = await getCreditAmountFromDatabase('trial_signup', 'trial');  // ✅ From database
  await supabase.rpc('allocate_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_source: 'trial_signup',
    p_description: `Welcome trial credits - ${amount} credits for 3 days`,
    p_metadata: {
      subscription_id: subscription.id,
      plan_type: subscription.plan_type
    }
  });
}
```

### 2. Fix `icraft-genAi.ts` - Replace Missing Function

**File**: `backend/modules/icraft-genAi.ts`

**Current (Line 1736 - Story Generation)**:
```typescript
const { data: creditResult, error: creditError } = await supabase.rpc('use_credits_for_operation', {
  p_user_id: storyParams.userId,
  p_operation_type: 'story_generation',
  p_quantity: storyParams.numPages,
  p_metadata: { ... }
});
```

**Option A: Use New Function** (If migration creates it):
```typescript
// No changes needed - migration creates use_credits_for_operation()
```

**Option B: Replace with use_credits()** (If we don't create the function):
```typescript
// Calculate cost (10 credits per page)
const cost = storyParams.numPages * 10;

const { data: creditResult, error: creditError } = await supabase.rpc('use_credits', {
  p_user_id: storyParams.userId,
  p_amount: cost,
  p_description: `AI story generation - ${storyParams.numPages} pages`,
  p_metadata: {
    operation_type: 'story_generation',
    num_pages: storyParams.numPages,
    cost_per_page: 10,
    ...
  }
});
```

**Recommendation**: **Option A** - Create `use_credits_for_operation()` in migration to minimize backend code changes and maintain semantic operation names.

---

## Implementation Plan

### Phase 1: Migration Preparation (10 minutes)
1. ✅ Create migration file: `backend/sql/migrations/019_subscription_redesign_comprehensive_fix.sql`
2. Review migration SQL (all sections)
3. Test migration syntax in non-prod

### Phase 2: Database Deployment (15 minutes)
1. Apply migration to **non-prod** first:
   ```bash
   cd backend
   npx supabase db push --project-ref jjpbogjufnqzsgiiaqwn
   ```
2. Verify functions exist:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name IN (
       'verify_and_create_subscription',
       'sync_expired_subscriptions',
       'use_credits_for_operation'
     );
   ```
3. Verify subscription_plans table:
   ```sql
   SELECT plan_type, one_time_credits FROM subscription_plans WHERE plan_type = 'trial';
   -- Expected: one_time_credits = 15
   ```

### Phase 3: Backend Code Updates (20 minutes)
1. Update `stripe-service.ts`:
   - Add `getCreditAmountFromDatabase()` helper
   - Update trial allocation logic
   - Update renewal allocation logic
2. Commit changes:
   ```bash
   git add modules/stripe-service.ts
   git commit -m "feat: Database-driven credit allocation (Migration 019)"
   ```

### Phase 4: Testing in Non-Prod (30 minutes)
1. **Test 1: New Trial Signup**
   - Create new test user
   - Subscribe to Individual Monthly
   - Verify: 15 credits allocated (NOT 30)
   - Verify: `plan_type='individual'`, `status='trialing'`

2. **Test 2: Trial → Active Transition**
   - Wait for trial to end (or simulate via Stripe)
   - Verify: `status='active'`, `plan_type` stays 'individual'
   - Verify: 30 monthly credits allocated
   - Verify: User has 15 (remaining trial) + 30 (monthly) = 45 total

3. **Test 3: Story Copy with use_credits_for_operation()**
   - Copy community story
   - Verify: No "function does not exist" error
   - Verify: Credits deducted correctly

4. **Test 4: AI Story Generation**
   - Generate 3-page story
   - Verify: 30 credits deducted (10 per page)
   - Verify: No errors in logs

### Phase 5: Production Deployment (10 minutes)
1. Apply migration to **production**:
   ```bash
   npx supabase db push --project-ref lgkjfymwvhcjvfkuidis
   ```
2. Deploy backend changes (if any - Zuplo auto-deploys)
3. Monitor logs for errors

### Phase 6: Monitoring (24 hours)
1. Check hourly sync job:
   ```sql
   SELECT jobid, status, return_message, start_time
   FROM cron.job_run_details
   WHERE jobid = 1
   ORDER BY start_time DESC
   LIMIT 5;
   ```
2. Check for credit allocation errors:
   ```sql
   SELECT log_type, log_message, metadata
   FROM system_logs
   WHERE log_type IN ('subscription_sync_error', 'credit_error')
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```
3. Monitor new trial signups:
   ```sql
   SELECT user_id, amount, description, created_at
   FROM credit_transactions
   WHERE source = 'trial_signup'
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   -- Expected: amount = 15 for all new trials
   ```

---

## Testing Strategy

### Test Cases

#### TC1: New User Trial Signup
**Steps**:
1. Create new user (Clerk signup)
2. Subscribe to Individual Monthly plan
3. Verify checkout session completed webhook

**Expected**:
- `subscriptions` table: `plan_type='individual'`, `status='trialing'`
- `credit_transactions`: 15 credits allocated with `source='trial_signup'`
- User can create/copy stories

#### TC2: Trial → Active Conversion
**Steps**:
1. Wait 3 days (or simulate in Stripe)
2. Verify Stripe charges payment method
3. Verify webhook processes `subscription.updated`

**Expected**:
- `subscriptions` table: `status='active'`, `plan_type` stays 'individual'
- `credit_transactions`: 30 credits allocated with `source='subscription_renewal'`
- Total balance: 15 (remaining trial) + 30 (monthly) = 45

#### TC3: Story Copy (use_credits_for_operation)
**Steps**:
1. User with 15 trial credits
2. Copy community story
3. Verify transaction completes

**Expected**:
- No "function does not exist" error
- 1 credit deducted
- New story created with correct ownership

#### TC4: AI Story Generation
**Steps**:
1. User with 30 credits
2. Generate 3-page story
3. Verify credits deducted

**Expected**:
- 30 credits deducted (10 per page)
- Story created successfully
- Balance updated correctly

#### TC5: Annual Plan Monthly Credits
**Steps**:
1. Subscribe to Individual Annual ($49.99)
2. Verify trial credits (15)
3. Wait for trial → active conversion
4. Wait 30 days for next billing cycle

**Expected**:
- Day 1-3: 15 trial credits
- Day 4: Stripe charges $49.99, 30 credits allocated
- Day 34: NO charge, 30 credits allocated
- Day 64: NO charge, 30 credits allocated
- ... every month until Day 365

---

## Risks & Mitigations

### Risk 1: Existing Active Subscriptions
**Risk**: Migration changes might affect existing active users

**Mitigation**:
- Migration only updates:
  1. `subscription_plans` table (configuration)
  2. Stored procedures (logic)
  3. One specific user (user_34w6diCnJofh5C9fPAIiCNNfu0o)
- No changes to existing subscription records (except the one user)
- New logic only applies to NEW subscriptions

**Validation**:
```sql
-- Check for unintended updates
SELECT user_id, plan_type, status, updated_at
FROM subscriptions
WHERE updated_at > NOW() - INTERVAL '1 hour'
  AND user_id != 'user_34w6diCnJofh5C9fPAIiCNNfu0o';
-- Expected: 0 rows (no unintended updates)
```

### Risk 2: use_credits_for_operation() Errors
**Risk**: Newly created function has bugs, breaks existing operations

**Mitigation**:
- Function calls `use_credits()` internally (tested and working)
- Simple cost calculation logic (hardcoded per operation type)
- Exception handling returns clear error messages
- Test in non-prod before production deployment

**Rollback**:
```sql
-- If function has bugs, drop it and update backend to use use_credits() directly
DROP FUNCTION IF EXISTS use_credits_for_operation(TEXT, TEXT, TEXT, INTEGER, JSONB);
```

### Risk 3: Credit Deduction Discrepancy
**Risk**: User sees 15 credits deducted (adjustment), gets confused

**Mitigation**:
- Only ONE user affected (user_34w6diCnJofh5C9fPAIiCNNfu0o)
- Transaction description clearly states: "Adjusted trial credits from 30 to 15 (migration fix)"
- User is in trial (hasn't paid yet), minimal impact
- Can manually communicate if user asks

**Alternative**:
- **Don't deduct credits** - let user keep 30 (grandfather them)
- Update migration Part 5 to comment out the credit adjustment

### Risk 4: Stripe Webhook Race Condition
**Risk**: Webhook fires before migration completes

**Mitigation**:
- Deploy during low-traffic hours
- Migration is fast (<30 seconds)
- Idempotency checks prevent duplicate credit allocation
- Worst case: Webhook fails, hourly sync fixes it

---

## Success Metrics

After deployment, monitor:

### 1. Credit Allocation Accuracy
```sql
-- Verify all new trials get exactly 15 credits
SELECT user_id, amount, description, created_at
FROM credit_transactions
WHERE source = 'trial_signup'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
-- Expected: amount = 15 for all rows
```

### 2. Function Errors
```sql
-- Check for any errors calling use_credits_for_operation()
SELECT log_type, log_message, metadata
FROM system_logs
WHERE log_message LIKE '%use_credits_for_operation%'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
-- Expected: 0 rows
```

### 3. Trial Conversion Rate
```sql
-- Monitor trial → active conversions
SELECT
  COUNT(*) FILTER (WHERE status = 'trialing') as active_trials,
  COUNT(*) FILTER (WHERE status = 'active' AND created_at > NOW() - INTERVAL '7 days') as new_active
FROM subscriptions
WHERE plan_type IN ('individual', 'team');
```

### 4. Subscription Sync Success Rate
```sql
-- Verify hourly sync job continues working
SELECT
  COUNT(*) FILTER (WHERE status = 'succeeded') as success,
  COUNT(*) FILTER (WHERE status != 'succeeded') as failure
FROM cron.job_run_details
WHERE jobid = 1
  AND start_time > NOW() - INTERVAL '7 days';
-- Expected: failure = 0
```

---

## Appendix: Architecture Comparison

### Current (Broken) vs. Proposed (Fixed)

| Aspect                     | Current (Broken)                | Proposed (Fixed)                    |
|----------------------------|---------------------------------|-------------------------------------|
| Trial Credits              | 30 ❌                           | **15** ✅                           |
| Trial plan_type            | 'trial' ❌                      | **'individual'/'team'** ✅          |
| Trial status               | 'trialing' ✅                   | **'trialing'** ✅                   |
| After trial plan_type      | Changes to 'individual' ❌      | **Stays 'individual'** ✅           |
| After trial status         | Changes to 'active' ✅          | **Changes to 'active'** ✅          |
| Credit allocation          | Hardcoded (30) ❌               | **Database-driven (15)** ✅         |
| use_credits_for_operation  | Missing ❌                      | **Created** ✅                      |
| Credit amounts in code     | Hardcoded ❌                    | **Queried from database** ✅        |

### State Transition Diagram

```
┌─────────────┐
│  Sign Up    │  subscription_status='free', no subscription record
└──────┬──────┘
       │
       │ User subscribes (Individual or Team)
       ↓
┌──────────────────────────────────┐
│   Trialing (Day 1-3)             │
│   plan_type='individual'/'team'  │  ← FIXED: No longer 'trial'
│   status='trialing'              │
│   credits=15                     │  ← FIXED: No longer 30
│                                  │
│   User can:                      │
│   - Use 15 credits               │
│   - Purchase more credits        │
│   - Cancel trial                 │
│   User CANNOT:                   │
│   - Start new subscription       │
└──────┬───────────────────────────┘
       │
       │ 3 days pass, Stripe charges payment
       ↓
┌──────────────────────────────────┐
│   Active (Day 4+)                │
│   plan_type='individual'/'team'  │  ← STAYS same (no change)
│   status='active'                │  ← ONLY status changes
│   credits=15 (remaining) + 30/200│
│                                  │
│   Monthly billing:               │
│   - Individual: $4.99            │
│   - Team: $29.99                 │
│                                  │
│   Annual billing:                │
│   - Individual: $49.99           │
│   - Team: $299.99                │
│   (Monthly credits continue)     │
└──────┬───────────────────────────┘
       │
       │ Each billing cycle (monthly)
       ↓
┌──────────────────────────────────┐
│   Renewal                        │
│   credits += 30/200 (monthly)    │
│   User billed (monthly or annual)│
└──────────────────────────────────┘
```

---

## Questions for Review

### Q1: Existing User Credit Adjustment
User `user_34w6diCnJofh5C9fPAIiCNNfu0o` currently has 30 trial credits.

**Options**:
- **A**: Deduct 15 credits to match new trial amount (migration includes this)
- **B**: Keep 30 credits (grandfather them, comment out credit adjustment in migration)

**Current Migration**: Option A (deduct 15 credits)

**Recommendation**: Option B (grandfather them) - better UX, minimal cost

### Q2: use_credits_for_operation() Implementation
**Options**:
- **A**: Create function in migration (hardcoded cost per operation)
- **B**: Update backend to calculate cost and call `use_credits()` directly

**Current Migration**: Option A (create function)

**Recommendation**: Option A - less backend code changes, semantic operation names

---

**Status**: ✅ READY FOR IMPLEMENTATION

**Next Steps**: Apply migration to non-prod, test, deploy to production
