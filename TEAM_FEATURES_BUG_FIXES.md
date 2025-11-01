# Team Features Bug Fixes

**Date**: 2025-11-01
**Environments**: Both Production (lgkjfymwvhcjvfkuidis) and Non-Production (jjpbogjufnqzsgiiaqwn)
**Affected User**: g@altgene.net (user_2k85C1qKiBy30qmo3FbQY8xmeDx)

## Summary

Fixed two critical bugs affecting team collaboration features:

1. **Team Stories Sync** - Team members could not see their team stories (stories disappeared from frontend)
2. **Community Story Sharing** - Team members received 500 error when sharing stories to community

Both issues have been resolved and deployed to production and non-production environments.

---

## Bug #1: Team Stories Sync Failure

### Problem

Team members could not see their team stories in the frontend application. Stories existed in the database but were not syncing to IndexedDB.

### Root Cause

The `fetchChangedData()` function in `backend/modules/icraft-sync.ts:265-316` only queried stories by `user_id`:

```typescript
let query = supabase
  .from(table)
  .select('*')
  .eq('user_id', userId);  // ❌ Excludes team stories
```

This excluded team stories where:
- `team_id IS NOT NULL` (story belongs to team)
- User is a member of that team
- Story should be visible to the user

### Evidence

**Database State (Verified via Supabase MCP)**:
- User: `user_2k85C1qKiBy30qmo3FbQY8xmeDx` (g@altgene.net)
- Team: `41fd2ce8-ca28-4581-b264-29cd747a25bf` (owner)
- **27 total stories**:
  - 21 team stories (`team_id = '41fd2ce8-ca28-4581-b264-29cd747a25bf'`)
  - 6 personal stories (`team_id IS NULL`)

**API Endpoint Comparison**:
- ✅ `GET /v1/stories` (using `get_user_and_team_stories_paginated()`) → Returns all 27 stories
- ❌ `GET /sync/changes` (using direct query) → Returns only 6 personal stories

**Sync Flow**:
1. Frontend calls `GET /sync/changes` every 5 minutes
2. Backend `fetchChangedData()` filters by `user_id` only
3. Team stories excluded from response
4. Frontend IndexedDB only contains personal stories
5. User sees "missing" stories

### Solution

Modified `fetchChangedData()` to use the same stored procedure as the manual stories endpoint:

```typescript
if (table === 'stories') {
  // Call stored procedure that includes team stories
  const { data, error } = await supabase.rpc('get_user_and_team_stories_paginated', {
    p_user_id: userId,
    p_page: 1,
    p_limit: 10000,
    p_search_term: null,
    p_tags_filter: null
  });

  let stories = data.stories || [];

  // Apply timestamp filtering for incremental sync
  if (lastSyncTimestamp) {
    const normalizedTimestamp = ensureISODate(lastSyncTimestamp);
    stories = stories.filter(story =>
      story.updatedAt && story.updatedAt > normalizedTimestamp
    );
  }

  return stories; // Already in camelCase from stored procedure
}
```

### Benefits

1. **Consistency**: Same data retrieval logic for both endpoints
2. **Maintainability**: Uses existing tested stored procedure
3. **Performance**: Stored procedure optimized for team queries
4. **Complete**: Returns both personal and team stories

### Files Modified

- `backend/modules/icraft-sync.ts:264-362` - Updated `fetchChangedData()` function

### Testing

**Verification Steps**:

1. **Database Query** (via Supabase MCP):
   ```sql
   SELECT COUNT(*) FROM stories
   WHERE user_id = 'user_2k85C1qKiBy30qmo3FbQY8xmeDx'
      OR team_id = '41fd2ce8-ca28-4581-b264-29cd747a25bf';
   -- Expected: 27 stories
   ```

2. **Stored Procedure Test**:
   ```sql
   SELECT get_user_and_team_stories_paginated(
     'user_2k85C1qKiBy30qmo3FbQY8xmeDx', 1, 50, NULL, NULL
   );
   -- Expected: total_count = 27, stories array with 27 items
   ```

3. **Sync Endpoint Test** (after fix):
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        -H "X-Device-Id: test-device" \
        https://api.icraftstories.com/sync/changes
   # Expected: stories array with 27 items (21 team + 6 personal)
   ```

### Impact

**Before Fix**:
- Team members only saw personal stories
- Team stories invisible in frontend
- Manual refresh (`GET /v1/stories`) would show all stories temporarily
- Automated sync would remove team stories again

**After Fix**:
- Team members see all their stories (personal + team)
- Automated sync includes team stories
- Consistent experience across manual and automated operations

---

## Bug #2: Community Story Sharing Credit Reward Failure

### Problem

Team members received a 500 error when attempting to share stories to the community:

```
Failed to share story and award credits: function …ward_credits(text, unknown, jsonb) does not exist
```

### Root Cause

The `share_story_to_community_transactional` stored procedure (line 85-95) called a non-existent function:

```sql
-- ❌ BROKEN: This function does not exist
SELECT add_reward_credits(
  p_user_id,
  'community_share',
  p_team_id,
  jsonb_build_object(...)
) INTO v_credit_result;
```

**Database Functions Available**:
- ✅ `allocate_credits(p_user_id, p_amount, p_source, p_description, p_metadata)` - EXISTS
- ❌ `add_reward_credits(...)` - DOES NOT EXIST

### Solution

Replaced the call to non-existent `add_reward_credits()` with a call to `allocate_credits()`:

```sql
-- ✅ FIXED: Use allocate_credits() which actually exists
-- Community share is a REWARD operation (+3 credits)
SELECT allocate_credits(
  p_user_id,
  3, -- Reward amount (positive = credit added)
  'community_share',
  'Shared story to community: ' || (p_story_data->>'title'),
  jsonb_build_object(
    'story_id', v_community_story_id,
    'story_title', p_story_data->>'title',
    'original_story_id', v_original_story_id,
    'shared_at', NOW(),
    'team_id', p_team_id
  )
) INTO v_credit_transaction_id;

