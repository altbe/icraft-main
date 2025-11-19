# Stripe Dispute & Chargeback Integration Analysis

**Date:** 2025-01-11
**Status:** Gap Analysis Complete
**Priority:** 🔴 HIGH - Missing critical dispute handling logic

---

## Executive Summary

Our Stripe integration is **missing dispute and chargeback handling**, which exposes us to significant financial and operational risks. When customers dispute payments:

1. ❌ **No webhook handlers** for dispute events (`charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`)
2. ❌ **No credit reversal logic** when disputes are filed or lost
3. ❌ **No automated evidence submission** workflow
4. ❌ **No monitoring** for dispute rates (card networks have thresholds)
5. ❌ **No notification system** to alert admins about disputes

---

## How Stripe Disputes Work

### Dispute Lifecycle

```
Customer Files Dispute
         ↓
[charge.dispute.created] ← Webhook fires here
         ↓
Stripe IMMEDIATELY debits:
  - Disputed amount (from your balance)
  - Dispute fee ($15-$20 USD, non-refundable*)
         ↓
Evidence Submission Window (7-21 days)
         ↓
[charge.dispute.updated] ← Webhook fires when evidence submitted
         ↓
Issuer Review (60-75 days)
         ↓
[charge.dispute.closed] ← Webhook fires with outcome
         ↓
      Outcome:
      - WON: Funds returned to your account
      - LOST: Funds stay with customer
```

**Timeline:** 2-3 months from dispute to resolution
**Dispute Fee:** $15 USD (US businesses), refunded only if you WIN

---

## Critical Stripe Webhook Events

### 1. `charge.dispute.created` (CRITICAL - Not Implemented)

**When:** Customer files dispute with their bank
**Stripe Action:** Immediately debits disputed amount + fee from your balance
**Your Action Required:**
- ✅ Log dispute in database
- ✅ Notify admins immediately
- ✅ **Flag credits as disputed** (prevent further usage if balance is negative)
- ✅ Create alert for evidence deadline

**Current State:** ❌ Not handled

---

### 2. `charge.dispute.updated` (Warning - Not Implemented)

**When:** Dispute is updated (usually evidence submission)
**Stripe Action:** Updates dispute status
**Your Action Required:**
- ✅ Log update in database
- ✅ Track evidence submission

**Current State:** ❌ Not handled

---

### 3. `charge.dispute.closed` (CRITICAL - Not Implemented)

**When:** Issuer makes final decision (won or lost)
**Stripe Action:**
- **WON:** Returns disputed amount (not fee) to your balance
- **LOST:** No action (funds already debited)

**Your Action Required:**
- ✅ **If LOST:** Deduct credits that were already used (if any)
- ✅ **If WON:** Restore credits if they were frozen
- ✅ Update subscription status
- ✅ Log outcome in database
- ✅ Notify admins

**Current State:** ❌ Not handled

---

## Financial Impact Analysis

### What Happens When a Dispute Occurs

#### Scenario 1: User Purchases 300 Credits ($30), Then Disputes
```
1. User pays $30 → 300 credits allocated ✅ (handled by checkout webhook)
2. User uses 50 credits for AI generation ✅
3. User files dispute 30 days later ❌ (NOT HANDLED)
4. Stripe debits $30 + $15 fee = $45 from our balance ❌ (NOT DETECTED)
5. User still has 250 credits remaining ❌ (NOT REVERSED)
6. Dispute resolves 60 days later as LOST ❌ (NOT DETECTED)

RESULT: We lost $45 + 50 credits worth of AI costs (~$5) = $50 total loss
```

#### Scenario 2: User Disputes Subscription Renewal
```
1. User subscribes to Team Plan ($29/month, 300 credits/month)
2. Renewal payment succeeds → 300 credits allocated ✅
3. User uses 150 credits over 2 weeks ✅
4. User disputes renewal charge ❌ (NOT HANDLED)
5. Stripe debits $29 + $15 fee = $44 ❌ (NOT DETECTED)
6. User continues using remaining 150 credits ❌ (NOT BLOCKED)
7. Dispute resolves as LOST 60 days later ❌ (NOT DETECTED)

RESULT: We lost $44 + 150 credits worth of AI costs (~$15) = $59 total loss
```

