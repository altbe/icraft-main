# Team Stories Sync Fix

**Date**: 2025-11-01
**Environment**: Non-Production (jjpbogjufnqzsgiiaqwn)
**Affected User**: g@altgene.net (user_2k85C1qKiBy30qmo3FbQY8xmeDx)

## Problem

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
- User: `user_2k85C1qKiBy30qmo3FbQY8xmeDx`
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

## Solution

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

## Files Modified

- `backend/modules/icraft-sync.ts:264-362` - Updated `fetchChangedData()` function

## Testing

### Verification Steps

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

### Expected Behavior After Fix

1. User opens application
2. Frontend `SimplifiedSyncService` calls `GET /sync/changes`
3. Backend returns all 27 stories (personal + team)
4. Frontend syncs stories to IndexedDB
5. User sees all 27 stories in StoryLibrary

## Impact

**Before Fix**:
- Team members only saw personal stories
- Team stories invisible in frontend
- Manual refresh (`GET /v1/stories`) would show all stories temporarily
- Automated sync would remove team stories again

**After Fix**:
- Team members see all their stories (personal + team)
- Automated sync includes team stories
- Consistent experience across manual and automated operations

## Related Code

**Stored Procedure** (`backend/sql/`):
- `get_user_and_team_stories_paginated()` - Handles team membership lookup

**API Endpoints**:
- `GET /v1/stories` - Manual fetch (uses stored procedure) ✅ Working
- `GET /sync/changes` - Automated sync (now uses stored procedure) ✅ Fixed

**Frontend Services**:
- `SimplifiedSyncService.ts` - Calls `/sync/changes` every 5 minutes
- `StoryService.ts` - Calls `/v1/stories` for manual fetch

## Deployment

1. **Compile**: `npm run compile` ✅ Passed
2. **Test**: Deploy to non-prod and verify with g@altgene.net
3. **Deploy to Production**: After verification in non-prod

## Notes

- Fix applies to both non-prod and production environments
- No database migration required (uses existing stored procedure)
- No frontend changes required (API contract unchanged)
- Backward compatible (personal stories still work as before)
