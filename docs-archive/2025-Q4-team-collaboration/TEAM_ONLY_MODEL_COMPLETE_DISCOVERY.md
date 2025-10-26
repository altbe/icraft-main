# Team-Only Model: Complete Discovery Results

**Date**: 2025-10-20
**Status**: Discovery Complete
**Related**: TEAM_ONLY_MODEL_DISCOVERY_FINDINGS.md, TEAM_ONLY_MODEL_CROSS_IMPACT_ANALYSIS.md

---

## Executive Summary

Database discovery has been completed on the non-production database. Key findings:

✅ **Schema Already Has team_id Column**: The `stories` table already has `team_id` as a nullable TEXT column
❌ **Column is user_id, NOT owner_id**: Confirmed backend code uses `user_id`, not `owner_id`
⚠️ **Migration Procedures Missing Story Transfer**: Existing procedures transfer credits but NOT stories
✅ **Two Views Reference Stories**: Both views need updates
✅ **One Trigger on Stories**: Trigger handles team credit deduction
✅ **No pg_cron Jobs**: No scheduled jobs reference stories
✅ **Decision: Drop team_id Column**: After migration, `team_id` will be dropped (redundant with `owner_id`)

### Current Database State
- **Total stories**: 323 (all personal, none have `team_id` populated)
- **Total teams**: 3 teams created on 2025-10-20
- **Affected stories**: 124 stories owned by team owners that should have been migrated but weren't
  - "travel" team: 119 stories need migration
  - "Activity Logging Test Team v2": 5 stories need migration
  - "Test Team Auto-Transfer": 0 stories (correct)

---

## 1. Current Stories Table Schema

```sql
-- Actual schema from non-prod database
CREATE TABLE stories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  cover_coaching_content jsonb,
  cover_canvas_editor_id uuid,
  cover_canvas_state jsonb,
  pages jsonb[] DEFAULT '{}'::jsonb[],
  user_id text NOT NULL,              -- ← Currently holds user ID
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_modified_by text,
  ai_generator_history jsonb[] DEFAULT '{}'::jsonb[],
  is_ai_generated boolean DEFAULT false,
  team_id text,                       -- ← Already exists, nullable
  original_community_story_id uuid,
  tags text[]
);
```

**Key Observations**:
1. ✅ `team_id` column already exists (but will be dropped after migration)
2. ❌ Column is `user_id`, NOT `owner_id`
3. ❌ No `created_by` column yet
4. ❌ No `owner_type` discriminator column yet

### Target Schema (After Migration)

```sql
-- Final schema after complete migration
CREATE TABLE stories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  cover_coaching_content jsonb,
  cover_canvas_editor_id uuid,
  cover_canvas_state jsonb,
  pages jsonb[] DEFAULT '{}'::jsonb[],
  owner_id text NOT NULL,             -- ← User ID OR Team ID (renamed from user_id)
  owner_type text NOT NULL,           -- ← 'user' OR 'team' discriminator
  created_by text NOT NULL,           -- ← Always user ID (original creator)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_modified_by text,
  ai_generator_history jsonb[] DEFAULT '{}'::jsonb[],
  is_ai_generated boolean DEFAULT false,
  -- team_id DROPPED                  -- ← Removed (redundant with owner_id)
  original_community_story_id uuid,
  tags text[]
);

-- Examples:
-- Personal story: owner_id='user_123', owner_type='user', created_by='user_123'
-- Team story: owner_id='team_456', owner_type='team', created_by='user_123'
```

---

## 1a. Decision: Drop team_id Column

**Decision**: ✅ **Drop `team_id` column after migration is complete**

### Why Drop team_id?

**Current schema has redundancy:**
```sql
-- Team story with BOTH columns (redundant!)
owner_id = 'team_456'
team_id = 'team_456'    -- Same value as owner_id
owner_type = 'team'
```

