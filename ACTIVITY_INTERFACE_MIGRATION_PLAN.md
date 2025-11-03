# Activity Interface Migration Plan

**Created:** 2025-11-03
**Status:** Ready for Implementation
**Goal:** Consolidate ActivityLog and TeamActivity into single interface aligned with database schema

---

## Executive Summary

### Current Problem

1. **Two redundant interfaces** - `ActivityLog` (frontend IndexedDB) and `TeamActivity` (backend database)
2. **Schema mismatch** - Frontend missing `entityType`/`entityId` fields that exist in database
3. **Display fields at top level** - `storyTitle`, `teamName`, etc. should be in metadata
4. **Type inconsistency** - Database had `entity_id` as UUID but needs TEXT for team IDs

### Solution

1. ✅ **Fix database schema** - Change `entity_id` from UUID to TEXT (Migration 027 - COMPLETE)
2. **Add core fields** - Add `entityType`/`entityId` to frontend ActivityLog
3. **Move display fields** - Migrate `storyTitle`, `teamName`, etc. to metadata
4. **Consolidate interfaces** - Use single ActivityLog for both local and remote activities

---

## Database Schema Changes

### ✅ Migration 027: entity_id Type Change (COMPLETE)

**Issue:** `entity_id` was UUID but needs to support TEXT team IDs (Clerk: `org_2kX...`)

**Fix Applied:**
```sql
ALTER TABLE activities
ALTER COLUMN entity_id TYPE TEXT
USING entity_id::TEXT;
```

**Rationale:**
- `stories.id` → UUID
- `teams.id` → TEXT (Clerk organization IDs)
- `credit_transactions.id` → UUID
- Must support mixed ID types

**Status:** ✅ Deployed to production and non-prod (2025-11-03)

---

## Current Database Schema (After Migration 027)

```sql
CREATE TABLE activities (
  -- Core indexed fields
  id                UUID PRIMARY KEY,
  user_id           TEXT NOT NULL,
  action_type       TEXT NOT NULL,
  entity_type       TEXT,           -- What kind: 'story', 'team', 'credit'
  entity_id         TEXT,           -- Which one: story UUID or team ID
  team_id           TEXT,           -- Team context

  -- Flexible storage
  metadata          JSONB,

  -- Timestamps
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  last_modified_by  TEXT
);
```

---

## Target Interface Structure

### Consolidated ActivityLog Interface

```typescript
export interface ActivityLog {
  // ========================================
  // CORE STRUCTURE (Match database columns)
  // ========================================
  id: string;
  userId: string;
  actionType: ActivityType;
  entityType: string;        // NEW: 'story', 'team', 'credit', etc.
  entityId: string;          // NEW: UUID or TEXT ID
  teamId?: string;           // Team context (TEXT)

  // ========================================
  // ACTOR DISPLAY (Computed by backend JOIN)
  // ========================================
  userEmail?: string;        // From user_profiles.email
  userName?: string;         // From user_profiles.display_name

  // ========================================
  // FLEXIBLE CONTEXT (Action-specific details)
  // ========================================
  metadata: {
    // Story actions
    storyTitle?: string;
    tags?: string[];

    // Team actions
    teamName?: string;
    targetUserId?: string;
    targetUserEmail?: string;
    previousRole?: string;
    newRole?: string;
    creditsTransferred?: number;
    storiesTransferred?: number;

    // Credit actions
    amount?: number;
    fromType?: 'personal' | 'team';
    toType?: 'personal' | 'team';
    description?: string;

    // Community copy
    communityStoryId?: string;
    creditsUsed?: number;

    // ... other action-specific fields
  };

  // ========================================
  // TIMESTAMPS
  // ========================================
  createdAt: string;
  updatedAt: string;

  // ========================================
  // INTERNAL (Frontend only)
  // ========================================
  _dateSanitized?: boolean;
  _lastModifiedBy?: string;  // Device ID
}
```

---

## Field Migration Mapping

### Top-Level Fields

| Current Field | Migration | Reason |
|--------------|-----------|--------|
| `id` | ✅ Keep | Primary key |
| `userId` | ✅ Keep | Actor (indexed) |
| `actionType` | ✅ Keep | What happened (indexed) |
| **`entityType`** | ➕ **ADD** | What kind (indexed) |
| **`entityId`** | ➕ **ADD** | Which one (indexed) |
| `teamId` | ✅ Keep | Team context (indexed) |
| `userEmail` | ✅ Keep | Actor display (JOIN) |
| `userName` | ✅ Keep | Actor display (JOIN) |
| `metadata` | ✅ Keep | Flexible storage |
| `createdAt` | ✅ Keep | Timestamp |
| `updatedAt` | ✅ Keep | Timestamp |

