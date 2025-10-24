# Non-Production Data Migration Plan
## Existing Team Members with Personal Stories/Credits

**Date**: 2025-10-24
**Status**: ✅ COMPLETE - Migration Successful
**Environment**: Non-Production Only (jjpbogjufnqzsgiiaqwn)
**Executed**: 2025-10-24 14:53:35 UTC

---

## Problem Statement

We implemented automatic story and credit transfer when users join teams (via `onboard_team_member()`). However, **existing team members who joined BEFORE this implementation** may still have:

1. **Personal stories** that should belong to their team
2. **Personal credits** that should be in the team pool
3. **Active individual subscriptions** that should have been canceled

This migration will retroactively apply the same transfer logic to existing team members.

---

## Scope Analysis

### Step 1: Identify Affected Users

```sql
-- Find team members with personal stories
SELECT
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  up.email,
  COUNT(s.id) as personal_story_count
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN user_profiles up ON tm.user_id = up.id
LEFT JOIN stories s ON s.user_id = tm.user_id
  AND (s.team_id IS NULL OR s.team_id = '')
  AND s.original_community_story_id IS NULL  -- Exclude community remixes
WHERE tm.status = 'active'
GROUP BY tm.user_id, tm.team_id, t.name, up.email
HAVING COUNT(s.id) > 0
ORDER BY personal_story_count DESC;
```

```sql
-- Find team members with personal credits
SELECT
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  up.email,
  COALESCE(cb.balance, 0) as personal_credits
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN user_profiles up ON tm.user_id = up.id
LEFT JOIN credit_balances cb ON cb.user_id = tm.user_id
WHERE tm.status = 'active'
  AND COALESCE(cb.balance, 0) > 0
ORDER BY personal_credits DESC;
```

```sql
-- Find team members with active individual subscriptions
SELECT
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  up.email,
  s.plan_id,
  s.status,
  s.current_period_end
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN user_profiles up ON tm.user_id = up.id
JOIN subscriptions s ON s.user_id = tm.user_id
WHERE tm.status = 'active'
  AND s.status IN ('active', 'trialing')
  AND s.plan_id IN ('individual', 'trial')
ORDER BY s.current_period_end;
```

### Step 2: Combined Analysis

```sql
-- Get complete picture of affected users
WITH team_member_data AS (
  SELECT
    tm.user_id,
    tm.team_id,
    tm.role,
    t.name as team_name,
    up.email,
    tm.created_at as joined_at
  FROM team_members tm
  JOIN teams t ON tm.team_id = t.id
  JOIN user_profiles up ON tm.user_id = up.id
  WHERE tm.status = 'active'
),
story_data AS (
  SELECT
    user_id,
    COUNT(*) as personal_story_count
  FROM stories
  WHERE (team_id IS NULL OR team_id = '')
    AND original_community_story_id IS NULL  -- Exclude remixes
  GROUP BY user_id
),
credit_data AS (
  SELECT
    user_id,
    balance as personal_credits
  FROM credit_balances
  WHERE balance > 0
),
subscription_data AS (
  SELECT
    user_id,
    plan_id,
    status as sub_status
  FROM subscriptions
  WHERE status IN ('active', 'trialing')
    AND plan_id IN ('individual', 'trial')
)
SELECT
  tmd.user_id,
  tmd.team_id,
  tmd.team_name,
  tmd.email,
  tmd.role,
  tmd.joined_at,
  COALESCE(sd.personal_story_count, 0) as personal_stories,
  COALESCE(cd.personal_credits, 0) as personal_credits,
  sbd.plan_id as individual_subscription,
  sbd.sub_status
FROM team_member_data tmd
LEFT JOIN story_data sd ON sd.user_id = tmd.user_id
LEFT JOIN credit_data cd ON cd.user_id = tmd.user_id
LEFT JOIN subscription_data sbd ON sbd.user_id = tmd.user_id
WHERE COALESCE(sd.personal_story_count, 0) > 0
   OR COALESCE(cd.personal_credits, 0) > 0
   OR sbd.plan_id IS NOT NULL
ORDER BY
  COALESCE(sd.personal_story_count, 0) DESC,
  COALESCE(cd.personal_credits, 0) DESC;
```

---

## Migration Strategy

### Option 1: Use Existing `onboard_team_member()` Function ✅ RECOMMENDED

**Pros**:
- ✅ Uses battle-tested, production-ready code
- ✅ Includes full audit trail (activities table)
- ✅ Handles all edge cases (community remixes, etc.)
- ✅ Logs comprehensive metadata
- ✅ Transactional integrity guaranteed

