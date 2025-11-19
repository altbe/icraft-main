# Community Stories Migration - Execution Instructions

**Created**: 2025-11-02
**Status**: Ready to Execute
**Stories to Migrate**: 113 stories
**Target User**: user_34w00wW4m51e2xSOoJH6pzfGvs9 (gene@icraftstories.com)

---

## Pre-Migration Checklist

- [x] Schema aligned between non-prod and production
- [x] Snapshot tables created in production
- [x] Target user verified in production
- [x] Migration scripts created
- [ ] Service keys obtained
- [ ] Migration executed
- [ ] Results validated

---

## Option 1: Using Python Script (Recommended)

### Prerequisites
```bash
pip install supabase
```

### Set Environment Variables
```bash
export SUPABASE_SERVICE_ROLE_KEY_NONPROD="<non-prod service key>"
export SUPABASE_SERVICE_ROLE_KEY_PROD="<production service key>"
```

### Run Migration
```bash
cd /home/g/_zdev/icraft-main
python3 scripts/migrate_stories.py
```

### Expected Output
```
Starting community stories migration...

Fetching stories from non-prod...
Found 113 stories to migrate

✓ Story 1/113: "Managing Sensory Overload in Public Spaces"
✓ Story 2/113: "Managing Sensory Overload in Public Spaces"
...
✓ Story 113/113: "[Last Story Title]"

============================================================
MIGRATION SUMMARY
============================================================
Total stories: 113
✓ Successfully imported: 113
✗ Errors: 0

Validating migration...
Production now has 113 community stories
✓ Migration successful - counts match!

Migration complete!
```

---

## Option 2: Using Node.js Script

### Prerequisites
```bash
cd scripts
npm install @supabase/supabase-js
```

### Set Environment Variables
```bash
export SUPABASE_SERVICE_ROLE_KEY_NONPROD="<non-prod service key>"
export SUPABASE_SERVICE_ROLE_KEY_PROD="<production service key>"
```

### Run Migration
```bash
cd /home/g/_zdev/icraft-main
node scripts/migrate-community-stories.js
```

---

## Getting Service Keys

### Non-Prod Service Key
1. Go to: https://supabase.com/dashboard/project/jjpbogjufnqzsgiiaqwn/settings/api
2. Copy the `service_role` key (secret, not anon)

### Production Service Key
1. Go to: https://supabase.com/dashboard/project/lgkjfymwvhcjvfkuidis/settings/api
2. Copy the `service_role` key (secret, not anon)

---

## Post-Migration Validation

### 1. Verify Story Count
```sql
-- Run in production (lgkjfymwvhcjvfkuidis)
SELECT COUNT(*) as total_stories FROM community_stories;
-- Expected: 113
```

### 2. Verify User Attribution
```sql
-- Run in production
SELECT
  original_user_id,
  COUNT(*) as story_count
FROM community_stories
GROUP BY original_user_id;
-- Expected: user_34w00wW4m51e2xSOoJH6pzfGvs9 with 113 stories
```

### 3. Verify Data Integrity
```sql
-- Run in production
SELECT
  COUNT(*) FILTER (WHERE id IS NULL) as missing_ids,
  COUNT(*) FILTER (WHERE title IS NULL OR title = '') as missing_titles,
  COUNT(*) FILTER (WHERE pages IS NULL) as missing_pages,
  COUNT(*) FILTER (WHERE array_length(pages, 1) = 0) as empty_pages
FROM community_stories;
-- Expected: All counts should be 0
```

### 4. Spot Check Sample Stories
```sql
-- Run in production
SELECT id, title, original_user_id, shared_at, array_length(pages, 1) as page_count
FROM community_stories
ORDER BY shared_at DESC
LIMIT 5;
```

### 5. Frontend Verification
- Visit: https://icraftstories.com/community
- Verify community stories are visible
- Test copying a community story

---

## Rollback Procedure (If Needed)

```sql
-- Run in production (lgkjfymwvhcjvfkuidis) ONLY IF ROLLBACK NEEDED

-- Clear newly migrated data
TRUNCATE TABLE community_stories;

-- Restore from snapshot
INSERT INTO community_stories
SELECT * FROM community_stories_snapshot_20251102;

-- Verify rollback
SELECT COUNT(*) as restored_count FROM community_stories;
-- Expected: 0 (original state)
```

---

## Cleanup (After Successful Migration)

**WAIT 30 DAYS** before dropping snapshot tables:

```sql
-- Run in production AFTER 30 DAYS OF SUCCESSFUL OPERATION

DROP TABLE IF EXISTS community_stories_snapshot_20251102;
DROP TABLE IF EXISTS terms_of_service_snapshot_20251102;
```

---

## Troubleshooting

### Error: "Missing Supabase service role keys"
**Solution**: Set environment variables with service keys (see "Getting Service Keys" above)

### Error: "duplicate key value violates unique constraint"
**Cause**: Story already exists in production
**Solution**: Either skip the duplicate or delete it first

### Error: "insert or update on table violates foreign key constraint"
**Cause**: Referenced user doesn't exist in production
**Solution**: Create user first or update script to handle missing references

### Script Hangs or Times Out
**Solution**: Migration is processing large payloads. Wait for completion or check logs.

---

## Migration Scripts Location

- **Python**: `/home/g/_zdev/icraft-main/scripts/migrate_stories.py`
- **Node.js**: `/home/g/_zdev/icraft-main/scripts/migrate-community-stories.js`

---

## Support

If you encounter issues during migration:
1. Check the error message in the script output
2. Verify service keys are correct
3. Check database connectivity
4. Review validation queries above
5. Use rollback procedure if needed

---

**Document Owner**: Claude Code
**Last Updated**: 2025-11-02
