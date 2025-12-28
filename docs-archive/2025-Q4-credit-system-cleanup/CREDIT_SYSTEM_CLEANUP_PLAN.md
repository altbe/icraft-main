# Credit System Cleanup & Legacy Webhook Removal Plan

**Date:** 2025-10-30
**Status:** 📝 Planned
**Dependencies:** Edge Function production deployment (✅ Complete 2025-10-30)
**Objective:** Complete credit system consolidation and remove deprecated code

---

## 🎯 Overview

This plan addresses:
1. **🔴 CRITICAL**: Fix 2 broken production files blocking team member credit purchases
2. **🟡 MEDIUM**: Remove legacy Zuplo webhook handler after Edge Function validation
3. **🟢 LOW**: Drop 7 remaining deprecated database functions
4. **✅ VALIDATE**: Confirm credit system consolidation is 100% complete

**Current Status:** 50% Complete (database done, backend partial, frontend pending)
**Target Status:** 90% Complete (database + backend complete, frontend Phase 3 deferred)

---

## Phase 1: Fix Broken Production Code (URGENT)

**Priority:** 🔴 CRITICAL - Production breaking for team members
**Timeline:** THIS WEEK (before team members attempt credit purchases)
**Dependencies:** None (independent fixes)

### Task 1.1: Fix Credit Purchase Handler

**File:** `backend/modules/stripe-checkout-completion.ts:162`

**Current Broken Code:**
```typescript
const { data, error } = await supabase.rpc('verify_and_allocate_payment', {
  p_session_id: session.id,
  p_user_id: userId,
  p_credits_to_allocate: credits,
  p_amount_paid: amountPaid,
  p_currency: currency
});
```

**Issue:** `verify_and_allocate_payment()` calls non-existent `get_team_credit_balance()`

**Fix Strategy:**
```typescript
// 1. Manual idempotency check
const { data: existingPayment } = await supabase
  .from('credit_transactions')
  .select('id')
  .eq('metadata->>stripe_session_id', session.id)
  .single();

if (existingPayment) {
  context.log.info('Payment already processed', { sessionId: session.id });
  return { success: true, duplicate: true };
}

// 2. Use modern allocate_credits() function
const { data, error } = await supabase.rpc('allocate_credits', {
  p_user_id: userId,
  p_amount: credits,
  p_source: 'payment',
  p_description: `Credit purchase (${credits} credits)`,
  p_metadata: {
    stripe_session_id: session.id,
    amount_paid: amountPaid,
    currency: currency,
    timestamp: new Date().toISOString()
  }
});
```

**Testing:**
- [ ] Test with individual user purchasing credits
- [ ] Test with team member purchasing credits (CRITICAL)
- [ ] Test duplicate payment attempt (idempotency)
- [ ] Verify credit_transactions record created correctly
- [ ] Verify activities log created
- [ ] Check balance updates correctly

**Rollback:** Revert to previous commit (will restore broken code but not cause new issues)

---

### Task 1.2: Fix Webhook Fallback Handler

**File:** `backend/modules/webhook-manager.ts:493`

**Current Broken Code:**
```typescript
const { data, error } = await supabase.rpc('process_credit_purchase_webhook', {
  event_data: event.data,
  idempotency_key: idempotencyKey,
  webhook_event_id: webhookEventId
});
```

**Issue:** `process_credit_purchase_webhook()` calls broken `verify_and_allocate_payment()`

**Fix Strategy:**

