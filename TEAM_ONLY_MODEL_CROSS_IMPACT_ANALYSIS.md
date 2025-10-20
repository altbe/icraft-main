# Team-Only Model: Cross-Impact Analysis

**Version**: 1.0
**Date**: 2025-10-20
**Related**: TEAM_ONLY_MODEL_DESIGN.md v1.1

## Executive Summary

This document analyzes the impact of adding `owner_type` discriminator to the `stories` table and identifies ALL database functions, stored procedures, and application code that need updates.

---

## 1. Database Schema Change Summary

### Change Being Made
```sql
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));
```

### Migration Strategy
1. **Add column with DEFAULT 'user'** - All existing stories become user stories
2. **Update indexes** - Add composite index `(owner_id, owner_type)`
3. **Update constraints** - Ensure `owner_id` is NOT NULL
4. **Keep `created_by`** - Always user ID, used for permissions

### Backward Compatibility
- ✅ **Safe DEFAULT**: All existing stories get `owner_type='user'`
- ✅ **No NULL values**: `owner_id` remains non-null
- ✅ **created_by preserved**: Permission system unchanged
- ⚠️ **Breaking change**: Any code querying stories MUST add `owner_type` filter

---

## 2. Impact Assessment Matrix

| Component | Impact Level | Changes Required | Risk Level |
|-----------|--------------|------------------|------------|
| Stored Procedures | **HIGH** | Query updates | Medium |
| Backend API Endpoints | **HIGH** | Query updates | Medium |
| Frontend Story Service | **HIGH** | Type updates | Low |
| Database Indexes | **MEDIUM** | New indexes | Low |
| Existing Data | **LOW** | Auto-migrated | Low |

---

## 3. Stored Procedures - Detailed Impact

### 3.1 New Procedures (Already Designed)

These are NEW procedures created for the Team-Only Model:

| Procedure | Status | Notes |
|-----------|--------|-------|
| `create_team_with_stories_migration()` | ✅ Designed | Uses `owner_type` correctly |
| `accept_invitation_with_stories_migration()` | ✅ Designed | Uses `owner_type` correctly |
| `get_team_activities()` (updated) | ✅ Designed | Filters by `owner_type='team'` |

### 3.2 Existing Procedures - Need Review

We need to identify and update ALL existing stored procedures that query the `stories` table.

#### Known Procedures (from previous work)
| Procedure | Location | Impact | Update Required |
|-----------|----------|--------|-----------------|
| `get_user_teams_with_details()` | Created recently | None | ✅ Doesn't query stories |

#### Procedures to Discover
We need to query the database to find ALL procedures that reference `stories` table:

```sql
-- Query to find all stored procedures that reference 'stories' table
SELECT
  n.nspname as schema_name,
  p.proname as procedure_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%stories%'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;
```

**Action Item**: Run this query on both non-prod and prod databases to get complete list.

### 3.3 Likely Procedures That Need Updates

Based on typical iCraftStories functionality, these procedures likely exist and need updates:

#### Story CRUD Procedures
```sql
-- If these exist, they need updates:
- get_user_stories() -- Add: WHERE owner_type = 'user'
- create_story() -- Add: owner_type parameter
- update_story() -- Preserve owner_type on update
- delete_story() -- Check permissions using owner_type
- duplicate_story() -- Preserve owner_type when duplicating
```

#### Story Query Procedures
```sql
-- If these exist, they need updates:
- search_stories() -- Filter by owner_type
- get_recent_stories() -- Filter by owner_type
- get_published_stories() -- May need owner_type for attribution
- get_community_stories() -- May need owner_type for display
```

#### Credit/Usage Procedures
```sql
-- If these exist, they need updates:
- use_story_credits() -- Check owner_type to determine credit source
- get_story_usage() -- Group by owner_type
```

---

## 4. Backend API Endpoints - Impact Analysis

### 4.1 Story Endpoints - Direct Impact

