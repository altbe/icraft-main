# Team Invitation System Refactoring - Implementation Plan

**Status**: Ready for Review
**Created**: 2025-01-22
**Target Environment**: Non-Production first, then Production
**Strategy**: Remove legacy code (not deprecate - no production deployment exists)

---

## Executive Summary

Refactor team invitation system to use Clerk Organizations API exclusively, removing dual invitation system complexity. Simplify role model from 3-tier (owner/admin/member) to 2-tier (owner/member). Fix critical bugs preventing team creation for custom enterprise subscriptions.

**Key Changes:**
- Use Clerk Organizations for all team invitation handling
- Remove legacy database invitation system (`team_invitations` table)
- Eliminate admin role (owner/member only)
- Hide Clerk implementation behind semantic API endpoints
- **Fix custom subscription support** - enable `custom_*` plan_id patterns (e.g., `custom_enterprise`)
- **Fix auto-creation trigger** - remove trigger that creates teams without Clerk orgs

---

## Database Validation Results (Non-Prod)

**Project**: `jjpbogjufnqzsgiiaqwn` (icraft non-prod)
**Validation Date**: 2025-01-22

### Current State

**Teams Table (5 rows):**
- ✅ `clerk_org_id` column EXISTS (nullable, text type) - no migration needed
- 1 team WITH Clerk integration: "travel" (c98ad5c8-a6da-4de3-9f3a-3061575b6398)
- 4 teams WITHOUT Clerk integration (need Organizations created):
  - "Johnny A's Team" (0b6e0cdb-0fbb-4064-a78c-6effbad15376)
  - "John Alonzo's Team" (15049d4d-2f4c-40c5-a7db-4d1646bd350c)
  - "Gene Leykind Team" (41fd2ce8-ca28-4581-b264-29cd747a25bf)
  - "Activity Logging Test Team v2" (93c229c2-9d99-453e-bee2-48f04836476d)

**Team Members Table (6 rows):**
- 5 owners
- 1 member
- 0 admins ✅ (clean migration - no admin role data exists)

**Team Invitations Table (6 rows):**
- ALL created today (2025-10-22 01:02 - 02:01 UTC)
- ALL for "member" role (no admin invitations)
- ALL expire in 7 days (still active)
- 3 invitations for team WITH Clerk ("travel")
- 2 invitations for "John Alonzo's Team" (no Clerk)
- 1 invitation for "Johnny A's Team" (no Clerk)

**Critical Finding #1**: Team "travel" HAS Clerk org (`org_34JLJ7W8O85gjY2mdbrNnxqYo2D`) but is STILL using legacy database invitations. This proves the dual system is actively being used.

**Critical Finding #2 - ROOT CAUSE FOR MISSING CLERK ORGS**:
- ✅ API endpoint (`team-management.ts:179-456`) DOES create Clerk organizations correctly
- ❌ Database trigger (`auto_create_team_on_upgrade()`) bypasses API and creates teams WITHOUT Clerk orgs
- **Evidence**: Timeline shows 4 teams created AFTER "travel" team (which has Clerk org), all missing `clerk_org_id`
- **Location**: `backend/scripts/migrations/005_auto_team_creation_nonprod.sql:57`
- **Problem**: Trigger directly inserts into `teams` table without `clerk_org_id` column
- **Impact**: Users upgrading to team plan get teams without Clerk integration, breaking invitation system

**Critical Finding #3 - CUSTOM SUBSCRIPTIONS NOT SUPPORTED**:
- ❌ API endpoint ONLY checks for `plan_id = 'team'` (line 211 of `team-management.ts`)
- ❌ Database trigger ONLY fires on `plan_id = 'team'` (line 25, 115 of `005_auto_team_creation_nonprod.sql`)
- **Database design**: Supports `custom_*` pattern (e.g., `custom_enterprise`, `custom_agency`) per constraint in `subscription_plans` table
- **Current behavior**: Users with `custom_enterprise` subscription CANNOT create teams via API (blocked by subscription check)
- **Expected behavior**: Users with ANY team-eligible plan (`team` OR `custom_*`) should be able to create teams
- **Impact**: Enterprise/custom plan customers cannot use team features despite paying for them

