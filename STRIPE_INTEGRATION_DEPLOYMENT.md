# Stripe Integration Architecture - Deployment Guide

**Created:** 2025-10-26
**Status:** Ready for Deployment
**Reference:** `STRIPE_INTEGRATION_ARCHITECTURE.md`

## ⚠️ CRITICAL WARNING: Existing Webhook Handler

**STOP! Read this before deploying.**

An **existing Stripe webhook handler** is currently running in production in Zuplo at `/icraft-stripe-webhook`. It processes the same events as the new Supabase Edge Function you're about to deploy.

**Before proceeding:**
1. 📖 Read `backend/WEBHOOK_MIGRATION_PLAN.md` for the complete migration strategy
2. ⚠️ Decide: Gradual migration (8 weeks) or parallel operation?
3. ✅ Configure Stripe to send webhooks to BOTH endpoints during migration
4. 📊 Set up monitoring for both handlers

**Deploying the Edge Function alone will NOT replace the existing handler.** You must follow the migration plan to avoid confusion and ensure smooth transition.

---

## Overview

This guide covers the complete deployment of the Stripe integration architecture as specified in `STRIPE_INTEGRATION_ARCHITECTURE.md`. The implementation includes:

- Subscription cache (5-minute TTL) for performance
- Stripe webhook event tracking for idempotency
- Subscription state machine with credit validation
- Supabase Edge Function for webhook processing
- Updated Zuplo API endpoints with state validation

## Prerequisites

- Access to Supabase production database (`lgkjfymwvhcjvfkuidis`)
- Access to Supabase non-prod database (`jjpbogjufnqzsgiiaqwn`)
- Supabase CLI installed (`supabase`)
- PostgreSQL client (`psql`) configured
- Stripe dashboard access (live and test modes)
- Zuplo deployment access

## Phase 1: Database Setup (Day 1-2)

### Step 1.1: Deploy Schema Migration

Deploy to **non-prod first** for testing:

```bash
# Connect to non-prod database
export DB_URL="postgresql://postgres:[password]@db.jjpbogjufnqzsgiiaqwn.supabase.co:5432/postgres"

# Deploy migration 013
psql $DB_URL < backend/sql/migrations/013_subscription_cache_stripe_events.sql

# Verify tables created
psql $DB_URL -c "\d subscription_cache"
psql $DB_URL -c "\d stripe_events"
```

**Validation:**
```sql
-- Check table creation
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('subscription_cache', 'stripe_events');

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('subscription_cache', 'stripe_events');
```

### Step 1.2: Deploy State Machine Functions

```bash
# Deploy subscription state machine
psql $DB_URL < backend/sql/subscription-state-machine.sql

# Verify functions created
psql $DB_URL -c "\df public.get_user_subscription_state"
psql $DB_URL -c "\df public.use_credits_validated"
psql $DB_URL -c "\df public.add_subscription_credits"
```

**Test functions:**
```sql
-- Test state machine (should return state JSON)
SELECT public.get_user_subscription_state('test_user_id');

-- Test get/create customer
SELECT public.get_or_create_stripe_customer('test_user_id', 'test@example.com');
```

### Step 1.3: Deploy Cache Refresh Cron Job

```bash
# Deploy cache refresh logic
psql $DB_URL < backend/sql/cache-refresh-cron.sql

# Verify cron job created
psql $DB_URL -c "SELECT * FROM cron.job WHERE jobname = 'subscription_cache_cleanup';"
```

**Validation:**
```sql
-- Check cache status function
SELECT public.get_subscription_cache_status();

-- Check cache cleanup history
SELECT * FROM public.get_cache_cleanup_history(5);
```

### Step 1.4: Production Database Deployment

**After non-prod validation**, deploy to production:

```bash
# Connect to production database
export DB_URL="postgresql://postgres:[password]@db.lgkjfymwvhcjvfkuidis.supabase.co:5432/postgres"

# Run all SQL files in order
psql $DB_URL < backend/sql/migrations/013_subscription_cache_stripe_events.sql
psql $DB_URL < backend/sql/subscription-state-machine.sql
psql $DB_URL < backend/sql/cache-refresh-cron.sql
```

## Phase 2: Edge Functions (Day 3)

### Step 2.1: Deploy Stripe Webhook Edge Function

```bash
cd backend/supabase/functions

# Link to Supabase project (non-prod)
supabase link --project-ref jjpbogjufnqzsgiiaqwn

# Deploy edge function (no JWT verification - uses signature verification)
supabase functions deploy stripe-webhook --no-verify-jwt

# Set secrets (non-prod)
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set SUPABASE_URL=https://jjpbogjufnqzsgiiaqwn.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Step 2.2: Test Edge Function Locally

```bash
# Create .env.local for testing
cat > backend/supabase/functions/.env.local << EOF
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SUPABASE_URL=https://jjpbogjufnqzsgiiaqwn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
EOF

