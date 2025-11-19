# Stripe Event Automation - Comprehensive Architecture Plan

**Created**: 2025-11-07
**Status**: 📝 **PLANNING** - Architecture design for systematic webhook and cron automation
**Priority**: 🔴 **CRITICAL** - 71% of subscription webhooks failing, cancellations not persisted

---

## Executive Summary

**Problem**: Stripe-initiated subscription changes (cancellations, plan changes, status transitions) are not systematically synchronized to the database, causing data integrity issues.

**Current Failure Rate**: **79.2%** for subscription lifecycle events (19 failed out of 24 events in last 30 days)

**Impact**:
- Canceled subscriptions show as "active" in database
- Users missing credits after plan changes
- Frontend displays incorrect subscription status
- No audit trail for Stripe-initiated changes
- Manual remediation required for affected users

**Root Causes**:
1. **Missing Metadata**: 71% of subscription webhooks fail due to missing `clerk_user_id` in Stripe metadata
2. **Incomplete Webhook Handlers**: Webhooks update cache only, don't call database state machine
3. **No Fallback Mechanism**: Cron job doesn't detect cancellations or metadata changes
4. **Architectural Gap**: Webhook and cron responsibilities not clearly defined

**Proposed Solution**:
- **Defense-in-Depth Architecture** with three layers: webhooks (real-time), cron (safety net), manual tools (recovery)
- **Graceful Degradation** with database fallback lookups for missing metadata
- **Clear Responsibility Boundaries** between webhook and cron components
- **Comprehensive Event Coverage** for all Stripe subscription lifecycle events

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architecture Principles](#architecture-principles)
3. [Proposed Architecture](#proposed-architecture)
4. [Audit Trail Architecture](#audit-trail-architecture)
5. [Event Routing Matrix](#event-routing-matrix)
6. [Implementation Phases](#implementation-phases)
7. [Testing Strategy](#testing-strategy)
8. [Monitoring and Alerting](#monitoring-and-alerting)
9. [Rollback Plan](#rollback-plan)
10. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Webhook Success Rates (Last 30 Days)

| Event Type | Total | Success | Failed | Missing Metadata | Success Rate |
|------------|-------|---------|--------|------------------|--------------|
| **Subscription Events** |
| `customer.subscription.created` | 10 | 4 | 6 | 6 | 40% ⚠️ |
| `customer.subscription.updated` | 8 | 1 | 7 | 6 | 12.5% 🔴 |
| `customer.subscription.deleted` | 6 | 0 | 6 | 5 | **0%** 🔴 |
| **Subtotal** | **24** | **5** | **19** | **17** | **20.8%** |
| **Payment Events** |
| `invoice.payment_succeeded` | 12 | 12 | 0 | 0 | 100% ✅ |
| `invoice.finalized` | 12 | 12 | 0 | 0 | 100% ✅ |
| `payment_intent.succeeded` | 5 | 5 | 0 | 0 | 100% ✅ |
| **Subtotal** | **29** | **29** | **0** | **0** | **100%** |
| **Other Events** |
| `customer.created` | 12 | 12 | 0 | 0 | 100% ✅ |
| `customer.updated` | 23 | 23 | 0 | 0 | 100% ✅ |
| **TOTAL** | **88** | **69** | **19** | **17** | **78.4%** |

**Key Findings**:
- ✅ Payment events work perfectly (100% success)
- ✅ Customer events work perfectly (100% success)
- 🔴 **Subscription events catastrophically broken** (20.8% success)
- 🔴 **Root cause**: 89% of failures due to missing `clerk_user_id` metadata

### Current Architecture Components

#### 1. Supabase Edge Function (Webhook Handler)

**Location**: `backend/supabase/functions/stripe-webhook/index.ts`

**Current Handlers**:
```typescript
✅ customer.subscription.created    → Cache update only
⚠️  customer.subscription.updated   → Cache update + state machine (trial→active only, 2025-11-07)
🔴 customer.subscription.deleted    → Cache update only (NO DB UPDATE)
✅ invoice.payment_succeeded        → Cache update + credit allocation
🔴 invoice.payment_failed           → Cache update only
✅ checkout.session.completed       → Logging only
```

**Current Behavior**:
- **Metadata Validation**: REQUIRED `clerk_user_id` (throws error if missing)
- **Cache Updates**: Always updates `subscription_cache` table (5-minute TTL)
- **State Machine**: Only called for trial→active transitions (as of 2025-11-07)
- **Activity Logs**: Creates `activity_logs` entries for some events
- **Idempotency**: Tracks processed events in `stripe_events` table

**Gaps**:
- ❌ Cancellations don't update `subscriptions` table
- ❌ No fallback for missing metadata (webhook fails completely)
- ❌ Plan upgrades/downgrades not detected
- ❌ Metadata changes not synced to database
- ❌ No retry logic for partial failures

#### 2. pg_cron Jobs (Scheduled Sync)

**Location**: Database-internal, configured via `cron.schedule()`

**Current Jobs**:

| Job Name | Schedule | Function | Purpose |
|----------|----------|----------|---------|
| `sync-expired-subscriptions` | Hourly (0 * * * *) | `scheduled_subscription_sync()` | Sync expired trials and renewals |
| `daily-subscription-summary` | Daily 9 AM UTC | `daily_subscription_summary()` | Health monitoring and alerts |

**What Cron Handles**:
- ✅ Expired trials (status='trialing', period_end < NOW)
- ✅ Expired active periods (status='active', period_end < NOW)
- ✅ Batch sync via `sync_expired_subscriptions()`
- ✅ Calls `sync_subscription_from_stripe()` for each subscription
- ✅ Logs results to `system_logs` table

**What Cron Doesn't Handle**:
- ❌ **Cancellations** (canceled subs stay "active" in DB forever)
- ❌ **Metadata changes** (Stripe metadata not synced to DB)
- ❌ **Plan changes** (upgrades/downgrades not detected)
- ❌ **Immediate updates** (1-hour delay for all changes)

**Current Implementation**:
```sql
-- scheduled_subscription_sync() calls:
SELECT sync_expired_subscriptions()
  ↓
-- Finds expired subscriptions and calls:
SELECT sync_subscription_from_stripe(external_subscription_id)
  ↓
-- Queries Stripe FDW and calls:
SELECT process_subscription_state_change(...)
  ↓
-- Updates subscriptions table and allocates credits
```

#### 3. Database State Machine

**Location**: `backend/sql/migrations/013_fix_subscription_plan_lookup.sql`

**Core Function**: `process_subscription_state_change()`

**What It Does**:
- ✅ Updates `subscriptions` table status
- ✅ Updates `user_profiles.subscription_status`
- ✅ Allocates credits via `allocate_credits()`
- ✅ Automated credit lookup from `subscription_plans` table
- ✅ Creates audit trail in `credit_transactions`
- ✅ Handles all status transitions (trialing, active, past_due, canceled)
- ✅ ACID transactions with rollback

**Transition Types**:
```sql
trial_to_active      → Allocate monthly credits
active_renewal       → Allocate monthly credits
plan_upgrade         → Adjust credits (NOT IMPLEMENTED)
plan_downgrade       → No credit adjustment
active_to_past_due   → No credit change
past_due_to_active   → Resume (no new credits)
active_to_canceled   → No credit change (keep remaining credits)
```

**Wrapper Function** (2025-11-07): `process_subscription_webhook_update()`
- Translates external IDs (Stripe/Clerk) to internal UUIDs
- Calls `process_subscription_state_change()` with proper parameters
- Designed for webhook use (external ID input)

### Responsibility Matrix (Current)

| Responsibility | Webhook | Cron | Database Function |
|----------------|---------|------|-------------------|
| **Status Changes** |
| Trial → Active | ⚠️ Partial (cache only, except trial→active) | ✅ Yes (1h delay) | ✅ Yes (when called) |
| Active → Canceled | 🔴 Cache only | ❌ Not detected | ✅ Yes (when called) |
| Active → Past Due | 🔴 Cache only | ✅ Yes (1h delay) | ✅ Yes (when called) |
| Past Due → Active | 🔴 Cache only | ✅ Yes (1h delay) | ✅ Yes (when called) |
| **Credit Management** |
| Trial signup | ✅ Yes (checkout) | N/A | ✅ Yes |
| Trial → Active | ✅ Yes (2025-11-07) | ✅ Yes (fallback) | ✅ Yes |
| Monthly renewal | ✅ Yes (invoice webhook) | ✅ Yes (fallback) | ✅ Yes |
| Plan upgrade | ❌ No | ❌ No | ❌ No |
| **Metadata Sync** |
| clerk_user_id | ❌ Required but not synced | ❌ Not handled | N/A |
| Plan metadata | ❌ Not synced | ❌ Not handled | N/A |
| **Data Tables** |
| subscription_cache | ✅ Always updated | ❌ Not touched | N/A |
| subscriptions | ⚠️ Only trial→active | ✅ Yes (1h delay) | ✅ Yes |
| credit_transactions | ⚠️ Only trial→active | ✅ Yes (1h delay) | ✅ Yes |
| stripe_events | ✅ Always logged | N/A | N/A |

---

## Architecture Principles

### 1. Defense-in-Depth

**Principle**: Multiple layers of automation ensure no events are missed

**Three Layers**:
1. **Primary**: Webhooks (real-time, seconds latency)
2. **Secondary**: Cron jobs (safety net, hourly)
3. **Tertiary**: Manual tools (recovery, on-demand)

**Example Flow**:
```
User cancels subscription in Stripe
  ↓
Layer 1: Webhook processes customer.subscription.deleted (seconds)
  ↓ (if webhook fails)
Layer 2: Cron detects canceled subscription in Stripe FDW (next hour)
  ↓ (if cron fails)
Layer 3: Admin runs manual sync or SQL query (manual)
```

### 2. Graceful Degradation

**Principle**: System continues functioning even with missing/corrupted data

**Metadata Fallback Chain**:
```
1. Try Stripe subscription.metadata.clerk_user_id
   ↓ (if missing)
2. Try database subscriptions.user_id lookup by external_subscription_id
   ↓ (if missing)
3. Try database user_profiles.id lookup by stripe_customer_id
   ↓ (if still missing)
4. Log error, mark for manual review, continue processing other webhooks
```

**Status Sync Fallback**:
```
1. Try webhook real-time update
   ↓ (if webhook fails)
2. Try cron hourly sync
   ↓ (if cron fails)
3. Admin runs manual sync_subscription_from_stripe()
```

### 3. Clear Responsibility Boundaries

**Principle**: Each component has distinct, non-overlapping responsibilities

| Component | Responsibility | Trigger | Latency | Failure Mode |
|-----------|----------------|---------|---------|--------------|
| **Edge Function (Webhook)** | Real-time event processing | Stripe webhook | Seconds | Retry via Stripe (3 attempts) |
| **pg_cron (Scheduled)** | Batch reconciliation and safety net | Time-based | Minutes-Hours | Next scheduled run |
| **Database Functions** | Business logic and state management | Called by webhook/cron | N/A | ACID rollback |

**Design Rules**:
- ✅ Webhooks own real-time updates (primary path)
- ✅ Cron owns reconciliation and missed events (secondary path)
- ✅ Database functions own business logic (always called by webhook or cron)
- ❌ Never duplicate logic across webhook and cron
- ❌ Never make webhook depend on cron for primary functionality
- ✅ Always design webhook as if cron doesn't exist (primary path)
- ✅ Always design cron as if all webhooks fail (safety net)

### 4. Single Source of Truth

**Principle**: Database is authoritative for all subscription state

**Database-First Patterns**:
- ✅ Team membership: `get_user_team_id()` determines team attribution
- ✅ Credit amounts: `subscription_plans` table, not Stripe metadata
- ✅ Subscription status: `subscriptions` table, not cache
- ✅ User identity: Clerk user_id, not Stripe customer_id

**Cache Strategy**:
- `subscription_cache` is performance optimization only (5-minute TTL)
- Cache updates NEVER replace database updates
- Cache misses trigger database query, not Stripe API call
- Cache invalidation automatic via TTL, no manual management

### 5. Idempotency Everywhere

**Principle**: Processing the same event multiple times produces the same result

**Implementation**:
- ✅ `stripe_events.stripe_event_id` UNIQUE constraint (webhook level)
- ✅ `process_subscription_state_change()` checks old_status vs new_status (function level)
- ✅ `credit_transactions` INSERT-only ledger (never update)
- ✅ `subscription_events` tracks processed events (audit level)

**Example**:
```sql
-- Idempotent status change
IF v_old_status = p_new_status THEN
  RETURN jsonb_build_object('success', true, 'message', 'Status unchanged');
END IF;

-- Idempotent credit allocation (ledger model)
INSERT INTO credit_transactions (user_id, amount, source, ...)
VALUES (p_user_id, 30, 'trial_to_active', ...);
-- Running this twice adds 30 credits twice (intentional for audit)
-- Protection at higher level: webhook idempotency via stripe_event_id
```

### 6. Fail-Safe Defaults

**Principle**: Errors should bias toward safe outcomes (no data loss, no user harm)

**Error Handling Strategy**:

| Error Type | Webhook Behavior | Cron Behavior | User Impact |
|------------|------------------|---------------|-------------|
| Missing metadata | ⚠️ Try fallback lookup → Fail webhook if not found | ✅ Skip, log for manual review | 🟡 May need manual fix |
| Network timeout | ❌ Fail webhook (Stripe retries) | ✅ Retry next hour | 🟢 Auto-resolved |
| Database constraint | ❌ Fail webhook, rollback | ❌ Skip, log error | 🟡 May need schema fix |
| Stripe API error | ❌ Fail webhook | ⚠️ Skip subscription, continue batch | 🟢 Auto-resolved next hour |
| Invalid state transition | ⚠️ Log warning, continue | ⚠️ Log warning, continue | 🟢 Idempotent retry safe |

**Critical Rule**: **NEVER silently skip errors that cause data loss**

---

## Proposed Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         STRIPE                                   │
│  (Source of Truth for Payment Data)                             │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├── Webhooks (Real-time) ──────────────────────┐
             │   • customer.subscription.*                   │
             │   • invoice.*                                 │
             │   • payment_intent.*                          │
             │                                               │
             └── Foreign Data Wrapper (Batch Query) ────────┤
                 • stripe.subscriptions                      │
                 • stripe.customers                          │
                                                             │
┌────────────────────────────────────────────────────────────┴────┐
│                    SUPABASE EDGE FUNCTION                        │
│  (Webhook Handler - Real-time Event Processing)                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. Idempotency Check (stripe_events.stripe_event_id)  │    │
│  │ 2. Metadata Validation & Fallback Lookup              │    │
│  │ 3. Route Event to Handler                              │    │
│  │ 4. Call Database State Machine                         │    │
│  │ 5. Update Cache (performance layer)                    │    │
│  │ 6. Mark Event Processed                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Event Handlers:                                                │
│  • handleSubscriptionCreated()   → State machine               │
│  • handleSubscriptionUpdated()   → State machine + cache       │
│  • handleSubscriptionDeleted()   → State machine + cache       │
│  • handleInvoicePayment()        → State machine + credits     │
│  • handlePaymentFailed()         → State machine + cache       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ Calls (via RPC)
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                              │
│  (Single Source of Truth)                                        │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Database State Machine (Core Logic)              │ │
│  │                                                             │ │
│  │  process_subscription_webhook_update()                     │ │
│  │    ↓ (ID translation: external → internal)                │ │
│  │  process_subscription_state_change()                       │ │
│  │    ↓ (status transitions, credit allocation)              │ │
│  │  allocate_credits() / use_credits()                        │ │
│  │    ↓ (ledger transactions)                                 │ │
│  │  [Updates subscriptions, user_profiles, credit_txns]      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Tables:                                                          │
│  • subscriptions              (authoritative status)             │
│  • subscription_cache         (5-min perf cache)                 │
│  • credit_transactions        (ledger model)                     │
│  • stripe_events              (webhook idempotency)              │
│  • subscription_events        (audit trail)                      │
│  • system_logs                (cron results)                     │
└───────────────────────┬───────────────────────────────────────────┘
                        │
                        │ Scheduled Queries (pg_cron)
                        ↓
┌──────────────────────────────────────────────────────────────────┐
│                    PG_CRON JOBS                                   │
│  (Safety Net - Reconciliation & Monitoring)                      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Hourly: sync-expired-subscriptions                         │ │
│  │   • Find status='trialing', period_end < NOW               │ │
│  │   • Find status='active', period_end < NOW                 │ │
│  │   • Find canceled in Stripe but active in DB (NEW)         │ │
│  │   • Call sync_subscription_from_stripe() for each          │ │
│  │   • Log results to system_logs                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Daily: subscription-health-summary                          │ │
│  │   • Count stuck trials (>24h expired)                       │ │
│  │   • Count expired active (>48h)                             │ │
│  │   • Count failed webhooks (last 24h)                        │ │
│  │   • Create alerts if thresholds exceeded                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow Examples

#### Example 1: User Cancels Subscription (Happy Path)

```
1. User clicks "Cancel" in Stripe Customer Portal
   ↓
2. Stripe generates customer.subscription.deleted event
   ↓
3. Stripe sends webhook to Edge Function
   ↓
4. Edge Function receives event
   ├─ Check stripe_events table (idempotency)
   ├─ Validate metadata (clerk_user_id exists)
   ├─ Call handleSubscriptionDeleted()
   │  ├─ Call process_subscription_webhook_update()
   │  │  └─ Update subscriptions.status = 'canceled'
   │  │  └─ Update user_profiles.subscription_status = 'canceled'
   │  │  └─ Log to subscription_events
   │  ├─ Update subscription_cache.status = 'canceled'
   │  └─ Log to activity_logs
   └─ Mark stripe_events.processed = true
   ↓
5. Database status = 'canceled' (within seconds)
   ↓
6. Next hourly cron runs
   └─ Finds DB already synced, no action needed ✅
```

#### Example 2: User Cancels Subscription (Webhook Fails - Missing Metadata)

```
1. User clicks "Cancel" in Stripe Customer Portal
   ↓
2. Stripe generates customer.subscription.deleted event
   ↓
3. Stripe sends webhook to Edge Function
   ↓
4. Edge Function receives event
   ├─ Check stripe_events table (idempotency)
   ├─ Validate metadata (clerk_user_id MISSING)
   ├─ Try fallback lookup #1: subscriptions.user_id WHERE external_subscription_id = sub_xxx
   │  └─ Found: user_34w6diCnJofh5C9fPAIiCNNfu0o ✅
   ├─ Call handleSubscriptionDeleted() with fallback user_id
   │  ├─ Call process_subscription_webhook_update()
   │  │  └─ Update subscriptions.status = 'canceled'
   │  └─ Update subscription_cache.status = 'canceled'
   └─ Mark stripe_events.processed = true
   ↓
5. Database status = 'canceled' (within seconds) ✅
```

#### Example 3: User Cancels Subscription (All Webhooks Fail)

```
1. User clicks "Cancel" in Stripe Customer Portal
   ↓
2. Stripe generates customer.subscription.deleted event
   ↓
3. Stripe sends webhook to Edge Function
   ↓
4. Edge Function receives event
   ├─ Validate metadata (clerk_user_id MISSING)
   ├─ Try fallback lookup #1: No subscriptions row found
   ├─ Try fallback lookup #2: No user_profiles row found
   └─ Fail webhook, log error to stripe_events ❌
   ↓
5. Stripe retries webhook (3 times, exponential backoff)
   └─ All retries fail ❌
   ↓
6. stripe_events.processed = false, error = "Cannot find clerk_user_id"
   ↓
7. Database status still = 'active' (STALE) ❌
   ↓
8. Next hourly cron runs (within 60 minutes)
   ├─ Query Stripe FDW: stripe.subscriptions WHERE id = 'sub_xxx'
   ├─ Find status = 'canceled' in Stripe
   ├─ Find status = 'active' in database (mismatch detected)
   ├─ Call sync_subscription_from_stripe('sub_xxx')
   │  └─ Update subscriptions.status = 'canceled'
   │  └─ Update user_profiles.subscription_status = 'canceled'
   └─ Log to system_logs: "Synced 1 canceled subscription" ✅
   ↓
9. Database status = 'canceled' (1 hour delay but eventually consistent) ✅
```

#### Example 4: Trial Expires and Converts to Active (Invoice Payment)

```
1. Trial period ends (Stripe automatic transition)
   ↓
2. Stripe charges customer for first paid invoice
   ↓
3. Stripe generates invoice.payment_succeeded event
   ↓
4. Edge Function receives event
   ├─ Check stripe_events table (idempotency)
   ├─ Call handleInvoicePayment()
   │  ├─ Fetch subscription from Stripe
   │  ├─ Validate metadata (clerk_user_id exists)
   │  ├─ Detect status transition: trialing → active
   │  ├─ Call process_subscription_webhook_update()
   │  │  ├─ Update subscriptions.status = 'active'
   │  │  ├─ Update subscriptions.current_period_start/end
   │  │  ├─ Automated credit lookup: subscription_plans.monthly_credits = 30
   │  │  └─ Call allocate_credits(user_id, 30, 'subscription_renewal')
   │  │     └─ INSERT credit_transactions (user_id, +30, ...)
   │  └─ Update subscription_cache
   └─ Mark stripe_events.processed = true
   ↓
5. Database status = 'active', user has 30 new credits (within seconds) ✅
   ↓
6. Frontend queries /credits/balance → Returns updated balance ✅
```

---

## Audit Trail Architecture

### Overview

The system maintains **three separate event tracking tables** with distinct purposes to ensure comprehensive audit trails, debugging capability, and user activity tracking.

### Three-Layer Event Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT TRACKING LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: stripe_events (Raw Webhook Events)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Purpose: Webhook idempotency & debugging                 │  │
│  │ Created by: Edge Function (webhook handler)              │  │
│  │ Scope: ALL Stripe events (invoice, payment, customer)    │  │
│  │ Retention: 90 days                                        │  │
│  │ Key: stripe_event_id (Stripe's evt_xxx)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ webhook_event_id reference           │
│                           ↓                                      │
│  Layer 2: subscription_events (State Change Audit)             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Purpose: Subscription lifecycle audit trail              │  │
│  │ Created by: Database functions (state machine)           │  │
│  │ Scope: ONLY subscription state transitions               │  │
│  │ Retention: Forever (legal/compliance)                    │  │
│  │ Link: webhook_event_id → stripe_events.id               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ activity reference                   │
│                           ↓                                      │
│  Layer 3: activity_logs (User Activity Feed)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Purpose: User-facing activity timeline                   │  │
│  │ Created by: Edge Function + Database triggers            │  │
│  │ Scope: User actions + system notifications               │  │
│  │ Retention: 1 year                                         │  │
│  │ Displayed in: Frontend user dashboard                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Table Schemas

#### 1. stripe_events (Webhook Idempotency)

```sql
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,          -- Stripe's evt_xxx (idempotency key)
  event_type TEXT NOT NULL,                       -- e.g., 'customer.subscription.deleted'
  object_type TEXT,                               -- e.g., 'subscription'
  object_id TEXT,                                 -- e.g., 'sub_xxx'
  data JSONB NOT NULL,                            -- Full Stripe event payload
  processed BOOLEAN DEFAULT false,                -- Webhook processing status
  processed_at TIMESTAMPTZ,
  error TEXT,                                     -- Error message if failed
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint ensures idempotency
CREATE UNIQUE INDEX idx_stripe_events_event_id ON stripe_events(stripe_event_id);
```

**Purpose**:
- Prevent duplicate webhook processing (idempotency)
- Debug webhook failures
- Retry failed webhooks
- Audit raw Stripe events

**Created by**: Edge Function `stripe-webhook/index.ts` via `log_stripe_event()`

**Example**:
```json
{
  "id": "d4e5f6a7-b8c9-...",
  "stripe_event_id": "evt_1SQaiZAdM2PoHEKvlDy92Dou",
  "event_type": "customer.subscription.deleted",
  "object_type": "subscription",
  "object_id": "sub_1SPVHMAdM2PoHEKvjx1Mb3Pq",
  "processed": true,
  "created_at": "2025-11-07T09:30:00Z"
}
```

#### 2. subscription_events (State Change Audit Trail)

```sql
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id UUID,                          -- Link to stripe_events (NULL for cron)
  user_id TEXT NOT NULL,                          -- Clerk user ID
  subscription_id TEXT,                           -- Stripe subscription ID (sub_xxx)
  event_type TEXT NOT NULL,                       -- e.g., 'trial_to_active', 'scheduled_sync'
  old_state JSONB,                                -- Previous subscription state
  new_state JSONB,                                -- New subscription state
  credits_allocated INTEGER DEFAULT 0,            -- Credits added in this event
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_webhook_event
    FOREIGN KEY (webhook_event_id)
    REFERENCES stripe_events(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_subscription_events_user ON subscription_events(user_id, created_at DESC);
CREATE INDEX idx_subscription_events_subscription ON subscription_events(subscription_id, created_at DESC);
CREATE INDEX idx_subscription_events_webhook ON subscription_events(webhook_event_id) WHERE webhook_event_id IS NOT NULL;
```

**Purpose**:
- Permanent audit trail of all subscription state changes
- Track credit allocations linked to state changes
- Legal/compliance record keeping
- Link webhook events to business logic outcomes

**Created by**: Database function `process_subscription_state_change()` (called by webhook or cron)

**Event Types**:
- `trial_to_active` - Trial period ended, subscription became active
- `active_renewal` - Monthly/yearly renewal
- `active_to_canceled` - Subscription canceled
- `active_to_past_due` - Payment failed
- `past_due_to_active` - Payment recovered
- `scheduled_sync` - Cron job sync
- `manual_sync` - Admin manual sync

**Example**:
```json
{
  "id": "58104537-7a07-4830-895c-0c1d64c7910c",
  "webhook_event_id": "d4e5f6a7-b8c9-...",
  "user_id": "user_34z0ou38WMG64H549OQuXmrvzMD",
  "subscription_id": "sub_1SPVHMAdM2PoHEKvjx1Mb3Pq",
  "event_type": "trial_to_active",
  "old_state": {"status": "trialing", "period_end": "2025-11-06T21:27:10Z"},
  "new_state": {"status": "active", "period_end": "2025-12-06T21:27:10Z"},
  "credits_allocated": 30,
  "created_at": "2025-11-07T09:27:51Z"
}
```

#### 3. activity_logs (User Activity Feed)

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,                    -- e.g., 'subscription_canceled'
  description TEXT,                               -- Human-readable message
  metadata JSONB,                                 -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_type ON activity_logs(activity_type, created_at DESC);
```

**Purpose**:
- User-facing activity timeline in frontend
- Human-readable descriptions
- Customer support visibility

**Created by**: Edge Function webhook handlers + database triggers

**Example**:
```json
{
  "id": "a1b2c3d4-e5f6-...",
  "user_id": "user_34z0ou38WMG64H549OQuXmrvzMD",
  "activity_type": "subscription_canceled",
  "description": "Subscription sub_1SPVHMAdM2PoHEKvjx1Mb3Pq canceled",
  "metadata": {
    "subscription_id": "sub_1SPVHMAdM2PoHEKvjx1Mb3Pq",
    "canceled_at": 1699362030,
    "reason": "user_requested"
  },
  "created_at": "2025-11-07T09:30:00Z"
}
```

### Data Flow: Webhook to Audit Trail

```
Stripe Webhook Event (evt_xxx)
  ↓
Edge Function receives webhook
  ↓
1. INSERT stripe_events (idempotency + raw event)
   - stripe_event_id = evt_xxx
   - data = full Stripe payload
   - processed = false
  ↓
2. Call handleSubscriptionDeleted()
   ↓
3. Call process_subscription_webhook_update(webhook_event_id = stripe_events.id)
   ↓
4. Database function: process_subscription_state_change()
   ↓
5. INSERT subscription_events (state change audit)
   - webhook_event_id = stripe_events.id (LINKED)
   - event_type = 'active_to_canceled'
   - old_state = {status: 'active', ...}
   - new_state = {status: 'canceled', ...}
   - credits_allocated = 0
  ↓
6. INSERT activity_logs (user-facing activity)
   - activity_type = 'subscription_canceled'
   - description = 'Your subscription was canceled'
  ↓
7. UPDATE stripe_events SET processed = true
```

### Querying the Audit Trail

#### Complete Event History for a Subscription

```sql
SELECT
  se.created_at,
  se.event_type,
  se.old_state->>'status' as old_status,
  se.new_state->>'status' as new_status,
  se.credits_allocated,
  we.stripe_event_id,
  we.event_type as webhook_event_type,
  we.processed as webhook_processed,
  we.error as webhook_error
FROM subscription_events se
LEFT JOIN stripe_events we ON se.webhook_event_id = we.id
WHERE se.subscription_id = 'sub_1SPVHMAdM2PoHEKvjx1Mb3Pq'
ORDER BY se.created_at DESC;
```

**Example Output**:
```
created_at              | event_type      | old_status | new_status | credits | stripe_event_id      | webhook_processed
------------------------|-----------------|------------|------------|---------|----------------------|-------------------
2025-11-07 09:27:51+00 | trial_to_active | trialing   | active     | 30      | evt_1SQaiZ...        | true
2025-11-03 03:36:28+00 | trial_created   | null       | trialing   | 15      | evt_1SPEZD...        | true
```

#### Find All Webhook-Driven vs Cron-Driven Events

```sql
-- Webhook-driven events (real-time)
SELECT COUNT(*) as webhook_events
FROM subscription_events
WHERE webhook_event_id IS NOT NULL;

-- Cron-driven events (safety net)
SELECT COUNT(*) as cron_events
FROM subscription_events
WHERE webhook_event_id IS NULL;
```

#### Find Failed Webhooks That Need Retry

```sql
SELECT
  we.stripe_event_id,
  we.event_type,
  we.object_id as subscription_id,
  we.error,
  we.retry_count,
  we.created_at,
  EXISTS(
    SELECT 1 FROM subscription_events se
    WHERE se.webhook_event_id = we.id
  ) as has_subscription_event
FROM stripe_events we
WHERE we.processed = false
  AND we.event_type LIKE 'customer.subscription.%'
  AND we.created_at > NOW() - INTERVAL '7 days'
ORDER BY we.created_at DESC;
```

### Audit Trail Best Practices

#### 1. Always Link webhook_event_id

**Edge Function Pattern**:
```typescript
// Log webhook event first (get ID)
const { data: logResult } = await supabase.rpc('log_stripe_event', {
  p_stripe_event_id: event.id,
  p_event_type: event.type,
  p_object_type: event.data.object.object,
  p_object_id: event.data.object.id,
  p_data: event.data,
});

const stripeEventId = logResult?.id; // UUID from stripe_events table

// Pass to state machine
await supabase.rpc('process_subscription_webhook_update', {
  p_stripe_subscription_id: subscription.id,
  p_clerk_user_id: clerkUserId,
  p_webhook_event_id: stripeEventId,  // ✅ Link to stripe_events
  // ... other params
});
```

**Database Function Pattern**:
```sql
-- In process_subscription_state_change()
INSERT INTO subscription_events (
  webhook_event_id,    -- ✅ Always pass this from webhook
  user_id,
  subscription_id,
  event_type,
  old_state,
  new_state,
  credits_allocated
) VALUES (
  p_webhook_event_id,  -- NULL for cron jobs, UUID for webhooks
  v_user_id,
  v_subscription_id,
  v_transition_type,
  to_jsonb(v_old_subscription),
  to_jsonb(v_new_subscription),
  v_credits_allocated
);
```

#### 2. Preserve Immutability

**Rules**:
- ✅ **Never UPDATE** `subscription_events` (INSERT-only audit trail)
- ✅ **Never DELETE** `subscription_events` (permanent compliance record)
- ⚠️ **Can UPDATE** `stripe_events.processed` (webhook retry flag)
- ⚠️ **Can DELETE** `stripe_events` (after 90 days retention)

#### 3. Include Rich Context in old_state/new_state

**Good Example**:
```json
{
  "old_state": {
    "status": "trialing",
    "current_period_start": "2025-11-03T03:36:28Z",
    "current_period_end": "2025-11-06T03:36:28Z",
    "plan_type": "individual",
    "monthly_credits": 30
  },
  "new_state": {
    "status": "active",
    "current_period_start": "2025-11-06T21:27:10Z",
    "current_period_end": "2025-12-06T21:27:10Z",
    "plan_type": "individual",
    "monthly_credits": 30
  }
}
```

**Bad Example** (insufficient context):
```json
{
  "old_state": {"status": "trialing"},
  "new_state": {"status": "active"}
}
```

#### 4. Retention Policies

| Table | Retention | Rationale | Cleanup Method |
|-------|-----------|-----------|----------------|
| `stripe_events` | 90 days | Webhook debugging, idempotency window | Auto-delete via pg_cron |
| `subscription_events` | Forever | Legal/compliance audit trail | Never delete |
| `activity_logs` | 1 year | User-facing timeline | Archive old entries |

**Cleanup Job**:
```sql
-- Run weekly via pg_cron
DELETE FROM stripe_events
WHERE created_at < NOW() - INTERVAL '90 days';

-- Run monthly via pg_cron
DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

---

## Event Routing Matrix

### Subscription Lifecycle Events

| Stripe Event | Handler Function | Database Function | subscription_events | stripe_events | Cache Update | Credit Allocation | Activity Log |
|-------------|------------------|-------------------|---------------------|---------------|--------------|-------------------|--------------|
| `customer.subscription.created` | `handleSubscriptionCreated()` | `process_subscription_webhook_update()` | ✅ Yes (via DB) | ✅ Yes (webhook) | ✅ Yes | ❌ No (trial credits at signup) | ✅ Yes |
| `customer.subscription.updated` (status change) | `handleSubscriptionUpdated()` | `process_subscription_webhook_update()` | ✅ Yes (via DB) | ✅ Yes (webhook) | ✅ Yes | ⚠️ If trial→active or renewal | ✅ Yes |
| `customer.subscription.updated` (plan change) | `handleSubscriptionUpdated()` | `process_subscription_webhook_update()` | ✅ Yes (via DB) | ✅ Yes (webhook) | ✅ Yes | 🔜 TODO: Plan upgrade credits | ✅ Yes |
| `customer.subscription.updated` (other) | `handleSubscriptionUpdated()` | ❌ No (cache only) | ❌ No | ✅ Yes (webhook) | ✅ Yes | ❌ No | ❌ No |
| `customer.subscription.deleted` | `handleSubscriptionDeleted()` | 🔜 TODO: `process_subscription_webhook_update()` | 🔜 Yes (via DB) | ✅ Yes (webhook) | ✅ Yes | ❌ No | ✅ Yes |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd()` (NEW) | ❌ No (notification only) | ❌ No | ✅ Yes (webhook) | ❌ No | ❌ No | ✅ Yes |

### Payment Events

| Stripe Event | Handler Function | Database Function | subscription_events | stripe_events | Cache Update | Credit Allocation | Activity Log |
|-------------|------------------|-------------------|---------------------|---------------|--------------|-------------------|--------------|
| `invoice.payment_succeeded` | `handleInvoicePayment()` | `process_subscription_webhook_update()` (if renewal) | ✅ Yes (via DB if renewal) | ✅ Yes (webhook) | ✅ Yes | ✅ Yes (if renewal) | ✅ Yes |
| `invoice.payment_failed` | `handlePaymentFailed()` | `process_subscription_webhook_update()` (status update) | ✅ Yes (via DB) | ✅ Yes (webhook) | ✅ Yes | ❌ No | ✅ Yes |
| `invoice.finalized` | `handleInvoiceFinalized()` (NEW) | ❌ No | ❌ No | ✅ Yes (webhook) | ❌ No | ❌ No | ✅ Yes |
| `payment_intent.succeeded` | ❌ Skip (handled by invoice) | N/A | N/A | ❌ No (skipped) | N/A | N/A | N/A |
| `payment_intent.payment_failed` | `handlePaymentFailed()` | ❌ No (logged only) | ❌ No | ✅ Yes (webhook) | ❌ No | ❌ No | ✅ Yes |

### Customer Events

| Stripe Event | Handler Function | Database Function | subscription_events | stripe_events | Cache Update | Credit Allocation | Activity Log |
|-------------|------------------|-------------------|---------------------|---------------|--------------|-------------------|--------------|
| `customer.created` | ❌ Skip (handled by Clerk) | N/A | N/A | ❌ No (skipped) | N/A | N/A | N/A |
| `customer.updated` | ❌ Skip (not needed) | N/A | N/A | ❌ No (skipped) | N/A | N/A | N/A |
| `customer.deleted` | `handleCustomerDeleted()` (NEW) | 🔜 TODO | ❌ No | ✅ Yes (webhook) | ❌ No | ❌ No | ✅ Yes |

### Checkout Events

| Stripe Event | Handler Function | Database Function | subscription_events | stripe_events | Cache Update | Credit Allocation | Activity Log |
|-------------|------------------|-------------------|---------------------|---------------|--------------|-------------------|--------------|
| `checkout.session.completed` | `handleCheckoutCompleted()` | ❌ No (subscription created separately) | ❌ No | ✅ Yes (webhook) | ❌ No | ❌ No | ✅ Yes |

---

## Implementation Phases

### Phase 1: Fix Critical Cancellation Handling (Week 1)

**Priority**: 🔴 CRITICAL - Immediate data integrity issue

**Goals**:
- Fix `handleSubscriptionDeleted()` to call state machine
- Update `subscriptions` table status to 'canceled'
- Ensure cancellations persist to database

**Tasks**:

#### Task 1.1: Update Edge Function Handler

**File**: `backend/supabase/functions/stripe-webhook/index.ts`

**Changes**:
```typescript
// BEFORE (current - BROKEN)
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  validateSubscriptionMetadata(subscription);
  const clerkUserId = subscription.metadata.clerk_user_id;

  await updateSubscriptionCache(subscription, clerkUserId); // Cache only ❌

  await supabase.from('activity_logs').insert({...}); // Log only

  return { success: true, ... };
}

// AFTER (proposed - FIXED)
async function handleSubscriptionCanceled(
  subscription: Stripe.Subscription,
  webhookEventId: string  // NEW: Pass webhook event ID for audit trail
) {
  validateSubscriptionMetadata(subscription);
  const clerkUserId = subscription.metadata.clerk_user_id;

  const stripeProductId = subscription.items.data[0]?.price?.product as string;

  // NEW: Call state machine to persist cancellation
  try {
    const { data: stateResult, error: stateError } = await supabase.rpc(
      'process_subscription_webhook_update',
      {
        p_stripe_subscription_id: subscription.id,
        p_clerk_user_id: clerkUserId,
        p_new_status: 'canceled',
        p_stripe_product_id: stripeProductId,
        p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        p_previous_status: subscription.status === 'canceled' ? 'active' : subscription.status,
        p_webhook_event_id: webhookEventId,  // ✅ NEW: Link to stripe_events table
      }
    );

    if (stateError) throw new Error(`State transition failed: ${stateError.message}`);

    console.log('✅ Subscription canceled in database:', stateResult);
  } catch (error) {
    console.error('Error processing cancellation:', error);
    // Continue to update cache even if state processing fails (graceful degradation)
  }

  await updateSubscriptionCache(subscription, clerkUserId);
  await supabase.from('activity_logs').insert({...});

  return { success: true, subscription_id: subscription.id, canceled_at: subscription.canceled_at };
}

// Main webhook handler - extracts event ID after logging
serve(async (req) => {
  // ... signature verification ...

  // Log event to database (idempotency check)
  const { data: logResult } = await supabase.rpc('log_stripe_event', {
    p_stripe_event_id: event.id,
    p_event_type: event.type,
    p_object_type: event.data.object.object,
    p_object_id: event.data.object.id,
    p_data: event.data,
  });

  if (logResult?.duplicate) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const webhookEventId = logResult?.id;  // ✅ UUID from stripe_events table

  // Pass to handler
  switch (event.type) {
    case 'customer.subscription.deleted':
      result = await handleSubscriptionCanceled(
        event.data.object as Stripe.Subscription,
        webhookEventId  // ✅ Pass to handler
      );
      break;
    // ... other cases ...
  }
});
```

**Note**: All handler functions will need to accept `webhookEventId` parameter and pass it to database functions.

#### Task 1.2: Update Database Migration (Add webhook_event_id)

**File**: `backend/supabase/migrations/023_add_webhook_event_id_to_functions.sql`

**Changes**:
```sql
-- 1. Add webhook_event_id parameter to process_subscription_webhook_update()
CREATE OR REPLACE FUNCTION public.process_subscription_webhook_update(
  p_stripe_subscription_id TEXT,
  p_clerk_user_id TEXT,
  p_new_status TEXT,
  p_stripe_product_id TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_previous_status TEXT DEFAULT NULL,
  p_webhook_event_id UUID DEFAULT NULL  -- ✅ NEW: Link to stripe_events table
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_subscription_id UUID;
  v_result JSONB;
BEGIN
  -- Translate external IDs to internal UUIDs
  -- ... existing logic ...

  -- Call state machine with webhook_event_id
  SELECT process_subscription_state_change(
    p_subscription_id := v_subscription_id,
    p_new_status := p_new_status,
    p_new_period_start := p_current_period_start,
    p_new_period_end := p_current_period_end,
    p_source := 'webhook',
    p_metadata := jsonb_build_object(
      'stripe_subscription_id', p_stripe_subscription_id,
      'previous_status', p_previous_status,
      'webhook_event_id', p_webhook_event_id  -- ✅ Pass through
    ),
    p_webhook_event_id := p_webhook_event_id  -- ✅ NEW parameter
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Add webhook_event_id parameter to process_subscription_state_change()
CREATE OR REPLACE FUNCTION public.process_subscription_state_change(
  p_subscription_id UUID,
  p_new_status TEXT,
  p_new_period_start TIMESTAMPTZ,
  p_new_period_end TIMESTAMPTZ,
  p_source TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_new_plan_id TEXT DEFAULT NULL,
  p_webhook_event_id UUID DEFAULT NULL  -- ✅ NEW: Link to stripe_events
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  -- ... existing variables ...
BEGIN
  -- ... existing logic ...

  -- Log to subscription_events with webhook link
  INSERT INTO subscription_events (
    webhook_event_id,    -- ✅ NEW: Link to stripe_events (NULL for cron)
    user_id,
    subscription_id,
    event_type,
    old_state,
    new_state,
    credits_allocated
  ) VALUES (
    p_webhook_event_id,  -- ✅ NULL for cron jobs, UUID for webhooks
    v_old_subscription.user_id,
    v_old_subscription.external_subscription_id,
    v_transition_type,
    to_jsonb(v_old_subscription),
    to_jsonb(v_new_subscription),
    v_credits_allocated
  );

  -- ... rest of function ...
END;
$$;

-- 3. Add foreign key constraint (if not exists)
ALTER TABLE subscription_events
  ADD CONSTRAINT fk_webhook_event
  FOREIGN KEY (webhook_event_id)
  REFERENCES stripe_events(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN subscription_events.webhook_event_id IS
'Link to stripe_events table for webhook-triggered state changes. NULL for cron-triggered changes.';
```

**Deploy**:
```bash
# Non-prod
npx supabase db push --project-ref jjpbogjufnqzsgiiaqwn

# Production (after testing)
npx supabase db push --project-ref lgkjfymwvhcjvfkuidis
```

#### Task 1.3: Deploy Edge Function to Non-Prod

**Steps**:
1. Deploy updated Edge Function to non-prod: `npx supabase functions deploy stripe-webhook --project-ref jjpbogjufnqzsgiiaqwn`
2. Test with Stripe CLI: `stripe trigger customer.subscription.deleted`
3. Verify database: `SELECT * FROM subscriptions WHERE external_subscription_id = 'sub_xxx'`
4. Expected: `status = 'canceled'`
5. Verify audit trail: `SELECT * FROM subscription_events WHERE webhook_event_id IS NOT NULL ORDER BY created_at DESC LIMIT 5`
6. Expected: Subscription state change linked to webhook event

#### Task 1.4: Test Failed Webhook Retry

**Steps**:
1. Find failed webhook in `stripe_events`: `SELECT * FROM stripe_events WHERE processed = false AND event_type = 'customer.subscription.deleted'`
2. Retry via Stripe dashboard: Events → [Select Event] → "Retry webhook"
3. Verify database updated
4. Verify `stripe_events.processed = true`
5. Verify audit trail linking: `SELECT se.*, st.event_type FROM subscription_events se JOIN stripe_events st ON se.webhook_event_id = st.id WHERE st.stripe_event_id = 'evt_xxx'`

#### Task 1.5: Deploy to Production

**Steps**:
1. Deploy updated Edge Function to prod: `npx supabase functions deploy stripe-webhook --project-ref lgkjfymwvhcjvfkuidis`
2. Monitor logs: `npx supabase functions logs stripe-webhook --project-ref lgkjfymwvhcjvfkuidis`
3. Verify existing failed webhooks can be retried successfully

**Success Criteria**:
- ✅ Canceled subscriptions update `subscriptions.status = 'canceled'` within seconds
- ✅ Failed webhooks (jnsinc2002@yahoo.com) can be retried and succeed
- ✅ Activity logs created for cancellations
- ✅ Zero data loss (credits preserved)

**Rollback Plan**:
- Revert Edge Function to previous version: `npx supabase functions deploy stripe-webhook --project-ref <id> --version <previous-version>`

---

### Phase 2: Add Metadata Fallback Lookup (Week 1-2)

**Priority**: 🟡 HIGH - Fixes 71% of webhook failures

**Goals**:
- Add graceful degradation for missing `clerk_user_id` metadata
- Lookup from database when Stripe metadata missing
- Reduce webhook failure rate from 79% to <5%

**Tasks**:

#### Task 2.1: Create Metadata Fallback Function

**File**: `backend/supabase/functions/stripe-webhook/index.ts`

**New Function**:
```typescript
/**
 * Retrieve clerk_user_id with graceful fallback when metadata missing
 * Fallback chain:
 * 1. Stripe subscription.metadata.clerk_user_id
 * 2. Database subscriptions.user_id (via external_subscription_id)
 * 3. Database user_profiles.id (via stripe_customer_id)
 */
async function resolveClerkUserId(subscription: Stripe.Subscription): Promise<{
  clerkUserId: string | null;
  source: 'stripe_metadata' | 'subscriptions_table' | 'user_profiles_table' | 'not_found';
  needsMetadataBackfill: boolean;
}> {
  // Try Stripe metadata first (preferred)
  if (subscription.metadata?.clerk_user_id) {
    return {
      clerkUserId: subscription.metadata.clerk_user_id,
      source: 'stripe_metadata',
      needsMetadataBackfill: false,
    };
  }

  console.warn(`Missing clerk_user_id metadata for subscription ${subscription.id}, trying fallback lookups`);

  // Fallback 1: Lookup from subscriptions table
  const { data: subData, error: subError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('external_subscription_id', subscription.id)
    .single();

  if (!subError && subData?.user_id) {
    console.log(`✅ Found clerk_user_id via subscriptions table: ${subData.user_id}`);
    return {
      clerkUserId: subData.user_id,
      source: 'subscriptions_table',
      needsMetadataBackfill: true, // Should backfill to Stripe
    };
  }

  // Fallback 2: Lookup from user_profiles via customer_id
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer as string)
    .single();

  if (!profileError && profileData?.id) {
    console.log(`✅ Found clerk_user_id via user_profiles table: ${profileData.id}`);
    return {
      clerkUserId: profileData.id,
      source: 'user_profiles_table',
      needsMetadataBackfill: true, // Should backfill to Stripe
    };
  }

  // All lookups failed
  console.error(`❌ Cannot find clerk_user_id for subscription ${subscription.id} (customer: ${subscription.customer})`);
  return {
    clerkUserId: null,
    source: 'not_found',
    needsMetadataBackfill: false,
  };
}
```

#### Task 2.2: Update Metadata Validation

**Replace**:
```typescript
// OLD: validateSubscriptionMetadata() - throws error if missing
function validateSubscriptionMetadata(subscription: Stripe.Subscription): void {
  const required = ['clerk_user_id'];
  const missing = required.filter(field => !subscription.metadata[field]);

  if (missing.length > 0) {
    throw new Error(`MISSING_REQUIRED_METADATA: ${missing.join(', ')}`);
  }
}
```

**With**:
```typescript
// NEW: resolveAndValidateMetadata() - tries fallback before failing
async function resolveAndValidateMetadata(subscription: Stripe.Subscription): Promise<{
  clerkUserId: string;
  needsBackfill: boolean;
}> {
  const { clerkUserId, source, needsMetadataBackfill } = await resolveClerkUserId(subscription);

  if (!clerkUserId) {
    // Still couldn't find user - fail webhook (Stripe will retry)
    throw new Error(`MISSING_REQUIRED_METADATA: clerk_user_id - Subscription ${subscription.id} (tried all fallbacks)`);
  }

  // Log if fallback was used (for monitoring)
  if (source !== 'stripe_metadata') {
    console.warn(`⚠️ Used fallback ${source} for subscription ${subscription.id}, user ${clerkUserId}`);

    // Optional: Log to database for tracking
    await supabase.from('metadata_fallback_logs').insert({
      subscription_id: subscription.id,
      user_id: clerkUserId,
      fallback_source: source,
      stripe_customer_id: subscription.customer,
      created_at: new Date().toISOString(),
    });
  }

  return { clerkUserId, needsBackfill: needsMetadataBackfill };
}
```

#### Task 2.3: Update All Handlers to Use New Validation

**Pattern** (apply to all handlers):
```typescript
async function handleSubscriptionXxx(
  subscription: Stripe.Subscription,
  webhookEventId: string  // ✅ Audit trail parameter
) {
  console.log(`Subscription xxx: ${subscription.id}`);

  // NEW: Use fallback-enabled validation
  const { clerkUserId, needsBackfill } = await resolveAndValidateMetadata(subscription);

  // Rest of handler logic...
  // Call database functions with webhookEventId parameter
  const { data: result } = await supabase.rpc('process_subscription_webhook_update', {
    p_stripe_subscription_id: subscription.id,
    p_clerk_user_id: clerkUserId,
    p_webhook_event_id: webhookEventId,  // ✅ Link to stripe_events
    // ... other parameters
  });

  // Optional: Backfill metadata to Stripe if needed
  if (needsBackfill) {
    try {
      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          ...subscription.metadata,
          clerk_user_id: clerkUserId, // Backfill for future webhooks
        }
      });
      console.log(`✅ Backfilled clerk_user_id to Stripe metadata: ${subscription.id}`);
    } catch (backfillError) {
      // Non-critical error, just log
      console.warn(`Failed to backfill metadata: ${backfillError.message}`);
    }
  }

  return { success: true, ... };
}
```

#### Task 2.4: Create Metadata Fallback Logs Table (Optional)

**Migration**: `backend/supabase/migrations/022_metadata_fallback_logs.sql`

```sql
CREATE TABLE IF NOT EXISTS public.metadata_fallback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  fallback_source TEXT NOT NULL CHECK (fallback_source IN ('subscriptions_table', 'user_profiles_table')),
  stripe_customer_id TEXT,
  backfilled_to_stripe BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metadata_fallback_logs_subscription
  ON public.metadata_fallback_logs(subscription_id);

CREATE INDEX idx_metadata_fallback_logs_created
  ON public.metadata_fallback_logs(created_at DESC);

COMMENT ON TABLE public.metadata_fallback_logs IS
'Tracks when clerk_user_id had to be retrieved via database fallback instead of Stripe metadata';
```

#### Task 2.5: Deploy and Test

**Steps**:
1. Deploy migration to non-prod
2. Deploy updated Edge Function to non-prod
3. Test with Stripe CLI: `stripe trigger customer.subscription.updated --override subscription:metadata=null`
4. Verify webhook succeeds via database fallback
5. Check `metadata_fallback_logs` table for entry
6. Verify Stripe metadata backfilled (check via Stripe dashboard)
7. Deploy to production
8. Retry failed webhooks from Phase 1

**Success Criteria**:
- ✅ Webhooks with missing metadata succeed via fallback
- ✅ Metadata automatically backfilled to Stripe for future webhooks
- ✅ Failed webhook count drops from 19 to <2
- ✅ Webhook success rate improves from 20.8% to >95%

---

### Phase 3: Add Checkout Metadata Validation (Week 2)

**Priority**: 🟢 MEDIUM - Prevents future issues

**Goals**:
- Add metadata validation at subscription creation
- Ensure all new subscriptions have `clerk_user_id`
- Prevent root cause of Phase 2 issues

**Tasks**:

#### Task 3.1: Update Checkout Creation

**File**: `backend/modules/stripe-checkout-session.ts` (or similar)

**Add validation**:
```typescript
export async function createCheckoutSession(request: ZuploRequest, context: ZuploContext) {
  const userId = request.user.sub; // From Clerk JWT

  // ... existing code ...

  // NEW: Validate required metadata before creating session
  const subscriptionMetadata = {
    clerk_user_id: userId,          // REQUIRED
    user_email: userEmail,           // RECOMMENDED
    plan_type: planType,             // RECOMMENDED
    created_via: 'checkout_session', // RECOMMENDED
    created_at: new Date().toISOString(),
  };

  // Create Stripe checkout session with metadata
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],

    subscription_data: {
      metadata: subscriptionMetadata, // ✅ Metadata attached to subscription
      trial_period_days: trialDays || undefined,
    },

    metadata: {
      ...subscriptionMetadata, // ✅ Also attached to session for tracking
      checkout_session_id: 'will_be_set_by_stripe',
    },

    success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/subscription/canceled`,
  });

  context.log.info('Checkout session created with metadata', {
    sessionId: session.id,
    userId,
    metadata: subscriptionMetadata,
  });

  return session;
}
```

#### Task 3.2: Add Server-Side Validation Function

**File**: `backend/modules/stripe-metadata-validator.ts` (NEW)

```typescript
import { ZuploContext } from '@zuplo/runtime';

export interface SubscriptionMetadata {
  clerk_user_id: string;      // REQUIRED
  user_email?: string;         // RECOMMENDED
  plan_type?: string;          // RECOMMENDED
  created_via?: string;        // RECOMMENDED
  created_at?: string;         // RECOMMENDED
}

export function validateSubscriptionMetadata(
  metadata: Record<string, any>,
  context: ZuploContext
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!metadata.clerk_user_id) {
    errors.push('clerk_user_id is required');
  } else if (!/^user_[A-Za-z0-9]+$/.test(metadata.clerk_user_id)) {
    errors.push('clerk_user_id has invalid format (expected: user_xxx)');
  }

  // Recommended fields
  if (!metadata.user_email) {
    warnings.push('user_email is recommended for support inquiries');
  }

  if (!metadata.plan_type) {
    warnings.push('plan_type is recommended for analytics');
  }

  if (!metadata.created_via) {
    warnings.push('created_via is recommended for tracking subscription source');
  }

  // Log validation results
  if (errors.length > 0) {
    context.log.error('Subscription metadata validation failed', { errors, metadata });
  } else if (warnings.length > 0) {
    context.log.warn('Subscription metadata validation warnings', { warnings, metadata });
  } else {
    context.log.info('Subscription metadata validation passed', { metadata });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function buildSubscriptionMetadata(userId: string, options?: {
  userEmail?: string;
  planType?: string;
  createdVia?: string;
}): SubscriptionMetadata {
  return {
    clerk_user_id: userId,
    user_email: options?.userEmail,
    plan_type: options?.planType,
    created_via: options?.createdVia || 'api',
    created_at: new Date().toISOString(),
  };
}
```

#### Task 3.3: Add Tests

**File**: `backend/tests/stripe-metadata-validator.test.ts` (NEW)

```typescript
import { describe, it, expect } from '@zuplo/test';
import { validateSubscriptionMetadata, buildSubscriptionMetadata } from '../modules/stripe-metadata-validator';

describe('Stripe Metadata Validator', () => {
  it('should validate correct metadata', () => {
    const metadata = {
      clerk_user_id: 'user_123abc',
      user_email: 'test@example.com',
      plan_type: 'individual',
    };

    const result = validateSubscriptionMetadata(metadata, mockContext());

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when clerk_user_id missing', () => {
    const metadata = { user_email: 'test@example.com' };

    const result = validateSubscriptionMetadata(metadata, mockContext());

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('clerk_user_id is required');
  });

  it('should warn when recommended fields missing', () => {
    const metadata = { clerk_user_id: 'user_123abc' };

    const result = validateSubscriptionMetadata(metadata, mockContext());

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should build metadata with required fields', () => {
    const metadata = buildSubscriptionMetadata('user_123abc', {
      userEmail: 'test@example.com',
      planType: 'individual',
    });

    expect(metadata.clerk_user_id).toBe('user_123abc');
    expect(metadata.user_email).toBe('test@example.com');
    expect(metadata.plan_type).toBe('individual');
    expect(metadata.created_at).toBeDefined();
  });
});

function mockContext(): any {
  return {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}
```

#### Task 3.4: Deploy and Verify

**Steps**:
1. Run tests: `npm run test`
2. Deploy to non-prod
3. Create test checkout session via API
4. Verify Stripe subscription has metadata: `stripe subscriptions retrieve sub_xxx`
5. Check webhook receives subscription with metadata
6. Deploy to production

**Success Criteria**:
- ✅ All new subscriptions have `clerk_user_id` metadata
- ✅ Tests pass (100% coverage for validator)
- ✅ Zero new webhooks fail due to missing metadata
- ✅ Monitoring shows metadata presence rate = 100%

---

### Phase 4: Enhance Cron Safety Net (Week 2-3)

**Priority**: 🟢 MEDIUM - Safety net for missed webhooks

**Goals**:
- Detect canceled subscriptions in Stripe FDW
- Detect metadata discrepancies
- Provide comprehensive reconciliation

**Tasks**:

#### Task 4.1: Update sync_expired_subscriptions()

**File**: `backend/supabase/migrations/023_enhance_cron_safety_net.sql`

**Add cancellation detection**:
```sql
CREATE OR REPLACE FUNCTION public.sync_expired_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  v_expired_trials subscriptions[];
  v_expired_periods subscriptions[];
  v_canceled_in_stripe subscriptions[]; -- NEW
  v_trial_count integer := 0;
  v_period_count integer := 0;
  v_canceled_count integer := 0; -- NEW
  v_success_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb[] := ARRAY[]::jsonb[];
BEGIN
  -- Existing logic: Find expired trials
  SELECT array_agg(s.*) INTO v_expired_trials
  FROM subscriptions s
  WHERE s.status = 'trialing'
    AND s.current_period_end < NOW()
    AND s.external_subscription_id IS NOT NULL;

  -- Existing logic: Find expired active periods
  SELECT array_agg(s.*) INTO v_expired_periods
  FROM subscriptions s
  WHERE s.status = 'active'
    AND s.current_period_end < NOW()
    AND s.external_subscription_id IS NOT NULL;

  -- NEW: Find subscriptions canceled in Stripe but not in database
  -- Query Stripe FDW to find mismatches
  SELECT array_agg(s.*) INTO v_canceled_in_stripe
  FROM subscriptions s
  WHERE s.status IN ('active', 'trialing', 'past_due')  -- Not canceled in DB
    AND s.external_subscription_id IS NOT NULL
    AND EXISTS (
      -- Subscription exists in Stripe but is canceled
      SELECT 1
      FROM stripe.subscriptions ss
      WHERE ss.id = s.external_subscription_id
        AND ss.attrs->>'status' = 'canceled'
    );

  v_trial_count := COALESCE(array_length(v_expired_trials, 1), 0);
  v_period_count := COALESCE(array_length(v_expired_periods, 1), 0);
  v_canceled_count := COALESCE(array_length(v_canceled_in_stripe, 1), 0);

  -- Process expired trials (existing logic)
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
          'external_id', v_expired_trials[i].external_subscription_id,
          'type', 'expired_trial',
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END IF;

  -- Process expired periods (existing logic)
  IF v_period_count > 0 THEN
    FOR i IN 1..v_period_count LOOP
      BEGIN
        PERFORM sync_subscription_from_stripe(
          v_expired_periods[i].external_subscription_id,
          v_expired_periods[i].user_id
        );
        v_success_count := v_success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, jsonb_build_object(
          'subscription_id', v_expired_periods[i].id,
          'external_id', v_expired_periods[i].external_subscription_id,
          'type', 'expired_period',
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END IF;

  -- NEW: Process canceled subscriptions
  IF v_canceled_count > 0 THEN
    RAISE NOTICE 'Found % subscriptions canceled in Stripe but not in database', v_canceled_count;

    FOR i IN 1..v_canceled_count LOOP
      BEGIN
        PERFORM sync_subscription_from_stripe(
          v_canceled_in_stripe[i].external_subscription_id,
          v_canceled_in_stripe[i].user_id
        );
        v_success_count := v_success_count + 1;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, jsonb_build_object(
          'subscription_id', v_canceled_in_stripe[i].id,
          'external_id', v_canceled_in_stripe[i].external_subscription_id,
          'type', 'canceled_in_stripe',
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END IF;

  -- Log results
  INSERT INTO system_logs (log_type, log_message, metadata)
  VALUES (
    'subscription_sync',
    format('Synced %s expired trials, %s expired periods, %s canceled',
           v_trial_count, v_period_count, v_canceled_count),
    jsonb_build_object(
      'trial_count', v_trial_count,
      'period_count', v_period_count,
      'canceled_count', v_canceled_count,
      'success_count', v_success_count,
      'error_count', v_error_count,
      'errors', v_errors
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'trials_found', v_trial_count,
    'periods_found', v_period_count,
    'canceled_found', v_canceled_count,
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
$;
```

#### Task 4.2: Add Metadata Reconciliation Function

**File**: Same migration file

```sql
-- NEW: Reconcile Stripe metadata with database
CREATE OR REPLACE FUNCTION public.reconcile_subscription_metadata()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  v_missing_metadata subscriptions[];
  v_count integer := 0;
  v_reconciled integer := 0;
  v_errors jsonb[] := ARRAY[]::jsonb[];
BEGIN
  -- Find subscriptions where Stripe metadata doesn't match database
  SELECT array_agg(s.*) INTO v_missing_metadata
  FROM subscriptions s
  WHERE s.external_subscription_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM stripe.subscriptions ss
      WHERE ss.id = s.external_subscription_id
        AND (
          -- Metadata missing clerk_user_id
          ss.attrs->'metadata'->>'clerk_user_id' IS NULL
          OR ss.attrs->'metadata'->>'clerk_user_id' = ''
          OR ss.attrs->'metadata'->>'clerk_user_id' != s.user_id
        )
    );

  v_count := COALESCE(array_length(v_missing_metadata, 1), 0);

  IF v_count > 0 THEN
    RAISE NOTICE 'Found % subscriptions with metadata mismatches', v_count;

    FOR i IN 1..v_count LOOP
      BEGIN
        -- Log the mismatch for manual review
        INSERT INTO metadata_reconciliation_log (
          subscription_id,
          external_subscription_id,
          user_id,
          stripe_metadata_clerk_user_id,
          needs_manual_review
        )
        SELECT
          v_missing_metadata[i].id,
          v_missing_metadata[i].external_subscription_id,
          v_missing_metadata[i].user_id,
          ss.attrs->'metadata'->>'clerk_user_id',
          true
        FROM stripe.subscriptions ss
        WHERE ss.id = v_missing_metadata[i].external_subscription_id;

        v_reconciled := v_reconciled + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, jsonb_build_object(
          'subscription_id', v_missing_metadata[i].id,
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END IF;

  -- Log results
  INSERT INTO system_logs (log_type, log_message, metadata)
  VALUES (
    'metadata_reconciliation',
    format('Found %s subscriptions with metadata mismatches', v_count),
    jsonb_build_object(
      'mismatches_found', v_count,
      'logged_for_review', v_reconciled,
      'errors', v_errors
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'mismatches_found', v_count,
    'logged_for_review', v_reconciled,
    'errors', v_errors
  );
END;
$;

-- Table to track metadata mismatches
CREATE TABLE IF NOT EXISTS public.metadata_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  external_subscription_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  stripe_metadata_clerk_user_id TEXT,
  needs_manual_review BOOLEAN DEFAULT true,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metadata_reconciliation_unresolved
  ON public.metadata_reconciliation_log(needs_manual_review, created_at DESC)
  WHERE needs_manual_review = true;
```

#### Task 4.3: Schedule Metadata Reconciliation

**Add to pg_cron**:
```sql
-- Run daily at 3 AM UTC (low traffic time)
SELECT cron.schedule(
  'reconcile-subscription-metadata',
  '0 3 * * *',
  'SELECT public.reconcile_subscription_metadata();'
);
```

#### Task 4.4: Deploy and Monitor

**Steps**:
1. Deploy migration to non-prod
2. Run manual test: `SELECT sync_expired_subscriptions();`
3. Verify canceled subscriptions detected
4. Check `metadata_reconciliation_log` table
5. Deploy to production
6. Monitor cron logs for next 7 days

**Success Criteria**:
- ✅ Cron detects all canceled subscriptions (jnsinc2002@yahoo.com)
- ✅ Metadata mismatches logged for manual review
- ✅ Zero false positives (subscriptions already synced not re-synced)
- ✅ Cron run time <30 seconds for 100 subscriptions

---

### Phase 5: Monitoring and Alerting (Week 3)

**Priority**: 🟢 LOW - Operational excellence

**Goals**:
- Real-time webhook failure monitoring
- Daily health summary alerts
- Automated remediation triggers

**Tasks**:

#### Task 5.1: Create Monitoring Dashboard Queries

**File**: `backend/docs-internal/operations/SUBSCRIPTION_MONITORING_QUERIES.md`

```sql
-- Webhook Success Rate (Last 24 Hours)
SELECT
  event_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processed = true) as success,
  COUNT(*) FILTER (WHERE processed = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE processed = true) / COUNT(*), 2) as success_rate
FROM stripe_events
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type LIKE 'customer.subscription.%'
GROUP BY event_type
ORDER BY total DESC;

-- Subscriptions Needing Attention
SELECT
  id,
  external_subscription_id,
  user_id,
  status,
  current_period_end,
  NOW() - current_period_end as time_expired,
  CASE
    WHEN status = 'trialing' AND current_period_end < NOW() - INTERVAL '24 hours' THEN 'STUCK_TRIAL'
    WHEN status = 'active' AND current_period_end < NOW() - INTERVAL '48 hours' THEN 'EXPIRED_ACTIVE'
    WHEN status = 'past_due' AND current_period_end < NOW() - INTERVAL '7 days' THEN 'LONG_PAST_DUE'
  END as issue_type
FROM subscriptions
WHERE (
  (status = 'trialing' AND current_period_end < NOW() - INTERVAL '24 hours')
  OR (status = 'active' AND current_period_end < NOW() - INTERVAL '48 hours')
  OR (status = 'past_due' AND current_period_end < NOW() - INTERVAL '7 days')
)
ORDER BY current_period_end;

-- Failed Webhooks Needing Retry
SELECT
  stripe_event_id,
  event_type,
  object_id,
  error,
  retry_count,
  created_at,
  NOW() - created_at as age
FROM stripe_events
WHERE processed = false
  AND retry_count < 3  -- Stripe auto-retries 3 times
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Metadata Fallback Usage (Last 7 Days)
SELECT
  fallback_source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE backfilled_to_stripe = true) as backfilled,
  COUNT(*) FILTER (WHERE backfilled_to_stripe = false) as not_backfilled
FROM metadata_fallback_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY fallback_source;

-- Cron Job Health
SELECT
  j.jobname,
  j.schedule,
  j.active,
  r.start_time,
  r.end_time,
  r.end_time - r.start_time as duration,
  r.status,
  r.return_message
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT * FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC
  LIMIT 1
) r ON true
WHERE j.jobname LIKE '%subscription%'
ORDER BY j.jobname;
```

#### Task 5.2: Create Alert Thresholds

**File**: `backend/supabase/migrations/024_subscription_alerts.sql`

```sql
-- Alert configuration table
CREATE TABLE IF NOT EXISTS public.alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL UNIQUE,
  threshold_value INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default thresholds
INSERT INTO public.alert_thresholds (alert_type, threshold_value, severity, description) VALUES
  ('webhook_failure_rate', 10, 'warning', 'Alert if >10% of webhooks fail in 24h'),
  ('webhook_failure_rate', 25, 'critical', 'Alert if >25% of webhooks fail in 24h'),
  ('stuck_trials', 5, 'warning', 'Alert if >5 trials stuck >24h'),
  ('stuck_trials', 10, 'critical', 'Alert if >10 trials stuck >24h'),
  ('expired_active', 3, 'warning', 'Alert if >3 active subs expired >48h'),
  ('expired_active', 10, 'critical', 'Alert if >10 active subs expired >48h'),
  ('metadata_fallbacks', 10, 'info', 'Alert if >10 metadata fallbacks in 24h'),
  ('metadata_fallbacks', 50, 'warning', 'Alert if >50 metadata fallbacks in 24h'),
  ('cron_failures', 2, 'warning', 'Alert if cron fails 2+ times consecutively'),
  ('cron_failures', 5, 'critical', 'Alert if cron fails 5+ times consecutively');

-- Alert evaluation function
CREATE OR REPLACE FUNCTION public.evaluate_subscription_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  v_alerts jsonb[] := ARRAY[]::jsonb[];
  v_webhook_failure_rate numeric;
  v_stuck_trials integer;
  v_expired_active integer;
  v_metadata_fallbacks integer;
  v_cron_failures integer;
BEGIN
  -- Calculate webhook failure rate (last 24h)
  SELECT
    ROUND(100.0 * COUNT(*) FILTER (WHERE processed = false) / NULLIF(COUNT(*), 0), 2)
  INTO v_webhook_failure_rate
  FROM stripe_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND event_type LIKE 'customer.subscription.%';

  IF v_webhook_failure_rate > 25 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'webhook_failure_rate',
      'severity', 'critical',
      'value', v_webhook_failure_rate,
      'message', format('Webhook failure rate: %.2f%% (threshold: 25%%)', v_webhook_failure_rate)
    ));
  ELSIF v_webhook_failure_rate > 10 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'webhook_failure_rate',
      'severity', 'warning',
      'value', v_webhook_failure_rate,
      'message', format('Webhook failure rate: %.2f%% (threshold: 10%%)', v_webhook_failure_rate)
    ));
  END IF;

  -- Count stuck trials
  SELECT COUNT(*)
  INTO v_stuck_trials
  FROM subscriptions
  WHERE status = 'trialing'
    AND current_period_end < NOW() - INTERVAL '24 hours';

  IF v_stuck_trials > 10 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'stuck_trials',
      'severity', 'critical',
      'value', v_stuck_trials,
      'message', format('%s trials stuck >24h (threshold: 10)', v_stuck_trials)
    ));
  ELSIF v_stuck_trials > 5 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'stuck_trials',
      'severity', 'warning',
      'value', v_stuck_trials,
      'message', format('%s trials stuck >24h (threshold: 5)', v_stuck_trials)
    ));
  END IF;

  -- Count expired active subscriptions
  SELECT COUNT(*)
  INTO v_expired_active
  FROM subscriptions
  WHERE status = 'active'
    AND current_period_end < NOW() - INTERVAL '48 hours';

  IF v_expired_active > 10 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'expired_active',
      'severity', 'critical',
      'value', v_expired_active,
      'message', format('%s active subs expired >48h (threshold: 10)', v_expired_active)
    ));
  ELSIF v_expired_active > 3 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'expired_active',
      'severity', 'warning',
      'value', v_expired_active,
      'message', format('%s active subs expired >48h (threshold: 3)', v_expired_active)
    ));
  END IF;

  -- Count metadata fallbacks (last 24h)
  SELECT COUNT(*)
  INTO v_metadata_fallbacks
  FROM metadata_fallback_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';

  IF v_metadata_fallbacks > 50 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'metadata_fallbacks',
      'severity', 'warning',
      'value', v_metadata_fallbacks,
      'message', format('%s metadata fallbacks in 24h (threshold: 50)', v_metadata_fallbacks)
    ));
  ELSIF v_metadata_fallbacks > 10 THEN
    v_alerts := array_append(v_alerts, jsonb_build_object(
      'type', 'metadata_fallbacks',
      'severity', 'info',
      'value', v_metadata_fallbacks,
      'message', format('%s metadata fallbacks in 24h (threshold: 10)', v_metadata_fallbacks)
    ));
  END IF;

  -- Log alerts if any
  IF array_length(v_alerts, 1) > 0 THEN
    INSERT INTO system_logs (log_type, log_message, metadata)
    VALUES (
      'subscription_alerts',
      format('%s alerts triggered', array_length(v_alerts, 1)),
      jsonb_build_object('alerts', v_alerts, 'evaluated_at', NOW())
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'alerts_triggered', array_length(v_alerts, 1),
    'alerts', v_alerts
  );
END;
$;

-- Schedule daily alert evaluation
SELECT cron.schedule(
  'evaluate-subscription-alerts',
  '0 8 * * *',  -- Daily at 8 AM UTC
  'SELECT public.evaluate_subscription_alerts();'
);
```

#### Task 5.3: Create Remediation Tools

**File**: `backend/supabase/migrations/025_subscription_remediation_tools.sql`

```sql
-- Manual retry of failed webhook
CREATE OR REPLACE FUNCTION public.retry_failed_webhook(p_stripe_event_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  v_event RECORD;
  v_result JSONB;
BEGIN
  -- Get event details
  SELECT * INTO v_event
  FROM stripe_events
  WHERE stripe_event_id = p_stripe_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.processed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event already processed');
  END IF;

  -- TODO: Re-process event (requires Edge Function integration)
  -- For now, just mark for manual review
  UPDATE stripe_events
  SET retry_count = retry_count + 1,
      error = error || ' [MARKED FOR MANUAL RETRY]',
      updated_at = NOW()
  WHERE stripe_event_id = p_stripe_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Event marked for manual retry',
    'event_id', p_stripe_event_id,
    'retry_count', v_event.retry_count + 1
  );
END;
$;

-- Batch sync all subscriptions with issues
CREATE OR REPLACE FUNCTION public.batch_sync_problem_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  v_problem_subs subscriptions[];
  v_synced integer := 0;
  v_errors jsonb[] := ARRAY[]::jsonb[];
BEGIN
  -- Find all subscriptions with known issues
  SELECT array_agg(s.*) INTO v_problem_subs
  FROM subscriptions s
  WHERE (
    -- Stuck trials
    (s.status = 'trialing' AND s.current_period_end < NOW() - INTERVAL '24 hours')
    -- Expired active
    OR (s.status = 'active' AND s.current_period_end < NOW() - INTERVAL '48 hours')
    -- Long past due
    OR (s.status = 'past_due' AND s.current_period_end < NOW() - INTERVAL '7 days')
  )
  AND s.external_subscription_id IS NOT NULL;

  IF v_problem_subs IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'No problem subscriptions found');
  END IF;

  -- Sync each subscription
  FOR i IN 1..array_length(v_problem_subs, 1) LOOP
    BEGIN
      PERFORM sync_subscription_from_stripe(v_problem_subs[i].external_subscription_id);
      v_synced := v_synced + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, jsonb_build_object(
        'subscription_id', v_problem_subs[i].id,
        'external_id', v_problem_subs[i].external_subscription_id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_found', array_length(v_problem_subs, 1),
    'synced', v_synced,
    'errors', v_errors
  );
END;
$;
```

**Success Criteria**:
- ✅ Daily alert emails sent if thresholds exceeded
- ✅ Manual remediation tools available for admins
- ✅ Monitoring dashboard shows real-time health metrics
- ✅ Alert history tracked in database

---

## Testing Strategy

### Unit Tests

**Location**: `backend/tests/`

**Coverage**:
- ✅ Metadata validation (with/without fallback)
- ✅ Metadata fallback chain (all 3 lookup methods)
- ✅ Event routing (correct handler for each event type)
- ✅ Idempotency (duplicate event handling)
- ✅ Error handling (graceful degradation)

**Example Test**:
```typescript
describe('Metadata Fallback', () => {
  it('should use subscriptions table fallback when metadata missing', async () => {
    const subscription = mockStripeSubscription({ metadata: {} }); // Missing clerk_user_id

    // Mock database response
    mockSupabase.from('subscriptions').select().single.mockResolvedValue({
      data: { user_id: 'user_123abc' },
      error: null,
    });

    const { clerkUserId, source } = await resolveClerkUserId(subscription);

    expect(clerkUserId).toBe('user_123abc');
    expect(source).toBe('subscriptions_table');
  });
});
```

### Integration Tests

**Location**: `backend/tests/integration/`

**Scenarios**:
1. **Webhook End-to-End**:
   - Send Stripe test webhook → Verify database updated → Verify cache updated
2. **Cron Job Execution**:
   - Create expired subscription → Run cron → Verify synced
3. **Metadata Fallback**:
   - Create subscription without metadata → Send webhook → Verify fallback used
4. **Cancellation Flow**:
   - Cancel subscription in Stripe → Webhook processed → Database shows canceled
5. **Audit Trail Linking** (NEW):
   - Send webhook → Verify `stripe_events` entry created → Verify `subscription_events` links to `stripe_events` via `webhook_event_id`
   - Query: `SELECT se.*, st.stripe_event_id FROM subscription_events se JOIN stripe_events st ON se.webhook_event_id = st.id`
   - Verify cron-triggered events have `webhook_event_id = NULL`

**Test Environment**: Non-prod Supabase project (jjpbogjufnqzsgiiaqwn)

### Load Tests

**Goal**: Ensure cron job scales to 1000+ subscriptions

**Test Plan**:
1. Create 1000 test subscriptions in non-prod
2. Mark 100 as expired
3. Run `sync_expired_subscriptions()`
4. Measure execution time (<60 seconds)
5. Verify no deadlocks or timeouts

### Manual Testing Checklist

**Before Production Deployment**:

- [ ] Phase 1: Test cancellation handler with real subscription
- [ ] Phase 2: Test metadata fallback with missing clerk_user_id
- [ ] Phase 2: Verify metadata backfilled to Stripe after fallback
- [ ] Phase 3: Create checkout session and verify metadata attached
- [ ] Phase 4: Run cron job and verify canceled subscriptions detected
- [ ] Phase 5: Trigger alerts and verify logged correctly
- [ ] End-to-End: Cancel subscription → Verify database updated within 60 seconds
- [ ] End-to-End: Retry failed webhook → Verify succeeds with fallback
- [ ] Rollback Test: Revert Edge Function → Verify system still works (cron fallback)

---

## Monitoring and Alerting

### Key Metrics

| Metric | Target | Alert Threshold | Measurement |
|--------|--------|-----------------|-------------|
| **Webhook Success Rate** | >95% | <90% (warning), <80% (critical) | Last 24 hours |
| **Stuck Trials** | 0 | >5 (warning), >10 (critical) | Expired >24h |
| **Expired Active** | 0 | >3 (warning), >10 (critical) | Expired >48h |
| **Metadata Fallbacks** | <10/day | >10 (info), >50 (warning) | Last 24 hours |
| **Cron Execution Time** | <30s | >60s (warning), >120s (critical) | Per run |
| **Cron Failure Rate** | 0% | >0% (warning), >10% (critical) | Last 7 days |

### Monitoring Queries (Scheduled)

```sql
-- Run every hour via pg_cron
SELECT cron.schedule(
  'subscription-health-check',
  '0 * * * *',
  'SELECT public.evaluate_subscription_alerts();'
);

-- Run daily via pg_cron
SELECT cron.schedule(
  'daily-subscription-summary',
  '0 9 * * *',
  'SELECT public.daily_subscription_summary();'
);
```

### Audit Trail Verification Queries

```sql
-- Check for orphaned subscription_events (missing webhook link)
-- Expected: Only cron-triggered events should have NULL webhook_event_id
SELECT
  event_type,
  COUNT(*) as total,
  COUNT(webhook_event_id) as with_webhook_link,
  COUNT(*) - COUNT(webhook_event_id) as without_webhook_link
FROM subscription_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY total DESC;

-- Verify webhook → subscription_events linking
-- Should return all recent webhook-triggered state changes
SELECT
  st.stripe_event_id,
  st.event_type as webhook_event,
  se.event_type as state_change,
  se.subscription_id,
  se.credits_allocated,
  st.created_at
FROM stripe_events st
JOIN subscription_events se ON se.webhook_event_id = st.id
WHERE st.created_at > NOW() - INTERVAL '24 hours'
ORDER BY st.created_at DESC
LIMIT 20;

-- Find webhook-triggered state changes missing audit link (should be 0)
SELECT
  se.id,
  se.event_type,
  se.subscription_id,
  se.created_at,
  se.new_state->>'source' as source
FROM subscription_events se
WHERE se.created_at > NOW() - INTERVAL '7 days'
  AND se.webhook_event_id IS NULL
  AND (se.new_state->>'source' = 'webhook' OR se.old_state->>'source' = 'webhook')
ORDER BY se.created_at DESC;
```

### Alert Destinations

**Phase 5a: Database Logging (Implemented)**
- ✅ All alerts logged to `system_logs` table
- ✅ Critical alerts logged to `system_alerts` table
- ✅ Queryable via SQL

**Phase 5b: External Notifications (Future)**
- 🔜 Email alerts via SendGrid Edge Function
- 🔜 Slack notifications via webhook Edge Function
- 🔜 PagerDuty integration for critical alerts

---

## Rollback Plan

### Phase 1 Rollback (Cancellation Handler)

**If webhooks start failing:**
```bash
# Revert Edge Function to previous version
npx supabase functions deploy stripe-webhook --project-ref lgkjfymwvhcjvfkuidis --version v9

# Cron will handle cancellations (1h delay, acceptable)
```

**Verification**:
- Check webhook error rate returns to baseline
- Verify cron still syncing cancellations (next hourly run)

### Phase 2 Rollback (Metadata Fallback)

**If fallback causes issues:**
```bash
# Revert Edge Function to Phase 1 version
npx supabase functions deploy stripe-webhook --project-ref lgkjfymwvhcjvfkuidis --version v10

# Webhooks will fail for missing metadata (same as before)
```

**Mitigation**:
- Failed webhooks can be manually retried after adding metadata
- No data loss (events logged in `stripe_events` table)

### Phase 3 Rollback (Checkout Validation)

**If validation blocks legitimate checkouts:**
```bash
# Revert checkout creation code to previous version
git revert <commit-hash>
git push origin main  # Zuplo auto-deploys

# No database changes needed (validation was app-level only)
```

### Phase 4 Rollback (Cron Enhancement)

**If cron job performance degrades:**
```sql
-- Disable enhanced cron job
SELECT cron.unschedule('sync-expired-subscriptions-v2');

-- Re-enable old version
SELECT cron.schedule(
  'sync-expired-subscriptions',
  '0 * * * *',
  'SELECT public.scheduled_subscription_sync();'  -- Old function
);
```

### Emergency Rollback (All Phases)

**If system becomes unstable:**
```bash
# 1. Disable cron jobs
psql -h <host> -U postgres -c "UPDATE cron.job SET active = false WHERE jobname LIKE '%subscription%'"

# 2. Revert Edge Function to last stable version
npx supabase functions deploy stripe-webhook --project-ref lgkjfymwvhcjvfkuidis --version v8

# 3. Manual sync if needed
psql -h <host> -U postgres -c "SELECT sync_subscription_from_stripe('<sub_id>')"
```

---

## Success Metrics

### Quantitative Metrics

| Metric | Baseline | Target | Measurement Period |
|--------|----------|--------|-------------------|
| **Webhook Success Rate** | 20.8% | >95% | 30 days post-deployment |
| **Webhook Failure Count** | 19/24 (79.2%) | <2/100 (<2%) | 30 days post-deployment |
| **Missing Metadata Failures** | 17/24 (71%) | 0 | 30 days post-deployment |
| **Stuck Trials** | Unknown | 0 | Real-time monitoring |
| **Canceled Subs (Stale DB)** | 6 | 0 | Real-time monitoring |
| **Cron Execution Time** | Unknown | <30s | Per hourly run |
| **Manual Remediation** | Unknown | 0 events/month | Monthly report |
| **Audit Trail Coverage** (NEW) | 0% (no linking) | 100% | 30 days post-deployment |

### Qualitative Metrics

- ✅ Zero user complaints about incorrect subscription status
- ✅ Zero support tickets for missing credits after plan change
- ✅ Admin dashboard shows 100% webhook health
- ✅ Engineering team confident in subscription automation
- ✅ Complete audit trail for all subscription state changes (webhook events linkable to state changes)
- ✅ Documentation complete and up-to-date

### Post-Deployment Validation (30 Days)

**Week 1**:
- [ ] Monitor webhook success rate daily
- [ ] Check cron logs for errors
- [ ] Verify no stuck trials or expired active subscriptions

**Week 2**:
- [ ] Review metadata fallback usage (should decline to near-zero)
- [ ] Check alert thresholds (adjust if needed)
- [ ] Interview support team for user feedback

**Week 3**:
- [ ] Analyze 30-day webhook data
- [ ] Calculate cost savings (reduced manual remediation)
- [ ] Document lessons learned

**Week 4**:
- [ ] Final metrics report
- [ ] Update runbooks with operational procedures
- [ ] Plan Phase 5b (external notifications) if needed

---

## Dependencies and Prerequisites

### Technical Requirements

- ✅ Supabase Edge Functions (Deno runtime)
- ✅ pg_cron extension enabled
- ✅ Stripe Wrappers FDW configured
- ✅ Existing database functions deployed
- ✅ Non-prod and prod environments available

### Team Requirements

- Backend engineer (implementation) - 2 weeks full-time
- QA engineer (testing) - 1 week part-time
- DevOps engineer (deployment) - 2 days part-time
- Product manager (sign-off) - Review checkpoints

### External Dependencies

- Stripe webhook endpoint must remain stable
- Clerk user IDs must not change format
- Supabase Wrappers must stay at v0.5.4+ (FDW bug fix)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Phase 1 deployment breaks existing webhooks** | Low | High | Thorough non-prod testing, gradual rollout |
| **Metadata fallback causes infinite loops** | Low | High | Idempotency checks, retry limits |
| **Cron job overloads database** | Low | Medium | Load testing, batch size limits, query optimization |
| **Stripe API rate limits** | Low | Medium | Caching, batch processing, exponential backoff |
| **Missing edge cases not caught in testing** | Medium | Medium | Comprehensive integration tests, canary deployment |
| **Documentation incomplete** | Medium | Low | Peer review, runbook validation |

---

## Timeline Summary

| Phase | Duration | Effort | Dependencies |
|-------|----------|--------|--------------|
| **Phase 1: Cancellation Fix** | 3 days | 16 hours | None |
| **Phase 2: Metadata Fallback** | 5 days | 32 hours | Phase 1 |
| **Phase 3: Checkout Validation** | 3 days | 16 hours | None (parallel) |
| **Phase 4: Cron Enhancement** | 4 days | 24 hours | Phase 1, 2 |
| **Phase 5: Monitoring** | 3 days | 16 hours | Phase 1-4 |
| **Testing & Validation** | 2 days | 12 hours | Phase 1-5 |
| **TOTAL** | **3 weeks** | **116 hours** | |

**Recommended Schedule**:
- Week 1: Phase 1 + Phase 3 (parallel)
- Week 2: Phase 2 + Phase 4
- Week 3: Phase 5 + Testing + Deployment

---

## Appendix

### A. Database Schema Changes

**New Tables**:
- `metadata_fallback_logs` - Track metadata fallback usage
- `metadata_reconciliation_log` - Track metadata mismatches
- `alert_thresholds` - Alert configuration

**Modified Tables**:
- None (all changes additive)

**New Functions**:
- `resolveClerkUserId()` - Edge Function (TypeScript)
- `reconcile_subscription_metadata()` - Database function
- `evaluate_subscription_alerts()` - Database function
- `retry_failed_webhook()` - Database function
- `batch_sync_problem_subscriptions()` - Database function

**Modified Functions**:
- `handleSubscriptionDeleted()` - Add state machine call
- `handleSubscriptionUpdated()` - Add metadata validation
- `sync_expired_subscriptions()` - Add cancellation detection
- All webhook handlers - Use new metadata validation

### B. Environment Variables

**No new environment variables required**

All configuration stored in database tables:
- `alert_thresholds` - Alert configuration
- `system_logs` - Historical data
- `cron.job` - Cron schedules

### C. Related Documentation

**Top-Level**:
- `TRIAL_TO_ACTIVE_CREDIT_FIX_PLAN.md` - Previous webhook fix (2025-11-07)
- `TRIAL_TO_ACTIVE_CREDIT_FIX_IMPLEMENTATION_COMPLETE.md` - Implementation results
- `CREDIT_SYSTEM_CONSOLIDATION_PLAN.md` - Credit system architecture

**Backend**:
- `backend/CREDIT_SYSTEM_CONSOLIDATED.md` - Complete credit system implementation
- `backend/docs-internal/subscription-cron-jobs.md` - Cron job documentation
- `backend/docs-internal/operations/SUBSCRIPTION_SYNC_FIX.md` - Previous sync fixes
- `backend/CLAUDE.md` - Backend development guidelines

**Frontend**:
- None directly related

### D. Glossary

| Term | Definition |
|------|------------|
| **Edge Function** | Supabase serverless function (Deno runtime) that handles webhooks |
| **pg_cron** | PostgreSQL extension for scheduled jobs (runs inside database) |
| **State Machine** | `process_subscription_state_change()` - Core business logic function |
| **FDW** | Foreign Data Wrapper - Allows PostgreSQL to query external data (Stripe) |
| **Idempotency** | Processing the same event multiple times produces the same result |
| **Graceful Degradation** | System continues functioning even with missing data |
| **Defense-in-Depth** | Multiple layers of automation (webhook + cron + manual) |
| **Metadata Fallback** | Looking up clerk_user_id from database when missing from Stripe |
| **Cache** | `subscription_cache` table - 5-minute TTL performance optimization |
| **Ledger Model** | Credit balances computed from INSERT-only transactions table |

---

## Document Metadata

**Created**: 2025-11-07
**Last Updated**: 2025-11-07
**Author**: Claude Code (Anthropic)
**Reviewers**: (TBD)
**Status**: 📝 DRAFT - Awaiting review and approval
**Version**: 1.0

**Related Issues**:
- 🔴 CRITICAL: 79% webhook failure rate
- 🔴 CRITICAL: Cancellations not persisted to database
- 🟡 HIGH: Missing clerk_user_id metadata (71% of failures)
- 🟡 MEDIUM: Cron doesn't detect cancellations
- 🟢 LOW: No monitoring/alerting for subscription issues

**Next Steps**:
1. Review and approve plan
2. Create implementation tasks in project tracker
3. Allocate engineering resources (2 weeks full-time)
4. Begin Phase 1 implementation

---

**End of Document**