---

## Migration Strategy

### Phase 0: Fix Auto-Creation Trigger (CRITICAL - Must Do First)

The `auto_create_team_on_upgrade()` database trigger creates teams without Clerk organizations. This MUST be fixed before any other changes.

**Options:**

**Option A: Remove Auto-Creation (Recommended)**
```sql
-- Disable automatic team creation
DROP TRIGGER IF EXISTS trg_auto_create_team ON subscriptions;
DROP FUNCTION IF EXISTS auto_create_team_on_upgrade();
```

**Rationale:**
- **Bug #1**: Creates teams without `clerk_org_id`, breaking invitation system
- **Bug #2**: Only triggers on `plan_id = 'team'`, ignoring `custom_*` subscriptions
- Team creation is a significant action that should be deliberate, not automatic
- Forces users through proper API flow (creates Clerk org + database entry)
- Prevents orphaned teams without Clerk integration
- Allows API to handle all team-eligible plans (`team` AND `custom_*`)

**User Flow After Fix:**
1. User subscribes to team-eligible plan (`team` OR `custom_*`) → subscription created
2. User explicitly clicks "Create Team" in UI → API endpoint called
3. API checks for active team-eligible subscription → creates Clerk org + database team
4. All teams guaranteed to have Clerk integration
5. Works for both standard Team Business Plan AND custom enterprise subscriptions

**Option B: Update Trigger to Create Clerk Org (Not Recommended)**
```sql
-- Would require database function to make Clerk API calls
-- Complex, error-prone, violates separation of concerns
-- Database layer shouldn't handle external API calls
```

**Recommendation**: Use Option A. Remove the trigger entirely and require explicit team creation via API.

**Migration Script for Non-Prod:**
```sql
-- backend/scripts/migrations/006_remove_auto_team_creation_nonprod.sql

-- Drop auto-creation trigger
DROP TRIGGER IF EXISTS trg_auto_create_team ON subscriptions;
DROP FUNCTION IF EXISTS auto_create_team_on_upgrade();

-- Keep downgrade trigger (still useful for credit cleanup)
-- No changes needed to handle_team_downgrade()

-- Verification
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_auto_create_team';
-- Should return 0 rows
```

### Phase 1: Clerk Organization Setup (4 Teams)

Create Clerk Organizations for teams without `clerk_org_id`:

```typescript
// For each team without clerk_org_id:
const clerkOrg = await clerkClient.organizations.createOrganization({
  name: team.name,
  createdBy: team.owner_id,
  publicMetadata: {
    team_id: team.id,
    migrated_at: new Date().toISOString()
  }
});

// Update team record
await supabase
  .from('teams')
  .update({ clerk_org_id: clerkOrg.id })
  .eq('id', team.id);
```

### Phase 2: Pending Invitation Migration (6 Invitations)

**Option A: Re-create in Clerk (Recommended)**
```typescript
// For each pending invitation:
const clerkInvitation = await clerkClient.organizations.createInvitation({
  organizationId: team.clerk_org_id,
  emailAddress: invitation.email,
  role: 'basic_member',
  redirectUrl: `${FRONTEND_URL}/teams/${team.id}`,
  publicMetadata: {
    migrated_from_db: invitation.id,
    original_created_at: invitation.created_at
  }
});

// Delete from database
await supabase
  .from('team_invitations')
  .delete()
  .eq('id', invitation.id);
```

**Option B: Let Expire (7 days)**
- All invitations created today, will expire 2025-10-29
- Notify team owners to re-send invitations after migration
- Simpler but requires user communication

**Recommendation**: Option A (re-create) for better user experience.

### Phase 3: Database Schema Changes

```sql
-- 1. Add CHECK constraint on team_members.role
ALTER TABLE team_members
ADD CONSTRAINT team_members_role_check
CHECK (role IN ('owner', 'member'));

-- 2. Drop team_invitations table (after migration complete)
DROP TABLE team_invitations;

-- 3. Verify no orphaned data
SELECT COUNT(*) FROM team_members WHERE role NOT IN ('owner', 'member');
-- Should return 0
```

---

## Code Changes

### Backend Changes

#### 1. Update API Routes (`backend/config/routes.oas.json`)