**Option A (Recommended): Direct allocation**
```typescript
// Extract data from webhook event
const session = event.data.object;
const userId = session.metadata?.clerk_user_id;
const credits = parseInt(session.metadata?.credits || '0');
const amountPaid = session.amount_total;
const currency = session.currency;

if (!userId || !credits) {
  throw new Error('Missing required metadata in session');
}

// Check idempotency via database query
const { data: existingPayment } = await supabase
  .from('credit_transactions')
  .select('id')
  .eq('metadata->>stripe_session_id', session.id)
  .single();

if (existingPayment) {
  context.log.info('Payment already processed', { sessionId: session.id });
  return { success: true, duplicate: true };
}

// Use allocate_credits() directly
const { data, error } = await supabase.rpc('allocate_credits', {
  p_user_id: userId,
  p_amount: credits,
  p_source: 'payment',
  p_description: `Credit purchase (${credits} credits)`,
  p_metadata: {
    stripe_session_id: session.id,
    amount_paid: amountPaid,
    currency: currency,
    webhook_event_id: webhookEventId,
    timestamp: new Date().toISOString()
  }
});
```

**Option B (Conservative): Keep wrapper, fix internals**
- Update `process_credit_purchase_webhook()` stored procedure to use `allocate_credits()`
- Less code change in backend API
- More database logic

**Recommendation:** Option A - Webhook fallback is rarely used, simpler to maintain inline

**Testing:**
- [ ] Test with simulated webhook failure → fallback triggered
- [ ] Test with team member credit purchase
- [ ] Test idempotency (duplicate webhook)
- [ ] Verify Edge Function is primary handler (this is just fallback)

**Rollback:** Revert to previous commit

---

### Task 1.3: Test End-to-End Credit Purchase Flow

**Test Scenarios:**

1. **Individual User Credit Purchase**
   - [ ] Create Stripe checkout session
   - [ ] Complete payment in test mode
   - [ ] Verify Edge Function processes webhook
   - [ ] Verify credits allocated correctly
   - [ ] Check balance query returns correct amount

2. **Team Member Credit Purchase**
   - [ ] Identify team member user ID
   - [ ] Create checkout session for team member
   - [ ] Complete payment
   - [ ] Verify credits allocated to TEAM (not personal)
   - [ ] Check team balance increases
   - [ ] Verify other team members see updated balance

3. **Idempotency Test**
   - [ ] Manually replay webhook event
   - [ ] Verify duplicate detection works
   - [ ] Confirm no double credit allocation
   - [ ] Check logs show "already processed"

4. **Fallback Test** (simulate Edge Function failure)
   - [ ] Temporarily disable Edge Function endpoint
   - [ ] Trigger credit purchase
   - [ ] Verify fallback handler processes it
   - [ ] Re-enable Edge Function
   - [ ] Verify next purchase uses Edge Function

**Validation Queries:**
```sql
-- Check recent credit purchases (last 24 hours)
SELECT
  user_id,
  team_id,
  amount,
  description,
  metadata->>'stripe_session_id' as session_id,
  metadata->>'amount_paid' as paid,
  created_at
FROM credit_transactions
WHERE transaction_type = 'allocation'
  AND metadata->>'source' = 'payment'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check team balance for specific team
SELECT get_user_credit_balance('TEAM_MEMBER_USER_ID');

-- Verify no duplicate payments
SELECT
  metadata->>'stripe_session_id' as session_id,
  COUNT(*) as occurrences
FROM credit_transactions
WHERE metadata->>'stripe_session_id' IS NOT NULL
GROUP BY metadata->>'stripe_session_id'
HAVING COUNT(*) > 1;
```

**Exit Criteria:**
- ✅ Individual users can purchase credits successfully
- ✅ Team members can purchase credits successfully (credits go to team pool)
- ✅ No duplicate credit allocations
- ✅ Fallback handler works when Edge Function unavailable
- ✅ All tests pass in non-prod environment

---

## Phase 2: Validate Edge Function Performance (ONGOING)

**Priority:** 🟡 MEDIUM - Required before removing legacy code
**Timeline:** 30 days from production deployment (2025-10-30 → 2025-11-29)
**Dependencies:** Phase 1 complete

### Monitoring Metrics

**Target Performance:**
- Success Rate: >99%
- Processing Time: <2 seconds average
- Duplicate Rate: 0%
- Failed Events: <1% (excluding test events)

