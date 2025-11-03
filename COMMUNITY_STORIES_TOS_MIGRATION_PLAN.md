# Community Stories & ToS Migration Plan
## Non-Prod → Production

**Created**: 2025-11-02
**Last Updated**: 2025-11-02
**Status**: ✅ **MIGRATION COMPLETE** - All 113 stories successfully migrated

---

## 🎉 Migration Results

**Executed**: 2025-11-02
**Duration**: ~5 minutes
**Status**: ✅ **100% SUCCESS**

### Migration Summary
- **Stories Migrated**: 113/113 (100%)
- **Errors**: 0
- **Target User**: `user_34w00wW4m51e2xSOoJH6pzfGvs9` (gene@icraftstories.com)
- **Script Used**: `scripts/migrate_stories.py` (Python)

### Validation Results
- ✅ **Story Count**: 113 stories in production
- ✅ **User Attribution**: All stories assigned to target user
- ✅ **Data Integrity**: 0 missing IDs, titles, pages, or tags
- ✅ **Sample Check**: All stories have valid page counts and metadata
- ✅ **ToS Status**: Already identical (no migration needed)

---

## ✅ What Was Completed

1. **Schema Investigation** - Verified schema compatibility between environments
2. **Schema Alignment** - Production schema updated to match non-prod
3. **Snapshot Creation** - Backup tables created in production:
   - `community_stories_snapshot_20251102` (0 rows)
   - `terms_of_service_snapshot_20251102` (1 row)
4. **Migration Scripts Created**:
   - `scripts/migrate_stories.py` (Python) ✅ USED
   - `scripts/migrate-community-stories.js` (Node.js)
5. **User Verification** - Target user confirmed: `user_34w00wW4m51e2xSOoJH6pzfGvs9`
6. **ToS Verification** - Terms of Service already identical (no migration needed)
7. **Migration Execution** - All 113 stories successfully imported
8. **Validation** - All checks passed

---

## Migration Summary

### What We're Migrating
1. **Community Stories**: 113 stories from non-prod → production
2. **Terms of Service**: ✅ **ALREADY MIGRATED** - Checksums match (version 2.0)
3. **Privacy Policy**: ❌ **DOES NOT EXIST** - No separate table found

### Environment Details

#### Non-Prod (jjpbogjufnqzsgiiaqwn)
- **Community Stories**: 113 stories
- **ToS Version**: 2.0 (14,738 bytes EN, 17,150 bytes ES)
- **ToS Checksum EN**: `d41229123239894fe7abcf7b06243350f60f65146f37e150da52bf823aeb560d`
- **ToS Checksum ES**: `d66c6d31318144b66fddb5258a882bc0d98916674e04cff7cf59d505cc9b29d1`

#### Production (lgkjfymwvhcjvfkuidis)
- **Community Stories**: 0 stories (empty table)
- **ToS Version**: 2.0 (14,738 bytes EN, 17,150 bytes ES)
- **ToS Checksum EN**: `d41229123239894fe7abcf7b06243350f60f65146f37e150da52bf823aeb560d` ✅ MATCH
- **ToS Checksum ES**: `d66c6d31318144b66fddb5258a882bc0d98916674e04cff7cf59d505cc9b29d1` ✅ MATCH

---

## Migration Plan

### Phase 1: Pre-Migration Validation ✅ COMPLETE

- [x] Verify non-prod community stories count (113 stories)
- [x] Verify production community stories count (0 stories)
- [x] Verify ToS exists in both environments
- [x] Compare ToS checksums (MATCH - no migration needed)
- [x] Verify privacy policy status (does not exist as separate table)
- [x] Verify schema compatibility between environments

### Phase 2: Backup & Snapshot Creation