| Endpoint | Current Query | Updated Query | Priority |
|----------|---------------|---------------|----------|
| `GET /stories` | `WHERE owner_id = ?` | `WHERE owner_id = ? AND owner_type = 'user'` | **HIGH** |
| `POST /stories` | `INSERT ... owner_id` | `INSERT ... owner_id, owner_type` | **HIGH** |
| `PUT /stories/:id` | No owner filter | Preserve `owner_type` | **MEDIUM** |
| `DELETE /stories/:id` | Check `owner_id` | Check `owner_type` for permissions | **HIGH** |
| `GET /stories/:id` | `WHERE id = ?` | Add `owner_type` to response | **MEDIUM** |

### 4.2 Team Story Endpoints - New

| Endpoint | Query | Priority |
|----------|-------|----------|
| `GET /teams/:id/stories` | `WHERE owner_id = :teamId AND owner_type = 'team'` | **HIGH** |
| `POST /teams/:id/stories` | `INSERT ... owner_id = :teamId, owner_type = 'team'` | **HIGH** |

### 4.3 Supporting Endpoints

| Endpoint | Impact | Update Required |
|----------|--------|-----------------|
| `GET /users/:id/story-count` | **NEW** | Count where `owner_type = 'user'` |
| `GET /users/:id/profile` | Low | May return story count - add filter |
| `GET /credits/balance` | Medium | May query story usage - check owner_type |

---

## 5. Frontend Code - Impact Analysis

### 5.1 Type Definitions

**File**: `frontend/src/types.ts`

```typescript
// BEFORE
export interface Story {
  id: string;
  ownerId: string;
  // ... other fields
}

// AFTER
export interface Story {
  id: string;
  ownerId: string;           // User ID or Team ID
  ownerType: 'user' | 'team'; // NEW: Discriminator
  createdBy: string;          // NEW: Always user ID
  // ... other fields
}
```

### 5.2 Service Layer Updates

**File**: `frontend/src/services/StoryService.ts`

All methods need to handle `ownerType`:

| Method | Update Required | Priority |
|--------|-----------------|----------|
| `getPersonalStories()` | Filter by `ownerType='user'` | **HIGH** |
| `getTeamStories()` | Filter by `ownerType='team'` | **HIGH** |
| `createStory()` | Include `ownerType` in request | **HIGH** |
| `duplicateStory()` | Preserve `ownerType` | **MEDIUM** |
| `deleteStory()` | Permission check using `ownerType` | **HIGH** |
| `shareStory()` | Attribution based on `ownerType` | **MEDIUM** |
| `publishStory()` | Attribution based on `ownerType` | **MEDIUM** |

### 5.3 Component Updates

| Component | Impact | Changes Required |
|-----------|--------|------------------|
| `StoryLibrary.tsx` | **HIGH** | Load stories based on user's team membership |
| `StoryCard.tsx` | **MEDIUM** | Show team badge if `ownerType='team'` |
| `StoryEditor.tsx` | **LOW** | Mostly unchanged, save preserves `ownerType` |
| `CreateStoryDialog.tsx` | **MEDIUM** | Set `ownerType` based on team membership |
| `TeamStoryManager.tsx` | **HIGH** | Query team stories with `ownerType='team'` |

---

## 6. IndexedDB (Offline Storage) - Impact

### 6.1 DatabaseService Updates

**File**: `frontend/src/services/DatabaseService.ts`

```typescript
// Story schema in IndexedDB needs to include ownerType
const storyStore = db.createObjectStore('stories', { keyPath: 'id' });
storyStore.createIndex('owner', ['ownerId', 'ownerType']); // NEW composite index
storyStore.createIndex('createdBy', 'createdBy'); // NEW for permissions
```

### 6.2 Sync Service Updates

**File**: `frontend/src/services/SimplifiedSyncService.ts`

- Sync queries need to filter by `ownerType`
- Conflict resolution preserves `ownerType`
- Migration of local stories to new schema

---

## 7. Migration Sequence

