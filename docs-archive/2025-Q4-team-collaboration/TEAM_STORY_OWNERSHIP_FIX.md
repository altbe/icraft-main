# Team Story Ownership - Complete Fix

**Status**: Critical Issues Identified - Ready for Implementation
**Priority**: HIGH - Affects team collaboration core functionality
**Developer Estimate**: 6-8 hours (1 developer)
**Date**: 2025-10-22

---

## Executive Summary

**CRITICAL ISSUES FOUND:**

1. ❌ **Library doesn't show team stories** - `get_user_stories_paginated()` only queries `user_id`, missing team stories
2. ❌ **No automatic team_id assignment** - New stories don't automatically get team_id when created by team members
3. ❌ **No team permission checks on delete** - Team members can't delete/edit team stories properly
4. ❌ **Story duplication doesn't preserve team ownership**

**IMPACT:**
- Team members can't see each other's stories in the library
- Stories created by team members belong to individuals, not teams
- Collaboration is broken - team stories isolated to creator

**SOLUTION:**
- Fix library query to include team stories
- Add automatic team_id assignment via database trigger
- Update all CRUD endpoints with team permission logic
- Add team_id to story creation/duplication

---

## 1. Current State Analysis

### 1.1 Library Query (BROKEN)

**Current Implementation:** `backend/sql/get_user_stories_paginated()`

```sql
SELECT *
FROM stories s
WHERE s.user_id = p_user_id  -- ❌ ONLY shows user's personal stories
```

**What's Missing:**
- Doesn't check `team_id` at all
- Team members can't see stories owned by the team
- Each member sees only their own stories, NOT team stories

**Expected Behavior:**
```sql
-- Should return stories where:
-- 1. user_id matches (personal stories)
-- 2. team_id matches ANY team the user is a member of
```

### 1.2 Story Creation (NO TEAM ASSIGNMENT)

**Current:**
- Stories created via API don't have `team_id` set
- Even when created by team member, `team_id` remains NULL
- No automatic team detection logic

**What Should Happen:**
1. User creates story
2. System checks: Is user a team member?
3. If yes → Set `team_id` to user's team
4. If no → Leave `team_id` NULL (personal story)

### 1.3 Team Permission Checks (MISSING)

**Current Issues:**
- `deleteStory()` only checks `user_id = userId` (line 585)
- Doesn't check if user can delete team stories
- Doesn't check if user is team member with permissions

**Should Check:**
- Is this a team story? (`team_id IS NOT NULL`)
- Is user a member of this team?
- Does user have `can_manage_team_stories` permission?

---

## 2. Comprehensive Solution Design

### 2.1 Fix Library Query - Include Team Stories

**New Stored Procedure:** `get_user_and_team_stories_paginated()`