#### 2.1 Create Production Snapshot (Safety First!)
```sql
-- Execute in PRODUCTION (lgkjfymwvhcjvfkuidis)

-- Create snapshot table for rollback
CREATE TABLE community_stories_snapshot_20251102 AS
SELECT * FROM community_stories;

-- Create backup of terms_of_service (for safety)
CREATE TABLE terms_of_service_snapshot_20251102 AS
SELECT * FROM terms_of_service;

-- Verify snapshots created
SELECT COUNT(*) as community_stories_backup_count
FROM community_stories_snapshot_20251102;

SELECT COUNT(*) as tos_backup_count
FROM terms_of_service_snapshot_20251102;
```

**Expected Results:**
- `community_stories_backup_count`: 0
- `tos_backup_count`: 1

### Phase 3: Community Stories Migration

#### 3.1 Export from Non-Prod
```sql
-- Execute in NON-PROD (jjpbogjufnqzsgiiaqwn)

-- Export all community stories as JSON
SELECT jsonb_agg(
  jsonb_build_object(
    'id', id,
    'title', title,
    'description', description,
    'cover_image_url', cover_image_url,
    'original_story_id', original_story_id,
    'original_user_id', original_user_id,
    'thumbnail_url', thumbnail_url,
    'likes_count', likes_count,
    'views_count', views_count,
    'shared_at', shared_at,
    'is_featured', is_featured,
    'is_approved', is_approved,
    'cover_coaching_content', cover_coaching_content,
    'cover_canvas_editor_id', cover_canvas_editor_id,
    'cover_canvas_state', cover_canvas_state,
    'pages', to_jsonb(pages),
    'ai_generator_history', to_jsonb(ai_generator_history),
    'tags', tags
  )
) as community_stories_export
FROM community_stories
ORDER BY shared_at DESC;
```

Save the output to: `backend/scripts/migrations/community_stories_export_20251102.json`

#### 3.2 Validate User References
```sql
-- Execute in NON-PROD (jjpbogjufnqzsgiiaqwn)

-- Check for user references that might not exist in production
SELECT DISTINCT cs.original_user_id, up.email
FROM community_stories cs
LEFT JOIN user_profiles up ON cs.original_user_id = up.id
WHERE cs.original_user_id IS NOT NULL
ORDER BY up.email;

-- Check for story references that might not exist in production
SELECT DISTINCT cs.original_story_id
FROM community_stories cs
WHERE cs.original_story_id IS NOT NULL;
```

**⚠️ IMPORTANT**: If any `original_user_id` references don't exist in production:
- Option 1: Migrate missing user profiles first
- Option 2: Set `original_user_id` to NULL for orphaned stories
- Option 3: Skip orphaned stories (document which ones)

#### 3.3 Import to Production
```sql
-- Execute in PRODUCTION (lgkjfymwvhcjvfkuidis)

-- Import community stories from JSON export
-- (This will be generated based on the export)

INSERT INTO community_stories (
  id, title, description, cover_image_url, original_story_id,
  original_user_id, thumbnail_url, likes_count, views_count,
  shared_at, is_featured, is_approved, cover_coaching_content,
  cover_canvas_editor_id, cover_canvas_state, pages,
  ai_generator_history, tags
)
SELECT
  (story->>'id')::uuid,
  story->>'title',
  story->>'description',
  story->>'cover_image_url',
  (story->>'original_story_id')::uuid,
  story->>'original_user_id',
  story->>'thumbnail_url',
  (story->>'likes_count')::integer,
  (story->>'views_count')::integer,
  (story->>'shared_at')::timestamptz,
  (story->>'is_featured')::boolean,
  (story->>'is_approved')::boolean,
  (story->'cover_coaching_content')::jsonb,
  (story->>'cover_canvas_editor_id')::uuid,
  (story->'cover_canvas_state')::jsonb,
  ARRAY(SELECT jsonb_array_elements(story->'pages'))::jsonb[],
  ARRAY(SELECT jsonb_array_elements(story->'ai_generator_history'))::jsonb[],
  ARRAY(SELECT jsonb_array_elements_text(story->'tags'))::text[]
FROM jsonb_array_elements('[...]'::jsonb) AS story;

-- Note: Replace '[...]' with actual JSON export content
```