### Phase 1: Database Schema (Zero Downtime)
```sql
BEGIN;

-- Step 1: Add column with DEFAULT (safe - no breaking changes)
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

-- Step 2: Add indexes (safe - performance improvement)
CREATE INDEX idx_stories_owner ON stories(owner_id, owner_type);
CREATE INDEX idx_stories_created_by ON stories(created_by);

-- Step 3: Add constraint (safe - owner_id already not null)
ALTER TABLE stories
ADD CONSTRAINT chk_story_owner_not_null
  CHECK (owner_id IS NOT NULL);

-- Step 4: Create new stored procedures (safe - new functions)
-- (Full SQL from TEAM_ONLY_MODEL_DESIGN.md Appendix A)

COMMIT;
```

✅ **Safe to deploy**: Existing code continues to work (ignores `owner_type`)

### Phase 2: Backend API Updates
```bash
# Update all backend modules to use owner_type
1. Update story query endpoints
2. Update story creation endpoints
3. Update story permission checks
4. Deploy backend (backward compatible with old frontend)
```

✅ **Safe to deploy**: Backend sends `owner_type`, old frontend ignores it

### Phase 3: Frontend Updates
```bash
# Update frontend to use owner_type
1. Update Story interface
2. Update StoryService methods
3. Update components
4. Update IndexedDB schema
5. Deploy frontend
```

✅ **Safe to deploy**: Frontend uses `owner_type`, backend already provides it

### Phase 4: Enable Team Features
```bash
# Enable team creation and migration
1. Enable team creation dialog with migration warning
2. Enable invitation acceptance with migration
3. Monitor for issues
```

---

## 8. Testing Checklist

### 8.1 Database Testing
- [ ] Run schema migration on non-prod database
- [ ] Verify all existing stories have `owner_type='user'`
- [ ] Test new stored procedures with sample data
- [ ] Verify indexes created successfully
- [ ] Test rollback procedure

### 8.2 Backend Testing
- [ ] Unit tests for updated story endpoints
- [ ] Integration tests for team story queries
- [ ] Permission tests for story deletion/editing
- [ ] Test team creation with story migration
- [ ] Test invitation acceptance with story migration

### 8.3 Frontend Testing
- [ ] Type checking passes with new Story interface
- [ ] Story list loads correctly (personal stories)
- [ ] Team story list loads correctly
- [ ] Story creation works for both user and team
- [ ] IndexedDB migration works for offline stories
- [ ] Sync service handles owner_type correctly

### 8.4 End-to-End Testing
- [ ] User creates team → stories migrated
- [ ] User accepts invitation → stories migrated
- [ ] Team member sees all team stories
- [ ] Team member can edit team stories
- [ ] Team member can delete own stories only
- [ ] Team admin can delete any story
- [ ] Story duplication preserves owner_type
- [ ] Story sharing shows correct attribution

---

## 9. Risk Assessment

### High Risk Areas
1. **Data Migration**: All existing stories default to `owner_type='user'`
   - **Mitigation**: Test migration on copy of prod data first
   - **Rollback**: ALTER TABLE DROP COLUMN is possible (but loses team assignments)

2. **Stored Procedure Discovery**: We may not know all procedures that need updates
   - **Mitigation**: Run discovery query on prod database
   - **Mitigation**: Deploy with comprehensive monitoring

3. **Frontend IndexedDB Migration**: Local stories need schema update
   - **Mitigation**: Version IndexedDB schema, migrate on open
   - **Fallback**: Clear IndexedDB and re-sync from server

### Medium Risk Areas
1. **API Endpoint Updates**: Missing owner_type filters could leak team stories
   - **Mitigation**: Comprehensive unit tests
   - **Mitigation**: Code review focused on story queries

2. **Permission Checks**: Incorrect owner_type checks could allow unauthorized access
   - **Mitigation**: Security-focused testing
   - **Mitigation**: Permission test suite

### Low Risk Areas
1. **New Stored Procedures**: These are new code, won't break existing functionality
2. **Frontend Type Updates**: TypeScript catches most issues at compile time
3. **Database Indexes**: Performance improvement, no functional change

---

## 10. Discovery Actions Required