**Monitoring Queries:**
```sql
-- Daily success rate
SELECT
  DATE(created_at) as date,
  event_type,
  COUNT(*) as total,
  SUM(CASE WHEN processed THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN processed THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM stripe_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC, event_type;

-- Failed events requiring investigation
SELECT
  stripe_event_id,
  event_type,
  error,
  created_at
FROM stripe_events
WHERE NOT processed
  AND created_at > NOW() - INTERVAL '7 days'
  AND error NOT LIKE '%missing clerk_user_id%' -- Exclude test events
ORDER BY created_at DESC;

-- Check for stuck payments
SELECT
  s.id as session_id,
  s.customer,
  s.amount_total,
  s.metadata->>'clerk_user_id' as user_id,
  se.processed,
  se.error,
  se.created_at
FROM stripe.checkout_sessions s
LEFT JOIN stripe_events se ON se.stripe_event_id LIKE '%' || s.id || '%'
WHERE s.payment_status = 'paid'
  AND s.created > NOW() - INTERVAL '7 days'
ORDER BY s.created DESC;
```

**Weekly Review Checklist:**
- [ ] Check Edge Function logs via Supabase dashboard
- [ ] Run success rate query (should be >99%)
- [ ] Check for failed events (investigate if any)
- [ ] Verify no duplicate credit allocations
- [ ] Review credit allocation patterns (individual vs. team)
- [ ] Check fallback handler invocation count (should be 0 or rare)

**Exit Criteria:**
- ✅ 30 days of production operation without critical errors
- ✅ Success rate consistently >99%
- ✅ No duplicate processing detected
- ✅ Credit allocations working correctly for individuals and teams
- ✅ No customer complaints about missing credits

---

## Phase 3: Remove Legacy Zuplo Webhook Handler

**Priority:** 🟢 LOW - Cleanup after validation complete
**Timeline:** After 30-day validation period (target: 2025-12-01)
**Dependencies:** Phase 2 validation complete

### Task 3.1: Deprecate Webhook Endpoints in Zuplo

**Files to Update:**
1. `backend/config/routes.oas.json`
   - Comment out or remove `/icraft-stripe-webhook` route
   - Add deprecation notice in description

**Before:**
```json
{
  "path": "/icraft-stripe-webhook",
  "method": "POST",
  "handler": "webhook-manager.ts",
  "description": "Stripe webhook handler"
}
```

**After:**
```json
{
  "path": "/icraft-stripe-webhook",
  "method": "POST",
  "handler": "webhook-manager.ts",
  "description": "⚠️ DEPRECATED: Migrated to Supabase Edge Function. Remove after 2025-12-01.",
  "x-deprecated": true
}
```

### Task 3.2: Archive Legacy Webhook Code

**Instead of deleting, move to archive:**

```bash
# Create archive directory
mkdir -p backend/modules/archive/legacy-webhooks/

# Move deprecated webhook handler
git mv backend/modules/webhook-manager.ts \
  backend/modules/archive/legacy-webhooks/webhook-manager.ts.DEPRECATED

# Add README explaining why it was deprecated
cat > backend/modules/archive/legacy-webhooks/README.md << 'EOF'
# Legacy Webhook Handlers (Deprecated)

**Deprecated:** 2025-11-29
**Replaced By:** Supabase Edge Function (`backend/supabase/functions/stripe-webhook/`)

## Why Deprecated

1. Edge Function provides native Stripe event logging via `stripe_events` table
2. Better performance (runs closer to Supabase database)
3. Simpler deployment (no Zuplo dependency for webhooks)
4. Unified credit allocation via `allocate_credits()` function

## Files Archived

- `webhook-manager.ts.DEPRECATED` - Original Zuplo webhook handler
  - Used `process_credit_allocation_webhook()` (broken after cleanup migration)
  - Replaced by Edge Function using `allocate_credits()` directly

## Migration Timeline

- 2025-10-30: Edge Function deployed to production
- 2025-10-30 - 2025-11-29: 30-day validation period
- 2025-11-29: Legacy handler archived
- 2025-12-15: Safe to remove archived files (after additional 2 weeks)

## Rollback Procedure

If Edge Function fails and needs emergency rollback:

1. Restore webhook-manager.ts from archive
2. Fix broken functions (`verify_and_allocate_payment` calls)
3. Re-enable Zuplo webhook endpoint in routes.oas.json
4. Update Stripe webhook URL to Zuplo endpoint
EOF
```