# Start local edge function server
supabase functions serve stripe-webhook --env-file .env.local

# In another terminal, test with Stripe CLI
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger invoice.payment_succeeded
```

**Expected output:**
- Event logged to `stripe_events` table
- Credits allocated via `add_subscription_credits()`
- Subscription cache updated

### Step 2.3: Deploy to Production

```bash
# Link to production project
supabase link --project-ref lgkjfymwvhcjvfkuidis

# Deploy edge function
supabase functions deploy stripe-webhook --no-verify-jwt

# Set production secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set SUPABASE_URL=https://lgkjfymwvhcjvfkuidis.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Phase 3: Zuplo Updates (Day 4-5)

### Step 3.1: Add New Module to Zuplo

```bash
cd backend

# Verify new module exists
ls -la modules/stripe-checkout-service.ts
```

### Step 3.2: Update Zuplo Routes Configuration

Add to `backend/config/routes.oas.json`:

```json
{
  "paths": {
    "/stripe/checkout/session": {
      "post": {
        "summary": "Create Stripe checkout session",
        "operationId": "createCheckoutSession",
        "x-zuplo-route": {
          "handler": {
            "module": "$import(@zuplo/runtime)",
            "export": "createCheckoutSession",
            "file": "modules/stripe-checkout-service.ts"
          },
          "policies": {
            "inbound": ["clerk-jwt-auth"]
          }
        }
      }
    },
    "/stripe/subscription/state": {
      "get": {
        "summary": "Get subscription state",
        "operationId": "getSubscriptionState",
        "x-zuplo-route": {
          "handler": {
            "module": "$import(@zuplo/runtime)",
            "export": "getSubscriptionState",
            "file": "modules/stripe-checkout-service.ts"
          },
          "policies": {
            "inbound": ["clerk-jwt-auth"]
          }
        }
      }
    },
    "/stories/generate-with-credits": {
      "post": {
        "summary": "Generate story with credit validation",
        "operationId": "generateStoryWithCredits",
        "x-zuplo-route": {
          "handler": {
            "module": "$import(@zuplo/runtime)",
            "export": "generateStoryWithCredits",
            "file": "modules/stripe-checkout-service.ts"
          },
          "policies": {
            "inbound": ["clerk-jwt-auth"]
          }
        }
      }
    }
  }
}
```

### Step 3.3: Deploy via GitOps

```bash
cd backend

# Create feature branch
git checkout -b feature/stripe-integration-architecture
git add modules/stripe-checkout-service.ts
git add config/routes.oas.json
git commit -m "feat: Implement Stripe integration architecture

- Add subscription state machine functions
- Add subscription cache with 5-minute TTL
- Add stripe_events table for webhook idempotency
- Add Supabase Edge Function for webhook processing
- Add new Zuplo endpoints with state validation

Ref: STRIPE_INTEGRATION_ARCHITECTURE.md"

# Push to development
git push origin feature/stripe-integration-architecture

# Merge to develop for dev deployment
git checkout develop
git merge feature/stripe-integration-architecture
git push origin develop
```

**Dev environment will auto-deploy** (Zuplo GitOps)

### Step 3.4: Test in Dev Environment

```bash
# Test checkout session creation
curl -X POST https://unico-api-develop-b2f4ce8.zuplo.app/stripe/checkout/session \
  -H "Authorization: Bearer $CLERK_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price_id": "price_test_xxx",
    "success_url": "https://dev.icraftstories.com/success",
    "cancel_url": "https://dev.icraftstories.com/cancel"
  }'

# Test subscription state
curl https://unico-api-develop-b2f4ce8.zuplo.app/stripe/subscription/state \
  -H "Authorization: Bearer $CLERK_JWT_TOKEN"

# Test credit usage
curl -X POST https://unico-api-develop-b2f4ce8.zuplo.app/stories/generate-with-credits \
  -H "Authorization: Bearer $CLERK_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Story",
    "prompt": "A test story about deployment",
    "includeImage": true
  }'
```

## Phase 4: Stripe Configuration (Day 6)

### Step 4.1: Configure Stripe Products (Test Mode)

In Stripe Dashboard → Products (Test Mode):

1. Create/update products with metadata:
   ```
   Product: Individual Plan
   - Price: $9.99/month
   - Metadata: credits = "30"

   Product: Team Plan
   - Price: $29.99/month
   - Metadata: credits = "200"

   Product: Custom Plan
   - Price: $49.99/month
   - Metadata: credits = "500"
   ```

2. Note the `price_id` for each (e.g., `price_xxx`)

### Step 4.2: Configure Webhook Endpoint (Test Mode)