**Current (WRONG):**
```json
"/teams/invite": {
  "post": {
    "handler": {
      "export": "default",
      "module": "$import(./modules/icraft-teams)"  // Legacy DB system
    }
  }
}
```

**Updated (CORRECT):**
```json
"/teams/invite": {
  "post": {
    "summary": "Send team invitation",
    "handler": {
      "export": "sendClerkTeamInvitation",
      "module": "$import(./modules/clerk-team-invitations)"
    }
  }
},
"/teams/{teamId}/invitations": {
  "get": {
    "summary": "Get team invitations",
    "handler": {
      "export": "getClerkTeamInvitations",
      "module": "$import(./modules/clerk-team-invitations)"
    }
  }
},
"/teams/{teamId}/invitations/{invitationId}": {
  "delete": {
    "summary": "Cancel team invitation",
    "handler": {
      "export": "cancelClerkTeamInvitation",
      "module": "$import(./modules/clerk-team-invitations)"
    }
  }
}
```

**Remove (Legacy endpoints):**
```json
"/teams/invite-clerk": { ... },  // Remove - use /teams/invite instead
"/teams/invitations/{token}/accept": { ... }  // Remove - Clerk handles acceptance
```

#### 2. Fix Custom Subscription Support (CRITICAL)

**File: `backend/modules/team-management.ts`**

**Current (BROKEN) - Lines 205-223:**
```typescript
// Check for active Team Business Plan subscription
// Database stores internal plan IDs ('individual', 'team', 'custom'), not Stripe product IDs
const { data: subscription, error: subError } = await supabase
  .from('subscriptions')
  .select('id, status, plan_id')
  .eq('user_id', userId)
  .eq('plan_id', 'team')  // ❌ ONLY checks for 'team' - blocks custom_* plans
  .in('status', ['active', 'trialing'])
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (subError || !subscription) {
  context.log.warn(`Team creation denied for user ${userId}: No active Team Business Plan subscription`);
  return HttpProblems.badRequest(request, context, {
    detail: "teams:error.teamPlanRequired",
    code: "TEAM_PLAN_REQUIRED"
  });
}
```

**Updated (CORRECT) - Use stored procedure for subscription check:**

**Step 1: Create Stored Procedure** (`backend/scripts/migrations/007_team_subscription_check_nonprod.sql`):
```sql
-- Check if user has team-eligible subscription (team OR custom_*)
CREATE OR REPLACE FUNCTION check_team_eligible_subscription(p_user_id TEXT)
RETURNS TABLE (
  subscription_id UUID,
  plan_id TEXT,
  status TEXT,
  has_eligible_subscription BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as subscription_id,
    s.plan_id,
    s.status,
    TRUE as has_eligible_subscription
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
    AND (s.plan_id = 'team' OR s.plan_id LIKE 'custom_%')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no results, return false indicator
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_team_eligible_subscription IS
  'Check if user has active team-eligible subscription (team or custom_*)';
```

**Step 2: Update Zuplo Code** (`team-management.ts`):
```typescript
// Check for active team-eligible subscription via stored procedure
const { data: subscriptionCheck, error: subError } = await supabase
  .rpc('check_team_eligible_subscription', { p_user_id: userId });

if (subError) {
  context.log.error(`Error checking subscription for user ${userId}`, subError);
  return HttpProblems.internalServerError(request, context, {
    detail: "Failed to verify subscription status"
  });
}

const eligibleSub = subscriptionCheck?.[0];
if (!eligibleSub?.has_eligible_subscription) {
  context.log.warn(`Team creation denied for user ${userId}: No active team-eligible subscription`);
  return HttpProblems.badRequest(request, context, {
    detail: "teams:error.teamPlanRequired",
    code: "TEAM_PLAN_REQUIRED"
  });
}

context.log.info(`Team creation authorized for user ${userId} with ${eligibleSub.plan_id} subscription ${eligibleSub.subscription_id}`);
```

**Why This Matters:**
- Users with `custom_enterprise`, `custom_agency`, etc. subscriptions can now create teams
- Aligns with database schema that supports `custom_*` pattern via constraint
- Prevents blocking enterprise customers who are paying for team features

