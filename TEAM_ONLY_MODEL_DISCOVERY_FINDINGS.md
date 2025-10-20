# Team-Only Model: Discovery Findings

**Date**: 2025-10-20
**Related**: TEAM_ONLY_MODEL_CROSS_IMPACT_ANALYSIS.md

## Critical Discovery: Column Name Mismatch

### Finding
The actual database column is `user_id`, **NOT** `owner_id` as assumed in design documents.

**Evidence**:
- `backend/modules/icraft-stories.ts:836`: `.eq('user_id', userId)`
- `backend/modules/icraft-stories.ts:889`: `.eq('user_id', userId)`
- `backend/modules/icraft-sync.ts:102`: `.eq('user_id', userId)`

### Impact on Design
Our design document assumed we would:
1. Add `owner_type` column alongside existing `owner_id`
2. Use `owner_id` to store user ID or team ID

**Actual implementation must**:
1. Add `owner_type` column alongside existing `user_id`
2. **Rename** `user_id` → `owner_id` OR keep `user_id` and add type discriminator

---

## Decision Point: Column Naming Strategy

### Option A: Rename Column (Preferred for Clarity)
```sql
-- Rename user_id to owner_id
ALTER TABLE stories RENAME COLUMN user_id TO owner_id;

-- Add owner_type discriminator
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));
```

**Pros**:
- Clearer semantics (owner can be user or team)
- Matches design document exactly
- Better alignment with team ownership concept

**Cons**:
- Breaking change - ALL existing code must update column reference
- Higher risk of missing updates
- Requires careful coordination

### Option B: Keep user_id + Add team_id (Simpler Migration)
```sql
-- Add team_id column (nullable)
ALTER TABLE stories
ADD COLUMN team_id TEXT REFERENCES teams(id);

-- Add owner_type discriminator
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

-- When owner_type='user': user_id is populated, team_id is null
-- When owner_type='team': team_id is populated, user_id keeps original creator
```

**Pros**:
- Less breaking change - existing queries still work for personal stories
- user_id always tracks original creator
- Gradual migration possible

**Cons**:
- Two columns instead of one (less elegant)
- More complex query logic
- Slightly redundant schema

### Option C: Keep user_id + Virtual owner_id (Least Breaking)
```sql
-- Keep user_id as is
-- Add owner_type discriminator
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

-- Add computed column for team ownership
ALTER TABLE stories
ADD COLUMN team_id TEXT;

-- Application logic determines:
-- - owner_type='user' → use user_id as owner
-- - owner_type='team' → use team_id as owner
```

**Pros**:
- Minimal breaking change
- Preserves all existing queries
- user_id always tracks creator

**Cons**:
- Less clear semantics
- Application must handle two different fields
- Not as clean as Option A

---

## Recommendation

**Use Option A** (Rename to owner_id) for following reasons:

1. **Cleaner Long-term**: Single `owner_id` + `owner_type` is elegant
2. **Better Semantics**: "owner" concept works for both users and teams
3. **Easier Permission Logic**: Always check `owner_id` + `owner_type`
4. **Matches Design**: Already documented in TEAM_ONLY_MODEL_DESIGN.md

**Migration Strategy**:
1. Add `owner_type` column with DEFAULT 'user' (non-breaking)
2. Rename `user_id` → `owner_id` (breaking - requires coordinated deployment)
3. Add `created_by` column (tracks original creator, always user ID)
4. Update all backend code in single PR
5. Deploy with comprehensive testing

---

## Backend Files Requiring Updates

### High Priority (Direct Story Queries)

| File | Lines | Query Type | Update Required |
|------|-------|------------|-----------------|
| `icraft-stories.ts` | 833, 886 | SELECT (ownership check) | Change `.eq('user_id', userId)` to `.eq('owner_id', userId).eq('owner_type', 'user')` |
| `icraft-sync.ts` | 102 | DELETE (with ownership check) | Change `.eq('user_id', userId)` to `.eq('owner_id', userId).eq('owner_type', 'user')` |
| `icraft-community.ts` | 549 | UPDATE (story duplication) | Add `owner_id`, `owner_type`, `created_by` fields |

### Medium Priority (May Reference Stories)

| File | Reason for Review |
|------|-------------------|
| `icraft-genAi.ts` | May create stories with AI |
| `icraft-r2.ts` | May query stories for asset management |
| `stripe-service.ts` | May query stories for usage metrics |
| `mongoatlas.ts` | May sync story metadata |
| `validation-schemas.ts` | May validate story payloads |

### Low Priority (Likely Just Type References)