**Benefits of dropping team_id:**
1. ✅ **Eliminates redundancy**: `owner_id` + `owner_type` is sufficient
2. ✅ **Simpler schema**: Single ownership column
3. ✅ **Clearer semantics**: "owner" concept works for both users and teams
4. ✅ **Easier queries**: `WHERE owner_id = ? AND owner_type = ?`
5. ✅ **Data consistency**: No risk of `owner_id` and `team_id` being out of sync

**Impact of dropping team_id:**
- **4 stored procedures** need updates (use `owner_id` instead of `team_id`)
- **2 views** need updates (filter by `owner_type` instead of `team_id IS NOT NULL`)
- **1 trigger** needs update (check `owner_type` instead of `team_id`)
- **0 backend code** changes (backend doesn't reference `team_id` directly)

**Migration strategy:**
1. Keep `team_id` temporarily during migration (as reference)
2. Update all procedures/views/triggers to use `owner_id` + `owner_type`
3. Drop `team_id` as final step (after testing)
4. Provides rollback option if needed

---

## 2. Database Views Requiring Updates

### 2.1 team_stories_view

**Current Definition**:
```sql
SELECT id, title, cover_coaching_content, cover_canvas_editor_id,
       cover_canvas_state, pages, user_id, created_at, updated_at,
       last_modified_by, ai_generator_history, is_ai_generated,
       team_id, original_community_story_id, tags
FROM stories s
WHERE team_id IS NOT NULL;
```

**Required Update**:
```sql
-- After migration: Filter by owner_type='team'
SELECT id, title, cover_coaching_content, cover_canvas_editor_id,
       cover_canvas_state, pages, owner_id, owner_type, created_by,
       created_at, updated_at, last_modified_by, ai_generator_history,
       is_ai_generated, original_community_story_id, tags
FROM stories s
WHERE owner_type = 'team';
```

### 2.2 user_accessible_stories

**Current Definition**:
```sql
SELECT id, title, cover_coaching_content, cover_canvas_editor_id,
       cover_canvas_state, pages, user_id, created_at, updated_at,
       last_modified_by, ai_generator_history, is_ai_generated,
       team_id, original_community_story_id, tags
FROM stories s
WHERE user_id IS NOT NULL;
```

**Required Update**:
```sql
-- After migration: Filter by owner_type='user'
SELECT id, title, cover_coaching_content, cover_canvas_editor_id,
       cover_canvas_state, pages, owner_id, owner_type, created_by,
       created_at, updated_at, last_modified_by, ai_generator_history,
       is_ai_generated, original_community_story_id, tags
FROM stories s
WHERE owner_type = 'user';
```

---

## 3. Trigger Requiring Update

### story_team_credits_trigger

**Current Trigger**:
```sql
CREATE TRIGGER story_team_credits_trigger
  AFTER UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION handle_team_story_credits();
```

**Function Logic** (handle_team_story_credits):
```sql
-- Only process for stories with team_id
IF NEW.team_id IS NULL THEN
  RETURN NEW;
END IF;
```

**Required Update**:
```sql
-- After migration: Check owner_type='team' instead of team_id IS NOT NULL
IF NEW.owner_type != 'team' THEN
  RETURN NEW;
END IF;
```

---

## 4. Stored Procedures Requiring Updates

### 4.1 High Priority - Direct Story Operations

#### can_access_story(p_story_id, p_user_id)

**Current Logic**:
```sql
-- Personal ownership check
SELECT 1 FROM stories
WHERE id = p_story_id AND user_id = p_user_id

UNION

-- Team ownership check
SELECT 1 FROM stories s
JOIN team_members tm ON s.team_id = tm.team_id
WHERE s.id = p_story_id AND tm.user_id = p_user_id
```

**Required Update**:
```sql
-- Personal ownership check
SELECT 1 FROM stories
WHERE id = p_story_id
  AND owner_id = p_user_id
  AND owner_type = 'user'

UNION

-- Team ownership check
SELECT 1 FROM stories s
JOIN team_members tm ON s.owner_id = tm.team_id
WHERE s.id = p_story_id
  AND tm.user_id = p_user_id
  AND s.owner_type = 'team'
```

#### create_team_story(p_title, p_user_id, p_team_id, ...)

**Current Logic**:
```sql
INSERT INTO stories (
  title, tags, pages, user_id, team_id, last_modified_by
) VALUES (
  p_title, COALESCE(p_tags, '[]'::TEXT[]), ..., p_user_id, p_team_id, ...
)
```

**Required Update**:
```sql
INSERT INTO stories (
  title, tags, pages,
  owner_id, owner_type, created_by,    -- NEW
  last_modified_by
) VALUES (
  p_title, COALESCE(p_tags, '[]'::TEXT[]), ...,
  p_team_id, 'team', p_user_id,        -- NEW
  ...
)
```

#### remove_story_from_team(p_story_id, p_user_id)

**Current Logic**:
```sql
-- Get the story
SELECT * INTO v_story
FROM stories
WHERE id = p_story_id AND user_id = p_user_id;

-- Remove team association
UPDATE stories
SET team_id = NULL
WHERE id = p_story_id;
```

**Required Update**:
```sql
-- For Team-Only Model, this operation should be BLOCKED
-- Users on team plans cannot have personal stories
RAISE EXCEPTION 'Cannot remove story from team: Team plan users must have all stories owned by team';
```

### 4.2 Medium Priority - Ownership Queries

#### update_page_canvas_state(p_story_id, p_page_index, ...)
#### update_cover_canvas_state(p_story_id, p_cover_canvas_state, ...)

**Current Logic**:
```sql
-- No ownership check (SECURITY DEFINER)
UPDATE stories
SET pages = v_pages, last_modified_by = p_device_id
WHERE id = p_story_id
RETURNING * INTO v_story;
```

**Status**: ✅ No changes required - backend handles ownership check before calling these

---

## 5. CRITICAL DISCOVERY: Missing Story Migration

### Current Migration Procedures

#### create_team_with_owner_and_transfer_all

**What it does**:
1. ✅ Creates team record
2. ✅ Adds owner as team member
3. ✅ Transfers credits to team
4. ✅ Logs activity
5. ❌ **DOES NOT migrate user stories to team**

**What's missing**:
```sql
-- MISSING: Transfer all user stories to team
UPDATE stories
SET owner_id = v_team_id,
    owner_type = 'team'
WHERE owner_id = p_owner_user_id
  AND owner_type = 'user';
```

#### accept_invitation_and_transfer_all

**What it does**:
1. ✅ Validates invitation
2. ✅ Adds user as team member
3. ✅ Transfers credits to team
4. ✅ Logs activity
5. ❌ **DOES NOT migrate user stories to team**

**What's missing**:
```sql
-- MISSING: Transfer all user stories to team
UPDATE stories
SET owner_id = v_invitation.team_id,
    owner_type = 'team'
WHERE owner_id = p_user_id
  AND owner_type = 'user';
```

---

## 6. Foreign Key Constraints

### community_stories_old.original_story_id → stories.id

**Current**:
```sql
ALTER TABLE community_stories_old
ADD CONSTRAINT community_stories_original_story_id_fkey
FOREIGN KEY (original_story_id) REFERENCES stories(id);
```

**Status**: ✅ No changes required - references `stories.id`, not affected by column rename

---

## 7. Backend Code Analysis

### Files with Direct Supabase Queries

#### icraft-stories.ts (Lines 833, 886)

**Current**:
```typescript
.eq('user_id', userId)  // ← Must change to .eq('owner_id', userId).eq('owner_type', 'user')
```

#### icraft-sync.ts (Line 102)

**Current**:
```typescript
.eq('user_id', userId)  // ← Must change to .eq('owner_id', userId).eq('owner_type', 'user')
```

#### icraft-community.ts (Line 549)

**Current**:
```typescript
// Story duplication - must set owner_id, owner_type, created_by
```

---

## 8. Revised Implementation Strategy

### Complete Migration Plan (6 Phases)

**Phase 0: Immediate Remediation for Existing Teams**
```sql
-- Fix the 3 existing teams created today (124 stories)
-- Run BEFORE full migration deployment

BEGIN;

-- Migrate stories for "travel" team (119 stories)
UPDATE stories
SET user_id = 'c98ad5c8-a6da-4de3-9f3a-3061575b6398',  -- travel team_id
    team_id = 'c98ad5c8-a6da-4de3-9f3a-3061575b6398'
WHERE user_id = 'user_32p9LGMsD64veVmf5EEqzBl1cDZ';  -- travel team owner

-- Migrate stories for "Activity Logging Test Team v2" (5 stories)
UPDATE stories
SET user_id = '93c229c2-9d99-453e-bee2-48f04836476d',  -- team_id
    team_id = '93c229c2-9d99-453e-bee2-48f04836476d'
WHERE user_id = 'user_33iKAKBKLjNWBUjHZ5muL54Hcgu';  -- team owner

COMMIT;

-- NOTE: This is a temporary fix until full migration is deployed
-- After full migration, these will have owner_id=team_id, owner_type='team'
```

**Phase 1: Add New Columns (Non-breaking)**
```sql
BEGIN;

-- 1. Add owner_type column with DEFAULT
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

-- 2. Add created_by column
ALTER TABLE stories
ADD COLUMN created_by TEXT;

-- 3. Backfill created_by from user_id
UPDATE stories SET created_by = user_id WHERE created_by IS NULL;

-- 4. Make created_by NOT NULL
ALTER TABLE stories
ALTER COLUMN created_by SET NOT NULL;

-- 5. Set owner_type='team' for existing team stories
--    (Currently 0 stories, but will have 124 after Phase 0)
UPDATE stories
SET owner_type = 'team'
WHERE team_id IS NOT NULL;

-- 6. Add indexes (using user_id for now, will update after rename)
CREATE INDEX idx_stories_owner ON stories(user_id, owner_type);
CREATE INDEX idx_stories_created_by ON stories(created_by);

COMMIT;

-- STATUS: ✅ Non-breaking - existing code continues to work
```

**Phase 2: Rename user_id → owner_id (Breaking Change)**
```sql
BEGIN;

-- Drop old index (uses user_id)
DROP INDEX IF EXISTS idx_stories_owner;

-- Rename user_id → owner_id
ALTER TABLE stories RENAME COLUMN user_id TO owner_id;

-- Create new index with owner_id
CREATE INDEX idx_stories_owner ON stories(owner_id, owner_type);

-- For team stories, owner_id should be team_id (not user who created team)
UPDATE stories
SET owner_id = team_id
WHERE owner_type = 'team' AND team_id IS NOT NULL;

COMMIT;

-- STATUS: ⚠️ Breaking - backend MUST be updated simultaneously
```

**Phase 3: Update Stored Procedures (Non-breaking after Phase 2)**
```sql
-- Update all procedures/views/triggers to use owner_id instead of user_id/team_id
-- See section 4 for specific updates

-- 4 procedures:
--   - can_access_story: Change team_id JOIN to owner_id JOIN
--   - create_team_story: Use owner_id, owner_type instead of user_id, team_id
--   - remove_story_from_team: Block operation (Team-Only model)
--   - handle_team_story_credits: Check owner_type instead of team_id

-- 2 views:
--   - team_stories_view: WHERE owner_type='team' (instead of team_id IS NOT NULL)
--   - user_accessible_stories: WHERE owner_type='user'

-- 2 migration procedures:
--   - create_team_with_owner_and_transfer_all: Add story migration
--   - accept_invitation_and_transfer_all: Add story migration

-- STATUS: ✅ Non-breaking if deployed after Phase 2
```

**Phase 4: Drop team_id Column (Final Schema)**
```sql
BEGIN;

-- Verify no procedures reference team_id
-- (All should be updated in Phase 3)

-- Drop team_id column (no longer needed)
ALTER TABLE stories DROP COLUMN team_id;

COMMIT;

-- STATUS: ✅ Non-breaking if Phase 3 complete
-- FINAL SCHEMA: owner_id + owner_type (no team_id)
```

**Phase 5: Update Backend Code**
```sql
-- Update backend API to use owner_id/owner_type
-- 3 files with direct Supabase queries:
--   - icraft-stories.ts (lines 833, 886)
--   - icraft-sync.ts (line 102)
--   - icraft-community.ts (line 549)

-- DEPLOY: Coordinate with Phase 2 (must deploy together)
```

**Phase 6: Update Frontend**
```sql
-- Update frontend to use ownerId/ownerType
-- - Story interface
-- - Service methods
-- - IndexedDB schema

-- DEPLOY: Safe after backend Phase 5 deployed
```

---

## 9. Testing Checklist

### Database Testing
- [ ] Run Phase 0 (immediate remediation for 3 existing teams)
- [ ] Verify 124 stories migrated to teams correctly
- [ ] Run Phase 1 migration on non-prod
- [ ] Verify all existing stories have `owner_type='user'`
- [ ] Verify stories with `team_id` have `owner_type='team'`
- [ ] Verify `created_by` backfilled correctly
- [ ] Run Phase 2 migration on non-prod
- [ ] Verify `owner_id` contains correct values for team stories
- [ ] Run Phase 3 (update procedures/views/triggers)
- [ ] Verify procedures use `owner_id` instead of `team_id`
- [ ] Run Phase 4 (drop team_id column)
- [ ] Verify `team_id` column dropped successfully
- [ ] Test rollback procedures for each phase

### Stored Procedure Testing
- [ ] Test `can_access_story` with personal stories
- [ ] Test `can_access_story` with team stories
- [ ] Test `create_team_story` creates with correct ownership
- [ ] Test updated migration procedures transfer stories
- [ ] Test trigger function with team stories

### Backend Testing
- [ ] Test story listing (personal stories only)
- [ ] Test story creation (sets owner_type correctly)
- [ ] Test story editing (preserves owner_type)
- [ ] Test story deletion (checks owner_type for permissions)
- [ ] Test team creation migrates all stories
- [ ] Test invitation acceptance migrates all stories

### Frontend Testing
- [ ] Test personal story library loads
- [ ] Test team story library loads
- [ ] Test story creation from team context
- [ ] Test IndexedDB migration
- [ ] Test sync service handles owner_type

---

## 10. Deployment Plan

### Pre-Deployment
1. ✅ Database discovery complete
2. ✅ All procedures identified
3. ✅ Migration SQL drafted (6 phases)
4. ✅ Decision: Drop team_id column (documented)
5. [ ] Run Phase 0 on non-prod (fix 3 existing teams)
6. [ ] Update all stored procedures (4 procedures + 2 views + 1 trigger)
7. [ ] Update migration procedures to include story transfer
8. [ ] Update backend code (3 files)
9. [ ] Test all 6 phases on non-prod database
10. [ ] Get approval for deployment

### Deployment Day - Phased Approach

**Immediate (Phase 0)**:
1. Run Phase 0: Migrate 124 stories for 3 existing teams
2. Verify migrations successful
3. Monitor for issues

**Phase 1-2 (Breaking Change Window)**:
1. Deploy Phase 1 (add columns) - **Non-breaking**
2. Deploy Phase 2 (rename user_id → owner_id) + Backend Code - **Breaking, coordinated**
3. Monitor for errors (critical window)

**Phase 3-4 (Cleanup)**:
1. Deploy Phase 3 (update procedures/views/triggers) - **Non-breaking**
2. Test all procedures work with new schema
3. Deploy Phase 4 (drop team_id) - **Non-breaking**
4. Verify final schema correct

**Phase 5-6 (Frontend)**:
1. Deploy Phase 5 (backend complete) - **Already done in Phase 2**
2. Deploy Phase 6 (frontend) - **Safe after backend**
3. Enable team creation features

### Post-Deployment
1. Monitor error logs for 24 hours
2. Verify story counts: 323 total stories
   - Personal stories should have `owner_type='user'`
   - 124 team stories should have `owner_type='team'`
3. Verify team migrations work for new teams
4. Verify `team_id` column successfully dropped
5. Gather user feedback
6. Document any issues

---

## 11. Risk Assessment

### Critical Risks

**1. Missing Story Migration in Existing Procedures**
- **Risk**: Users create teams, credits transfer, but stories don't migrate
- **Impact**: HIGH - Users lose access to their stories
- **Mitigation**: Update both migration procedures to include story UPDATE

**2. Column Rename Breaking Change**
- **Risk**: Any missed reference to `user_id` will break
- **Impact**: HIGH - Runtime errors, failed queries
- **Mitigation**: Comprehensive code search, phased deployment

**3. Frontend-Backend Mismatch**
- **Risk**: Frontend sends `userId`, backend expects `ownerId`
- **Impact**: MEDIUM - Story operations fail
- **Mitigation**: Deploy backend first with backward compatibility

### Medium Risks

**4. View Updates**
- **Risk**: Views not updated, return wrong columns
- **Impact**: MEDIUM - Queries using views fail
- **Mitigation**: Update views in Phase 3

**5. Trigger Function**
- **Risk**: Trigger checks wrong column
- **Impact**: MEDIUM - Team credits not deducted
- **Mitigation**: Update trigger in Phase 3

### Low Risks

**6. No pg_cron Jobs**
- **Risk**: None - no scheduled jobs reference stories
- **Impact**: NONE
- **Mitigation**: None needed

**7. Dropping team_id Column**
- **Risk**: If procedures still reference team_id when dropped
- **Impact**: LOW - Detected at Phase 3 testing, before Phase 4
- **Mitigation**: Verify all procedures updated before Phase 4
- **Rollback**: Can re-add column if needed (before Phase 4)

---

## 12. Next Steps

### Immediate Actions (Priority Order)

1. **Phase 0: Fix Existing Teams** (URGENT)
   - Run remediation SQL on non-prod first
   - Migrate 124 stories for 3 existing teams
   - Verify team owners can access their stories

2. **Update Migration Procedures** (HIGH PRIORITY)
   - Add story transfer logic to `create_team_with_owner_and_transfer_all`
   - Add story transfer logic to `accept_invitation_and_transfer_all`
   - Test procedures transfer stories correctly

3. **Write Complete Migration SQL**
   - Phase 1: Add columns SQL
   - Phase 2: Rename + backend coordination SQL
   - Phase 3: Update procedures SQL
   - Phase 4: Drop team_id SQL

4. **Update Stored Procedures**
   - 4 procedures: `can_access_story`, `create_team_story`, `remove_story_from_team`, `handle_team_story_credits`
   - 2 views: `team_stories_view`, `user_accessible_stories`
   - All to use `owner_id` + `owner_type` instead of `user_id`/`team_id`

5. **Update Backend Code**
   - `icraft-stories.ts` (2 queries)
   - `icraft-sync.ts` (1 query)
   - `icraft-community.ts` (1 duplication logic)

### Before Production Deployment
1. ✅ Get approval for breaking change (column rename)
2. ✅ Get approval to drop team_id column
3. [ ] Test all 6 phases on non-prod database
4. [ ] Schedule maintenance window for Phase 2
5. [ ] Prepare rollback scripts for each phase
6. [ ] Brief team on 6-phase deployment plan
7. [ ] Set up monitoring alerts

---

## Document Status

- **Discovery Phase**: ✅ Complete (2025-10-20)
- **Planning Phase**: ✅ Complete (2025-10-20)
  - ✅ Decision: Drop team_id column
  - ✅ 6-phase migration plan documented
  - ✅ Current state analyzed (323 stories, 3 teams, 124 stories need migration)
- **Implementation Phase**: 🚧 Ready to Start
  - Next: Run Phase 0 remediation
  - Next: Update migration procedures
- **Testing Phase**: ⏳ Pending
- **Deployment Phase**: ⏳ Pending

---

**End of Document**
