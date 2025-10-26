# Admin Team Transfer Troubleshooting Guide

**Audience**: System Administrators, Support Staff
**Last Updated**: 2025-10-24
**Status**: Production Reference

---

## Overview

This guide helps admins troubleshoot issues with automatic story and credit transfers when users join teams or upgrade subscriptions.

## Transfer Mechanisms

### 1. Team Invitation Acceptance

**Trigger**: Clerk webhook `organizationMembership.created`

**Handler**: `backend/modules/clerk-organization-webhooks.ts` (lines 182-286)

**Flow**:
```
1. User accepts Clerk invitation
2. Clerk sends webhook to /webhooks/clerk/organization
3. handleMembershipCreated() processes webhook
4. Creates team_members record
5. Calls onboard_team_member(userId, teamId)
6. Transfers stories, credits, cancels subscription
7. Returns success to Clerk
```

**Database Function**: `onboard_team_member()` (`backend/sql/team-member-onboarding.sql`)

### 2. Subscription Upgrade

**Trigger**: Stripe webhook `customer.subscription.updated`

**Handler**: `backend/modules/webhook-manager.ts` (line 325)

**Flow**:
```
1. User upgrades to Team/Custom plan in Stripe
2. Stripe sends webhook to /webhooks/stripe
3. process_subscription_webhook() called
4. detect_and_handle_subscription_upgrade() detects upgrade
5. Auto-creates team if needed
6. Calls onboard_team_member(userId, teamId)
7. Transfers stories, credits, cancels subscription
8. Returns success to Stripe
```

**Database Functions**:
- `detect_and_handle_subscription_upgrade()` (`backend/sql/subscription-upgrade-transfer.sql`)
- `process_subscription_webhook()` (enhanced version)

---

## Common Issues

### Issue 1: Transfer Didn't Happen

**Symptoms**:
- User reports stories/credits not transferred after joining team
- Activity log missing `team_join` or `subscription_upgrade_transfer` entry

**Diagnosis**:

```sql
-- Check if webhook was received
SELECT *
FROM webhook_idempotency
WHERE idempotency_key LIKE '%{user_id}%'
ORDER BY created_at DESC
LIMIT 10;

-- Check for transfer activity
SELECT *
FROM activities
WHERE user_id = '{user_id}'
  AND action_type IN ('team_join', 'subscription_upgrade_transfer')
ORDER BY created_at DESC;

-- Check system logs for errors
SELECT *
FROM system_logs
WHERE log_type LIKE '%transfer%'
  AND metadata->>'user_id' = '{user_id}'
ORDER BY created_at DESC
LIMIT 20;
```

**Common Causes**:

1. **Webhook not received**:
   - Check Clerk/Stripe webhook logs
   - Verify webhook endpoint is accessible
   - Check for webhook signature validation errors

2. **Webhook failed to process**:
   - Check system_logs for errors
   - Verify database connection
   - Check for constraint violations

3. **onboard_team_member() failed**:
   - Check system_logs for `subscription_upgrade_transfer_error`
   - Verify user exists in user_profiles
   - Verify team exists in teams table

**Resolution**:

```sql
-- Manual transfer (if webhook failed)
-- WARNING: Only use if automatic transfer confirmed failed
SELECT onboard_team_member('{user_id}', '{team_id}');

-- Check result
SELECT *
FROM activities
WHERE user_id = '{user_id}'
  AND action_type = 'team_join'
ORDER BY created_at DESC
LIMIT 1;
```

### Issue 2: Partial Transfer

**Symptoms**:
- Credits transferred but not stories (or vice versa)
- Some stories transferred but not all

**Diagnosis**:

```sql
-- Check which stories belong to user vs team
SELECT
  CASE
    WHEN team_id IS NULL OR team_id = '' THEN 'Personal'
    ELSE 'Team'
  END as ownership,
  COUNT(*) as count
FROM stories
WHERE user_id = '{user_id}'
GROUP BY ownership;

-- Check credit transaction history
SELECT *
FROM credit_transactions
WHERE user_id = '{user_id}'
  AND transaction_type = 'transfer'
ORDER BY created_at DESC
LIMIT 10;

-- Check onboarding result from activity metadata
SELECT
  metadata->'creditsTransferred' as credits_transferred,
  metadata->'storiesTransferred' as stories_transferred,
  metadata->'subscriptionCancelled' as subscription_cancelled
FROM activities
WHERE user_id = '{user_id}'
  AND action_type IN ('team_join', 'subscription_upgrade_transfer')
ORDER BY created_at DESC
LIMIT 1;
```

**Common Causes**:

1. **Transaction rollback**:
   - Database transaction failed mid-transfer
   - Check PostgreSQL logs for transaction errors

2. **Community story remixes**:
   - These are EXCLUDED from transfer (expected behavior)
   - Verify stories have `original_community_story_id IS NULL`

3. **Zero balance/No stories**:
   - User had nothing to transfer (expected behavior)
   - Check activity metadata shows `stories_transferred: 0`

**Resolution**:

```sql
-- Re-run transfer for remaining items
-- This is idempotent - safe to re-run
SELECT onboard_team_member('{user_id}', '{team_id}');
```

### Issue 3: Subscription Not Canceled

**Symptoms**:
- User still has active individual subscription after transfer
- User being charged for both individual and team subscriptions

**Diagnosis**:

```sql
-- Check current subscriptions
SELECT
  id,
  plan_id,
  status,
  cancel_at_period_end,
  current_period_end
FROM subscriptions
WHERE user_id = '{user_id}'
ORDER BY created_at DESC;

-- Check if cancellation was attempted
SELECT
  metadata->'subscriptionCancellation' as cancellation_result
FROM activities
WHERE user_id = '{user_id}'
  AND action_type IN ('team_join', 'subscription_upgrade_transfer')
ORDER BY created_at DESC
LIMIT 1;
```

**Common Causes**:

1. **Subscription already canceled**:
   - User canceled before joining team
   - Nothing to do (expected)

2. **Non-individual plan**:
   - User has Team/Custom plan (not auto-canceled)
   - Only individual/trial plans are canceled

3. **Cancel failed**:
   - Database update failed
   - Check system_logs for errors

**Resolution**:

```sql
-- Manual cancellation
UPDATE subscriptions
SET
  status = 'canceled',
  cancel_at_period_end = true,
  updated_at = NOW()
WHERE user_id = '{user_id}'
  AND status IN ('active', 'trialing')
  AND plan_id IN ('individual', 'trial');

-- Verify
SELECT plan_id, status, cancel_at_period_end
FROM subscriptions
WHERE user_id = '{user_id}';
```

### Issue 4: Duplicate Transfer

**Symptoms**:
- User reports transfer happened twice
- Activity log shows multiple `team_join` entries
- Credits subtracted twice from personal balance

**Diagnosis**:

```sql
-- Check for duplicate activities
SELECT
  action_type,
  created_at,
  metadata->'creditsTransferred' as credits,
  metadata->'storiesTransferred' as stories
FROM activities
WHERE user_id = '{user_id}'
  AND action_type IN ('team_join', 'subscription_upgrade_transfer')
ORDER BY created_at DESC;

-- Check webhook idempotency
SELECT
  idempotency_key,
  operation_type,
  created_at
FROM webhook_idempotency
WHERE webhook_event_id IN (
  SELECT metadata->>'webhook_event_id'
  FROM activities
  WHERE user_id = '{user_id}'
    AND action_type IN ('team_join', 'subscription_upgrade_transfer')
)
ORDER BY created_at DESC;
```

**Common Causes**:

1. **Webhook retry**:
   - Stripe/Clerk retried webhook due to timeout
   - Idempotency check should prevent this

2. **Manual re-execution**:
   - Admin ran `onboard_team_member()` manually
   - Function is NOT fully idempotent (will transfer again)

3. **Multiple team joins**:
   - User joined team, left, rejoined
   - Each join triggers new transfer

**Resolution**:

```sql
-- Check credit balance history
SELECT *
FROM credit_transactions
WHERE user_id = '{user_id}'
ORDER BY created_at DESC
LIMIT 20;

-- If duplicate transfer confirmed, manual credit adjustment needed
-- Contact finance team for refund process
```

**Prevention**:
- Always check activity log before manual transfer
- Use webhook idempotency keys
- Never re-run `onboard_team_member()` unless transfer confirmed failed

### Issue 5: Team Not Auto-Created on Upgrade

**Symptoms**:
- User upgraded to Team plan
- Stories/credits not transferred
- User has no team

**Diagnosis**:

```sql
-- Check if user has a team
SELECT *
FROM teams
WHERE owner_id = '{user_id}';

-- Check if upgrade was detected
SELECT *
FROM system_logs
WHERE log_type = 'subscription_upgrade_detected'
  AND metadata->>'user_id' = '{user_id}'
ORDER BY created_at DESC
LIMIT 5;

-- Check subscription history
SELECT
  plan_id,
  status,
  created_at,
  updated_at
FROM subscriptions
WHERE user_id = '{user_id}'
ORDER BY created_at DESC;
```

**Common Causes**:

1. **plan_id not set in Stripe metadata**:
   - Stripe subscription missing `metadata.plan_id`
   - Defaults to 'individual' - no upgrade detected

2. **Upgrade detection failed**:
   - Old plan_id same as new plan_id
   - Not an individual→team upgrade

3. **Team creation failed**:
   - Database constraint violation
   - User already has team

**Resolution**:

```sql
-- Create team manually
INSERT INTO teams (
  id,
  name,
  owner_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid()::text,
  '{User Name}''s Team',
  '{user_id}',
  NOW(),
  NOW()
) RETURNING id;

-- Create team_members record
INSERT INTO team_members (
  team_id,
  user_id,
  role,
  email,
  status
) VALUES (
  '{team_id}',
  '{user_id}',
  'owner',
  '{user_email}',
  'active'
);

-- Run transfer
SELECT onboard_team_member('{user_id}', '{team_id}');
```