**Cons**:
- ⚠️ Not idempotent - re-running transfers data twice
- ⚠️ Requires careful verification before execution

**Implementation**:
```sql
-- Migration script using existing function
DO $
DECLARE
  v_user record;
  v_result JSONB;
BEGIN
  -- Loop through affected users
  FOR v_user IN (
    SELECT DISTINCT
      tm.user_id,
      tm.team_id
    FROM team_members tm
    LEFT JOIN stories s ON s.user_id = tm.user_id
      AND (s.team_id IS NULL OR s.team_id = '')
      AND s.original_community_story_id IS NULL
    LEFT JOIN credit_balances cb ON cb.user_id = tm.user_id
    WHERE tm.status = 'active'
      AND (s.id IS NOT NULL OR cb.balance > 0)
    ORDER BY tm.user_id
  )
  LOOP
    -- Call existing onboard function
    SELECT onboard_team_member(v_user.user_id, v_user.team_id)
    INTO v_result;

    -- Log migration result
    RAISE NOTICE 'Migrated user % to team %: %',
      v_user.user_id,
      v_user.team_id,
      v_result::TEXT;
  END LOOP;
END $;
```

### Option 2: Custom Migration with Idempotency

**Pros**:
- ✅ Idempotent - safe to re-run
- ✅ Can be executed incrementally
- ✅ Explicit migration tracking

**Cons**:
- ❌ Duplicates transfer logic
- ❌ May miss edge cases
- ❌ Requires separate audit trail

**Implementation**: See migration script below

---

## Recommended Approach

**Use Option 1** with safety checks:

### Phase 1: Pre-Migration Validation (DRY RUN)

```sql
-- DRY RUN: Preview what would be transferred
SELECT
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  up.email,
  (
    SELECT COUNT(*)
    FROM stories s
    WHERE s.user_id = tm.user_id
      AND (s.team_id IS NULL OR s.team_id = '')
      AND s.original_community_story_id IS NULL
  ) as stories_to_transfer,
  COALESCE(cb.balance, 0) as credits_to_transfer,
  (
    SELECT plan_id
    FROM subscriptions
    WHERE user_id = tm.user_id
      AND status IN ('active', 'trialing')
      AND plan_id IN ('individual', 'trial')
    LIMIT 1
  ) as subscription_to_cancel
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN user_profiles up ON tm.user_id = up.id
LEFT JOIN credit_balances cb ON cb.user_id = tm.user_id
WHERE tm.status = 'active'
  AND (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.user_id = tm.user_id
        AND (s.team_id IS NULL OR s.team_id = '')
        AND s.original_community_story_id IS NULL
    )
    OR COALESCE(cb.balance, 0) > 0
  )
ORDER BY stories_to_transfer DESC, credits_to_transfer DESC;
```

### Phase 2: Create Migration Snapshot

```sql
-- Create snapshot table for rollback capability
CREATE TABLE IF NOT EXISTS migration_snapshot_20251024 AS
SELECT
  s.id as story_id,
  s.user_id,
  s.team_id as old_team_id,
  s.title,
  s.updated_at
FROM stories s
JOIN team_members tm ON s.user_id = tm.user_id
WHERE tm.status = 'active'
  AND (s.team_id IS NULL OR s.team_id = '')
  AND s.original_community_story_id IS NULL;

-- Snapshot credit balances
CREATE TABLE IF NOT EXISTS credit_snapshot_20251024 AS
SELECT
  cb.user_id,
  cb.balance as old_balance,
  tm.team_id,
  NOW() as snapshot_time
FROM credit_balances cb
JOIN team_members tm ON cb.user_id = tm.user_id
WHERE tm.status = 'active'
  AND cb.balance > 0;
```

### Phase 3: Execute Migration