### Risk Multiplier
If 2% of payments are disputed (industry average):
- **$10,000/month revenue** = $200 disputed
- **$200 disputed** + $300 dispute fees = **$500/month loss**
- **Plus** AI costs for credits used after dispute = **$600-800/month total loss**

---

## Current Implementation Status

### ✅ What We Handle (Working)

1. **Payment Success** - `invoice.payment_succeeded`
   - Allocates credits via `allocate_credits()` function
   - Creates credit transaction record
   - Updates subscription cache

2. **Payment Failed** - `invoice.payment_failed`
   - Logs failure in activity logs
   - Updates subscription status to `past_due`
   - ⚠️ Does NOT reverse credits already allocated

3. **Subscription Canceled** - `customer.subscription.deleted`
   - Logs cancellation
   - Updates cache
   - ⚠️ Does NOT handle remaining credit balance

---

### ❌ What We're Missing (Gaps)

1. **Dispute Created** - `charge.dispute.created`
   - No handler exists
   - No credit freezing logic
   - No admin notification
   - No deadline tracking

2. **Dispute Closed** - `charge.dispute.closed`
   - No handler exists
   - No credit reversal for lost disputes
   - No credit restoration for won disputes
   - No financial reconciliation

3. **Refunds** - `charge.refunded`
   - No handler exists
   - No credit reversal logic
   - Refunds don't reverse credits

---

## Stripe Best Practices (Official Recommendations)

### 1. Automated Webhook Monitoring
✅ **Recommendation:** Implement automated systems that listen to webhook events to alert you about refunds and disputes
❌ **Our Status:** Only handle subscription events, no dispute events

### 2. Evidence Collection
✅ **Recommendation:** Create a form for businesses to upload information and evidence to counter disputes
❌ **Our Status:** No evidence collection system

### 3. Deadline Management
✅ **Recommendation:** Companies that address disputes within 24 hours win back over 60% of chargeback claims
❌ **Our Status:** No deadline tracking or alerts

### 4. Early Fraud Warnings (EFW)
✅ **Recommendation:** Listen for early fraud warning webhooks - a refund can prevent a fraud report when processed as a reversal (within 2 hours)
❌ **Our Status:** No EFW webhook handlers

### 5. Dispute Rate Monitoring
✅ **Recommendation:** Monitor dispute rates to avoid card network monitoring programs (Visa/Mastercard thresholds)
❌ **Our Status:** No dispute rate tracking

---

## Implementation Plan

### Phase 1: Critical Loss Prevention (Priority: 🔴 URGENT)

#### 1.1 Add Dispute Event Handlers

**File:** `backend/supabase/functions/stripe-webhook/index.ts:76`

```typescript
// Add to switch statement
case 'charge.dispute.created':
  result = await handleDisputeCreated(event.data.object, webhookEventId);
  break;
case 'charge.dispute.closed':
  result = await handleDisputeClosed(event.data.object, webhookEventId);
  break;
case 'charge.refunded':
  result = await handleChargeRefunded(event.data.object, webhookEventId);
  break;
```

#### 1.2 Create Database Functions

**File:** `backend/sql/stripe-dispute-handling.sql`