```sql
CREATE OR REPLACE FUNCTION get_user_and_team_stories_paginated(
  p_user_id TEXT,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20,
  p_search_term TEXT DEFAULT NULL,
  p_tags_filter TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _offset INTEGER;
  _total_count INTEGER;
  _stories JSON;
  _user_teams TEXT[];
BEGIN
  -- Calculate offset
  _offset := (p_page - 1) * p_limit;

  -- Get all teams the user belongs to
  SELECT array_agg(team_id)
  INTO _user_teams
  FROM team_members
  WHERE user_id = p_user_id;

  -- Get total count for pagination
  SELECT COUNT(*)
  INTO _total_count
  FROM stories s
  WHERE (
    -- Personal stories (user owns directly)
    s.user_id = p_user_id AND (s.team_id IS NULL OR s.team_id = '')
    OR
    -- Team stories (user is team member)
    (s.team_id IS NOT NULL AND s.team_id != '' AND s.team_id = ANY(_user_teams))
  )
    AND (p_search_term IS NULL OR s.title ILIKE '%' || p_search_term || '%')
    AND (
      p_tags_filter IS NULL OR
      EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(s.tags) AS tag
        WHERE tag = ANY(p_tags_filter)
      )
    );

  -- Get paginated stories with camelCase transformation
  SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'id', s.id,
      'title', s.title,
      'tags', s.tags,
      'userId', s.user_id,
      'teamId', s.team_id,  -- ✅ ADDED: Include team_id
      'createdAt', s.created_at,
      'updatedAt', s.updated_at,
      'lastModifiedBy', s.last_modified_by,
      'coverCoachingContent', s.cover_coaching_content,
      'pages', s.pages,
      'isAiGenerated', s.is_ai_generated,
      'originalCommunityStoryId', s.original_community_story_id,
      'coverCanvasState', s.cover_canvas_state,
      'coverCanvasEditorId', s.cover_canvas_editor_id,
      -- ✅ ADDED: Ownership metadata
      'ownershipType', CASE
        WHEN s.team_id IS NOT NULL AND s.team_id != '' THEN 'team'
        ELSE 'personal'
      END,
      'teamName', t.name
    )
  )
  INTO _stories
  FROM (
    SELECT s.*, t.name as team_name
    FROM stories s
    LEFT JOIN teams t ON t.id = s.team_id
    WHERE (
      -- Personal stories
      s.user_id = p_user_id AND (s.team_id IS NULL OR s.team_id = '')
      OR
      -- Team stories
      (s.team_id IS NOT NULL AND s.team_id != '' AND s.team_id = ANY(_user_teams))
    )
      AND (p_search_term IS NULL OR s.title ILIKE '%' || p_search_term || '%')
      AND (
        p_tags_filter IS NULL OR
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(s.tags) AS tag
          WHERE tag = ANY(p_tags_filter)
        )
      )
    ORDER BY s.updated_at DESC
    LIMIT p_limit OFFSET _offset
  ) s
  LEFT JOIN teams t ON t.id = s.team_id;

  -- Return structured result
  RETURN JSON_BUILD_OBJECT(
    'stories', COALESCE(_stories, '[]'::JSON),
    'total_count', _total_count,
    'user_teams', _user_teams
  );
END;
$$;

COMMENT ON FUNCTION get_user_and_team_stories_paginated IS
  'Returns both personal stories (user_id matches) and team stories (team_id matches user teams) for library display.';
```

**Key Changes:**
1. ✅ Queries user's teams via `team_members` table
2. ✅ Returns stories WHERE `user_id = p_user_id` OR `team_id IN (user's teams)`
3. ✅ Includes `teamId` and `ownershipType` in response
4. ✅ Joins `teams` table to include `teamName`

### 2.2 Automatic Team Assignment - Database Trigger

**Problem:** No automatic `team_id` assignment on story creation

**Solution:** PostgreSQL trigger that sets `team_id` before insert

```sql
-- ==========================================
-- Automatic Team Story Assignment Trigger
-- ==========================================

CREATE OR REPLACE FUNCTION assign_team_to_new_story()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_team_id TEXT;
  v_team_count INTEGER;
BEGIN
  -- Only process if team_id is not already set
  IF NEW.team_id IS NULL OR NEW.team_id = '' THEN

    -- Check how many teams the user belongs to
    SELECT COUNT(*), MIN(team_id)
    INTO v_team_count, v_user_team_id
    FROM team_members
    WHERE user_id = NEW.user_id;

    -- If user belongs to exactly ONE team, auto-assign
    IF v_team_count = 1 THEN
      NEW.team_id := v_user_team_id;

      -- Log auto-assignment (optional)
      INSERT INTO system_logs (
        log_type,
        log_message,
        metadata
      ) VALUES (
        'story_team_auto_assigned',
        format('Auto-assigned story %s to team %s for user %s', NEW.id, v_user_team_id, NEW.user_id),
        jsonb_build_object(
          'story_id', NEW.id,
          'user_id', NEW.user_id,
          'team_id', v_user_team_id
        )
      );
    END IF;

    -- If user belongs to multiple teams, leave team_id NULL
    -- (User must manually assign, or frontend provides team_id)

  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS assign_team_to_story_on_insert ON stories;
CREATE TRIGGER assign_team_to_story_on_insert
  BEFORE INSERT ON stories
  FOR EACH ROW
  EXECUTE FUNCTION assign_team_to_new_story();

COMMENT ON FUNCTION assign_team_to_new_story IS
  'Automatically assigns team_id to new stories if user belongs to exactly one team. If user has multiple teams, team_id must be provided explicitly.';
```