### Task 3.3: Update Documentation

**Files to Update:**
1. `backend/docs-internal/integrations/STRIPE_DOCUMENTATION_STATUS.md`
   - Change status from "🟡 Legacy" to "✅ Archived"
   - Update deprecation timeline

2. `WEBHOOK_MIGRATION_PLAN.md`
   - Mark Phase 4 (Legacy Removal) as complete
   - Update final status

**Testing:**
- [ ] Verify Stripe webhooks still work via Edge Function
- [ ] Confirm no requests hitting old Zuplo webhook endpoint
- [ ] Check Stripe dashboard webhook endpoint configuration
- [ ] Verify application functions normally without legacy code

**Rollback:** Restore archived files and re-enable Zuplo endpoint

---

## Phase 4: Drop Deprecated Database Functions

**Priority:** 🟢 LOW - Cleanup after code fixes validated
**Timeline:** After Phase 1 fixes are tested (1-2 weeks)
**Dependencies:** Phase 1 complete and validated

### Task 4.1: Identify Deprecated Functions

**From database validation (2025-10-30 MCP queries):**

**BROKEN (call non-existent functions) - DROP IMMEDIATELY after fixes:**
1. `verify_and_allocate_payment()` - Calls non-existent `get_team_credit_balance()`
2. `process_credit_allocation_webhook()` - Calls non-existent `allocate_trial_credits_team()`
3. `add_reward_credits()` - Calls non-existent `allocate_trial_credits_team()`
4. `use_credits_for_operation(5 params)` - Calls non-existent `use_team_credits()`

**WORKING but deprecated - DROP after confirming no usage:**
5. `allocate_monthly_credits(TEXT, INTEGER)` - 2-param overload
6. `allocate_monthly_credits(TEXT, INTEGER, TEXT)` - 3-param overload
7. `process_credit_purchase_webhook()` - Used by fallback (fix first)

### Task 4.2: Verify No Active Usage

**Check backend codebase:**
```bash
cd backend

# Search for function calls
for func in \
  verify_and_allocate_payment \
  process_credit_allocation_webhook \
  process_credit_purchase_webhook \
  add_reward_credits \
  allocate_monthly_credits \
  use_credits_for_operation
do
  echo "=== Searching for: $func ==="
  grep -r "$func" modules/ --include="*.ts" | grep -v ".DEPRECATED"
done
```

**Expected Results:**
- `verify_and_allocate_payment` - Found in stripe-checkout-completion.ts (will be fixed in Phase 1)
- `process_credit_purchase_webhook` - Found in webhook-manager.ts (will be fixed/archived)
- Others - Should return 0 results

**Check frontend codebase:**
```bash
cd frontend

# These functions should never be called from frontend
# (only via backend RPC)
grep -r "verify_and_allocate_payment\|process_credit" src/ --include="*.ts" --include="*.tsx"
```

**Expected:** No results (frontend only calls `/credits/*` API endpoints)

### Task 4.3: Create Cleanup Migration

**File:** `backend/supabase/migrations/[TIMESTAMP]_drop_deprecated_credit_functions.sql`