```sql
-- ACTUAL MIGRATION (DO NOT RUN WITHOUT APPROVAL)
DO $
DECLARE
  v_user record;
  v_result JSONB;
  v_total INTEGER := 0;
  v_success INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  -- Count total users to migrate
  SELECT COUNT(DISTINCT tm.user_id)
  INTO v_total
  FROM team_members tm
  LEFT JOIN stories s ON s.user_id = tm.user_id
    AND (s.team_id IS NULL OR s.team_id = '')
    AND s.original_community_story_id IS NULL
  LEFT JOIN credit_balances cb ON cb.user_id = tm.user_id
  WHERE tm.status = 'active'
    AND (s.id IS NOT NULL OR cb.balance > 0);

  RAISE NOTICE 'Starting migration for % users...', v_total;

  -- Loop through affected users
  FOR v_user IN (
    SELECT DISTINCT
      tm.user_id,
      tm.team_id,
      up.email
    FROM team_members tm
    JOIN user_profiles up ON tm.user_id = up.id
    LEFT JOIN stories s ON s.user_id = tm.user_id
      AND (s.team_id IS NULL OR s.team_id = '')
      AND s.original_community_story_id IS NULL
    LEFT JOIN credit_balances cb ON cb.user_id = tm.user_id
    WHERE tm.status = 'active'
      AND (s.id IS NOT NULL OR cb.balance > 0)
    ORDER BY tm.user_id
  )
  LOOP
    BEGIN
      -- Call existing onboard function (with full error handling)
      SELECT onboard_team_member(v_user.user_id, v_user.team_id)
      INTO v_result;

      v_success := v_success + 1;

      RAISE NOTICE '[%/%] SUCCESS: Migrated user % (%) to team %: stories=%, credits=%',
        v_success + v_failed,
        v_total,
        v_user.user_id,
        v_user.email,
        v_user.team_id,
        COALESCE(v_result->>'stories_transferred', '0'),
        COALESCE(v_result->>'credits_transferred', '0');

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING '[%/%] FAILED: User % (%) - Error: %',
        v_success + v_failed,
        v_total,
        v_user.user_id,
        v_user.email,
        SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Migration complete: % succeeded, % failed out of % total',
    v_success, v_failed, v_total;
END $;
```

### Phase 4: Validation

```sql
-- Verify no personal stories remain for team members
SELECT
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  up.email,
  COUNT(s.id) as remaining_personal_stories
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN user_profiles up ON tm.user_id = up.id
LEFT JOIN stories s ON s.user_id = tm.user_id
  AND (s.team_id IS NULL OR s.team_id = '')
  AND s.original_community_story_id IS NULL
WHERE tm.status = 'active'
GROUP BY tm.user_id, tm.team_id, t.name, up.email
HAVING COUNT(s.id) > 0;

-- Expected result: 0 rows (all stories transferred)

-- Verify no personal credits remain for team members
SELECT
  tm.user_id,
  tm.team_id,
  t.name as team_name,
  up.email,
  cb.balance as remaining_credits
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN user_profiles up ON tm.user_id = up.id
LEFT JOIN credit_balances cb ON cb.user_id = tm.user_id
WHERE tm.status = 'active'
  AND cb.balance > 0;

-- Expected result: 0 rows (all credits transferred)

-- Verify migration activities logged
SELECT
  COUNT(*) as migration_activities
FROM activities
WHERE action_type = 'team_join'
  AND DATE(created_at) = CURRENT_DATE;
```

### Phase 5: Rollback Script (IF NEEDED)

```sql
-- ROLLBACK SCRIPT (EMERGENCY USE ONLY)
-- WARNING: Only use if migration goes wrong

-- Restore story ownership
UPDATE stories s
SET
  team_id = NULL,
  updated_at = NOW()
FROM migration_snapshot_20251024 ms
WHERE s.id = ms.story_id
  AND ms.old_team_id IS NULL;

-- Credits cannot be rolled back easily - would need manual adjustment
-- Subscriptions cannot be rolled back - would need manual re-activation

RAISE NOTICE 'Rollback complete. Credits and subscriptions require manual restoration.';
```

---

## Execution Checklist

### Pre-Migration
- [ ] Run Phase 1: Pre-Migration Validation (DRY RUN)
- [ ] Review affected users and counts
- [ ] Get approval from team lead
- [ ] Take database snapshot (via Supabase dashboard)
- [ ] Run Phase 2: Create Migration Snapshot tables
- [ ] Verify snapshot tables created successfully

### Migration
- [ ] Schedule maintenance window (optional for non-prod)
- [ ] Run Phase 3: Execute Migration
- [ ] Monitor migration output for errors
- [ ] Run Phase 4: Validation queries
- [ ] Verify expected results (0 remaining personal stories/credits)

### Post-Migration
- [ ] Check activities table for migration logs
- [ ] Spot-check 3-5 users manually in database
- [ ] Test team invitation flow with new user (should still work)
- [ ] Document migration results
- [ ] Drop snapshot tables after 30 days (if successful)

---

## Estimated Impact