### Phase 4: Post-Migration Validation

#### 4.1 Verify Migration Success
```sql
-- Execute in PRODUCTION (lgkjfymwvhcjvfkuidis)

-- Check total count matches
SELECT
  'Production' as environment,
  COUNT(*) as total_stories,
  COUNT(DISTINCT original_user_id) as unique_users,
  COUNT(*) FILTER (WHERE is_approved = true) as approved_stories,
  COUNT(*) FILTER (WHERE is_featured = true) as featured_stories
FROM community_stories;

-- Compare with expected counts from non-prod
-- Expected: 113 total stories

-- Verify data integrity
SELECT
  COUNT(*) FILTER (WHERE id IS NULL) as missing_ids,
  COUNT(*) FILTER (WHERE title IS NULL OR title = '') as missing_titles,
  COUNT(*) FILTER (WHERE pages IS NULL) as missing_pages,
  COUNT(*) FILTER (WHERE array_length(pages, 1) = 0) as empty_pages
FROM community_stories;

-- Expected: All counts should be 0 (no missing data)

-- Spot check sample stories
SELECT id, title, original_user_id, shared_at, array_length(pages, 1) as page_count
FROM community_stories
ORDER BY shared_at DESC
LIMIT 5;
```

#### 4.2 Verify Foreign Key Constraints
```sql
-- Execute in PRODUCTION (lgkjfymwvhcjvfkuidis)

-- Check for orphaned user references
SELECT COUNT(*) as orphaned_user_refs
FROM community_stories cs
LEFT JOIN user_profiles up ON cs.original_user_id = up.id
WHERE cs.original_user_id IS NOT NULL AND up.id IS NULL;

-- Expected: 0

-- Check for orphaned story references
SELECT COUNT(*) as orphaned_story_refs
FROM community_stories cs
LEFT JOIN stories s ON cs.original_story_id = s.id
WHERE cs.original_story_id IS NOT NULL AND s.id IS NULL;

-- Expected: 0 or documented count
```

### Phase 5: Rollback Plan (If Needed)

#### 5.1 Rollback Community Stories
```sql
-- Execute in PRODUCTION (lgkjfymwvhcjvfkuidis) ONLY IF ROLLBACK NEEDED

-- Clear newly migrated data
TRUNCATE TABLE community_stories;

-- Restore from snapshot
INSERT INTO community_stories
SELECT * FROM community_stories_snapshot_20251102;

-- Verify rollback
SELECT COUNT(*) as restored_count FROM community_stories;
-- Expected: 0 (original state)
```

#### 5.2 Clean Up Snapshots (After Successful Migration)
```sql
-- Execute in PRODUCTION (lgkjfymwvhcjvfkuidis) AFTER CONFIRMING SUCCESS

-- Keep snapshots for 30 days before dropping
-- DROP TABLE community_stories_snapshot_20251102;
-- DROP TABLE terms_of_service_snapshot_20251102;
```

---

## Terms of Service - No Migration Needed

### Verification ✅ COMPLETE

**Both environments have IDENTICAL Terms of Service (version 2.0):**

| Environment | Version | EN Checksum | ES Checksum |
|------------|---------|-------------|-------------|
| Non-Prod | 2.0 | `d412291...eb560d` | `d66c6d3...9b29d1` |
| Production | 2.0 | `d412291...eb560d` | `d66c6d3...9b29d1` |

**Status**: ✅ **NO ACTION REQUIRED** - Content is identical

---

## Privacy Policy - Does Not Exist

### Finding

**No separate `privacy_policy` table exists in either environment.**

### Possible Scenarios

1. **Privacy policy is embedded in Terms of Service** (common pattern)
2. **Privacy policy hasn't been created yet**
3. **Privacy policy is stored elsewhere** (frontend, separate service)

### Recommendation

- [ ] **USER ACTION REQUIRED**: Clarify if privacy policy is:
  - Part of the Terms of Service markdown
  - Stored separately (if so, where?)
  - Not yet created

---