```sql
-- Migration: Drop deprecated credit functions
-- Date: 2025-11-XX
-- Prerequisite: Phase 1 fixes deployed and validated
-- Impact: None (no active usage after fixes)

-- BROKEN functions (safe to drop after Phase 1 fixes)
DROP FUNCTION IF EXISTS public.verify_and_allocate_payment(TEXT, TEXT, INTEGER, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.process_credit_allocation_webhook(JSONB, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.add_reward_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.use_credits_for_operation(TEXT, TEXT, INTEGER, TEXT, JSONB); -- 5-param version

-- WORKING but deprecated (safe to drop after usage verification)
DROP FUNCTION IF EXISTS public.allocate_monthly_credits(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.allocate_monthly_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.process_credit_purchase_webhook(JSONB, TEXT, BIGINT);

-- Verify cleanup
DO $$
DECLARE
  v_remaining_count INTEGER;
BEGIN
  -- Count remaining deprecated credit functions
  SELECT COUNT(*) INTO v_remaining_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'verify_and_allocate_payment',
      'process_credit_allocation_webhook',
      'process_credit_purchase_webhook',
      'add_reward_credits'
    );

  IF v_remaining_count > 0 THEN
    RAISE WARNING 'Found % deprecated functions still remaining', v_remaining_count;
  ELSE
    RAISE NOTICE 'All deprecated credit functions successfully dropped';
  END IF;
END $$;

-- Create system log entry
INSERT INTO system_logs (log_type, log_message, metadata)
VALUES (
  'migration',
  'Dropped 7 deprecated credit functions',
  jsonb_build_object(
    'migration', 'drop_deprecated_credit_functions',
    'functions_dropped', ARRAY[
      'verify_and_allocate_payment',
      'process_credit_allocation_webhook',
      'process_credit_purchase_webhook',
      'add_reward_credits',
      'use_credits_for_operation (5-param)',
      'allocate_monthly_credits (2-param)',
      'allocate_monthly_credits (3-param)'
    ],
    'timestamp', NOW()
  )
);
```

### Task 4.4: Deploy Cleanup Migration

**Non-Prod First:**
```bash
cd backend/supabase

# Apply to non-prod
npx supabase db push --project-ref jjpbogjufnqzsgiiaqwn
```

**Validation Queries:**
```sql
-- Verify deprecated functions are gone
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'verify_and_allocate_payment',
    'process_credit_allocation_webhook',
    'add_reward_credits'
  );
-- Expected: 0 rows

-- Verify modern functions still exist
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'allocate_credits',
    'get_user_credit_balance',
    'get_user_team_id'
  );
-- Expected: 3 rows
```

**Production Deployment:**
```bash
# After non-prod validation (wait 1 week)
npx supabase db push --project-ref lgkjfymwvhcjvfkuidis
```

**Testing:**
- [ ] Test credit purchase (individual)
- [ ] Test credit purchase (team member)
- [ ] Test credit usage (AI generation)
- [ ] Test balance queries
- [ ] Verify no errors in application logs
- [ ] Check system_logs for migration entry

**Rollback:** Re-create dropped functions from git history if needed

---

## Phase 5: Final Validation

**Priority:** ✅ VALIDATE
**Timeline:** After Phase 4 complete
**Dependencies:** All phases complete

### Task 5.1: Comprehensive System Check

**Database Validation:**
```sql
-- 1. Count remaining credit functions (should be ~6)
SELECT COUNT(*) as modern_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%credit%' OR p.proname ILIKE '%allocate%')
  AND obj_description(p.oid) LIKE '%Consolidated%';

-- 2. Verify no broken function dependencies
SELECT
  p.proname,
  pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE pronamespace = 'public'::regnamespace
  AND pg_get_functiondef(p.oid) ILIKE ANY(ARRAY[
    '%allocate_trial_credits_team%',
    '%use_team_credits%',
    '%get_team_credit_balance%'
  ]);
-- Expected: 0 rows

-- 3. Check credit transactions health
SELECT
  DATE(created_at) as date,
  COUNT(*) as transactions,
  SUM(amount) FILTER (WHERE amount > 0) as credits_added,
  SUM(amount) FILTER (WHERE amount < 0) as credits_used
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Backend Code Validation:**
```bash
cd backend

