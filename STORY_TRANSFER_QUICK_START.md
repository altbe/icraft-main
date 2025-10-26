# Story Transfer Stored Procedure - Quick Start

**For 1 Developer | Estimated Time: 5 hours**

---

## What You're Implementing

A `transfer_all_user_stories_to_team()` stored procedure that:
- Mirrors the existing `transfer_all_user_credits_to_team()` pattern
- Transfers ALL personal stories from user to team atomically
- Creates audit trail in new `story_transfers` table
- Integrates with `onboard_team_member()` for automatic onboarding

---

## Files Created

✅ All files ready in `/home/g/_zdev/icraft-main/backend/sql/`:

1. **`story-transfer-implementation.sql`** - Main migration (run this in DB)
2. **`test-story-transfer.sql`** - Test suite (run this to verify)
3. **`STORY_TRANSFER_IMPLEMENTATION_PLAN.md`** - Complete 12-section guide

---

## Quick Deployment (30 minutes)

### Non-Production First

```bash
# 1. Navigate to backend
cd /home/g/_zdev/icraft-main/backend

# 2. Apply migration to non-prod
# Using Supabase MCP tool or psql:
psql -h db.jjpbogjufnqzsgiiaqwn.supabase.co \
     -U postgres \
     -d postgres \
     -f sql/story-transfer-implementation.sql

# 3. Run tests
psql -h db.jjpbogjufnqzsgiiaqwn.supabase.co \
     -U postgres \
     -d postgres \
     -f sql/test-story-transfer.sql

# Expected output: "✓ ALL TESTS PASSED"
```

### Production (After Non-Prod Success)

```bash
# Apply to production
psql -h db.lgkjfymwvhcjvfkuidis.supabase.co \
     -U postgres \
     -d postgres \
     -f sql/story-transfer-implementation.sql

# Verify (don't run full test suite in prod)
psql -h db.lgkjfymwvhcjvfkuidis.supabase.co \
     -U postgres \
     -d postgres \
     -c "SELECT transfer_all_user_stories_to_team('fake_user', 'fake_team', 'test');"
# Expected: {"success": false, "error": "User not found"}
```

---

## What Gets Created

### New Table: `story_transfers`
```sql
-- Audit trail for story ownership changes
CREATE TABLE story_transfers (
  id UUID PRIMARY KEY,
  transfer_type TEXT,  -- 'user_to_team', 'team_to_user', 'team_to_team'
  from_user_id TEXT,
  to_team_id TEXT,
  story_ids UUID[],    -- Array of transferred story IDs
  story_count INTEGER,
  metadata JSONB,      -- Story titles, team name, etc.
  created_at TIMESTAMPTZ
);
```

### New Function: `transfer_all_user_stories_to_team()`
```sql
-- Returns JSONB:
{
  "success": true,
  "stories_transferred": 2,
  "story_ids": ["uuid1", "uuid2"],
  "team_name": "Team Name",
  "transfer_id": "uuid"
}

-- OR if no stories:
{
  "success": true,
  "stories_transferred": 0,
  "message": "No stories to transfer"
}
```

### Updated Function: `onboard_team_member()`
- Now calls `transfer_all_user_stories_to_team()` instead of inline UPDATE
- Returns detailed story_transfer metadata in response

---

## Verification After Deployment

```sql
-- 1. Check table exists
\d story_transfers

-- 2. Check function exists
\df transfer_all_user_stories_to_team

-- 3. Check updated function
\df onboard_team_member

-- 4. Test with fake data (should fail gracefully)
SELECT transfer_all_user_stories_to_team(
  'nonexistent_user',
  'nonexistent_team',
  'Verification test'
);
-- Expected: {"success": false, "error": "User not found"}
```

---

## Next Real User Test

After deployment, when next user accepts team invitation:

```sql
-- Check their team_join activity
SELECT
  metadata->>'creditsTransferred' as credits,
  metadata->>'storiesTransferred' as stories,
  metadata->>'subscriptionCancelled' as sub_cancelled,
  created_at
FROM activities
WHERE user_id = '<new_user_id>'
  AND action_type = 'team_join'
ORDER BY created_at DESC
LIMIT 1;

-- Check audit trail
SELECT
  from_user_id,
  to_team_id,
  story_count,
  metadata->>'story_titles' as titles,
  created_at
FROM story_transfers
ORDER BY created_at DESC
LIMIT 1;
```

---

## Rollback (If Needed)

```sql
BEGIN;

-- Revert onboard_team_member to old version
-- (Copy from backend/sql/team-member-onboarding.sql)

-- Drop new function
DROP FUNCTION IF EXISTS transfer_all_user_stories_to_team(TEXT, TEXT, TEXT);

-- Drop new table (CAREFUL: loses audit trail)
DROP TABLE IF EXISTS story_transfers;

COMMIT;
```

---

## Key Design Decisions

### ✅ What Gets Transferred
- Stories where `team_id IS NULL` or `team_id = ''`
- Only stories owned by user (`user_id = p_user_id`)
- **Excludes community remixes** (`original_community_story_id IS NOT NULL`)

### ✅ Audit Trail
- Separate `story_transfers` table (not just activities)
- Preserves story IDs and titles at time of transfer
- Enables rollback/reversal if needed

### ✅ Pattern Consistency
- Exactly mirrors `transfer_all_user_credits_to_team()`
- Same parameter signature
- Same return structure
- Same error handling

---

## Success Criteria

- [ ] `story_transfers` table exists in both databases
- [ ] `transfer_all_user_stories_to_team()` function exists
- [ ] `onboard_team_member()` calls new function
- [ ] All 6 tests pass in non-prod
- [ ] Verification query succeeds in prod
- [ ] Next team join includes story transfer in activities

---

## Help & Documentation

**Full Details:** See `STORY_TRANSFER_IMPLEMENTATION_PLAN.md` (12 sections, 450+ lines)

**Sections Include:**
1. Design Specification
2. SQL Implementation
3. Testing Plan
4. Deployment Guide
5. Rollback Plan
6. Monitoring & Validation
7. Developer Time Estimate
8. Post-Deployment Tasks
9. FAQ & Troubleshooting
10. Acceptance Criteria
11. Related Documents
12. Change Log

**Questions?** Check the FAQ section in the implementation plan.

---

**Created:** 2025-10-22 by Claude Code
**Ready for Implementation:** ✅ Yes