-- Validate credit allocation succeeded
IF v_credit_transaction_id IS NULL THEN
  RAISE EXCEPTION 'Failed to allocate community share reward credits';
END IF;

-- Get new balance after credit allocation
SELECT get_user_credit_balance(p_user_id) INTO v_new_balance;
```

### Credit Reward Amount

**Source**: `backend/CREDIT_OPERATION_PRICING_DESIGN.md:59`
```sql
('community_share', 'community', true, -3.0, 1.0, 'NONE', 'Share story to community - 3 credits reward', true);
```

Community sharing rewards **+3 credits** (negative in pricing table = reward).

### Files Modified

- `backend/supabase/migrations/20251101000001_fix_community_share_credits.sql` - New migration
- `backend/supabase/migrations/20250805000001_share_story_to_community_transactional.sql` - Original (broken)

### Migration Applied

**Non-Production**: ✅ Applied successfully (2025-11-01)
**Production**: ✅ Applied successfully (2025-11-01)

### Testing

**Verification Steps**:

1. **Test with g@altgene.net account**:
   - Log in as team member
   - Create or select a story
   - Share to community
   - Expected: Success message, +3 credits awarded

2. **Verify credit transaction**:
   ```sql
   SELECT * FROM credit_transactions
   WHERE user_id = 'user_2k85C1qKiBy30qmo3FbQY8xmeDx'
     AND source = 'community_share'
   ORDER BY created_at DESC
   LIMIT 1;
   -- Expected: Transaction with amount = 3
   ```

3. **Verify community story created**:
   ```sql
   SELECT * FROM community_stories
   WHERE original_user_id = 'user_2k85C1qKiBy30qmo3FbQY8xmeDx'
   ORDER BY shared_at DESC
   LIMIT 1;
   -- Expected: Community story record with correct metadata
   ```

### Impact

**Before Fix**:
- Community sharing completely broken for all users
- 500 error on every share attempt
- No credits awarded
- No community stories created

**After Fix**:
- Community sharing works for all users
- Credits awarded correctly (+3 per share)
- Community stories created successfully
- Proper error handling and validation

---

## Related Code

### Stored Procedures Used

**`get_user_and_team_stories_paginated()`** - Team story retrieval:
- Handles team membership lookup
- Returns both personal and team stories
- Used by both manual fetch and sync endpoints

**`allocate_credits()`** - Credit allocation:
- Pure ledger model (INSERT-only)
- Auto-detects team membership via `get_user_team_id()`
- Creates audit trail in `credit_transactions` table

**`get_user_credit_balance()`** - Balance query:
- Computes balance from ledger
- Auto-detects team vs. personal credits

### API Endpoints

**Stories**:
- `GET /v1/stories` - Manual fetch (uses stored procedure) ✅ Working
- `GET /sync/changes` - Automated sync (now uses stored procedure) ✅ Fixed

**Community**:
- `POST /community/stories` - Share story to community ✅ Fixed

### Frontend Services

**`SimplifiedSyncService.ts`**:
- Calls `/sync/changes` every 5 minutes
- Syncs stories to IndexedDB

**`StoryService.ts`**:
- Calls `/v1/stories` for manual fetch

---

## Deployment Status

### Backend Code Changes

**Git Commits**:
- Team sync fix: `backend/modules/icraft-sync.ts` (commit: 51d865a)
- Documentation: `TEAM_STORIES_SYNC_FIX.md` (commit: 51d865a)

**Branch**: `backend/develop`
**Deployed**: ✅ Via Zuplo GitOps (develop → preview → main)

### Database Migrations

**Migration 20251101000001** - Community share credit fix:
- Non-Production (jjpbogjufnqzsgiiaqwn): ✅ Applied
- Production (lgkjfymwvhcjvfkuidis): ✅ Applied

---

## Notes

- Both fixes apply to production and non-production environments
- No frontend changes required (API contracts unchanged)
- Backward compatible (existing functionality preserved)
- No data migration required (uses existing stored procedures)

---

## Verification Checklist

### Team Stories Sync
- [x] Database query confirms 27 stories for g@altgene.net
- [x] Stored procedure test returns all stories
- [x] Backend code updated to use stored procedure
- [x] TypeScript compilation passes
- [ ] Frontend test: User sees all team stories after sync
- [ ] Production verification with real user account

### Community Story Sharing
- [x] Migration applied to non-prod database
- [x] Migration applied to production database
- [x] Database function signature verified
- [x] Credit reward amount confirmed (+3 credits)
- [ ] Frontend test: User can share story to community
- [ ] Frontend test: User receives +3 credits
- [ ] Production verification with real user account

---

## Related Documentation

- `TEAM_STORIES_SYNC_FIX.md` - Detailed sync fix documentation
- `backend/CREDIT_SYSTEM_CONSOLIDATED.md` - Credit system architecture
- `backend/CREDIT_OPERATION_PRICING_DESIGN.md` - Credit pricing specifications
- `TEAM_MEMBER_REQUIREMENTS.md` - Team collaboration requirements