# Verify no references to deprecated functions
echo "Checking for deprecated function calls..."
DEPRECATED_FUNCS=(
  "verify_and_allocate_payment"
  "process_credit_allocation_webhook"
  "allocate_trial_credits_team"
  "use_team_credits"
  "get_team_credit_balance"
)

for func in "${DEPRECATED_FUNCS[@]}"; do
  matches=$(grep -r "$func" modules/ --include="*.ts" | grep -v ".DEPRECATED" | wc -l)
  if [ $matches -gt 0 ]; then
    echo "❌ Found $matches references to $func"
  else
    echo "✅ No references to $func"
  fi
done
```

**Documentation Validation:**
```bash
# Check documentation alignment
cd .

# All status docs should show completion
grep -E "Status:|Complete|Broken|Partial" \
  CREDIT_SYSTEM_CONSOLIDATION_PLAN.md \
  backend/CREDIT_SYSTEM_CONSOLIDATED.md \
  STRIPE_DOCUMENTATION_STATUS.md
```

### Task 5.2: Update Status Documents

**Files to Update:**

1. **`CREDIT_SYSTEM_CONSOLIDATION_PLAN.md`**
   ```markdown
   **Status:** ✅ 90% Complete (Database + Backend complete, Frontend Phase 3 deferred)

   ### Phase 2: Backend Layer - ✅ 100% Complete
   - ✅ Modern functions deployed
   - ✅ 2 broken modules fixed (2025-11-XX)
   - ✅ 7 deprecated functions dropped (2025-11-XX)
   - ✅ All backend code using consolidated functions
   ```

2. **`backend/CREDIT_SYSTEM_CONSOLIDATED.md`**
   ```markdown
   **Status:** ✅ Production-Ready (Database validated, backend complete)

   ## ✅ PRODUCTION ISSUES RESOLVED

   **Fixed (2025-11-XX):**
   - ✅ Credit purchase handler updated to use `allocate_credits()`
   - ✅ Webhook fallback handler updated
   - ✅ 7 deprecated functions dropped from database
   ```

3. **`TODO.md`**
   ```markdown
   ## ✅ Recently Completed

   ### November 2025
   - [x] Fix broken credit purchase handler - Team member purchases now work
   - [x] Drop deprecated database functions - Cleanup complete
   - [x] Remove legacy Zuplo webhook handler - Migrated to Edge Function
   ```

4. **`DOCUMENTATION_ALIGNMENT_CHECKLIST.md`**
   - Update status to "✅ Aligned and Complete"
   - Update change log with cleanup completion date

### Task 5.3: Create Completion Report

**File:** `CREDIT_SYSTEM_CONSOLIDATION_COMPLETE.md`

```markdown
# Credit System Consolidation - Completion Report

**Date:** 2025-11-XX
**Status:** ✅ COMPLETE (90%)

## Summary

Successfully consolidated credit system from 18+ functions to 6 core functions.
All backend code updated, deprecated functions removed, legacy webhooks archived.

## What Was Accomplished

### Database Layer (100%)
- ✅ Universal `allocate_credits()` function deployed
- ✅ Auto-detection via `get_user_team_id()`
- ✅ Pure ledger model validated
- ✅ 7 deprecated functions dropped

### Backend Layer (100%)
- ✅ Fixed 2 broken production modules
- ✅ All modules using modern functions
- ✅ Legacy webhook handler archived
- ✅ Idempotency handled correctly

### Frontend Layer (0% - Deferred)
- Phase 3 deferred to future sprint
- Current frontend works with consolidated backend

## Validation Results

- Credit purchases: ✅ Working (individual + team)
- Credit usage: ✅ Working (AI generation)
- Balance queries: ✅ Working (auto-detects team)
- Idempotency: ✅ Working (no duplicates)
- Performance: ✅ Acceptable (<2s average)