#### 3. Update Permission Checks

**Files to Update:**
- `backend/modules/clerk-team-invitations.ts`
- `backend/modules/team-management.ts`

**Change Pattern:**
```typescript
// OLD: Allow owner OR admin
if (!['owner', 'admin'].includes(requestingMember.role)) {
  return HttpProblems.forbidden(...);
}

// NEW: Owner only
if (requestingMember.role !== 'owner') {
  return HttpProblems.forbidden(request, context, {
    detail: "Only team owners can perform this action"
  });
}
```

**Specific Updates:**

`clerk-team-invitations.ts`:
- Line 79: Permission check in `sendClerkTeamInvitation`
- Line 145: Remove admin role mapping (always 'basic_member')
- Line 305: Response mapping (remove admin conversion)
- Line 372: Permission check in `cancelClerkTeamInvitation`

`team-management.ts`:
- Line 491: Permission check in `updateTeamMemberRole`
- Line 612: Permission check in `removeTeamMember`
- **REMOVE ENTIRELY**: `updateTeamMemberRole` function (lines 461-584)

#### 3. Remove Legacy Invitation Code

**File: `backend/modules/icraft-teams.ts`**

**Remove Functions:**
- `teamsInvitePost` (lines 18-287) - Database invitation creation
- `acceptTeamInvitation` (line 293+) - Token-based acceptance
- `declineTeamInvitation` - If exists
- All database invitation queries

**Action**: Delete entire file if only contains invitation code, OR remove specific functions if file has other team logic.

#### 4. Update Interfaces

**File: `backend/modules/clerk-team-invitations.ts`**

```typescript
// OLD
interface ClerkTeamInvitationRequest {
  teamId: string;
  email: string;
  role: 'member' | 'admin';  // ❌ Remove admin
}

// NEW
interface ClerkTeamInvitationRequest {
  teamId: string;
  email: string;
  role: 'member';  // ✅ Member only
}
```

**File: `backend/modules/team-management.ts`**

```typescript
// OLD
interface TeamMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';  // ❌ Remove admin
  ...
}

// NEW
interface TeamMember {
  userId: string;
  role: 'owner' | 'member';  // ✅ Two-tier only
  ...
}
```

### Frontend Changes

#### 1. Fix API Endpoint Call

**File: `frontend/src/services/TeamInvitationService.ts`**

```typescript
// Line 56 - CURRENT (404 ERROR)
const response = await api.post('/teams/invite-clerk', request, { headers });

// UPDATED (CORRECT ENDPOINT)
const response = await api.post('/teams/invite', request, { headers });
```

#### 2. Fix Conditional Rendering Bug

**File: `frontend/src/components/TeamManagement.tsx`**

```typescript
// Lines 938-1029 - CURRENT (BROKEN)
{invitations.length > 0 && (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h3>Pending Invitations ({invitations.length})</h3>
    {/* ... */}
  </div>
)}

// UPDATED (ALWAYS SHOW WITH EMPTY STATE)
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
    <Mail className="h-5 w-5 mr-2 text-blue-600" />
    {t('invitations.title', 'Pending Invitations')}
    {invitations.length > 0 && ` (${invitations.length})`}
  </h3>

  {invitations.length === 0 ? (
    <p className="text-sm text-gray-500">
      {t('invitations.empty', 'No pending invitations')}
    </p>
  ) : (
    <div className="space-y-3">
      {invitations.map((invitation) => (
        {/* ... invitation item */}
      ))}
    </div>
  )}
</div>
```

#### 3. Update Permission Functions

**File: `frontend/src/components/TeamManagement.tsx`**

```typescript
// Line 126 - CURRENT
const isTeamAdmin = () => {
  if (!team || !user?.id) return false;
  const member = team.members.find(m => m.userId === user.id);
  return member?.role === 'admin' || member?.role === 'owner';  // ❌ Allow admin
};

// UPDATED
const isTeamOwner = () => {
  if (!team || !user?.id) return false;
  const member = team.members.find(m => m.userId === user.id);
  return member?.role === 'owner';  // ✅ Owner only
};

// Update all usages:
// - Line 178: {isTeamOwner() && ...}
// - Line 238: {isTeamOwner() && ...}
// - All other permission checks
```