In Stripe Dashboard → Webhooks (Test Mode):

1. **Add endpoint:**
   - URL: `https://jjpbogjufnqzsgiiaqwn.supabase.co/functions/v1/stripe-webhook`
   - Description: "iCraft Non-Prod Webhook"

2. **Select events:**
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`

3. **Copy webhook secret** (`whsec_xxx`)

4. **Update Supabase secrets:**
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

### Step 4.3: Test Webhook Delivery

1. **Trigger test event in Stripe:**
   - Stripe Dashboard → Webhooks → Test endpoint → Send test webhook

2. **Verify in Supabase:**
   ```sql
   -- Check event received
   SELECT * FROM stripe_events ORDER BY created_at DESC LIMIT 5;

   -- Check event processing
   SELECT processed, error, created_at
   FROM stripe_events
   WHERE stripe_event_id = 'evt_xxx';
   ```

### Step 4.4: Production Stripe Configuration

Repeat steps 4.1-4.3 for **Live Mode**:
- Use production webhook URL: `https://lgkjfymwvhcjvfkuidis.supabase.co/functions/v1/stripe-webhook`
- Update production secrets

## Phase 5: Testing & Rollout (Day 7-10)

### Step 5.1: Integration Tests

**Test Scenario 1: New User Subscription**
1. Create checkout session via API
2. Complete Stripe checkout (test mode)
3. Verify webhook received and processed
4. Check subscription cache updated
5. Check credits allocated

**Test Scenario 2: Monthly Renewal**
1. Trigger `invoice.payment_succeeded` webhook
2. Verify credits allocated via `add_subscription_credits()`
3. Check credit balance updated
4. Check activity log created

**Test Scenario 3: Credit Usage**
1. Call `/stories/generate-with-credits`
2. Verify state validation passes
3. Check credits deducted
4. Verify refund on generation failure

**Test Scenario 4: Subscription Cancellation**
1. Cancel subscription in Stripe
2. Verify webhook processed
3. Check cache updated to `canceled` state
4. Verify user can still use credits until period end

### Step 5.2: Monitoring Queries

```sql
-- Cache health
SELECT public.get_subscription_cache_status();

-- Recent webhook events
SELECT stripe_event_id, event_type, processed, error
FROM stripe_events
ORDER BY created_at DESC
LIMIT 20;

-- Failed webhook processing
SELECT *
FROM stripe_events
WHERE NOT processed
ORDER BY created_at DESC;

-- Cache cleanup history
SELECT * FROM public.get_cache_cleanup_history(10);

-- Subscription states by status
SELECT
  sc.status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - sc.cached_at))) as avg_age_seconds
FROM subscription_cache sc
WHERE sc.expires_at >= NOW()
GROUP BY sc.status;
```

### Step 5.3: Gradual Production Rollout

1. **QA Environment:**
   ```bash
   git checkout preview
   git merge develop
   git push origin preview
   ```
   - Test with QA Stripe account
   - Verify all flows work

2. **Production Deployment:**
   ```bash
   git checkout main
   git merge preview
   git push origin main
   ```
   - Monitor webhook processing
   - Watch error rates
   - Check cache hit rates

3. **Rollback Plan:**
   ```bash
   # If issues detected, rollback
   cd backend
   npm run rollback:production
   ```

## Monitoring & Operations

### Daily Checks

```sql
-- Check webhook processing queue
SELECT COUNT(*)
FROM stripe_events
WHERE NOT processed
  AND created_at > NOW() - INTERVAL '1 day';

-- Check cache health
SELECT public.get_subscription_cache_status();
```

### Weekly Checks

```sql
-- Reconcile credit balances with Stripe invoices
SELECT
  ct.user_id,
  SUM(ct.amount) FILTER (WHERE ct.transaction_type = 'allocation') as allocated,
  SUM(ct.amount) FILTER (WHERE ct.transaction_type = 'usage') as used,
  SUM(ct.amount) as balance
FROM credit_transactions ct
WHERE ct.created_at > NOW() - INTERVAL '1 week'
GROUP BY ct.user_id
HAVING SUM(ct.amount) < 0;  -- Negative balance (shouldn't happen)
```

### Monthly Maintenance

```sql
-- Archive processed events older than 90 days
DELETE FROM stripe_events
WHERE processed = true
  AND created_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Issue: Webhook Not Processing

**Symptoms:** Events in `stripe_events` table with `processed = false`

**Diagnosis:**
```sql
SELECT stripe_event_id, event_type, error, retry_count
FROM stripe_events
WHERE NOT processed
ORDER BY created_at DESC;
```

**Resolution:**
1. Check error message
2. Fix underlying issue (e.g., missing user, invalid data)
3. Re-process event:
   ```sql
   -- Mark as unprocessed to trigger retry
   UPDATE stripe_events
   SET processed = false, retry_count = 0
   WHERE stripe_event_id = 'evt_xxx';
   ```

### Issue: Cache Always Expired

**Symptoms:** `get_user_subscription_state()` always returns `cached = false`

**Diagnosis:**
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE expires_at >= NOW()) as valid,
  AVG(EXTRACT(EPOCH FROM (expires_at - cached_at))) as avg_ttl_seconds
FROM subscription_cache;
```