## Next Steps

1. Monitor production for 2 weeks
2. Consider Phase 3 (Frontend i18n) for future sprint
3. Archive outdated documentation
```

---

## Risk Assessment

### High Risk
- ❌ None (all changes are fixes or cleanup)

### Medium Risk
- ⚠️ Credit purchase flow changes (mitigated by testing in non-prod first)
- ⚠️ Removing legacy webhook handler (mitigated by 30-day validation period)

### Low Risk
- ✅ Dropping deprecated database functions (no active usage)
- ✅ Documentation updates (no code impact)

---

## Rollback Procedures

### Phase 1: Fix Broken Code
**Rollback:** `git revert <commit-hash>`
- Restores broken functions (not ideal but safe)
- Will break team member credit purchases again
- Use only if new code causes worse issues

### Phase 2: Validation Period
**Rollback:** N/A (monitoring only, no changes)

### Phase 3: Remove Legacy Webhook
**Rollback:** Restore from archive
```bash
git mv backend/modules/archive/legacy-webhooks/webhook-manager.ts.DEPRECATED \
  backend/modules/webhook-manager.ts
# Update Stripe webhook URL back to Zuplo
# Re-enable route in routes.oas.json
```

### Phase 4: Drop Database Functions
**Rollback:** Re-create functions from git history
```bash
git show <commit-before-drop>:backend/supabase/migrations/xxx.sql | \
  npx supabase db execute --project-ref <project-id>
```

---

## Success Criteria

### Phase 1 Success
- ✅ Individual users can purchase credits
- ✅ Team members can purchase credits (credits to team pool)
- ✅ No duplicate credit allocations
- ✅ Fallback handler works
- ✅ All tests pass

### Phase 2 Success
- ✅ 30 days without critical errors
- ✅ Success rate >99%
- ✅ No customer complaints

### Phase 3 Success
- ✅ Legacy webhook removed
- ✅ Application works normally
- ✅ No requests to old endpoint

### Phase 4 Success
- ✅ Deprecated functions dropped
- ✅ Application works normally
- ✅ Credit purchases work
- ✅ Credit usage works

### Phase 5 Success
- ✅ Documentation aligned
- ✅ No broken function dependencies
- ✅ Completion report written
- ✅ 90% consolidation achieved

---

## Timeline Summary

| Phase | Priority | Duration | Start Date | Target End |
|-------|----------|----------|------------|------------|
| 1. Fix Broken Code | 🔴 CRITICAL | 3-5 days | 2025-10-31 | 2025-11-05 |
| 2. Validation | 🟡 MEDIUM | 30 days | 2025-10-30 | 2025-11-29 |
| 3. Remove Legacy | 🟢 LOW | 2-3 days | 2025-12-01 | 2025-12-03 |
| 4. Drop Functions | 🟢 LOW | 1 day | 2025-11-06 | 2025-11-06 |
| 5. Final Validation | ✅ VALIDATE | 1 day | 2025-12-04 | 2025-12-04 |

**Total Duration:** ~5 weeks (overlapping phases)
**Critical Path:** Phase 1 → Phase 4 (1 week for urgent fixes)

---

## References

- [CREDIT_SYSTEM_CONSOLIDATION_PLAN.md](./CREDIT_SYSTEM_CONSOLIDATION_PLAN.md) - Overall plan
- [backend/CREDIT_SYSTEM_CONSOLIDATED.md](./backend/CREDIT_SYSTEM_CONSOLIDATED.md) - Implementation details
- [WEBHOOK_MIGRATION_PLAN.md](./WEBHOOK_MIGRATION_PLAN.md) - Webhook migration strategy
- [DOCUMENTATION_ALIGNMENT_CHECKLIST.md](./DOCUMENTATION_ALIGNMENT_CHECKLIST.md) - Alignment verification

---

**Last Updated:** 2025-10-30
**Next Review:** After Phase 1 completion (target: 2025-11-05)