```sql
-- Log dispute in database
CREATE OR REPLACE FUNCTION log_stripe_dispute(
  p_dispute_id TEXT,
  p_charge_id TEXT,
  p_amount INTEGER,
  p_reason TEXT,
  p_status TEXT,
  p_user_id TEXT,
  p_metadata JSONB
) RETURNS UUID AS $$
DECLARE
  v_dispute_record_id UUID;
BEGIN
  INSERT INTO stripe_disputes (
    dispute_id,
    charge_id,
    amount,
    reason,
    status,
    user_id,
    metadata,
    created_at
  ) VALUES (
    p_dispute_id,
    p_charge_id,
    p_amount,
    p_reason,
    p_status,
    p_user_id,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_dispute_record_id;

  RETURN v_dispute_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reverse credits for lost dispute
CREATE OR REPLACE FUNCTION reverse_credits_for_dispute(
  p_user_id TEXT,
  p_dispute_id TEXT,
  p_amount INTEGER,
  p_description TEXT
) RETURNS JSONB AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance INTEGER;
BEGIN
  -- Check current balance
  SELECT get_user_credit_balance(p_user_id) INTO v_current_balance;

  -- Create negative transaction (credit reversal)
  INSERT INTO credit_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    entity_type,
    entity_id,
    metadata,
    status
  ) VALUES (
    p_user_id,
    -p_amount, -- Negative amount = deduction
    'dispute_reversal',
    p_description,
    'stripe_dispute',
    p_dispute_id,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'reversal_reason', 'dispute_lost',
      'previous_balance', v_current_balance
    ),
    'completed'
  ) RETURNING id INTO v_transaction_id;

  -- Log activity
  INSERT INTO activity_logs (
    user_id,
    activity_type,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'credits_reversed',
    p_description,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'amount_reversed', p_amount,
      'transaction_id', v_transaction_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'credits_reversed', p_amount,
    'new_balance', v_current_balance - p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 1.3 Create Disputes Table

**File:** `backend/sql/migrations/create_stripe_disputes_table.sql`

```sql
CREATE TABLE IF NOT EXISTS stripe_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id TEXT UNIQUE NOT NULL,
  charge_id TEXT NOT NULL,
  payment_intent_id TEXT,
  amount INTEGER NOT NULL, -- Amount disputed in cents
  currency TEXT DEFAULT 'usd',
  reason TEXT NOT NULL, -- fraud, duplicate, product_not_received, etc.
  status TEXT NOT NULL, -- warning_needs_response, needs_response, under_review, won, lost
  user_id TEXT REFERENCES user_profiles(id),
  team_id TEXT REFERENCES teams(id),
  evidence_deadline TIMESTAMPTZ,
  evidence_submitted BOOLEAN DEFAULT false,
  evidence_submitted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  outcome TEXT, -- won, lost
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_disputes_user_id ON stripe_disputes(user_id);
CREATE INDEX idx_stripe_disputes_status ON stripe_disputes(status);
CREATE INDEX idx_stripe_disputes_charge_id ON stripe_disputes(charge_id);
CREATE INDEX idx_stripe_disputes_evidence_deadline ON stripe_disputes(evidence_deadline) WHERE status IN ('warning_needs_response', 'needs_response');

-- Trigger for updated_at
CREATE TRIGGER update_stripe_disputes_updated_at
  BEFORE UPDATE ON stripe_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Phase 2: Credit Reversal Logic (Priority: 🟡 HIGH)

#### 2.1 Implement Credit Reversal Handler

**Edge Function Handler:** `handleDisputeCreated()`

