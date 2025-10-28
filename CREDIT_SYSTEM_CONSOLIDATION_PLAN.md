# Credit System Consolidation Plan

**Date**: 2025-10-27
**Status**: Design Complete - Ready for Implementation
**Breaking Changes**: YES - Consolidating 18+ functions into 2 universal functions

## Executive Summary

Consolidate credit operations into **TWO universal functions**:
1. **`use_credits_for_operation()`** - Usage/deductions (quantity-based pricing lookup)
2. **`allocate_credits()`** - Allocations/additions (amount-based, no lookup)

Both functions:
- ✅ Auto-detect team membership via `get_user_team_id()`
- ✅ Update `credit_transactions` table
- ✅ Update `activities` table consistently
- ✅ Store translation-friendly metadata
- ✅ Return JSONB with balance info

---

## Layer 1: Supabase Database Changes

### New/Updated Functions

#### 1. `use_credits_for_operation()` - Usage Operations (ALREADY EXISTS - UPDATE)

**Current State**: Already refactored (migration 20251027130632)
**Changes Needed**: Add activity logging

```sql
CREATE OR REPLACE FUNCTION public.use_credits_for_operation(
  p_user_id TEXT,
  p_operation_type TEXT,        -- 'story_generation', 'image_generation', 'community_copy', 'community_share'
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team_id TEXT;
  v_calculation_result JSONB;
  v_cost INTEGER;
  v_description TEXT;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_metadata JSONB;
BEGIN
  -- Validate inputs
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be positive');
  END IF;

  -- AUTO-DETECT team membership (Database-First pattern)
  v_team_id := get_user_team_id(p_user_id);

  -- Calculate cost using centralized pricing
  SELECT calculate_operation_credits(p_operation_type, p_quantity) INTO v_calculation_result;

  IF NOT (v_calculation_result->>'success')::boolean THEN
    RETURN v_calculation_result;
  END IF;

  v_cost := (v_calculation_result->>'credits_needed')::integer;

  -- Get current balance
  v_balance_before := get_user_credit_balance(p_user_id);

  -- Validate sufficient balance (unless it's a reward with negative cost)
  IF v_cost > 0 AND v_balance_before < v_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'balance', v_balance_before,
      'required', v_cost
    );
  END IF;

  -- Calculate new balance
  v_balance_after := v_balance_before - v_cost;  -- Negative cost = reward adds credits

  -- Build translation key description
  v_description := 'operations.' || p_operation_type;

  -- Build metadata with translation variables
  v_metadata := p_metadata || jsonb_build_object(
    'operation_type', p_operation_type,
    'quantity', p_quantity,
    'credits_used', v_cost,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'timestamp', NOW(),
    'formula_used', v_calculation_result->>'formula',
    'team_id', v_team_id
  );

  -- Insert credit transaction
  IF v_team_id IS NOT NULL THEN
    -- Team transaction
    INSERT INTO credit_transactions (user_id, team_id, amount, transaction_type, description, metadata)
    VALUES (p_user_id, v_team_id, -v_cost, 'usage', v_description, v_metadata);
  ELSE
    -- Personal transaction
    INSERT INTO credit_transactions (user_id, team_id, amount, transaction_type, description, metadata)
    VALUES (p_user_id, NULL, -v_cost, 'usage', v_description, v_metadata);
  END IF;

  -- Insert activity (CRITICAL - consistent audit trail)
  INSERT INTO activities (user_id, team_id, activity_type, description, metadata)
  VALUES (p_user_id, v_team_id, p_operation_type, v_description, v_metadata);

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'operation_type', p_operation_type,
    'quantity', p_quantity,
    'credits_used', v_cost,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'team_id', v_team_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

**Supported Operations**:
- `story_generation` - AI story generation
- `image_generation` - AI image generation
- `community_copy` - Copy community story
- `community_share` - Share story to community (reward)

---

#### 2. `allocate_credits()` - Allocation Operations (NEW FUNCTION)

```sql
CREATE OR REPLACE FUNCTION public.allocate_credits(
  p_user_id TEXT,
  p_amount INTEGER,              -- Exact credits to add (can be negative for refunds)
  p_source TEXT,                 -- 'subscription_renewal', 'trial_signup', 'payment', 'admin_adjustment', 'refund', 'transfer'
  p_description TEXT,            -- Human-readable description (for legacy/admin cases)
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_team_id TEXT;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_metadata JSONB;
  v_translation_key TEXT;
BEGIN
  -- Validate inputs
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount cannot be zero');
  END IF;

  IF p_source IS NULL OR p_source = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source is required');
  END IF;

  -- AUTO-DETECT team membership (Database-First pattern)
  v_team_id := get_user_team_id(p_user_id);

  -- Get current balance
  v_balance_before := get_user_credit_balance(p_user_id);
  v_balance_after := v_balance_before + p_amount;

  -- Build translation key description (unless custom description provided)
  IF p_description IS NULL OR p_description = '' THEN
    v_translation_key := 'allocations.' || p_source;
  ELSE
    v_translation_key := p_description;  -- Use custom description as-is
  END IF;

  -- Build metadata with translation variables
  v_metadata := p_metadata || jsonb_build_object(
    'source', p_source,
    'credits_added', p_amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'timestamp', NOW(),
    'team_id', v_team_id
  );

  -- Insert credit transaction
  IF v_team_id IS NOT NULL THEN
    -- Team transaction
    INSERT INTO credit_transactions (user_id, team_id, amount, transaction_type, description, metadata)
    VALUES (p_user_id, v_team_id, p_amount, 'allocation', v_translation_key, v_metadata);
  ELSE
    -- Personal transaction
    INSERT INTO credit_transactions (user_id, team_id, amount, transaction_type, description, metadata)
    VALUES (p_user_id, NULL, p_amount, 'allocation', v_translation_key, v_metadata);
  END IF;

  -- Insert activity (CRITICAL - consistent audit trail)
  INSERT INTO activities (user_id, team_id, activity_type, description, metadata)
  VALUES (p_user_id, v_team_id, p_source, v_translation_key, v_metadata);

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'source', p_source,
    'credits_added', p_amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'team_id', v_team_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.allocate_credits(TEXT, INTEGER, TEXT, TEXT, JSONB) IS
'Universal credit allocation function for subscriptions, trials, payments, admin adjustments.
Auto-detects team membership. Updates both credit_transactions and activities tables.
Uses translation-friendly descriptions for frontend i18n.';
```

**Supported Sources**:
- `subscription_renewal` - Monthly subscription credits
- `trial_signup` - Trial signup bonus
- `payment` - Credit purchase
- `admin_adjustment` - Manual admin correction
- `refund` - Credit refund (negative amount)
- `transfer` - Credit transfer (from transfer_all_user_credits_to_team)

---

### Functions to KEEP (Complex Business Logic)

These functions have complex logic beyond simple credit allocation:

1. ✅ `get_user_credit_balance()` - Balance query
2. ✅ `calculate_operation_credits()` - Pricing calculator
3. ✅ `get_user_team_id()` - Team detection helper
4. ✅ `process_subscription_state_change()` - Subscription state machine
5. ✅ `onboard_team_member()` - Team onboarding flow
6. ✅ `transfer_all_user_credits_to_team()` - Complex transfer with dual transactions
7. ✅ `transfer_all_user_stories_to_team()` - Story transfer

---

### Functions to DROP (Migration)

**⚠️ BREAKING CHANGES - These functions will be removed:**

```sql
-- Migration: Drop deprecated credit functions
DROP FUNCTION IF EXISTS public.use_credits(TEXT, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.use_team_credits(TEXT, TEXT, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.allocate_subscription_credits(TEXT, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.allocate_trial_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.allocate_monthly_credits(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.allocate_monthly_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.allocate_monthly_credits(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.allocate_monthly_credits(TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.add_team_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.add_reward_credits(TEXT, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.verify_and_allocate_payment(TEXT, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_team_credit_balance(TEXT, INTEGER);
```

**Note**: Only drop these AFTER all callers have been updated to use new functions.

---

## Layer 2: Backend API Changes (Zuplo)

### Updated Modules

#### 1. `modules/icraft-genAi.ts` - AI Story/Image Generation

**Current State**: ✅ Already uses `use_credits_for_operation()` (updated in migration 20251027130632)

**No changes needed** - Already calling:
```typescript
// Story generation
const { data: creditResult } = await supabase.rpc('use_credits_for_operation', {
  p_user_id: storyParams.userId,
  p_operation_type: 'story_generation',
  p_quantity: storyParams.numPages
});

// Image generation
const { data: creditResult } = await supabase.rpc('use_credits_for_operation', {
  p_user_id: userId,
  p_operation_type: 'image_generation',
  p_quantity: 1
});
```

---

#### 2. `modules/webhook-manager.ts` - Stripe Subscription Webhooks

**⚠️ BREAKING CHANGES**

**Current Code** (lines ~140-180):
```typescript
// ❌ OLD: Using deprecated allocate_subscription_credits()
const { error: creditError } = await supabase.rpc('allocate_subscription_credits', {
  p_user_id: userId,
  p_amount: creditAmount,
  p_description: `Monthly subscription renewal - ${planName}`,
  p_metadata: { ... }
});
```

**New Code**:
```typescript
// ✅ NEW: Use universal allocate_credits()
const { data: creditResult, error: creditError } = await supabase.rpc('allocate_credits', {
  p_user_id: userId,
  p_amount: creditAmount,
  p_source: 'subscription_renewal',
  p_description: '',  // Empty = use translation key
  p_metadata: {
    plan_name: planName.toLowerCase(),  // For translation
    plan_id: planId,
    subscription_id: subscriptionId,
    period_start: periodStart,
    period_end: periodEnd,
    stripe_invoice_id: invoiceId
  }
});

if (creditError) {
  context.log.error('Failed to allocate subscription credits', { error: creditError, userId });
  return; // Don't throw - webhook already processed subscription state
}

context.log.info('Subscription credits allocated', {
  userId,
  credits: creditAmount,
  balance_after: creditResult.balance_after
});
```

---

#### 3. `modules/icraft-clerk.ts` - User Signup Webhook

**⚠️ BREAKING CHANGES**

**Current Code** (lines ~80-100):
```typescript
// ❌ OLD: Using deprecated allocate_trial_credits()
const { error: trialError } = await supabase.rpc('allocate_trial_credits', {
  p_user_id: userId,
  p_amount: 30,
  p_description: 'Welcome trial credits'
});
```

**New Code**:
```typescript
// ✅ NEW: Use universal allocate_credits()
const { data: creditResult, error: trialError } = await supabase.rpc('allocate_credits', {
  p_user_id: userId,
  p_amount: 30,
  p_source: 'trial_signup',
  p_description: '',  // Empty = use translation key
  p_metadata: {
    signup_date: new Date().toISOString().split('T')[0]
  }
});

if (trialError) {
  context.log.error('Failed to allocate trial credits', { error: trialError, userId });
  // Continue - don't fail user creation over trial credits
} else {
  context.log.info('Trial credits allocated', {
    userId,
    credits: 30,
    balance_after: creditResult.balance_after
  });
}
```

---

#### 4. `modules/stripe-service.ts` - Credit Purchase Webhook

**⚠️ BREAKING CHANGES**

**Current Code** (lines ~200-250):
```typescript
// ❌ OLD: Using deprecated verify_and_allocate_payment()
const { error: paymentError } = await supabase.rpc('verify_and_allocate_payment', {
  p_user_id: userId,
  p_amount: creditAmount,
  p_payment_intent_id: paymentIntentId,
  p_metadata: { ... }
});
```

**New Code**:
```typescript
// ✅ NEW: Use universal allocate_credits()
const { data: creditResult, error: paymentError } = await supabase.rpc('allocate_credits', {
  p_user_id: userId,
  p_amount: creditAmount,
  p_source: 'payment',
  p_description: '',  // Empty = use translation key
  p_metadata: {
    payment_id: paymentIntentId,
    payment_intent_id: paymentIntentId,
    amount_paid: (amountPaid / 100).toFixed(2),  // Convert cents to dollars
    currency: 'usd',
    package_name: packageName,
    stripe_customer_id: customerId
  }
});

if (paymentError) {
  context.log.error('Failed to allocate payment credits', {
    error: paymentError,
    userId,
    paymentIntentId
  });
  throw new Error('Credit allocation failed');
}

context.log.info('Payment credits allocated', {
  userId,
  credits: creditAmount,
  balance_after: creditResult.balance_after,
  paymentIntentId
});
```

---

#### 5. `modules/icraft-community.ts` - Community Story Copy

**⚠️ BREAKING CHANGES**

**Current Code** (lines ~150-180):
```typescript
// ❌ OLD: Direct call to use_credits() - no operation type
const { error: creditError } = await supabase.rpc('use_credits', {
  p_user_id: userId,
  p_amount: 2,
  p_description: 'Copy community story',
  p_metadata: { story_id: storyId }
});
```

**New Code**:
```typescript
// ✅ NEW: Use use_credits_for_operation() with operation type
const { data: creditResult, error: creditError } = await supabase.rpc('use_credits_for_operation', {
  p_user_id: userId,
  p_operation_type: 'community_copy',
  p_quantity: 1,  // 1 story copied
  p_metadata: {
    source_story_id: storyId,
    new_story_id: newStoryId,
    author_id: originalAuthorId
  }
});

if (creditError) {
  context.log.error('Failed to deduct credits for community copy', {
    error: creditError,
    userId,
    storyId
  });
  return HttpProblems.badRequest(request, context, {
    detail: 'Insufficient credits to copy story'
  });
}

context.log.info('Community story copied', {
  userId,
  storyId,
  credits_used: creditResult.credits_used,
  balance_after: creditResult.balance_after
});
```

---

#### 6. Admin Endpoints (Future - if they exist)

**Pattern for admin credit adjustments**:
```typescript
// Admin adds credits
const { data: result } = await supabase.rpc('allocate_credits', {
  p_user_id: targetUserId,
  p_amount: adjustmentAmount,  // Can be negative
  p_source: 'admin_adjustment',
  p_description: '',  // Empty = use translation key
  p_metadata: {
    adjustment_type: 'compensation',  // or 'correction', 'bonus'
    reason: 'Service outage compensation',
    admin_id: adminUserId,
    admin_email: adminEmail,
    ticket_id: supportTicketId
  }
});
```

---

## Layer 3: Frontend Changes (React)

### Updated Services

#### 1. `services/SubscriptionService.ts` - Credit Service Methods

**No breaking changes needed** - Frontend doesn't call credit allocation functions directly.

Current pattern (already correct):
```typescript
// Frontend calls API endpoints, not database functions directly
const creditBalance = await subscriptionService.getCreditBalance(token);
const history = await subscriptionService.getCreditUsageHistory(userId, token);
```

---

### Updated Components

#### 1. Credit History Display - Add Translation Support

**File**: `src/components/subscription/CreditHistory.tsx` (or wherever credit history is shown)

**New Code**:
```typescript
import { useTranslation } from 'react-i18next';

interface CreditTransaction {
  id: string;
  description: string;  // Translation key: "operations.story_generation"
  amount: number;
  metadata: {
    operation_type?: string;
    source?: string;
    quantity?: number;
    credits_used?: number;
    credits_added?: number;
    [key: string]: any;
  };
  createdAt: string;
}

function CreditHistoryRow({ transaction }: { transaction: CreditTransaction }) {
  const { t } = useTranslation(['credits', 'common']);

  // Translate description using translation key and metadata variables
  const translatedDescription = translateCreditDescription(transaction.description, transaction.metadata, t);

  return (
    <tr>
      <td>{formatDate(transaction.createdAt)}</td>
      <td>{translatedDescription}</td>
      <td className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
        {transaction.amount > 0 ? '+' : ''}{transaction.amount}
      </td>
    </tr>
  );
}
```

---

#### 2. Translation Utility Function

**File**: `src/utils/creditTranslations.ts` (NEW FILE)

```typescript
import { TFunction } from 'i18next';

/**
 * Translate credit transaction description using i18next.
 * Handles both new translation keys and legacy English descriptions.
 */
export function translateCreditDescription(
  description: string,
  metadata: Record<string, any>,
  t: TFunction
): string {
  // Check if it's a translation key (new format)
  if (description.startsWith('operations.') || description.startsWith('allocations.')) {
    // Prepare variables for translation
    const variables = { ...metadata };

    // Handle special cases for display
    if (metadata.credits_used !== undefined && metadata.credits_used < 0) {
      // Reward case - show as positive
      variables.credits_earned = Math.abs(metadata.credits_used);
    }

    if (metadata.credits_added !== undefined && metadata.credits_added < 0) {
      // Refund/transfer sent - show as positive
      variables.credits_removed = Math.abs(metadata.credits_added);
      variables.transfer_amount = Math.abs(metadata.credits_added);
    }

    // Translate using i18next
    return t(`credits.${description}`, variables);
  }

  // Legacy format - return as-is (already in English)
  return description;
}
```

---

#### 3. Translation Files

**File**: `src/locales/en/credits.json` (NEW FILE)

```json
{
  "operations": {
    "story_generation": "Generated AI story ({{quantity}} pages, {{credits_used}} credits)",
    "image_generation": "Generated AI image ({{credits_used}} credits)",
    "image_generation_plural": "Generated {{quantity}} AI images ({{credits_used}} credits)",
    "community_copy": "Copied community story ({{credits_used}} credits)",
    "community_share": "Shared story to community (+{{credits_earned}} credits)"
  },
  "allocations": {
    "subscription_renewal": "Monthly subscription - {{plan_name}} plan (+{{credits_added}} credits)",
    "trial_signup": "Welcome trial bonus (+{{credits_added}} credits)",
    "payment": "Credit purchase - ${{amount_paid}} (+{{credits_added}} credits)",
    "admin_adjustment": "Admin adjustment - {{reason}} ({{credits_change}} credits)",
    "refund": "Credit refund - ${{refund_amount}} ({{credits_removed}} credits)",
    "transfer_sent": "Credits transferred to team (-{{transfer_amount}} credits)",
    "transfer_received": "Credits received from user (+{{transfer_amount}} credits)"
  }
}
```

**File**: `src/locales/es/credits.json` (NEW FILE)

```json
{
  "operations": {
    "story_generation": "Historia generada con IA ({{quantity}} páginas, {{credits_used}} créditos)",
    "image_generation": "Imagen generada con IA ({{credits_used}} créditos)",
    "image_generation_plural": "{{quantity}} imágenes generadas con IA ({{credits_used}} créditos)",
    "community_copy": "Historia de la comunidad copiada ({{credits_used}} créditos)",
    "community_share": "Historia compartida en la comunidad (+{{credits_earned}} créditos)"
  },
  "allocations": {
    "subscription_renewal": "Suscripción mensual - Plan {{plan_name}} (+{{credits_added}} créditos)",
    "trial_signup": "Bono de bienvenida (+{{credits_added}} créditos)",
    "payment": "Compra de créditos - ${{amount_paid}} (+{{credits_added}} créditos)",
    "admin_adjustment": "Ajuste administrativo - {{reason}} ({{credits_change}} créditos)",
    "refund": "Reembolso de créditos - ${{refund_amount}} ({{credits_removed}} créditos)",
    "transfer_sent": "Créditos transferidos al equipo (-{{transfer_amount}} créditos)",
    "transfer_received": "Créditos recibidos del usuario (+{{transfer_amount}} créditos)"
  }
}
```

---

## Implementation Timeline

### Phase 1: Database Layer (Supabase)
**Duration**: 1-2 days

1. Create `allocate_credits()` function
2. Update `use_credits_for_operation()` to log activities
3. Test both functions in non-prod
4. Deploy to production

**Migration File**: `20251027_consolidate_credit_functions.sql`

**Deliverables**:
- ✅ New `allocate_credits()` function
- ✅ Updated `use_credits_for_operation()` with activity logging
- ✅ Test results (all operation types verified)

---

### Phase 2: Backend Layer (Zuplo)
**Duration**: 2-3 days

1. Update `webhook-manager.ts` (subscription renewals)
2. Update `icraft-clerk.ts` (trial signups)
3. Update `stripe-service.ts` (credit purchases)
4. Update `icraft-community.ts` (community copy)
5. Test all webhooks in development
6. Deploy to QA
7. Deploy to production

**Files to Update**:
- `modules/webhook-manager.ts`
- `modules/icraft-clerk.ts`
- `modules/stripe-service.ts`
- `modules/icraft-community.ts`

**Deliverables**:
- ✅ All API callers updated to use new functions
- ✅ Webhook testing complete (Stripe test mode)
- ✅ QA environment validated
- ✅ Production deployment complete

---

### Phase 3: Frontend Layer (React)
**Duration**: 2-3 days

1. Create `creditTranslations.ts` utility
2. Create translation files (`en/credits.json`, `es/credits.json`)
3. Update credit history components
4. Test with both new and legacy transactions
5. Deploy to QA
6. Deploy to production

**Files to Create**:
- `src/utils/creditTranslations.ts`
- `src/locales/en/credits.json`
- `src/locales/es/credits.json`

**Files to Update**:
- `src/components/subscription/CreditHistory.tsx`
- `src/components/subscription/TeamCreditManagement.tsx`
- Any other components displaying credit transactions

**Deliverables**:
- ✅ Translation utility function
- ✅ English and Spanish translations
- ✅ Credit history displays correctly in both languages
- ✅ Legacy transactions still work

---

### Phase 4: Cleanup (Database)
**Duration**: 1 day (after 1 week monitoring)

1. Monitor production for 1 week (ensure no errors)
2. Verify all API callers updated (grep codebase for deprecated function calls)
3. Create migration to drop deprecated functions
4. Deploy cleanup migration to non-prod first
5. Validate non-prod (24 hours)
6. Deploy cleanup migration to production

**Migration File**: `20251028_drop_deprecated_credit_functions.sql`

**Deliverables**:
- ✅ 1 week of error-free production logs
- ✅ Code audit confirms no deprecated function calls
- ✅ Cleanup migration tested in non-prod
- ✅ Deprecated functions dropped in production

---

### Phase 5: Documentation Updates
**Duration**: 1 day

1. Update `SUPABASE_NON_PROD_CATALOG.md` with new function inventory
2. Verify function counts with SQL queries
3. Update architectural pattern descriptions
4. Add changelog entry for consolidation
5. Commit documentation updates

**Files to Update**:
- `SUPABASE_NON_PROD_CATALOG.md`

**Deliverables**:
- ✅ Database catalog reflects simplified architecture
- ✅ Function counts verified
- ✅ Changelog documents consolidation
- ✅ Documentation committed to git

---

**Total Duration**: 7-10 days + 1 week monitoring

---

## Testing Checklist

### Database Layer
- [ ] `use_credits_for_operation('story_generation', 6)` - Deducts 5 credits, creates activity
- [ ] `use_credits_for_operation('image_generation', 1)` - Deducts 1 credit, creates activity
- [ ] `use_credits_for_operation('community_copy', 1)` - Deducts 2 credits, creates activity
- [ ] `use_credits_for_operation('community_share', 1)` - Adds 3 credits (reward), creates activity
- [ ] `allocate_credits(300, 'subscription_renewal')` - Adds 300 credits, creates activity
- [ ] `allocate_credits(30, 'trial_signup')` - Adds 30 credits, creates activity
- [ ] `allocate_credits(100, 'payment')` - Adds 100 credits, creates activity
- [ ] `allocate_credits(50, 'admin_adjustment')` - Adds 50 credits, creates activity
- [ ] Team member operations route to team balance
- [ ] Individual operations route to personal balance
- [ ] Insufficient balance returns error
- [ ] All transactions update `credit_transactions` and `activities` consistently

### Backend Layer
- [ ] Stripe subscription renewal webhook allocates credits
- [ ] Clerk user signup webhook allocates trial credits
- [ ] Stripe payment webhook allocates purchase credits
- [ ] Community story copy deducts credits
- [ ] AI story generation deducts credits
- [ ] AI image generation deducts credits
- [ ] All webhooks log success/failure
- [ ] Error handling doesn't break webhook processing

### Frontend Layer
- [ ] Credit history displays translated descriptions (English)
- [ ] Credit history displays translated descriptions (Spanish)
- [ ] Legacy transactions (old format) still display correctly
- [ ] New transactions (translation keys) display correctly
- [ ] Positive amounts show with "+" prefix
- [ ] Negative amounts show with "-" prefix
- [ ] Rewards show as positive with "+" prefix
- [ ] Team credit management shows correct balance
- [ ] Credit balance refreshes after operations

---

## Rollback Plan

### If Issues Found After Deployment

1. **Backend Rollback**: Revert API changes, call old functions temporarily
2. **Database Rollback**: Old functions still exist until Phase 4
3. **Frontend Rollback**: Legacy descriptions still supported via `translateCreditDescription()`

### Emergency Hotfix

If critical bug found:
1. Create hotfix branch
2. Revert to calling old functions
3. Test in QA
4. Deploy to production
5. Investigate root cause offline

---

## Benefits Summary

### Reduced Complexity
- 18+ functions → 2 universal functions
- Consistent behavior across all operations
- Single source of truth for pricing

### Better Auditability
- Every credit operation creates activity log
- Translation keys make operation type explicit
- Metadata includes all context for filtering

### Multilingual Support
- No hardcoded English text in database
- Frontend controls translations
- Easy to add new languages

### Maintainability
- Update pricing in one place (`calculate_operation_credits()`)
- Add new operation types without API changes
- Consistent metadata schema across all transactions

### Team Attribution
- Database-First pattern enforced everywhere
- Frontend can never spoof team membership
- Automatic routing to team/personal balances

---

## Breaking Changes Summary

### Supabase
- ❌ Drop 12+ deprecated credit functions
- ✅ Add `allocate_credits()` function
- ✅ Update `use_credits_for_operation()` to log activities

### Backend API
- ❌ Stop calling `allocate_subscription_credits()`
- ❌ Stop calling `allocate_trial_credits()`
- ❌ Stop calling `verify_and_allocate_payment()`
- ❌ Stop calling `use_credits()` directly
- ✅ Call `allocate_credits()` for all allocations
- ✅ Call `use_credits_for_operation()` for all usage

### Frontend
- ✅ Add translation support for credit descriptions (backward compatible)
- ✅ No breaking changes (legacy format still supported)

---

## Questions/Decisions

1. **Should we migrate existing transactions to use translation keys?**
   - **Decision**: No - support both formats in frontend for backward compatibility

2. **Should we add `operation_pricing` table now?**
   - **Decision**: No - keep pricing in function for now (only 4 operation types)

3. **Should transfers use `allocate_credits()` or keep dedicated function?**
   - **Decision**: Keep `transfer_all_user_credits_to_team()` (complex dual-transaction logic)

4. **Should we version the API?**
   - **Decision**: No - internal breaking changes only, external API unchanged

---

## Phase 5: Documentation Updates

### Update SUPABASE_NON_PROD_CATALOG.md

After Phase 4 cleanup completes, update the database catalog to reflect the simplified architecture.

#### Changes Required

**File**: `SUPABASE_NON_PROD_CATALOG.md`

**Line 25-27**: Update statistics
```markdown
<!-- BEFORE -->
- **Total Tables**: 38 (3 tables dropped 2025-10-27)
- **Total Functions/Procedures**: 167 (2 functions dropped 2025-10-27)
- **Primary Schema**: public

<!-- AFTER -->
- **Total Tables**: 38 (no changes)
- **Total Functions/Procedures**: 156 (12 deprecated functions dropped 2025-10-27)
- **Primary Schema**: public
```

**Lines 612-671**: Update Credit Management section
```markdown
### Credit Management (6 functions - consolidated from 17)

#### Balance Queries
- **`get_user_credit_balance(p_user_id text)`** → integer
  Returns credit balance with automatic team detection. If user is team member, returns team shared balance. Otherwise, returns personal balance. **Database-First Team Attribution pattern.** This is the ONLY balance function needed.

#### Credit Usage (Quantity-Based Operations)
- **`use_credits_for_operation(p_user_id, p_operation_type, p_quantity, p_metadata)`** → jsonb
  **Universal credit usage function** for AI operations and community actions. Auto-detects team membership. Calculates credits from operation type and quantity via `calculate_operation_credits()`. Updates both `credit_transactions` AND `activities` tables. Supports: story_generation, image_generation, community_copy, community_share.

- **`check_credits_for_operation(p_user_id, p_operation_type, p_quantity)`** → jsonb
  Check if user has sufficient credits for operation.

#### Credit Allocation (Amount-Based Operations)
- **`allocate_credits(p_user_id, p_amount, p_source, p_description, p_metadata)`** → jsonb
  **Universal credit allocation function** for subscriptions, trials, purchases, admin adjustments. Auto-detects team membership. Updates both `credit_transactions` AND `activities` tables. Supports: subscription_renewal, trial_signup, payment, admin_adjustment, refund, transfer. Uses translation keys for i18n support.

#### Credit Operations
- **`calculate_operation_credits(p_operation_type, p_quantity)`** → jsonb
  Calculate credit cost for operation type. Central pricing logic for all quantity-based operations.

#### Credit History
- **`get_user_credit_history(p_user_id, p_limit, p_offset, p_types)`** → jsonb
  Get paginated credit transaction history for user. Returns transactions with translation-friendly descriptions.

#### Legacy Functions (Keep for Complex Business Logic)
- **`transfer_all_user_credits_to_team(p_user_id, p_team_id, p_description)`** → jsonb
  Transfer ALL user credits to team (used during team onboarding). Complex dual-transaction logic preserved.

**Deprecated Functions (Removed 2025-10-27)**:
- ❌ `use_credits()` - Replaced by `use_credits_for_operation()`
- ❌ `allocate_subscription_credits()` - Replaced by `allocate_credits()`
- ❌ `allocate_trial_credits()` - Replaced by `allocate_credits()`
- ❌ `allocate_monthly_credits()` (4 overloads) - Replaced by `allocate_credits()`
- ❌ `add_team_credits()` - Replaced by `allocate_credits()`
- ❌ `add_reward_credits()` - Replaced by `use_credits_for_operation()`
- ❌ `allocate_team_credits()` - Replaced by `allocate_credits()`
- ❌ `allocate_team_monthly_credits()` - Replaced by `allocate_credits()`
- ❌ `update_team_credit_balance()` - Replaced by `allocate_credits()`
- ❌ `verify_and_allocate_payment()` - Replaced by `allocate_credits()`
- ❌ `transfer_credits_to_team()` - Replaced by `allocate_credits()`
- ❌ `get_team_credit_history()` - Use `get_user_credit_history()` (auto-detects team)
```

**Lines 1109-1116**: Update architectural pattern description
```markdown
### 2. Pure Ledger Credit System (Consolidated 2025-10-27)
All credit operations consolidated into TWO universal functions:
- **`use_credits_for_operation()`** - Usage/deductions (quantity-based, pricing lookup)
- **`allocate_credits()`** - Allocations/additions (amount-based, no lookup)
- **Single table**: `credit_transactions` (ledger with all operations)
- **No cached balances** - balances computed on-demand from ledger
- **Single balance function**: `get_user_credit_balance()` - auto-detects team membership
- **Consistent logging**: Both functions update `credit_transactions` AND `activities` tables
- **Translation-friendly**: Descriptions use i18n keys for multilingual support
```

**Add new section after line 1231**: Recent Changes - Credit Consolidation
```markdown
### Credit Consolidation (2025-10-27)
Simplified credit system from 17 functions to 2 universal functions:

**New Functions (1):**
- `allocate_credits(p_user_id, p_amount, p_source, p_description, p_metadata)` - Universal allocation function

**Updated Functions (1):**
- `use_credits_for_operation()` - Now logs activities consistently

**Functions Dropped (12):**
- `use_credits()`, `allocate_subscription_credits()`, `allocate_trial_credits()`
- `allocate_monthly_credits()` (4 overloads)
- `add_team_credits()`, `add_reward_credits()`, `allocate_team_credits()`
- `allocate_team_monthly_credits()`, `update_team_credit_balance()`
- `verify_and_allocate_payment()`, `transfer_credits_to_team()`
- `get_team_credit_history()` (use `get_user_credit_history()` instead)

**Key Changes:**
- Two universal functions handle all credit operations
- Auto-detection of team membership (Database-First pattern)
- Consistent activity logging across all operations
- Translation-friendly descriptions for i18n support
- Metadata schema standardized for easy SQL filtering

**Result:**
- 17 functions → 6 functions (11 removed, 1 added)
- Simpler API surface: 2 universal functions vs 12+ specialized functions
- Consistent behavior: All operations auto-detect team, log activities
- Better auditability: Translation keys + structured metadata
```

#### Update Steps

1. **After Phase 4 Cleanup Completes** (all deprecated functions dropped):
   ```bash
   # Edit SUPABASE_NON_PROD_CATALOG.md with changes above
   git add SUPABASE_NON_PROD_CATALOG.md
   git commit -m "docs: Update database catalog after credit consolidation"
   ```

2. **Verify Catalog Accuracy**:
   ```sql
   -- Count total functions in public schema
   SELECT COUNT(*) FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.prokind = 'f';  -- Functions only (not aggregates/window functions)
   ```

3. **Generate Updated Function List** (if needed):
   ```sql
   -- List all credit-related functions
   SELECT
     p.proname as function_name,
     pg_get_function_arguments(p.oid) as arguments,
     pg_get_function_result(p.oid) as return_type,
     obj_description(p.oid, 'pg_proc') as description
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.proname LIKE '%credit%'
   ORDER BY p.proname;
   ```

---

## Success Criteria

- ✅ All credit operations use 2 universal functions
- ✅ All operations create activity logs
- ✅ All operations auto-detect team membership
- ✅ Frontend displays translations in English and Spanish
- ✅ No errors in production after deployment
- ✅ Audit trail is complete and consistent
- ✅ Zero manual SQL queries needed for credit operations
- ✅ Database catalog updated to reflect simplified architecture