### Fields Moving to Metadata

| Current Field | New Location | Example |
|--------------|--------------|---------|
| `storyId` | ❌ Remove | Use `entityId` instead |
| `storyTitle` | `metadata.storyTitle` | Display only |
| `teamName` | `metadata.teamName` | Display only |
| `targetUserId` | `metadata.targetUserId` | Context |
| `targetUserEmail` | `metadata.targetUserEmail` | Context |
| `tags` | `metadata.tags` | Categorization |

---

## Migration Phases

### Phase 1: Add Core Fields to Interfaces

**Backend** (`backend/modules/types.ts`):
```typescript
export interface ActivityLog {
  id: string;
  userId: string;
  actionType: ActivityType;
  entityType: string;      // ADD
  entityId: string;        // ADD
  teamId?: string;
  userEmail?: string;
  userName?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// DEPRECATED: Will be removed after consolidation
export interface TeamActivity {
  // Keep temporarily for compatibility
}
```

**Frontend** (`frontend/src/types.ts`):
```typescript
export interface ActivityLog {
  id: string;
  userId: string;
  actionType: ActivityType;
  entityType: string;      // ADD
  entityId: string;        // ADD
  teamId?: string;

  // Display fields (keep during migration)
  storyId?: string;        // DEPRECATED
  storyTitle?: string;     // DEPRECATED
  teamName?: string;       // DEPRECATED

  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

**Files to Update:**
- `backend/modules/types.ts`
- `frontend/src/types.ts`

---

### Phase 2: Update Backend to Populate New Fields

**2.1. Stored Procedures**

Update functions to set `entity_type` and `entity_id`:

```sql
-- Example: copy_community_story_transactional
INSERT INTO activities (
  user_id,
  team_id,
  action_type,
  entity_type,    -- ADD
  entity_id,      -- ADD
  metadata
) VALUES (
  p_user_id,
  v_team_id,
  'community_story_copied',
  'story',        -- NEW
  v_new_story_id, -- NEW
  jsonb_build_object(
    'community_story_id', p_community_story_id,
    'new_story_id', v_new_story_id,
    'credits_used', v_credit_cost
  )
);
```

**Files to Update:**
- `supabase/migrations/*_copy_community_story_transactional.sql`
- Any other functions that INSERT INTO activities

**2.2. Backend API Responses**

Ensure `team-activities.ts` includes new fields:

```typescript
const formattedActivities = (activities || []).map((activity: any) => ({
  id: activity.activity_id,
  userId: activity.user_id,
  userEmail: activity.user_email,
  userName: activity.user_name,
  actionType: activity.action_type,
  entityType: activity.entity_type,  // Already exists
  entityId: activity.entity_id,      // Already exists
  metadata: activity.metadata,
  createdAt: activity.created_at,
  updatedAt: activity.updated_at
}));
```

**Files to Update:**
- `backend/modules/team-activities.ts`

---

### Phase 3: Update Frontend to Write New Fields

**3.1. ActivityService - logActivity()**

```typescript
async logActivity(userId: string, story: Story | null, actionType: ActivityType) {
  const activity: ActivityLog = {
    id: uuidv4(),
    userId,
    actionType,
    entityType: 'story',              // NEW
    entityId: story?.id || '',        // NEW
    teamId: story?.teamId,

    // Deprecated (keep during migration)
    storyId: story?.id,               // DEPRECATED
    storyTitle: story?.title,         // DEPRECATED

    metadata: {
      storyTitle: story?.title || 'Untitled',  // NEW location
      tags: story?.tags || []                   // NEW location
    },

    createdAt: ensureISOStringFormat(new Date()),
    updatedAt: ensureISOStringFormat(new Date())
  };

  await simplifiedSync.saveActivity(activity);
}
```

**3.2. ActivityService - logTeamActivity()**

```typescript
async logTeamActivity(
  userId: string,
  actionType: ActivityType,
  teamId: string,
  teamName: string,
  metadata?: any
) {
  const activity: ActivityLog = {
    id: uuidv4(),
    userId,
    actionType,
    entityType: 'team',         // NEW
    entityId: teamId,           // NEW
    teamId,

    metadata: {
      teamName,                 // NEW location
      ...metadata               // Merge action-specific metadata
    },

    createdAt: ensureISOStringFormat(new Date()),
    updatedAt: ensureISOStringFormat(new Date())
  };

  await db.put('activities', activity);
}
```

**Files to Update:**
- `frontend/src/services/ActivityService.ts`

---

### Phase 4: Move Display Fields to Metadata

**4.1. Backend Functions**

Move display fields to metadata in stored procedures:

```sql
-- Before
INSERT INTO activities (metadata)
VALUES (jsonb_build_object(
  'credits_used', 1
));

-- After
INSERT INTO activities (metadata)
VALUES (jsonb_build_object(
  'storyTitle', v_story_record.title,     -- ADD
  'credits_used', 1
));
```

**4.2. Frontend Migration**

During migration period, read from both locations:

```typescript
// Backward compatible helper
function getStoryTitle(activity: ActivityLog): string {
  return activity.metadata?.storyTitle  // New location
    || activity.storyTitle              // Old location (deprecated)
    || 'Untitled';
}
```

**Files to Update:**
- Backend stored procedures
- `frontend/src/services/ActivityService.ts`
- `frontend/src/components/TeamActivityLog.tsx`
- `frontend/src/components/profile/ActivityTable.tsx`

---

### Phase 5: Update UI Components to Read from Metadata

**5.1. TeamActivityLog Component**

```typescript
// Before
const title = activity.storyTitle;
const teamName = activity.teamName;

// After (with fallback during migration)
const title = activity.metadata?.storyTitle || activity.storyTitle || 'Untitled';
const teamName = activity.metadata?.teamName || activity.teamName || 'Unknown';
```

**5.2. Activity Display Helpers**

Create helper functions for consistent access:

```typescript
// frontend/src/lib/activity-helpers.ts
export function getActivityDisplayName(activity: ActivityLog): string {
  switch (activity.entityType) {
    case 'story':
      return activity.metadata?.storyTitle || 'Untitled Story';
    case 'team':
      return activity.metadata?.teamName || 'Unknown Team';
    default:
      return 'Unknown';
  }
}

export function getActivityEntityId(activity: ActivityLog): string {
  return activity.entityId;
}
```

**Files to Update:**
- `frontend/src/components/TeamActivityLog.tsx`
- `frontend/src/components/profile/ActivityTable.tsx`
- Create `frontend/src/lib/activity-helpers.ts`

---

### Phase 6: Remove Deprecated Fields

After all code updated and deployed:

**6.1. Remove from Interfaces**

```typescript
export interface ActivityLog {
  id: string;
  userId: string;
  actionType: ActivityType;
  entityType: string;
  entityId: string;
  teamId?: string;
  userEmail?: string;
  userName?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;

  // REMOVE:
  // storyId?: string;
  // storyTitle?: string;
  // teamName?: string;
  // targetUserId?: string;
  // targetUserEmail?: string;
  // tags?: string[];
}
```

**6.2. Remove Fallback Code**

```typescript
// Remove backward compatibility helpers
// const title = activity.metadata?.storyTitle || activity.storyTitle;

// Use direct access
const title = activity.metadata?.storyTitle || 'Untitled';
```

**Files to Update:**
- `backend/modules/types.ts`
- `frontend/src/types.ts`
- All components using ActivityLog

---

### Phase 7: Consolidate ActivityLog and TeamActivity

**7.1. Remove TeamActivity Interface**

```typescript
// REMOVE this interface entirely
// export interface TeamActivity { ... }

// Use ActivityLog everywhere
export interface ActivityLog {
  // ... consolidated interface
}
```

**7.2. Update Component Props**

```typescript
// Before
interface TeamActivityLogProps {
  activities: TeamActivity[];  // REMOVE
}

// After
interface TeamActivityLogProps {
  activities: ActivityLog[];   // USE
}
```

**7.3. Update API Response Types**

```typescript
// backend/modules/team-activities.ts
export async function getTeamActivities() {
  // Return ActivityLog[], not TeamActivity[]
  return formattedActivities;  // Already ActivityLog format
}
```

**Files to Update:**
- `backend/modules/types.ts`
- `frontend/src/types.ts`
- `frontend/src/services/TeamService.ts`
- `frontend/src/components/TeamActivityLog.tsx`

---

## Testing Strategy

### Phase-by-Phase Testing

**After Phase 1:**
- ✅ TypeScript compiles without errors
- ✅ No runtime errors from new optional fields

**After Phase 2:**
- ✅ Backend APIs return entityType/entityId
- ✅ Database activities have new fields populated
- ✅ Stored procedures work correctly

**After Phase 3:**
- ✅ Frontend creates activities with new fields
- ✅ IndexedDB stores activities correctly
- ✅ Sync to backend works

**After Phase 4:**
- ✅ Display fields appear in metadata
- ✅ UI still displays correctly (fallback works)

**After Phase 5:**
- ✅ UI reads from metadata
- ✅ Old activities still display (backward compat)

**After Phase 6:**
- ✅ No references to deprecated fields
- ✅ All tests pass

**After Phase 7:**
- ✅ Only ActivityLog interface exists
- ✅ Team activity feed works correctly

### Integration Tests

```typescript
describe('Activity Migration', () => {
  it('creates activity with new structure', async () => {
    const activity = await activityService.logActivity(userId, story, 'create');

    expect(activity.entityType).toBe('story');
    expect(activity.entityId).toBe(story.id);
    expect(activity.metadata.storyTitle).toBe(story.title);
  });

  it('reads activity from both old and new format', () => {
    const oldFormat = { storyTitle: 'Old' };
    const newFormat = { metadata: { storyTitle: 'New' } };

    expect(getStoryTitle(oldFormat)).toBe('Old');
    expect(getStoryTitle(newFormat)).toBe('New');
  });
});
```

---

## Rollout Plan

### Step 1: Database Migration (COMPLETE ✅)
- Migration 027: entity_id UUID → TEXT
- Status: Deployed to production and non-prod

### Step 2: Backend Changes (Phases 1-2)
- Add fields to interfaces
- Update stored procedures
- Update API responses
- Deploy to QA → Production

### Step 3: Frontend Changes (Phases 3-5)
- Add fields to interfaces
- Update ActivityService
- Update UI components
- Deploy to QA → Production

### Step 4: Cleanup (Phases 6-7)
- Remove deprecated fields
- Consolidate interfaces
- Deploy to QA → Production

### Timeline Estimate

- **Week 1:** Phases 1-2 (Backend)
- **Week 2:** Phases 3-5 (Frontend)
- **Week 3:** Testing and validation
- **Week 4:** Phases 6-7 (Cleanup)

---

## Risk Mitigation

### Backward Compatibility

During migration, support both formats:

```typescript
function getStoryTitle(activity: ActivityLog): string {
  // Try new location first
  if (activity.metadata?.storyTitle) {
    return activity.metadata.storyTitle;
  }

  // Fall back to old location
  if (activity.storyTitle) {
    return activity.storyTitle;
  }

  return 'Untitled';
}
```

### Rollback Strategy

Each phase can be rolled back independently:
- Database schema change is safe (TEXT supports UUID strings)
- New fields are optional (nullable)
- Old code works with new data (ignores unknown fields)
- New code works with old data (fallback logic)

### Data Integrity

- No data loss (only adding/moving fields)
- No breaking changes to existing activities
- All existing queries continue to work

---

## Success Criteria

✅ **Consolidation Complete:**
- Only one ActivityLog interface exists
- TeamActivity interface removed
- All code uses ActivityLog

✅ **Schema Aligned:**
- Frontend interface matches database schema
- entityType/entityId used consistently
- Display fields in metadata

✅ **Performance Maintained:**
- Query performance unchanged or improved
- No regression in sync performance
- UI responsiveness maintained

✅ **Tests Pass:**
- All unit tests pass
- Integration tests pass
- Manual testing complete

---

## Documentation Updates

After completion:
- Update `backend/CLAUDE.md` with new structure
- Update `frontend/CLAUDE.md` with new patterns
- Update API documentation
- Update developer guides

---

## Questions Answered

**Q: Should entityId be UUID or TEXT?**
**A:** TEXT - Must support both UUID (stories) and TEXT (team IDs from Clerk)

**Q: Should entityType/entityId be in metadata?**
**A:** No - They're indexed database columns for querying, not display data

**Q: Why do we need userEmail and userName?**
**A:** Team activity feed requires showing "who did what" - computed by backend JOIN from user_profiles

**Q: Why consolidate ActivityLog and TeamActivity?**
**A:** They represent the same data with same structure - no need for two interfaces

---

**Last Updated:** 2025-11-03
**Status:** ✅ Ready for Phase 1 Implementation