**Non-Production Database**: `jjpbogjufnqzsgiiaqwn`

Expected affected users: **TBD** (run analysis queries)

**Risks**:
- ⚠️ Low risk - non-production environment
- ⚠️ Stories will become team-shared (team members can edit)
- ⚠️ Credits pooled into team (team admin controls distribution)
- ⚠️ Individual subscriptions canceled (users use team subscription)

**Timeline**:
- Analysis: 1 hour
- Approval: 1 business day
- Migration execution: 15 minutes
- Validation: 30 minutes
- Total: ~2 hours active work + approval time

---

## Production Considerations

**DO NOT RUN THIS MIGRATION IN PRODUCTION** without:

1. ✅ Successful non-prod migration
2. ✅ Legal review of data ownership changes
3. ✅ User communication plan (email notification)
4. ✅ Support team briefing
5. ✅ Maintenance window scheduled
6. ✅ Full database backup completed
7. ✅ Executive approval obtained

---

## Next Steps

1. Run analysis queries in non-prod
2. Review affected user list
3. Get approval from team lead
4. Execute migration in non-prod
5. Validate results
6. Document findings

---

## Execution Results (2025-10-24)

### Migration Scope - Final

**Users Migrated**: 4 (only users with active team subscriptions)

| User Email | Team Name | Stories Transferred | Credits Transferred | Subscription Cancelled |
|------------|-----------|---------------------|---------------------|------------------------|
| travel@altgene.net | travel | 111 | 0 | No |
| g@altgene.net | Gene Leykind Team | 19 | 0 | No |
| jnsinc2002@yahoo.com | Johnny A's Team | 8 | 0 | Yes (was double-paying) |
| john@ga-concepts.com | John Alonzo's Team | 5 | 0 | No |

**Total Stories Transferred**: 143
**Total Credits Transferred**: 0

### Users Excluded (Correct Behavior)

- **gene@icraftstories.com** - Team subscription = 'none' → Treated as individual user → No migration

### Migration Phases Executed

1. ✅ **Phase 1: Pre-Migration Analysis** (2025-10-24 14:52:00 UTC)
   - Identified 4 users with active team subscriptions
   - Identified 143 personal stories to transfer
   - Confirmed 0 personal credits to transfer

2. ✅ **Phase 2: Create Migration Snapshot** (2025-10-24 14:52:52 UTC)
   - Created `migration_snapshot_20251024` table
   - Backed up 143 stories, 4 affected users
   - Rollback capability enabled

3. ✅ **Phase 3: Execute Migration** (2025-10-24 14:53:35 UTC)
   - Called `onboard_team_member()` for each user
   - All 4 users migrated successfully
   - 0 failures reported

4. ✅ **Phase 4: Validation** (2025-10-24 14:54:00 UTC)
   - Verified 0 remaining personal stories for team users
   - Verified all stories now team-owned
   - Verified activity logs created
   - Verified subscription cancelled for jnsinc2002@yahoo.com

### Final State Verification

```
travel@altgene.net:        112 team stories, 0 personal stories ✅
g@altgene.net:              19 team stories, 0 personal stories ✅
john@ga-concepts.com:       11 team stories, 0 personal stories ✅
jnsinc2002@yahoo.com:        9 team stories, 0 personal stories ✅
```

### Key Decisions Made

**Migration Criteria**: Only migrate users with active team subscriptions
- ✅ Migrate: `teams.subscription_status IN ('active', 'trialing', 'team')`
- ❌ Exclude: `teams.subscription_status = 'none'` (individual users)

**Rationale**:
- Team subscription indicates user is actively using team features
- No team subscription = individual user, even if they own a team entity
- Prevents breaking individual users who have empty team structures

### Rollback Information

**Snapshot Table**: `migration_snapshot_20251024`
- Contains original state of all 143 transferred stories
- Retention: Keep until 2025-11-23 (30 days)
- Location: Non-prod database (jjpbogjufnqzsgiiaqwn)

**Rollback Not Needed**: Migration successful, no issues reported

### Post-Migration Monitoring

- [ ] Monitor for 24-48 hours for user-reported issues
- [ ] Delete snapshot table after 2025-11-23
- [ ] Document lessons learned for production migration

---

**Created**: 2025-10-24 by Claude Code
**Executed**: 2025-10-24 14:53:35 UTC
**Status**: ✅ COMPLETE - Migration Successful (0 errors, 4 users, 143 stories)
**Environment**: Non-Production Only (jjpbogjufnqzsgiiaqwn)