**File: `frontend/src/components/TeamManagementPage.tsx`**

Same pattern - rename `isTeamAdmin()` to `isTeamOwner()` and update logic.

#### 4. Update Interfaces

**File: `frontend/src/services/TeamInvitationService.ts`**

```typescript
// Lines 13-17 - CURRENT
export interface InviteTeamMemberRequest {
  teamId: string;
  email: string;
  role: 'member' | 'admin';  // ❌ Remove admin
}

// UPDATED
export interface InviteTeamMemberRequest {
  teamId: string;
  email: string;
  role: 'member';  // ✅ Member only
}
```

**File: `frontend/src/components/TeamInvitationsManager.tsx`**

```typescript
// Line 40 - CURRENT
interface TeamInvitationsManagerProps {
  teamId: string;
  teamName: string;
  userRole: 'owner' | 'admin' | 'member';  // ❌ Remove admin
}

// UPDATED
interface TeamInvitationsManagerProps {
  teamId: string;
  teamName: string;
  userRole: 'owner' | 'member';  // ✅ Two-tier only
}

// Line 57 - CURRENT
const canManageInvitations = userRole === 'owner' || userRole === 'admin';

// UPDATED
const canManageInvitations = userRole === 'owner';
```

#### 5. Fix Viewport Overflow Issues

**File: `frontend/src/components/TeamManagement.tsx`**

**Issue 1: Email text (Line 975)**
```typescript
// CURRENT (conflicting classes)
<span className="text-sm text-gray-600 break-words sm:truncate">
  {invitation.email}
</span>

// UPDATED (responsive text handling)
<span className="text-sm text-gray-600 break-all sm:break-words">
  {invitation.email}
</span>
```

**Issue 2: Invite button section (Lines 903-920)**
```typescript
// CURRENT (no wrap on mobile)
<div className="flex items-center gap-2">
  <Input ... />
  <Button>Invite</Button>
</div>

// UPDATED (stack on mobile)
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
  <Input className="flex-1" ... />
  <Button className="sm:w-auto">
    {t('teams:inviteMember', 'Invite Member')}
  </Button>
</div>
```

**Issue 3: Member list (Lines 1041-1104)**
```typescript
// CURRENT (horizontal layout breaks on mobile)
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    {/* Member info */}
  </div>
  <div className="flex items-center gap-2">
    {/* Actions */}
  </div>
</div>

// UPDATED (stack on mobile)
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div className="flex items-center gap-3 min-w-0">
    {/* Member info */}
  </div>
  <div className="flex items-center gap-2 shrink-0">
    {/* Actions */}
  </div>
</div>
```

---

## Complete File Audit

### Files Requiring Changes

**Backend (9 files):**
1. ✅ `config/routes.oas.json` - Update route handlers, remove legacy endpoints
2. ✅ `modules/clerk-team-invitations.ts` - Update permission checks, remove admin role
3. ✅ `modules/team-management.ts` - **CRITICAL**: Fix custom subscription support (lines 205-223), update permissions, remove `updateTeamMemberRole`
4. ❌ `modules/icraft-teams.ts` - **DELETE** (legacy invitation system)
5. ❌ `scripts/migrations/005_auto_team_creation_nonprod.sql` - **REMOVE VIA NEW MIGRATION** (trigger creates teams without Clerk orgs)
6. 📝 Need to check: `modules/team-webhooks.ts` - May reference team roles
7. 📝 Need to check: Any database migration files
8. 📝 Need to check: Test files referencing team invitations
9. 📝 Need to check: OpenAPI/Swagger documentation

**Migration Scripts (Created):**
1. ✅ `scripts/migrations/006_remove_auto_team_creation_nonprod.sql` - Drop auto-creation trigger
2. ✅ `scripts/migrations/007_team_subscription_check_nonprod.sql` - Subscription check stored procedure (non-prod)
3. ✅ `scripts/migrations/007_team_subscription_check_prod.sql` - Subscription check stored procedure (production)
4. ✅ `scripts/migrations/008_create_clerk_orgs_for_existing_teams_nonprod.sql` - Retroactive Clerk org creation (non-prod)
5. ✅ `scripts/migrations/008_create_clerk_orgs_for_existing_teams_prod.sql` - Retroactive Clerk org creation (production)
6. ✅ `scripts/migrations/create-clerk-orgs.ts` - Automated script for Clerk org creation with dry-run support