```typescript
async function handleDisputeCreated(dispute: Stripe.Dispute, webhookEventId: string) {
  console.log(`Dispute created: ${dispute.id}`);

  // Extract charge details
  const chargeId = dispute.charge;
  const paymentIntentId = dispute.payment_intent;
  const amount = dispute.amount;
  const reason = dispute.reason;

  // Find user associated with this charge
  const { data: chargeData } = await supabase
    .from('stripe_events')
    .select('data')
    .eq('object_id', chargeId)
    .eq('event_type', 'charge.succeeded')
    .single();

  if (!chargeData) {
    console.error(`Cannot find charge ${chargeId} in stripe_events`);
    return { success: false, error: 'Charge not found' };
  }

  const clerkUserId = chargeData.data.metadata?.clerk_user_id;
  if (!clerkUserId) {
    console.error(`No clerk_user_id in charge metadata: ${chargeId}`);
    return { success: false, error: 'User ID not found' };
  }

  // Calculate evidence deadline (typically 7-21 days)
  const evidenceDeadline = new Date(dispute.evidence_details.due_by * 1000);

  // Log dispute in database
  const { data: disputeRecord, error: logError } = await supabase.rpc('log_stripe_dispute', {
    p_dispute_id: dispute.id,
    p_charge_id: chargeId,
    p_amount: amount,
    p_reason: reason,
    p_status: dispute.status,
    p_user_id: clerkUserId,
    p_metadata: {
      payment_intent_id: paymentIntentId,
      evidence_deadline: evidenceDeadline.toISOString(),
      webhook_event_id: webhookEventId
    }
  });

  if (logError) {
    console.error('Failed to log dispute:', logError);
    throw new Error(`Dispute logging failed: ${logError.message}`);
  }

  // Send admin notification (via Supabase edge function or email service)
  await sendDisputeNotification({
    disputeId: dispute.id,
    userId: clerkUserId,
    amount: amount / 100, // Convert cents to dollars
    reason: reason,
    deadline: evidenceDeadline
  });

  console.log(`Dispute logged: ${dispute.id}, deadline: ${evidenceDeadline}`);

  return {
    success: true,
    dispute_id: dispute.id,
    evidence_deadline: evidenceDeadline,
    webhook_event_id: webhookEventId
  };
}

async function handleDisputeClosed(dispute: Stripe.Dispute, webhookEventId: string) {
  console.log(`Dispute closed: ${dispute.id}, status: ${dispute.status}`);

  // Get dispute record
  const { data: disputeRecord } = await supabase
    .from('stripe_disputes')
    .select('*')
    .eq('dispute_id', dispute.id)
    .single();

  if (!disputeRecord) {
    console.error(`Dispute ${dispute.id} not found in database`);
    return { success: false, error: 'Dispute not found' };
  }

  const outcome = dispute.status; // 'won' or 'lost'
  const clerkUserId = disputeRecord.user_id;

  // Update dispute record
  await supabase
    .from('stripe_disputes')
    .update({
      status: dispute.status,
      outcome: outcome,
      closed_at: new Date().toISOString()
    })
    .eq('dispute_id', dispute.id);

  if (outcome === 'lost') {
    // Calculate credits to reverse based on charge amount
    const chargeAmount = dispute.amount; // in cents

    // Find original credit allocation
    const { data: creditTx } = await supabase
      .from('credit_transactions')
      .select('amount, metadata')
      .eq('entity_type', 'stripe_charge')
      .eq('entity_id', dispute.charge)
      .eq('transaction_type', 'purchase')
      .single();

    if (creditTx) {
      const creditsToReverse = creditTx.amount;

      // Reverse credits
      const { data: reversalResult, error: reversalError } = await supabase.rpc('reverse_credits_for_dispute', {
        p_user_id: clerkUserId,
        p_dispute_id: dispute.id,
        p_amount: creditsToReverse,
        p_description: `Credits reversed - Dispute lost: ${dispute.id}`
      });

      if (reversalError) {
        console.error('Failed to reverse credits:', reversalError);
        return { success: false, error: reversalError.message };
      }

      console.log(`Reversed ${creditsToReverse} credits for lost dispute ${dispute.id}`);

      return {
        success: true,
        outcome: 'lost',
        credits_reversed: creditsToReverse,
        webhook_event_id: webhookEventId
      };
    }
  } else if (outcome === 'won') {
    // Log activity - no credit action needed (credits were never frozen)
    await supabase.from('activity_logs').insert({
      user_id: clerkUserId,
      activity_type: 'dispute_won',
      description: `Dispute ${dispute.id} won - no action required`,
      metadata: {
        dispute_id: dispute.id,
        webhook_event_id: webhookEventId
      }
    });

    console.log(`Dispute ${dispute.id} won - no credit reversal needed`);
  }

  return {
    success: true,
    outcome: outcome,
    webhook_event_id: webhookEventId
  };
}

async function handleChargeRefunded(charge: Stripe.Charge, webhookEventId: string) {
  console.log(`Charge refunded: ${charge.id}`);

  const refundAmount = charge.amount_refunded;
  const clerkUserId = charge.metadata?.clerk_user_id;

  if (!clerkUserId) {
    console.error(`No clerk_user_id in refunded charge metadata: ${charge.id}`);
    return { success: false, error: 'User ID not found' };
  }

  // Find original credit allocation
  const { data: creditTx } = await supabase
    .from('credit_transactions')
    .select('amount')
    .eq('entity_type', 'stripe_charge')
    .eq('entity_id', charge.id)
    .eq('transaction_type', 'purchase')
    .single();

  if (creditTx) {
    // Calculate proportional credit reversal
    const totalCharge = charge.amount;
    const creditsToReverse = Math.floor((refundAmount / totalCharge) * creditTx.amount);

    // Reverse credits
    const { error: reversalError } = await supabase.rpc('reverse_credits_for_dispute', {
      p_user_id: clerkUserId,
      p_dispute_id: charge.id, // Use charge ID since no dispute ID
      p_amount: creditsToReverse,
      p_description: `Credits reversed - Refund issued: $${refundAmount / 100}`
    });

    if (reversalError) {
      console.error('Failed to reverse credits for refund:', reversalError);
      return { success: false, error: reversalError.message };
    }

    console.log(`Reversed ${creditsToReverse} credits for refund on charge ${charge.id}`);

    return {
      success: true,
      credits_reversed: creditsToReverse,
      refund_amount: refundAmount,
      webhook_event_id: webhookEventId
    };
  }

  return {
    success: true,
    skipped: true,
    reason: 'No credit allocation found',
    webhook_event_id: webhookEventId
  };
}
```