**Behavior:**
- User creates story without specifying `team_id`
- Trigger checks: How many teams does user belong to?
  - **1 team** → Auto-assign `team_id`
  - **0 teams** → Leave `team_id` NULL (personal story)
  - **2+ teams** → Leave `team_id` NULL (user must choose)

**Alternative Approach (If Auto-Assignment Too Aggressive):**

Instead of trigger, update API endpoint to explicitly set `team_id`:

```typescript
// In story creation endpoint
export async function createStory(request: ZuploRequest, context: ZuploContext) {
  const { userId } = await requireUserWithProfile(request, context);
  const storyData = await request.json();

  // Get user's team (if they have exactly one)
  const { data: teamMemberships } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);

  // Auto-assign team_id if user has exactly one team
  if (!storyData.team_id && teamMemberships?.length === 1) {
    storyData.team_id = teamMemberships[0].team_id;
    context.log.info(`Auto-assigned story to team ${storyData.team_id} for user ${userId}`);
  }

  // Create story with team_id
  const { data, error } = await supabase
    .from('stories')
    .insert({
      ...storyData,
      user_id: userId,
      team_id: storyData.team_id || null
    });

  //...
}
```

### 2.3 Team Permission Checks - All CRUD Operations

**Add Helper Function for Permission Checks:**

```sql
-- ==========================================
-- Team Story Permission Check
-- ==========================================

CREATE OR REPLACE FUNCTION can_user_modify_story(
  p_user_id TEXT,
  p_story_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_story RECORD;
  v_is_team_member BOOLEAN;
BEGIN
  -- Get story details
  SELECT user_id, team_id
  INTO v_story
  FROM stories
  WHERE id = p_story_id;

  IF NOT FOUND THEN
    RETURN FALSE;  -- Story doesn't exist
  END IF;

  -- Check if user is the owner
  IF v_story.user_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check if it's a team story and user is a team member
  IF v_story.team_id IS NOT NULL AND v_story.team_id != '' THEN
    SELECT EXISTS(
      SELECT 1 FROM team_members
      WHERE team_id = v_story.team_id
        AND user_id = p_user_id
    ) INTO v_is_team_member;

    RETURN v_is_team_member;
  END IF;

  -- Not owner and not team member
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION can_user_modify_story IS
  'Checks if user can modify a story (either owner or team member for team stories).';
```

**Update Delete Story Endpoint:**