**Frontend (6+ files):**
1. ✅ `services/TeamInvitationService.ts` - Fix endpoint, update interface
2. ✅ `components/TeamManagement.tsx` - Fix rendering, permissions, viewport
3. ✅ `components/TeamManagementPage.tsx` - Update permission function
4. ✅ `components/TeamInvitationsManager.tsx` - Update interface, permissions
5. 📝 Need to check: `types/index.ts` or team type definitions
6. 📝 Need to check: Any other components using `isTeamAdmin()` pattern
7. 📝 Need to check: Test files for team invitations

**Database:**
1. Add CHECK constraint on `team_members.role`
2. Drop `team_invitations` table

### Search Patterns to Find All References

```bash
# Backend - find admin role references
cd backend
grep -r "'admin'" modules/ config/
grep -r '"admin"' modules/ config/
grep -r "role === 'admin'" modules/
grep -r "includes('admin')" modules/

# Backend - find legacy invitation references
grep -r "team_invitations" modules/ config/
grep -r "teamsInvitePost" modules/
grep -r "acceptTeamInvitation" modules/

# Frontend - find admin role references
cd frontend/src
grep -r "'admin'" components/ services/ types/
grep -r '"admin"' components/ services/ types/
grep -r "isTeamAdmin" components/

# Frontend - find invitation references
grep -r "invite-clerk" services/
grep -r "acceptInvitation" services/ components/
```

---

## Testing Plan

### Pre-Migration Testing (Non-Prod)

1. **Verify Clerk Organization Creation**
   ```typescript
   // Test creating org for team without clerk_org_id
   const result = await createClerkOrgForTeam('15049d4d-2f4c-40c5-a7db-4d1646bd350c');
   console.assert(result.clerk_org_id, 'Clerk org created');
   ```

2. **Test Invitation Migration**
   ```typescript
   // Test migrating pending invitation to Clerk
   const invitation = await migrateInvitationToClerk('09558116-e4b3-4043-ba2e-6eb2455f7c2b');
   console.assert(invitation.clerkInvitationId, 'Migrated to Clerk');
   ```

3. **Verify Database Constraints**
   ```sql
   -- Test role constraint
   INSERT INTO team_members (team_id, user_id, role)
   VALUES ('test-id', 'test-user', 'admin');
   -- Should fail with constraint violation
   ```

### Post-Migration Testing (Non-Prod)

1. **API Endpoint Testing**
   ```bash
   # Test invitation flow
   curl -X POST https://api-dev.icraftstories.com/teams/invite \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"teamId": "...", "email": "test@example.com", "role": "member"}'

   # Verify 404 on old endpoint
   curl -X POST https://api-dev.icraftstories.com/teams/invite-clerk
   # Should return 404
   ```

2. **Frontend UI Testing**
   - Load team management page with 0 invitations → section should render
   - Send invitation → should appear in list
   - Cancel invitation → should disappear from list
   - Test on mobile viewport → no horizontal overflow

3. **Permission Testing**
   - As owner: Can invite/remove members ✅
   - As member: Cannot invite/remove members ❌
   - Try to use admin role → should fail constraint

### Production Migration Testing

1. **Pre-Production Checklist**
   - [ ] All non-prod tests passing
   - [ ] Database migration script tested
   - [ ] Rollback plan documented
   - [ ] Team owners notified of changes

2. **Production Deployment**
   - [ ] Database backup created
   - [ ] Migrate pending invitations
   - [ ] Deploy backend changes
   - [ ] Deploy frontend changes
   - [ ] Monitor error logs for 24 hours

---

## Rollback Plan

### Database Rollback

```sql
-- If migration fails, restore team_invitations table
CREATE TABLE team_invitations (
  -- Original schema from backup
);

-- Remove constraint if problematic
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;

-- Restore clerk_org_id to NULL if needed
UPDATE teams SET clerk_org_id = NULL WHERE id IN (...);
```