---

### Phase 3: Admin Notifications (Priority: 🟢 MEDIUM)

#### 3.1 Email Notification System

Create Supabase Edge Function or use email service (SendGrid, Resend) to notify admins:

**Notification Triggers:**
- Dispute created (immediate alert)
- Evidence deadline approaching (3 days before)
- Dispute closed (outcome notification)

#### 3.2 Dashboard Integration

Add dispute monitoring dashboard:
- Active disputes list
- Evidence submission status
- Dispute rate metrics
- Financial impact summary

---

### Phase 4: Dispute Rate Monitoring (Priority: 🟢 MEDIUM)

#### 4.1 Calculate Dispute Rate

```sql
CREATE OR REPLACE FUNCTION get_dispute_rate(
  p_days_back INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  v_total_charges INTEGER;
  v_total_disputes INTEGER;
  v_dispute_rate NUMERIC;
BEGIN
  -- Count charges in time period
  SELECT COUNT(*) INTO v_total_charges
  FROM stripe_events
  WHERE event_type = 'charge.succeeded'
  AND created_at >= NOW() - (p_days_back || ' days')::INTERVAL;

  -- Count disputes in time period
  SELECT COUNT(*) INTO v_total_disputes
  FROM stripe_disputes
  WHERE created_at >= NOW() - (p_days_back || ' days')::INTERVAL;

  -- Calculate rate
  IF v_total_charges > 0 THEN
    v_dispute_rate := (v_total_disputes::NUMERIC / v_total_charges::NUMERIC) * 100;
  ELSE
    v_dispute_rate := 0;
  END IF;

  RETURN jsonb_build_object(
    'total_charges', v_total_charges,
    'total_disputes', v_total_disputes,
    'dispute_rate_percent', ROUND(v_dispute_rate, 2),
    'period_days', p_days_back,
    'warning_threshold', 0.9, -- Visa/Mastercard threshold
    'at_risk', v_dispute_rate >= 0.9
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Risk Assessment

### Current Risk Level: 🔴 **HIGH**

| Risk Factor | Impact | Likelihood | Severity |
|------------|--------|------------|----------|
| **Financial Loss** | Credits used after dispute | High | Critical |
| **Fraud Exploitation** | Bad actors exploit lack of reversal | Medium | High |
| **Card Network Penalties** | High dispute rate triggers monitoring | Low | Critical |
| **Operational Blindness** | No visibility into disputes | High | Medium |

---

## Success Metrics

### Phase 1 Success Criteria
- ✅ All dispute webhook events logged in database
- ✅ Admin notifications sent within 5 minutes of dispute
- ✅ Credit reversals processed within 24 hours of lost dispute
- ✅ Zero manual intervention required for standard disputes

### Phase 2 Success Criteria
- ✅ Dispute rate < 0.5% (well below 0.9% threshold)
- ✅ Evidence submission rate > 80%
- ✅ Dispute win rate > 40%
- ✅ Financial loss from disputes < $100/month

---

## Testing Plan

### Test Scenario 1: Dispute Created (Stripe Test Mode)
```bash
# Use Stripe CLI to trigger test dispute
stripe trigger charge.dispute.created