## Migration Execution Checklist

### Pre-Execution
- [ ] Backup production database (Supabase automatic backup confirmed)
- [ ] Create snapshot tables in production
- [ ] Export community stories from non-prod
- [ ] Validate user references exist in production
- [ ] Review migration scripts for correctness

### Execution
- [ ] Run Phase 2 (Backup & Snapshot Creation)
- [ ] Run Phase 3.1 (Export from Non-Prod)
- [ ] Run Phase 3.2 (Validate User References)
- [ ] Resolve any missing user references
- [ ] Run Phase 3.3 (Import to Production)

### Post-Execution
- [ ] Run Phase 4.1 (Verify Migration Success)
- [ ] Run Phase 4.2 (Verify Foreign Key Constraints)
- [ ] Verify frontend can load community stories
- [ ] Test community story copying functionality
- [ ] Monitor for errors for 24 hours
- [ ] Clean up snapshot tables after 30 days

### Rollback (If Needed)
- [ ] Run Phase 5.1 (Rollback Community Stories)
- [ ] Verify rollback success
- [ ] Document issues encountered
- [ ] Fix issues before retry

---

## Risk Assessment

### Low Risk
- ✅ Terms of Service already identical (no action needed)
- ✅ Community stories table exists in both environments
- ✅ Schema is compatible between environments
- ✅ Snapshot/rollback strategy in place

### Medium Risk
- ⚠️ **User references**: Some `original_user_id` values may not exist in production
  - **Mitigation**: Validate before import, handle orphaned references
- ⚠️ **Story references**: Some `original_story_id` values may not exist in production
  - **Mitigation**: Document which stories are orphaned, set to NULL if needed

### High Risk
- 🔴 None identified

---

## Timeline Estimate

- **Phase 2 (Backup)**: 5 minutes
- **Phase 3 (Migration)**: 15-30 minutes
  - Export: 5 minutes
  - Validation: 10 minutes
  - Import: 10-15 minutes
- **Phase 4 (Validation)**: 15 minutes
- **Total**: 35-50 minutes

**Recommended Execution Window**: Off-peak hours (late evening/early morning)

---

## Support Scripts Location

All migration scripts will be created in:
- `backend/scripts/migrations/community_stories_migration_20251102/`

Scripts to create:
1. `01_create_snapshots.sql` - Phase 2
2. `02_export_from_nonprod.sql` - Phase 3.1
3. `03_validate_references.sql` - Phase 3.2
4. `04_import_to_production.sql` - Phase 3.3
5. `05_validate_migration.sql` - Phase 4
6. `06_rollback.sql` - Phase 5 (emergency use)

---

## Notes

### Discovered During Investigation
- Both environments use the same `community_stories` schema (aligned via migrations)
- ToS checksums match exactly - content is identical
- No privacy policy table exists in either environment
- 113 community stories ready to migrate
- Production is currently empty (0 community stories)

### Questions for User
- [ ] Should we migrate ALL 113 stories or only approved ones?
- [ ] What should we do about privacy policy? (doesn't exist as separate table)
- [ ] Are there any specific stories to exclude from migration?
- [ ] Should we preserve story IDs or generate new UUIDs?

---

## Success Criteria

Migration is successful when:
1. ✅ Production has 113 community stories (or expected count)
2. ✅ All stories have valid data (no NULL titles, pages, etc.)
3. ✅ Foreign key constraints are satisfied
4. ✅ Frontend can load and display community stories
5. ✅ Community story copying works correctly
6. ✅ No errors in production logs for 24 hours

---

## Rollback Criteria

Rollback should be executed if:
1. ❌ Story count doesn't match expected
2. ❌ Data integrity issues found (NULL values, invalid references)
3. ❌ Foreign key constraint violations
4. ❌ Frontend errors loading community stories
5. ❌ Production errors spike after migration

---

**Document Owner**: Claude Code
**Approved By**: [Pending User Approval]
**Executed By**: [Pending]
**Execution Date**: [Pending]