| File | Reason for Review |
|------|-------------------|
| `prompt-security.ts` | Likely just mentions "stories" in context |
| `health-monitoring.ts` | Likely just health checks |
| `environment-config.ts` | Likely just config values |
| `clerk-team-invitations.ts` | Team webhooks - may not touch stories |
| `email-service.ts` | Email templates - may mention stories |
| `validation-middleware.ts` | Request validation - may validate story requests |
| `types.ts` | Type definitions - needs Story interface update |

---

## Stored Procedures to Discover

Run discovery script to find procedures:

```bash
# Connect to non-prod database
cd backend/scripts
psql $SUPABASE_NONPROD_URL -f discover-story-procedures.sql > discovery-results.txt
```

### Expected Procedures (Based on Code References)

| Procedure | File Reference | Update Required |
|-----------|----------------|-----------------|
| `update_page_canvas_state()` | icraft-stories.ts:853 | Check if queries user_id |
| `update_cover_canvas_state()` | icraft-stories.ts:906 | Check if queries user_id |

---

## Frontend Files Requiring Updates

### Type Definitions
**File**: `frontend/src/types.ts`

```typescript
// CURRENT (inferred)
export interface Story {
  id: string;
  userId: string;  // ← Currently user_id
  // ...
}

// UPDATED
export interface Story {
  id: string;
  ownerId: string;            // User ID or Team ID
  ownerType: 'user' | 'team'; // Discriminator
  createdBy: string;          // Original creator (always user ID)
  // ...
}
```

### Service Methods
**File**: `frontend/src/services/StoryService.ts`

All methods that send/receive Story objects need updates.

---

## Next Steps (In Order)

1. **Run Discovery Script**
   ```bash
   cd backend/scripts
   psql $SUPABASE_NONPROD_URL -f discover-story-procedures.sql > discovery-results.txt
   cat discovery-results.txt
   ```

2. **Review Discovery Results**
   - Identify all stored procedures that query stories table
   - Identify all views/triggers/materialized views
   - Document findings

3. **Update Design Document**
   - Change all `owner_id` references to acknowledge current `user_id` column
   - Add migration step: Rename `user_id` → `owner_id`
   - Update SQL in Appendix A

4. **Create Migration PR** (Backend Only First)
   - Add `owner_type` column
   - Rename `user_id` → `owner_id`
   - Add `created_by` column
   - Update all stored procedures
   - Update all backend queries

5. **Frontend PR** (After Backend Deployed)
   - Update Story interface
   - Update StoryService
   - Update components

6. **Enable Team Features**
   - Deploy team creation dialog
   - Deploy invitation acceptance
   - Monitor

---

## Open Questions

1. **Q**: Does `created_by` column already exist in stories table?
   - **Action**: Run `\d stories` in database to see schema

2. **Q**: Are there database triggers on stories table?
   - **Action**: Discovery script will reveal

3. **Q**: Do we have database views that expose stories?
   - **Action**: Discovery script will reveal

4. **Q**: What is the rollback plan if rename breaks something?
   - **Answer**: Can rename back, but will lose team assignments made during deployment window

---

## Risk Assessment Updated

### Critical Risks Identified

1. **Column Rename Risk**: Renaming `user_id` → `owner_id` is a breaking change
   - **Mitigation**: Thorough code search for all references
   - **Mitigation**: Comprehensive test suite before deployment
   - **Mitigation**: Deploy to QA first, validate all story operations

2. **Missed Query Risk**: We may not find all places that query user_id
   - **Mitigation**: Run discovery script to find stored procedures
   - **Mitigation**: Search all backend code for 'user_id'
   - **Mitigation**: Monitor error logs closely post-deployment

3. **Frontend-Backend Mismatch**: Frontend expecting userId, backend sends ownerId
   - **Mitigation**: Deploy backend first (send both userId and ownerId for transition)
   - **Mitigation**: Update frontend to use ownerId
   - **Mitigation**: Remove userId from backend response after frontend deployed

---

## Deployment Strategy (Revised)

### Phase 1: Backend Schema Only
```sql
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

ALTER TABLE stories
ADD COLUMN created_by TEXT;

-- Backfill created_by from user_id
UPDATE stories SET created_by = user_id WHERE created_by IS NULL;

ALTER TABLE stories
ALTER COLUMN created_by SET NOT NULL;
```
**Status**: ✅ Non-breaking, safe to deploy

### Phase 2: Backend Code + Column Rename
```sql
-- Rename column
ALTER TABLE stories RENAME COLUMN user_id TO owner_id;

-- Update all backend code to use owner_id
-- Deploy backend simultaneously with schema change
```
**Status**: ⚠️ Breaking change, requires coordination

### Phase 3: Frontend Updates
```typescript
// Update frontend to use ownerId and ownerType
// Deploy after backend stable
```
**Status**: ✅ Safe once backend deployed

### Phase 4: Enable Team Features
```typescript
// Enable team creation and story migration
```
**Status**: ✅ New features, safe to enable

---

**End of Document**