---

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Transfer Success Rate**:
```sql
-- Daily transfer success rate
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE metadata->>'transfer_success' = 'true') as successful,
  COUNT(*) FILTER (WHERE metadata->>'transfer_success' = 'false') as failed,
  COUNT(*) as total
FROM activities
WHERE action_type IN ('team_join', 'subscription_upgrade_transfer')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

2. **Average Transfer Sizes**:
```sql
-- Average stories/credits transferred
SELECT
  AVG((metadata->>'storiesTransferred')::INTEGER) as avg_stories,
  AVG((metadata->>'creditsTransferred')::INTEGER) as avg_credits
FROM activities
WHERE action_type IN ('team_join', 'subscription_upgrade_transfer')
  AND created_at > NOW() - INTERVAL '30 days';
```

3. **Transfer Errors**:
```sql
-- Recent transfer errors
SELECT
  log_type,
  log_message,
  metadata->>'user_id' as user_id,
  created_at
FROM system_logs
WHERE log_type IN (
  'subscription_upgrade_transfer_error',
  'subscription_upgrade_transfer_exception'
)
ORDER BY created_at DESC
LIMIT 50;
```

### Recommended Alerts

Set up monitoring alerts for:

1. **Transfer failure rate > 5%** (24-hour window)
2. **No transfers in past 24 hours** (if normally active)
3. **Webhook processing latency > 5 seconds**
4. **Database function execution errors**

---

## Support Scripts

### Check User Transfer Status

```sql
-- Complete transfer audit for user
WITH user_info AS (
  SELECT
    id,
    email,
    subscription_status,
    created_at as user_created_at
  FROM user_profiles
  WHERE id = '{user_id}'
),
team_info AS (
  SELECT
    t.id as team_id,
    t.name as team_name,
    tm.role,
    tm.status,
    tm.created_at as joined_at
  FROM teams t
  JOIN team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = '{user_id}'
),
story_info AS (
  SELECT
    COUNT(*) FILTER (WHERE team_id IS NULL OR team_id = '') as personal_stories,
    COUNT(*) FILTER (WHERE team_id IS NOT NULL AND team_id != '') as team_stories
  FROM stories
  WHERE user_id = '{user_id}'
),
credit_info AS (
  SELECT
    balance as personal_credits
  FROM credit_balances
  WHERE user_id = '{user_id}'
),
transfer_history AS (
  SELECT
    action_type,
    metadata->'creditsTransferred' as credits_transferred,
    metadata->'storiesTransferred' as stories_transferred,
    created_at
  FROM activities
  WHERE user_id = '{user_id}'
    AND action_type IN ('team_join', 'subscription_upgrade_transfer')
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  u.*,
  t.*,
  s.*,
  c.*,
  th.*
FROM user_info u
LEFT JOIN team_info t ON TRUE
LEFT JOIN story_info s ON TRUE
LEFT JOIN credit_info c ON TRUE
LEFT JOIN transfer_history th ON TRUE;
```

### Validate Transfer Integrity

```sql
-- Check for orphaned stories (shouldn't exist)
SELECT
  id,
  user_id,
  team_id,
  created_at
FROM stories
WHERE user_id IS NOT NULL
  AND team_id IS NOT NULL
  AND team_id != ''
  AND NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = stories.team_id
      AND user_id = stories.user_id
  );

-- Check for negative credit balances (shouldn't exist)
SELECT
  user_id,
  balance,
  updated_at
FROM credit_balances
WHERE balance < 0;
```

---

## Escalation

### When to Escalate to Engineering

Escalate if:

1. **Multiple users affected** (not isolated incident)
2. **Data integrity issues** (orphaned stories, negative credits)
3. **Webhook failures** (webhook endpoint down)
4. **Database errors** (constraint violations, transaction failures)
5. **Manual resolution ineffective** (script doesn't fix issue)

### Escalation Information to Provide

Include:
- User ID(s)
- Team ID(s)
- Timestamp of transfer attempt
- Activity log entries
- System log errors
- Webhook event IDs
- Steps already attempted

---

## Reference

### Database Tables

- `teams` - Team records
- `team_members` - Team membership
- `stories` - Story ownership
- `credit_balances` - Credit ownership
- `subscriptions` - Subscription status
- `activities` - Transfer activity log
- `system_logs` - System error logs
- `webhook_idempotency` - Webhook deduplication

### Database Functions

- `onboard_team_member(user_id, team_id)` - Main transfer function
- `transfer_all_user_stories_to_team(user_id, team_id, description)` - Story transfer
- `transfer_all_user_credits_to_team(user_id, team_id, description)` - Credit transfer
- `detect_and_handle_subscription_upgrade(...)` - Upgrade detection
- `process_subscription_webhook(...)` - Webhook handler

### API Endpoints

- `POST /webhooks/clerk/organization` - Clerk organization webhooks
- `POST /webhooks/stripe` - Stripe payment webhooks
- `GET /users/{userId}/transfer-preview` - Preview transfer (NEW)

---

**Document Version**: 1.0
**Created**: 2025-10-24
**Maintained By**: Backend Team
**Review Frequency**: Quarterly