# Expected results:
# 1. Webhook received and logged
# 2. Dispute record created in database
# 3. Admin notification sent
# 4. Evidence deadline calculated
```

### Test Scenario 2: Lost Dispute
```bash
# Trigger dispute closed event with 'lost' status
stripe trigger charge.dispute.closed --override status=lost

# Expected results:
# 1. Dispute record updated with outcome
# 2. Credits reversed via negative transaction
# 3. Activity log created
# 4. Admin notified of loss
```

### Test Scenario 3: Won Dispute
```bash
# Trigger dispute closed event with 'won' status
stripe trigger charge.dispute.closed --override status=won

# Expected results:
# 1. Dispute record updated with outcome
# 2. No credit reversal (funds returned by Stripe)
# 3. Activity log created
# 4. Admin notified of win
```

---

## Timeline & Effort Estimate

| Phase | Tasks | Estimated Effort | Priority |
|-------|-------|------------------|----------|
| **Phase 1** | Webhook handlers + DB functions + disputes table | 8-12 hours | 🔴 URGENT |
| **Phase 2** | Credit reversal logic + testing | 6-8 hours | 🟡 HIGH |
| **Phase 3** | Admin notifications + dashboard | 4-6 hours | 🟢 MEDIUM |
| **Phase 4** | Dispute rate monitoring + alerts | 3-4 hours | 🟢 MEDIUM |
| **TOTAL** | | **21-30 hours** | |

---

## Related Documentation

- [Stripe Disputes Documentation](https://docs.stripe.com/disputes)
- [Stripe Webhook Events](https://docs.stripe.com/api/events/types)
- [Credit System Architecture](backend/CREDIT_SYSTEM_CONSOLIDATED.md)
- [Stripe Integration Architecture](backend/STRIPE_INTEGRATION_ARCHITECTURE.md)

---

## Questions for Stakeholders

1. **Credit Reversal Policy:** Should we reverse credits immediately when a dispute is created, or wait until it's lost?
   - **Recommendation:** Wait until lost (innocent until proven guilty)

2. **Negative Balance Handling:** What happens if user's balance goes negative after reversal?
   - **Recommendation:** Allow negative balance, block new AI operations until resolved

3. **Evidence Submission:** Should we automate evidence submission or handle manually?
   - **Recommendation:** Manual for now (requires human judgment), automate common cases later

4. **Refund Policy:** Should refunds automatically reverse credits?
   - **Recommendation:** Yes, proportional to refund amount

5. **Dispute Prevention:** Should we implement fraud detection before disputes occur?
   - **Recommendation:** Phase 5 - integrate Stripe Radar rules

---

## Conclusion

**Immediate Action Required:** Implement Phase 1 (webhook handlers + credit reversal) within the next sprint to prevent ongoing financial losses. Current implementation leaves us vulnerable to dispute fraud and has no visibility into chargebacks.

**Estimated Monthly Savings:** $500-800/month (assuming 2% dispute rate on $10k revenue)
**Implementation Priority:** 🔴 CRITICAL - Should be prioritized over non-essential features