### Code Rollback

```bash
# Backend - revert to previous deployment
cd backend
npm run rollback:production

# Frontend - revert to previous tag
cd frontend
git checkout tags/<previous-prod-tag>
npm run deploy:prod
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Active invitations lost during migration | Medium | High | Migrate to Clerk before dropping table |
| Teams without Clerk orgs cannot invite | High | Critical | Create Clerk orgs for all teams first |
| Frontend breaks on old endpoint | High | High | Update frontend first, test in non-prod |
| Database constraint prevents valid operations | Low | Medium | Test constraint thoroughly before prod |
| Users confused by missing admin role | Low | Low | Document in release notes |

---

## Deployment Order

**Critical**: Must deploy in this order to prevent downtime.

### Step 0: Remove Auto-Creation Trigger (CRITICAL FIRST STEP)
1. Run migration `006_remove_auto_team_creation_nonprod.sql`
2. Verify trigger is dropped: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_auto_create_team';`
3. Test: User with team plan should NOT auto-create team on subscription update
4. **BLOCKER**: Do not proceed until this is complete and verified

### Step 1: Database Migration (Non-Prod)
1. Create Clerk Organizations for 4 existing teams (created by old trigger)
2. Migrate 6 pending invitations to Clerk
3. Verify all teams have clerk_org_id
4. **DO NOT drop team_invitations table yet**

### Step 2: Backend Deployment (Non-Prod)
1. Update routes.oas.json to point to Clerk handlers
2. Update permission checks (owner only)
3. Remove admin role from interfaces
4. **DO NOT delete icraft-teams.ts yet** (keep as fallback)
5. Deploy to develop branch
6. Test invitation flow end-to-end

### Step 3: Frontend Deployment (Non-Prod)
1. Fix API endpoint call (`/teams/invite`)
2. Fix conditional rendering bug
3. Update permission functions
4. Fix viewport overflow
5. Deploy to dev environment
6. Test UI flows

### Step 4: Verification (Non-Prod)
1. End-to-end invitation flow works
2. No 404 errors in logs
3. Mobile viewport renders correctly
4. Permission checks work as expected

### Step 5: Database Cleanup (Non-Prod)
1. Add CHECK constraint on team_members.role
2. Drop team_invitations table
3. Delete icraft-teams.ts file
4. Verify no errors

### Step 6: Production Deployment (After Non-Prod Success)
1. Repeat steps 1-5 in production environment
2. Monitor logs for 24 hours
3. User acceptance testing

---

## Success Criteria

- [ ] **Auto-creation trigger removed** (`trg_auto_create_team` no longer exists)
- [ ] **Custom subscription support** - API accepts `team` OR `custom_*` plan_id values
- [ ] All teams have Clerk Organizations (`clerk_org_id` populated)
- [ ] All pending invitations migrated or expired
- [ ] Zero references to admin role in codebase
- [ ] `team_invitations` table dropped
- [ ] CHECK constraint on `team_members.role` enforced
- [ ] Frontend calls correct API endpoint (`/teams/invite`)
- [ ] Invitations section renders with empty state
- [ ] Mobile viewport has no horizontal overflow
- [ ] Only team owners can manage invitations
- [ ] No errors in production logs related to teams/invitations
- [ ] New teams created via API all have Clerk organizations
- [ ] Users with Team Business Plan can manually create teams via UI
- [ ] Users with custom enterprise subscriptions (`custom_*`) can create teams via UI

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Remove auto-creation trigger (Phase 0) | 30 minutes | None |
| Database migration (Phase 1) | 1-2 hours | Phase 0 complete, Clerk API access |
| Backend code changes | 2-3 hours | Database migration complete |
| Frontend code changes | 3-4 hours | None (can be parallel) |
| Frontend "Create Team" UI | 1-2 hours | Design/UX decision |
| Testing (non-prod) | 2-4 hours | Code changes deployed |
| Production migration | 1-2 hours | Non-prod success |
| Monitoring | 24 hours | Production deployment |

**Total**: ~3-4 days (including testing and monitoring)

**Note**: Frontend changes increased by 1-2 hours to add "Create Team" button/flow for users with Team Business Plan subscription.