```typescript
// backend/modules/icraft-stories.ts:506-599

export async function deleteStory(request: ZuploRequest, context: ZuploContext) {
  try {
    const { requireUserWithProfile } = await import('./auth-utils');
    const { userId } = await requireUserWithProfile(request, context);

    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return HttpProblems.unauthorized(request, context, {
        detail: 'Device ID is required'
      });
    }

    const storyId = request.params.storyId;
    if (!storyId) {
      return HttpProblems.badRequest(request, context, {
        detail: 'Story ID is required'
      });
    }

    // ✅ NEW: Check permission using stored procedure
    const { data: canModify, error: permError } = await supabase
      .rpc('can_user_modify_story', {
        p_user_id: userId,
        p_story_id: storyId
      });

    if (permError) {
      context.log.error(`Error checking story permissions: ${permError.message}`);
      return HttpProblems.internalServerError(request, context, {
        detail: 'Failed to check permissions'
      });
    }

    if (!canModify) {
      context.log.warn(`User ${userId} attempted to delete story ${storyId} without permission`);
      return HttpProblems.forbidden(request, context, {
        detail: 'You do not have permission to delete this story'
      });
    }

    // ✅ OLD CODE REMOVED: No longer check user_id directly
    // const { data: storyData } = await supabase
    //   .from('stories')
    //   .select('id, user_id')
    //   .eq('id', storyId)
    //   .eq('user_id', userId)  // ❌ This prevented team member deletion
    //   .single();

    // Proceed with deletion
    const { error: deleteError } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (deleteError) {
      context.log.error(`Error deleting story: ${deleteError.message}`);
      return HttpProblems.internalServerError(request, context);
    }

    // Log deletion to sync
    await supabase
      .from('sync_deleted_log')
      .insert({ story_id: storyId, user_id: userId, device_id: deviceId });

    context.log.info(`Story ${storyId} deleted by user ${userId}`);
    return HttpProblems.ok(request, context, {
      detail: 'Story deleted successfully'
    });

  } catch (error) {
    context.log.error('Error in deleteStory:', error);
    return HttpProblems.internalServerError(request, context);
  }
}
```

**Update Patch Story (Regenerate Images):**

```typescript
// backend/modules/icraft-stories.ts:193-498

export async function patchStory(request: ZuploRequest, context: ZuploContext) {
  try {
    const { requireUserWithProfile } = await import('./auth-utils');
    const { userId } = await requireUserWithProfile(request, context);

    const storyParams = await request.json();

    // ... validation ...

    // ✅ NEW: Check permission
    const { data: canModify } = await supabase
      .rpc('can_user_modify_story', {
        p_user_id: userId,
        p_story_id: storyParams.storyId
      });

    if (!canModify) {
      return HttpProblems.forbidden(request, context, {
        detail: 'You do not have permission to modify this story'
      });
    }

    // ✅ OLD CODE - Keep but no longer filters by user_id
    const { data: storyData, error: storyError } = await supabase
      .from('stories')
      .select('id, user_id, team_id, is_ai_generated')
      .eq('id', storyParams.storyId)
      // .eq('user_id', userId)  // ❌ REMOVED: Too restrictive for teams
      .single();

    // ... rest of regeneration logic ...
  }
}
```

### 2.4 Story Duplication - Preserve Team Ownership

**Add Duplicate Story Endpoint:**

```typescript
export async function duplicateStory(request: ZuploRequest, context: ZuploContext) {
  try {
    const { requireUserWithProfile } = await import('./auth-utils');
    const { userId } = await requireUserWithProfile(request, context);

    const storyId = request.params.storyId;
    if (!storyId) {
      return HttpProblems.badRequest(request, context, {
        detail: 'Story ID is required'
      });
    }

    // Get original story
    const { data: originalStory, error: fetchError } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .single();

    if (fetchError || !originalStory) {
      return HttpProblems.notFound(request, context, {
        detail: 'Story not found'
      });
    }

    // Check if user can access this story
    const { data: canAccess } = await supabase
      .rpc('can_user_modify_story', {
        p_user_id: userId,
        p_story_id: storyId
      });

    if (!canAccess) {
      return HttpProblems.forbidden(request, context, {
        detail: 'You do not have permission to duplicate this story'
      });
    }

    // Create duplicate with SAME team_id (if team story)
    const duplicateData = {
      ...originalStory,
      id: undefined,  // Let database generate new ID
      title: `${originalStory.title} (Copy)`,
      user_id: userId,  // Creator of duplicate
      team_id: originalStory.team_id,  // ✅ PRESERVE team ownership
      created_at: undefined,
      updated_at: undefined,
      last_modified_by: userId
    };

    const { data: newStory, error: createError } = await supabase
      .from('stories')
      .insert(duplicateData)
      .select()
      .single();

    if (createError) {
      context.log.error('Error creating duplicate:', createError);
      return HttpProblems.internalServerError(request, context);
    }

    // Log duplication activity
    await supabase
      .from('activities')
      .insert({
        user_id: userId,
        action_type: 'duplicate',
        entity_type: 'story',
        entity_id: newStory.id,
        metadata: {
          original_story_id: storyId,
          team_id: originalStory.team_id
        }
      });

    context.log.info(`Story ${storyId} duplicated to ${newStory.id} by user ${userId}`);

    return new Response(JSON.stringify(newStory), {
      status: HttpStatusCode.OK,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    context.log.error('Error duplicating story:', error);
    return HttpProblems.internalServerError(request, context);
  }
}
```

