# Subscription Sync Function Signature Fix - 2025-11-29

## Summary

Fixed function signature mismatch bug that was causing the hourly subscription sync cron job to fail silently. The bug affected both production and non-prod environments.

## Problem

The `sync_expired_subscriptions()` function was calling `sync_subscription_from_stripe()` with 2 parameters, but the function only accepts 1 parameter.

**Error from system_logs:**
```
function sync_subscription_from_stripe(text, text) does not exist
```

## Root Cause

```sql
-- ❌ WRONG: Called with 2 params (external_subscription_id, user_id)
PERFORM sync_subscription_from_stripe(
  v_expired_trials[i].external_subscription_id,
  v_expired_trials[i].user_id
);

-- ✅ CORRECT: Function only accepts 1 param
sync_subscription_from_stripe(p_external_subscription_id text)
```

The function internally looks up the user from the `subscriptions` table - the second parameter was never needed.

## Impact

**Production:**
- 3 subscriptions stuck in `trialing` (should be `active`)
- 1 subscription stuck in `past_due` (should be `canceled`)
- 7 user profiles with mismatched `subscription_status`

**Non-prod:**
- 9 subscriptions not syncing (accumulated over time)

## Fix Applied

### Migration: `fix_sync_expired_subscriptions_signature`

Applied to both production (`lgkjfymwvhcjvfkuidis`) and non-prod (`jjpbogjufnqzsgiiaqwn`).

Changed the function call to pass only 1 parameter:
```sql
PERFORM sync_subscription_from_stripe(
  v_expired_trials[i].external_subscription_id
);
```

### Data Remediation (Production)

1. Updated 3 trialing → active
2. Updated 1 past_due → canceled (verified against Stripe)
3. Synced 7 user_profiles.subscription_status to match subscriptions.status

## Verification

- Cron job now runs successfully (error_count: 0)
- No duplicate functions created
- No duplicate cron jobs created
- Both environments verified working

## Documentation

Full details in `backend/docs-internal/operations/SUBSCRIPTION_SYNC_FIX_2025-11-29.md`

## Key Learnings

1. Function signature drift can cause silent failures in scheduled jobs
2. System logs with error patterns are critical for diagnosis
3. Always verify the actual function signature when debugging "function does not exist" errors