---

## Questions for Review

1. **Auto-Creation Trigger**: Confirm removal of `auto_create_team_on_upgrade()` trigger. This means users with Team Business Plan will need to explicitly click "Create Team" in UI instead of having a team auto-created. (Recommendation: Remove - deliberate action is better than automatic)

Answer: After a team subscription upgrade, a team owner needs to navigate to /team-management and provide a name of the team.  When a name of the team is provided and submit button is clicked, a new team creation process should be triggered.  This is not automatic.

2. **Existing Teams Without Clerk**: The 4 teams created by the trigger need Clerk orgs retroactively created. Confirm automatic creation via migration script. (Recommendation: Automatic with script)

Answer: Yes, confirmed.

3. **Invitation Migration**: Should we re-create the 6 pending invitations in Clerk, or notify users to re-send? (Recommendation: Re-create for better UX)

Answer: No, the users can create new invitations.

4. **Legacy Code**: Can we delete `icraft-teams.ts` entirely, or does it contain other team logic? (Needs file review)

Answer: Review and advise.

**REVIEW COMPLETE**: File contains ONLY legacy invitation functions (5 total):
- `teamsInvitePost` - Database invitation creation
- `acceptTeamInvitation` - Token-based acceptance
- `declineTeamInvitation` - Decline invitation
- `getTeamInvitations` - List database invitations
- `cancelTeamInvitation` - Cancel database invitation

**RECOMMENDATION**: ✅ **DELETE ENTIRE FILE** - No other team logic exists, all functions are part of legacy database invitation system being replaced by Clerk.

5. **Role Transfer**: Should we implement "transfer ownership" feature now or later? (Recommendation: Later - separate feature)

Answer: No.

6. **Production Timeline**: What's the target date for production deployment? (Need stakeholder input)

Answer: FOcus on implementation.  We will need to update both supabase non-prod and prod databases as a part of this migration.

7. **Frontend "Create Team" Button**: After removing auto-creation, users will need a prominent "Create Team" button. Where should this be placed in the UI? (Recommendation: Dashboard with Team Business Plan badge/indicator)

Answer: This button already exists when a user specifes a team name in /team-management.

8. Instead of creating sql directly in the Zuplo code, create supabase stored procedures and use them from Zuplo code.

**CURRENT STATE REVIEW**:

Team creation in `team-management.ts` (lines 179-456) ALREADY follows this pattern correctly:

```typescript
// ✅ CORRECT: Clerk API calls in Zuplo (external HTTP - can't be in DB)
const clerkResponse = await fetch(`${CLERK_API_BASE}/organizations`, {...});
const clerkOrgId = clerkOrg.id;

// ✅ CORRECT: Database operations via stored procedure
const { data: result, error: createError } = await supabase
  .rpc('create_team_with_owner_and_transfer_all', {
    p_team_name: name.trim(),
    p_team_description: description?.trim(),
    p_owner_user_id: userId,
    p_clerk_org_id: clerkOrgId  // Pass Clerk org ID to stored procedure
  });
```

**ARCHITECTURE**:
- **Zuplo Layer**: Handles Clerk API calls (external HTTP requests)
- **Database Layer**: Handles all database operations via stored procedures
- **Separation**: External API calls CANNOT be in stored procedures (PostgreSQL limitation)

**CHANGES NEEDED**:
- ✅ Team creation already uses stored procedure: `create_team_with_owner_and_transfer_all`
- ✅ No inline SQL in team creation code
- ❌ Custom subscription fix (lines 205-223) uses inline `.eq()` queries
- **ACTION**: Create stored procedure `check_team_eligible_subscription(p_user_id)` to replace inline subscription checks

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Answer questions** listed above (especially #1 about auto-creation trigger removal)
3. **Create migration scripts**:
   - `006_remove_auto_team_creation_nonprod.sql` (Phase 0)
   - Clerk org creation script for 4 existing teams (Phase 1)
   - Invitation migration script (Phase 1)
4. **Execute Phase 0** (CRITICAL - remove auto-creation trigger)
5. **Execute Phase 1** (database migration) in non-prod
6. **Execute Phases 2-6** following deployment order
7. **Monitor and iterate** based on results