---

## 3. Implementation Plan (For 1 Developer)

### Time Estimate: 6-8 Hours

| Task | Time | Priority |
|------|------|----------|
| **Phase 1: Library Fix** | | |
| Create new `get_user_and_team_stories_paginated()` | 1 hour | P0 |
| Update API endpoint to call new function | 30 min | P0 |
| Test library shows team stories | 30 min | P0 |
| **Phase 2: Team Assignment** | | |
| Create team assignment trigger | 1 hour | P1 |
| Test trigger with various scenarios | 30 min | P1 |
| OR implement API-level assignment | 1 hour | P1 |
| **Phase 3: Permission Checks** | | |
| Create `can_user_modify_story()` function | 45 min | P0 |
| Update `deleteStory()` endpoint | 30 min | P0 |
| Update `patchStory()` endpoint | 30 min | P0 |
| Test deletion by team members | 30 min | P0 |
| **Phase 4: Duplication** | | |
| Implement `duplicateStory()` endpoint | 1 hour | P2 |
| Test duplication preserves team_id | 30 min | P2 |
| **Phase 5: Testing** | | |
| End-to-end team story flow test | 1 hour | P0 |
| Edge case testing | 30 min | P0 |

**Total**: 7-9 hours

---

## 4. Deployment Steps

### Step 1: Database Migration (Non-Prod)

```bash
# File: backend/sql/team-story-ownership-fix.sql

-- Apply in this order:
-- 1. Permission check function
-- 2. New library query function
-- 3. Team assignment trigger (optional)
```

```sql
-- Execute migration
psql -h db.jjpbogjufnqzsgiiaqwn.supabase.co \
     -U postgres \
     -d postgres \
     -f backend/sql/team-story-ownership-fix.sql
```

### Step 2: Backend Code Updates

```bash
cd backend

# Update icraft-stories.ts
# - getUserStories: Call new stored procedure
# - deleteStory: Use permission check
# - patchStory: Use permission check
# - Add duplicateStory endpoint

git add modules/icraft-stories.ts
git commit -m "fix(stories): Add team story ownership and permissions

- Library now shows team stories via get_user_and_team_stories_paginated()
- Permission checks via can_user_modify_story() function
- Team members can view/edit/delete team stories
- Story duplication preserves team ownership
- Optional: Auto-assign team_id via trigger"

git push origin develop
```

### Step 3: Testing Checklist

- [ ] Team member A creates story → Appears in team member B's library
- [ ] Team member B can edit team member A's story
- [ ] Team member B can delete team story
- [ ] Non-team member CANNOT edit/delete team story
- [ ] Story duplication preserves team_id
- [ ] Personal stories (team_id=NULL) still work
- [ ] Multi-team users see all their teams' stories

### Step 4: Production Deployment

After non-prod success:

```bash
# Deploy to production
psql -h db.lgkjfymwvhcjvfkuidis.supabase.co \
     -f backend/sql/team-story-ownership-fix.sql

# Backend auto-deploys via Zuplo
git checkout develop
git merge feature/team-story-ownership
npm run promote:qa
npm run release:production
```

---

## 5. Breaking Changes & Migration

### Potential Issues:

