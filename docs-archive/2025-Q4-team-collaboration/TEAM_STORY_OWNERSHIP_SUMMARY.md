# Team Story Ownership - Executive Summary

**Status**: 🚨 CRITICAL ISSUES IDENTIFIED
**Priority**: HIGH
**Estimated Fix Time**: 6-8 hours (1 developer)
**Date**: 2025-10-22

---

## 🔴 Critical Issues Found

### 1. Library Doesn't Show Team Stories
**Problem:** Team members can't see each other's stories
**Root Cause:** `get_user_stories_paginated()` only queries `WHERE user_id = p_user_id`
**Impact:** Collaboration broken - each member sees only their own stories

### 2. No Automatic Team Assignment
**Problem:** New stories don't get `team_id` set
**Root Cause:** No trigger or API logic to assign team_id
**Impact:** Stories created by team members belong to individuals, not teams

### 3. Missing Team Permission Checks
**Problem:** Team members can't edit/delete team stories
**Root Cause:** `deleteStory()` checks `user_id` only, not team membership
**Impact:** Team collaboration restricted to story creator

### 4. Duplication Doesn't Preserve Team
**Problem:** No duplication endpoint exists
**Impact:** If implemented later, would lose team ownership

---

## ✅ Solution Overview

### Quick Fix (Database + Backend)

**File Created:** `backend/sql/team-story-ownership-fix.sql`

**What It Does:**
1. ✅ New function: `get_user_and_team_stories_paginated()` - Returns personal + team stories
2. ✅ New function: `can_user_modify_story()` - Permission check for team members
3. ✅ Optional trigger: Auto-assigns `team_id` if user has exactly 1 team
4. ✅ Backfill: Updates existing stories with team_id (if applicable)

**Backend Changes Needed:** `backend/modules/icraft-stories.ts`
- Update `getUserStories()` to call new function
- Update `deleteStory()` to use permission check
- Update `patchStory()` to use permission check
- Add `duplicateStory()` endpoint (preserves team_id)

---

## 📋 Deployment Checklist

### Phase 1: Database (30 minutes)
- [ ] Review `backend/sql/team-story-ownership-fix.sql`
- [ ] Apply to non-prod database
- [ ] Verify functions created: `can_user_modify_story()`, `get_user_and_team_stories_paginated()`
- [ ] Check backfill: How many stories got team_id?

### Phase 2: Backend Code (2 hours)
- [ ] Update `getUserStories()` - line 607
- [ ] Update `deleteStory()` - line 506
- [ ] Update `patchStory()` - line 193
- [ ] Add `duplicateStory()` endpoint (new)
- [ ] Commit and push to develop

### Phase 3: Testing (1 hour)
- [ ] Team member A creates story
- [ ] Team member B sees story in library ✅
- [ ] Team member B can edit story ✅
- [ ] Team member B can delete story ✅
- [ ] Non-team member CANNOT edit story ✅
- [ ] Personal stories still work ✅

### Phase 4: Production (1 hour)
- [ ] Apply SQL to production database
- [ ] Backend auto-deploys via Zuplo
- [ ] Monitor for 24 hours

**Total Time:** 4.5 hours (deployment) + 2-3 hours (buffer) = 6-8 hours

---

## 📁 Files Created

1. **`TEAM_STORY_OWNERSHIP_FIX.md`** (8,000+ words)
   - Complete implementation guide
   - Code examples for all changes
   - Testing plan
   - Rollback instructions

2. **`backend/sql/team-story-ownership-fix.sql`** (300+ lines)
   - Ready-to-deploy SQL migration
   - Includes verification queries
   - Optional trigger for auto-assignment

3. **`TEAM_STORY_OWNERSHIP_SUMMARY.md`** (This document)
   - Executive summary
   - Quick deployment checklist

---

## 🎯 Success Criteria

After deployment:

```sql
-- Test query: tech@altgene.net should see Gene Leykind Team stories
SELECT get_user_and_team_stories_paginated(
  'user_34QVci9hMiAU0rN3K6qB1mBbv8W',  -- tech@altgene.net
  1,  -- page
  20  -- limit
);
-- Expected: Returns team stories + personal stories
```

### What Should Work:
✅ Team members see ALL team stories in library
✅ Team members can edit ANY team story
✅ Team members can delete ANY team story
✅ New stories get team_id (if user has 1 team)
✅ Personal stories still work (team_id=NULL)
✅ Non-team members can't modify team stories

---

## 🚀 Quick Start

**For Developer:**

```bash
# 1. Review implementation plan
cat TEAM_STORY_OWNERSHIP_FIX.md

# 2. Apply SQL to non-prod
cd backend
psql -h db.jjpbogjufnqzsgiiaqwn.supabase.co \
     -U postgres \
     -d postgres \
     -f sql/team-story-ownership-fix.sql

# 3. Update backend code
# Edit modules/icraft-stories.ts (see implementation plan)

# 4. Test in non-prod
# Follow testing checklist

# 5. Deploy to production
psql -h db.lgkjfymwvhcjvfkuidis.supabase.co \
     -f sql/team-story-ownership-fix.sql

git push origin develop
# (Zuplo auto-deploys)
```

---

## 🔄 Before & After

### BEFORE (Current - Broken)
```
Team Member A creates "Story 1" → team_id = NULL
Team Member B's library → Shows 0 stories
Team Member A's library → Shows "Story 1"
```
❌ Collaboration broken

### AFTER (Fixed)
```
Team Member A creates "Story 1" → team_id = "team_123" (auto-assigned)
Team Member B's library → Shows "Story 1" ✅
Team Member A's library → Shows "Story 1" ✅
Both can edit/delete "Story 1" ✅
```
✅ Collaboration works

---

## ⚠️ Important Notes

### Auto-Assignment Trigger Behavior:
- **1 team**: Auto-assigns team_id ✅
- **0 teams**: Leaves team_id NULL (personal story) ✅
- **2+ teams**: Leaves team_id NULL (user must choose) ⚠️

For multi-team users, frontend should provide team selector.

### Backwards Compatibility:
- Old API calls still work
- New fields added to response (teamId, ownershipType, teamName)
- Frontend doesn't need immediate changes (but should display team info)

---

## 📞 Questions?

**See Full Documentation:** `TEAM_STORY_OWNERSHIP_FIX.md`

**Sections:**
1. Current State Analysis (what's broken)
2. Comprehensive Solution Design (code examples)
3. Implementation Plan (6-8 hours)
4. Deployment Steps (step-by-step)
5. Breaking Changes & Migration
6. Success Criteria
7. Monitoring & Validation
8. Rollback Plan
9. Related Documents

---

**Created:** 2025-10-22 by Claude Code
**Ready for Implementation:** ✅ Yes
**Approved:** Pending review