**Resolution:**
- Check if `update_subscription_cache()` is being called
- Verify TTL is set correctly (5 minutes = 300 seconds)
- Clear all cache and let it rebuild: `SELECT public.clear_all_subscription_cache();`

### Issue: Credits Not Allocated

**Symptoms:** Invoice paid but credits not added

**Diagnosis:**
```sql
-- Check if webhook received
SELECT * FROM stripe_events
WHERE object_id = 'in_xxx'  -- Invoice ID
  AND event_type = 'invoice.payment_succeeded';

-- Check credit transactions
SELECT *
FROM credit_transactions
WHERE metadata->>'invoice_id' = 'in_xxx';
```

**Resolution:**
1. Check webhook was processed: `processed = true`
2. If not processed, check `error` field
3. Manually allocate credits if needed:
   ```sql
   SELECT public.add_subscription_credits(
     'cus_xxx',
     'in_xxx',
     'sub_xxx',
     30,
     'Manual credit allocation - missed webhook'
   );
   ```

## Rollback Procedures

### Database Rollback

**If database issues detected:**

```sql
-- Drop new tables
DROP TABLE IF EXISTS public.subscription_cache CASCADE;
DROP TABLE IF EXISTS public.stripe_events CASCADE;

-- Drop new functions
DROP FUNCTION IF EXISTS public.get_user_subscription_state CASCADE;
DROP FUNCTION IF EXISTS public.use_credits_validated CASCADE;
DROP FUNCTION IF EXISTS public.add_subscription_credits CASCADE;
DROP FUNCTION IF EXISTS public.update_subscription_cache CASCADE;
DROP FUNCTION IF EXISTS public.clear_expired_subscription_cache CASCADE;

-- Remove cron job
SELECT cron.unschedule('subscription_cache_cleanup');
```

### API Rollback

```bash
# Revert to previous release
cd backend
npm run rollback:production

# Or revert Git commits
git revert HEAD
git push origin main
```

### Edge Function Rollback

```bash
# Delete edge function
supabase functions delete stripe-webhook

# Revert to old webhook handler (if exists)
# Update Stripe webhook URL to old endpoint
```

## Success Metrics

### Performance Targets

- Cache hit rate: >80%
- Webhook processing latency: <2 seconds
- Credit allocation latency: <500ms
- API endpoint latency: <200ms

### Data Integrity Targets

- Webhook processing success rate: >99%
- Credit balance integrity: 100% (zero discrepancies)
- Cache staleness: <5 minutes

### Monitoring Queries

```sql
-- Cache hit rate (estimate)
SELECT
  COUNT(*) FILTER (WHERE cached_at > NOW() - INTERVAL '5 minutes') * 100.0 / NULLIF(COUNT(*), 0) as cache_hit_rate_pct
FROM subscription_cache;

-- Webhook success rate
SELECT
  COUNT(*) FILTER (WHERE processed) * 100.0 / NULLIF(COUNT(*), 0) as success_rate_pct
FROM stripe_events
WHERE created_at > NOW() - INTERVAL '1 day';
```

## Cost Analysis

### Infrastructure Costs (Monthly)

| Component | Cost | Notes |
|-----------|------|-------|
| Supabase (100 users) | $325 | Pro plan with compute |
| Stripe fees (2.9% + $0.30) | ~$30 | Based on transaction volume |
| Edge Function invocations | ~$0 | Included in Supabase Pro |
| Database storage | Included | < 8GB |
| **Total** | **~$355/month** | |

### Break-even Analysis

- Individual plan ($9.99/month): ~36 users
- Team plan ($29.99/month): ~12 teams
- Mixed: ~25-30 active subscriptions

## Next Steps

After successful deployment:

1. **Monitor metrics** for first week
2. **Gather user feedback** on subscription flow
3. **Optimize cache TTL** if needed (based on hit rates)
4. **Fine-tune webhook retry** logic
5. **Document operational procedures** for support team

## Support Contacts

- **Database issues:** Supabase support
- **Webhook issues:** Stripe support + internal team
- **API issues:** Zuplo support + internal team
- **Deployment issues:** DevOps team

---

**Document Version:** 1.0
**Last Updated:** 2025-10-26
**Maintained By:** Engineering Team