### Before Implementation
1. **Run Stored Procedure Discovery Query** (Section 3.2)
   ```bash
   # Connect to non-prod database
   psql $SUPABASE_NONPROD_URL

   # Run discovery query
   \i scripts/discover-story-procedures.sql
   ```

2. **Review Backend Codebase**
   ```bash
   # Find all story-related queries
   cd backend
   grep -r "FROM stories" modules/
   grep -r "JOIN stories" modules/
   grep -r "UPDATE stories" modules/
   grep -r "INSERT INTO stories" modules/
   grep -r "DELETE FROM stories" modules/
   ```

3. **Review Frontend Codebase**
   ```bash
   # Find all Story type usage
   cd frontend
   grep -r "interface Story" src/
   grep -r "Story\[\]" src/
   grep -r "owner_id" src/
   grep -r "ownerId" src/
   ```

4. **Check Production Data**
   ```bash
   # Count stories by owner type (after schema migration)
   SELECT
     owner_type,
     COUNT(*) as count
   FROM stories
   GROUP BY owner_type;

   # Should show: ('user', <total count>)
   # After team creation: ('user', <personal count>), ('team', <team count>)
   ```

---

## 11. Open Questions to Resolve

1. **Q**: Are there any `pg_cron` jobs that query the stories table?
   - **Action**: Check for scheduled jobs that might need updates

2. **Q**: Do we have any database views that include the stories table?
   - **Action**: Query for views: `SELECT * FROM information_schema.views WHERE table_name = 'stories'`

3. **Q**: Are there any triggers on the stories table?
   - **Action**: Query for triggers: `SELECT * FROM information_schema.triggers WHERE event_object_table = 'stories'`

4. **Q**: Do we have any materialized views that reference stories?
   - **Action**: Query for matviews: `SELECT matviewname FROM pg_matviews`

5. **Q**: Are there any foreign key constraints FROM other tables TO stories?
   - **Action**: Query foreign keys: `SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'`

---

## 12. Rollback Plan

### If Critical Issues Discovered

**Option 1: Rollback Database Only** (if backend not yet deployed)
```sql
BEGIN;
DROP INDEX IF EXISTS idx_stories_owner;
DROP INDEX IF EXISTS idx_stories_created_by;
ALTER TABLE stories DROP CONSTRAINT IF EXISTS chk_story_owner_not_null;
ALTER TABLE stories DROP COLUMN IF EXISTS owner_type;
COMMIT;
```

**Option 2: Rollback Backend + Database** (if backend deployed)
1. Revert backend to previous version
2. Run database rollback SQL above
3. Verify system operational

**Option 3: Forward Fix** (if team migrations already occurred)
- Cannot drop `owner_type` column (would lose team assignments)
- Must fix issues in place
- Deploy hotfix with corrected logic

---

## 13. Deployment Checklist

### Pre-Deployment
- [ ] Run stored procedure discovery query
- [ ] Review all identified procedures
- [ ] Update all affected procedures
- [ ] Run migration on copy of prod data
- [ ] Verify zero data loss in test migration
- [ ] Complete unit test suite
- [ ] Complete integration test suite
- [ ] Complete E2E test suite
- [ ] Review rollback procedures

### Deployment Day
- [ ] Deploy database migration (non-prod)
- [ ] Verify migration success (non-prod)
- [ ] Deploy backend updates (non-prod)
- [ ] Verify API endpoints (non-prod)
- [ ] Deploy frontend updates (non-prod)
- [ ] Run E2E tests (non-prod)
- [ ] Deploy to production (database → backend → frontend)
- [ ] Monitor error rates
- [ ] Verify team creation works
- [ ] Verify story migration works

### Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Verify story counts match expectations
- [ ] Verify no unauthorized access issues
- [ ] Gather user feedback
- [ ] Document any issues discovered

---

## Document Status

- **Status**: Draft - Awaiting Discovery Phase
- **Next Steps**:
  1. Run stored procedure discovery query
  2. Review backend story queries
  3. Complete impact analysis with findings
  4. Get approval to proceed

---

**End of Document**
