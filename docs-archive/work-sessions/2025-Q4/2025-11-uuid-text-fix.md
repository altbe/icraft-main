# UUID/TEXT Type Mismatch Fix

**Date Completed**: 2025-11-09
**Environment**: Production and Non-Production
**Status**: ✅ COMPLETE

## Problem
PostgreSQL stored procedures incorrectly casting TEXT (Clerk IDs) to UUID, causing production 500 errors.

## Symptoms
- Team invitation acceptance failed
- Team activities page crashed with translation error

## Root Cause
- Functions declared parameters as UUID instead of TEXT for Clerk IDs
- Unnecessary `::uuid` casts in WHERE clauses and INSERT statements
- Return types declared as UUID when columns were TEXT

## Solution Deployed

### Frontend Fix
- Fixed i18n pluralization in TeamManagementPage.tsx:203

### Database Fixes
- `get_team_activities()` - Removed `::uuid` casts, changed return type to TEXT
- `onboard_team_member()` - Removed unnecessary `p_team_id::uuid` cast
- `share_story_to_community_transactional()` - Changed `p_team_id` from UUID to TEXT
- `update_team_clerk_org_id()` - Changed `p_team_id` from UUID to TEXT
- `process_plan_change()` - Changed `p_user_id` from UUID to TEXT

## Key Learning
Clerk IDs are TEXT (even when UUID format). Never cast TEXT to UUID.

## Prevention
Added comprehensive guidelines to `backend/CLAUDE.md` → "Clerk ID Type System (CRITICAL)"

## Results
- ✅ Team invitation flow working end-to-end
- ✅ Team activities loading successfully
- ✅ Zero UUID/TEXT type errors in production

## Documentation
- `backend/UUID_TEXT_TYPE_MISMATCH_FIX.md` - Complete resolution guide
- `backend/CLAUDE.md` - Updated with prevention guidelines

## Deployment
Both production and non-production (2025-11-09)