1. **Existing Team Stories Missing team_id**
   - Stories created BEFORE fix have `team_id = NULL`
   - Need migration to backfill team_id

```sql
-- Backfill team_id for existing stories
UPDATE stories s
SET team_id = tm.team_id,
    updated_at = NOW()
FROM team_members tm
WHERE s.user_id = tm.user_id
  AND s.team_id IS NULL
  AND s.created_at > '2025-10-20'  -- Only recent stories (team feature launch date)
  AND EXISTS (
    SELECT 1 FROM team_members tm2
    WHERE tm2.user_id = s.user_id
    GROUP BY tm2.user_id
    HAVING COUNT(*) = 1  -- Only if user has exactly 1 team
  );
```

2. **Frontend Expects Different Response**
   - Old: `{stories: [...], pagination: {...}}`
   - New: `{stories: [...], pagination: {...}, user_teams: [...]}`
   - Should be backwards compatible (added field)

---

## 6. Success Criteria

- [ ] Team member library shows ALL team stories
- [ ] New stories auto-assign team_id (if applicable)
- [ ] Team members can edit ANY team story
- [ ] Team members can delete ANY team story
- [ ] Non-team members CANNOT modify team stories
- [ ] Story duplication preserves team ownership
- [ ] Personal stories still work (team_id=NULL)
- [ ] No breaking changes for existing functionality

---

## 7. Monitoring & Validation

### After Deployment Queries:

```sql
-- 1. Check team stories visibility
SELECT COUNT(*) as team_stories
FROM stories
WHERE team_id IS NOT NULL;

-- 2. Verify permission function works
SELECT can_user_modify_story(
  'user_34QVci9hMiAU0rN3K6qB1mBbv8W',  -- tech@altgene.net
  (SELECT id FROM stories WHERE team_id = '41fd2ce8-ca28-4581-b264-29cd747a25bf' LIMIT 1)
);
-- Expected: true (team member can modify team story)

-- 3. Check library query returns team stories
SELECT get_user_and_team_stories_paginated(
  'user_34QVci9hMiAU0rN3K6qB1mBbv8W',  -- tech@altgene.net
  1,  -- page
  20  -- limit
);
-- Should include team stories

-- 4. Verify trigger auto-assignment
INSERT INTO stories (user_id, title)
VALUES ('user_34QVci9hMiAU0rN3K6qB1mBbv8W', 'Test Auto-Assignment');

SELECT team_id FROM stories WHERE title = 'Test Auto-Assignment';
-- Expected: '41fd2ce8-ca28-4581-b264-29cd747a25bf' (Gene Leykind Team)
```

---

## 8. Rollback Plan

If issues occur:

```sql
-- Revert to old library function
DROP FUNCTION IF EXISTS get_user_and_team_stories_paginated;

-- Old function is still in database, so API falls back automatically

-- Disable trigger
DROP TRIGGER IF EXISTS assign_team_to_story_on_insert ON stories;

-- Revert permission checks (backend code revert)
git revert <commit-hash>
git push origin develop
```

---

## 9. Related Documents

- `STORY_TRANSFER_IMPLEMENTATION_PLAN.md` - Story transfer stored procedure
- `TEAM_ONBOARDING_SCENARIOS.md` - Team onboarding scenarios
- `CLERK_WEBHOOK_FIX_GUIDE.md` - Webhook infrastructure
- `backend/modules/icraft-stories.ts:607` - Current `getUserStories()` implementation

---

## 10. Next Steps

**Immediate:**
1. Review this document with team
2. Decide on trigger vs API-level team assignment
3. Create SQL migration file
4. Update TypeScript endpoints
5. Test in non-prod
6. Deploy to production

**Follow-up:**
- Add team story filtering UI (frontend)
- Add "Move to Team" functionality
- Add team story analytics

---

**Created:** 2025-10-22 by Claude Code
**Status:** Ready for Implementation
**Priority:** HIGH - Core collaboration feature broken
