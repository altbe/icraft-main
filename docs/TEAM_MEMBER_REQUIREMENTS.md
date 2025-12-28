# Team Member Requirements - Implementation Reference

**Status**: Active Reference Document
**Last Updated**: 2025-10-25 (Updated for ledger model)
**Purpose**: Comprehensive requirements documentation for team member features

> ✅ **CREDIT SYSTEM**: This document uses the **pure ledger model**. All credit balances are computed from `credit_transactions` table using stored procedures. See `backend/CREDIT_SYSTEM_CONSOLIDATED.md` for details.

---

## Executive Summary

This document captures all implemented and planned requirements for team member functionality in iCraftStories. It serves as the source of truth for understanding what team features exist, how they work, and what's planned for the future.

**Key Implementation Status:**
- ✅ Clerk-first team management and invitations
- ✅ Automatic member onboarding with asset transfer
- ✅ Two-tier role model (owner/member)
- ✅ Team credit pools with role-based permissions
- ✅ Team story ownership and sharing
- ✅ Webhook-based synchronization

---

## Table of Contents

1. [Core Team Management](#core-team-management)
2. [Team Invitations](#team-invitations)
3. [Member Onboarding](#member-onboarding)
4. [Role-Based Permissions](#role-based-permissions)
5. [Team Credits](#team-credits)
6. [Team Story Ownership](#team-story-ownership)
7. [Data Synchronization](#data-synchronization)
8. [Security & Access Control](#security--access-control)
9. [User Experience Requirements](#user-experience-requirements)
10. [Future Enhancements](#future-enhancements)

---

## Core Team Management

### REQ-TM-001: Team Creation
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Users with team-eligible subscriptions can create teams
- Team-eligible subscriptions: `plan_id = 'team'` OR `plan_id LIKE 'custom_%'`
- Team creation must create both Clerk Organization AND Supabase record
- All teams must have `clerk_org_id` populated
- Creator automatically becomes team owner

**Implementation:**
- **File**: `backend/modules/team-management.ts:179-456`
- **Stored Procedure**: `create_team_with_owner_and_transfer_all()`
- **Database**: Teams table with `clerk_org_id` column (nullable text)

**User Flow:**
1. User navigates to `/team-management`
2. User enters team name and description
3. System validates team-eligible subscription
4. System creates Clerk Organization
5. System creates Supabase team record with `clerk_org_id`
6. Owner added as team member with full permissions
7. Owner's personal credits transferred to team

**Acceptance Criteria:**
- ✅ Only users with `team` or `custom_*` subscriptions can create teams
- ✅ All new teams have Clerk Organizations
- ✅ Creator is automatically owner with full permissions
- ✅ Team appears in user's team list immediately

---

### REQ-TM-002: Team Subscription Validation
**Status**: ✅ Implemented (2025-01-22)
**Priority**: Critical

**Requirements:**
- API must accept both standard Team Business Plan (`team`) and custom enterprise plans (`custom_*`)
- Subscription check must use stored procedure (not inline SQL)
- Clear error messages for users without team-eligible subscriptions

**Implementation:**
- **File**: `backend/modules/team-management.ts:205-223`
- **Stored Procedure**: `check_team_eligible_subscription(p_user_id TEXT)`
- **Migration**: `backend/scripts/migrations/007_team_subscription_check_nonprod.sql`

**Technical Details:**
```sql
-- Stored procedure checks for team-eligible subscriptions
CREATE OR REPLACE FUNCTION check_team_eligible_subscription(p_user_id TEXT)
RETURNS TABLE (
  subscription_id UUID,
  plan_id TEXT,
  status TEXT,
  has_eligible_subscription BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.plan_id, s.status, TRUE as has_eligible_subscription
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
    AND (s.plan_id = 'team' OR s.plan_id LIKE 'custom_%')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Acceptance Criteria:**
- ✅ Users with `team` subscription can create teams
- ✅ Users with `custom_enterprise` subscription can create teams
- ✅ Users with `custom_agency` subscription can create teams
- ✅ Clear error message for users without team subscription

---

### REQ-TM-003: Team Member Display
**Status**: ✅ Implemented
**Priority**: High

**Requirements:**
- Display all team members with names, emails, roles
- Show role badges (owner/member)
- Display join dates
- Show permissions (can use credits, can manage credits)
- Support for member removal (owner only)

**Implementation:**
- **Component**: `frontend/src/components/TeamManagement.tsx`
- **Service**: `frontend/src/services/TeamService.ts`
- **API**: `GET /teams/{teamId}/members`

**Acceptance Criteria:**
- ✅ All team members displayed with complete information
- ✅ Role badges visible (owner/member)
- ✅ Owner can remove members
- ✅ Member cannot remove other members
- ✅ Responsive design (mobile-friendly)

---

## Team Invitations

### REQ-INV-001: Clerk-First Invitation System
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- All invitations sent via Clerk Organizations API
- Professional email delivery through Clerk
- No custom invitation email system
- Invitations tracked in Clerk, synced to Supabase via webhooks

**Implementation:**
- **Backend**: `backend/modules/clerk-team-invitations.ts`
- **Frontend**: `frontend/src/services/TeamInvitationService.ts`
- **Webhooks**: `backend/modules/clerk-organization-webhooks.ts`

**API Endpoints:**
```typescript
POST /teams/invite          // Send invitation
GET /teams/{teamId}/invitations      // List invitations
DELETE /teams/{teamId}/invitations/{id}  // Cancel invitation
```

**Clerk Configuration:**
- Organization invitations enabled in Clerk Dashboard
- Webhook endpoint: `POST /webhooks/clerk/organizations`
- Events: `organizationInvitation.accepted`, `organizationInvitation.revoked`

**Acceptance Criteria:**
- ✅ Invitations sent via Clerk (not database)
- ✅ Professional email templates from Clerk
- ✅ Invitation status tracked (pending/accepted/revoked)
- ✅ Owner can cancel pending invitations
- ✅ Webhook syncs membership on acceptance

---

### REQ-INV-002: Invitation Management UI
**Status**: ✅ Implemented
**Priority**: High

**Requirements:**
- Display pending invitations in team management page
- Show invitation details: email, role, status, expiration
- Allow cancellation of pending invitations (owner only)
- Empty state when no invitations exist
- Mobile-responsive design

**Implementation:**
- **Component**: `frontend/src/components/TeamInvitationsManager.tsx`
- **Dialog**: `frontend/src/components/TeamInvitationDialog.tsx`

**User Flow:**
1. Owner opens team management page
2. Sees "Pending Invitations" section (always visible)
3. If invitations exist, shows list with cancel buttons
4. If no invitations, shows "No pending invitations" message
5. Click "Invite Member" to send new invitation

**Acceptance Criteria:**
- ✅ Section always visible (not conditional on invitation count)
- ✅ Empty state displayed when no invitations
- ✅ Cancel button only for owners
- ✅ Invitation count badge shows number
- ✅ Mobile layout stacks properly (no horizontal overflow)

---

### REQ-INV-003: Pre-Invitation Team Membership Check
**Status**: ✅ Implemented (2025-10-23)
**Priority**: High

**Requirements:**
- Validate user's team status before sending invitation
- Check if email is already member of another team
- Check if email owns another team
- Show informational dialog (not error) if user already has team
- Prevent sending invitation that will fail on acceptance

**Implementation:**
- **Stored Procedure**: `check_user_team_membership_by_email(p_email TEXT)`
- **Files**:
  - `backend/sql/check-user-team-membership-by-email.sql`
  - `backend/scripts/migrations/011_check_user_team_membership_nonprod.sql`
  - `backend/scripts/migrations/011_check_user_team_membership_prod.sql`
- **Returns**: Team details if user is in a team, NULL otherwise

**Usage in API** (`backend/modules/clerk-team-invitations.ts:144-172`):
```typescript
// Check if user is already in another team (one-team-per-user constraint)
const { data: existingMembership } = await supabase
  .rpc('check_user_team_membership_by_email', { p_email: email });

if (existingMembership && existingMembership.length > 0) {
  const membership = existingMembership[0];
  return HttpProblems.badRequest(request, context, {
    detail: `User is already ${membership.is_owner ? 'owner of' : 'a member of'} ${membership.team_name}`,
    code: membership.is_owner ? 'USER_ALREADY_OWNS_TEAM' : 'USER_ALREADY_IN_TEAM',
    metadata: {
      existingTeamName: membership.team_name,
      existingTeamId: membership.team_id,
      userRole: membership.user_role
    }
  });
}
```

**Frontend Handling** (`frontend/src/components/TeamInvitationDialog.tsx:96-106`):
```typescript
// Check for specific error codes from backend
if (errorCode === 'USER_ALREADY_IN_TEAM' && metadata?.existingTeamName) {
  setError(t('invitation.userAlreadyInTeam', {
    email: email.trim().toLowerCase(),
    teamName: metadata.existingTeamName
  }));
} else if (errorCode === 'USER_ALREADY_OWNS_TEAM' && metadata?.existingTeamName) {
  setError(t('invitation.userAlreadyOwnsTeam', {
    email: email.trim().toLowerCase(),
    teamName: metadata.existingTeamName
  }));
}
```

**Database Constraint**: One-team-per-user enforced by migration 002
- `idx_team_members_one_per_user` - Unique index on `team_members(user_id)`
- `idx_teams_one_owner` - Unique index on `teams(owner_id)`

**Security - Zod-Based Input Validation:**
- **Frontend** (`TeamInvitationService.ts:158-236`):
  - **Zod Schema**: Type-safe email validation with sanitization transform
  - **Built-in Validation**: Zod's `.email()` validator (RFC 5322 compliant)
  - **Custom Refine**: Injection pattern detection (XSS, protocol injection, directory traversal)
  - **Length Validation**: 3-320 characters enforced by schema
  - **Method**: `validateEmail()` returns `{valid, error?, sanitized?}` for detailed feedback
  - **Real-Time UX**: Progressive validation with visual feedback (green/yellow/red borders)
- **Backend** (`clerk-team-invitations.ts:19-83`):
  - **Zod Schema**: Consistent validation with frontend
  - **Transform**: Auto-sanitization (trim, lowercase, remove control chars/HTML)
  - **Refine**: Same injection pattern detection as frontend
  - **Error Messages**: Zod provides detailed, user-friendly error messages
  - **Security Logging**: Failed validations logged with input preview
  - **Type Safety**: Full TypeScript type inference from schema

**Acceptance Criteria:**
- ✅ Stored procedure created in both databases (non-prod and prod)
- ✅ API validates before sending Clerk invitation (fail-open strategy)
- ✅ Frontend shows informational message with team name
- ✅ No invitations sent to users already in teams
- ✅ Clear error messages with specific error codes
- ✅ English and Spanish translations added
- ✅ Robust email sanitization on frontend and backend
- ✅ Injection pattern detection and security logging

---

### REQ-INV-004: Two-Tier Role Model
**Status**: ✅ Implemented (admin role deprecated)
**Priority**: Critical

**Requirements:**
- Only two roles: `owner` and `member`
- Admin role removed from system
- All invitations create `member` role
- Owner has full permissions
- Member has limited permissions

**Implementation:**
- **Database Constraint**: `CHECK (role IN ('owner', 'member'))`
- **Migration**: `backend/scripts/migrations/010_add_role_constraint_nonprod.sql`

**Role Mapping:**
- Clerk `admin` → Team `member` (no more admin role)
- Clerk `basic_member` → Team `member`
- Team `owner` role is application-specific (not in Clerk)

**Acceptance Criteria:**
- ✅ Database constraint prevents admin role insertion
- ✅ All new invitations create member role
- ✅ Frontend shows owner/member only
- ✅ No references to admin role in codebase

---

## Member Onboarding

### REQ-ONB-001: Automatic Onboarding on Invitation Accept
**Status**: ✅ Implemented (2025-10-22)
**Priority**: Critical

**Requirements:**
- When user accepts Clerk invitation, automatic onboarding triggers
- Onboarding transfers personal assets to team
- Different behavior for new users vs existing users
- All operations atomic and logged

**Implementation:**
- **Webhook Handler**: `backend/modules/clerk-organization-webhooks.ts:225-250`
- **Stored Procedure**: `onboard_team_member(p_user_id, p_team_id)`
- **SQL File**: `backend/sql/team-member-onboarding.sql`

**Webhook Flow:**
```typescript
// clerk-organization-webhooks.ts
case 'organizationMembership.created':
  // Create team_members record
  // Call onboard_team_member() stored procedure
  const { data } = await supabase.rpc('onboard_team_member', {
    p_user_id: user.id,
    p_team_id: team.id
  });
```

**Acceptance Criteria:**
- ✅ Webhook fires on invitation acceptance
- ✅ Team member record created
- ✅ Onboarding procedure executes automatically
- ✅ All transfers logged in activities table
- ✅ Error handling with clear logging

---

### REQ-ONB-002: New User Onboarding (No Subscription)
**Status**: ✅ Implemented
**Priority**: High

**User Profile:**
- First-time user accepting team invitation
- No individual subscription
- Zero credits
- Zero stories

**Onboarding Process:**
1. User accepts Clerk invitation
2. Webhook creates team member record
3. Stored procedure executes:
   - Transfers 0 credits (gracefully handles empty balance)
   - Transfers 0 stories (no personal stories exist)
   - Skips subscription cancellation (no subscription to cancel)
   - Logs `team_join` activity with metadata

**Expected Result:**
```json
{
  "creditsTransferred": 0,
  "storiesTransferred": 0,
  "subscriptionCancelled": false
}
```

**Test Case:**
```sql
SELECT onboard_team_member('user_34QVci9hMiAU0rN3K6qB1mBbv8W', '<team_id>');
-- Expected: success, 0 credits, 0 stories, no subscription cancelled
```

**Acceptance Criteria:**
- ✅ New user becomes team member
- ✅ Uses team subscription and credits
- ✅ No errors when zero assets to transfer
- ✅ Activity logged with correct metadata

---

### REQ-ONB-003: Existing User Onboarding (With Subscription)
**Status**: ✅ Implemented
**Priority**: Critical

**User Profile:**
- Existing user with individual or trial subscription
- Has personal credits (e.g., 50 credits)
- Has personal stories (e.g., 5 stories)
- Active subscription to cancel

**Onboarding Process:**
1. User accepts Clerk invitation
2. Webhook creates team member record
3. Stored procedure executes:
   - Transfers ALL user credits to team (50 credits → team)
   - Transfers ALL user stories to team (5 stories → team)
   - Cancels individual/trial subscription (status → 'canceled')
   - Logs subscription cancellation to system_logs
   - Logs `team_join` activity with full transfer details

**Expected Result:**
```json
{
  "creditsTransferred": 50,
  "storiesTransferred": 5,
  "subscriptionCancelled": true,
  "cancelledPlanId": "trial"
}
```

**Database State After:**
```sql
-- User credits: 0 (no personal balance after transfer)
SELECT get_user_credit_balance('<user_id>');
-- Returns: 150 (team balance - user is now team member)

-- Team credits: +50 (from transferred personal credits)
-- No separate query needed - get_user_credit_balance() auto-detects team membership

-- Stories transferred
SELECT COUNT(*) FROM stories WHERE user_id = '<user_id>' AND team_id = '<team_id>';
-- Returns: 5

-- Subscription cancelled
SELECT status FROM subscriptions WHERE user_id = '<user_id>';
-- Returns: 'canceled'
```

**Acceptance Criteria:**
- ✅ ALL credits transferred (none remain personal)
- ✅ ALL stories transferred to team ownership
- ✅ Individual/trial subscription cancelled
- ✅ User can no longer use personal subscription benefits
- ✅ User uses team subscription and credits going forward
- ✅ Complete audit trail in activities and system_logs

---

### REQ-ONB-004: Team Owner Creation (Different Behavior)
**Status**: ✅ Implemented
**Priority**: High

**User Profile:**
- User creating a new team (not accepting invitation)
- Has active team-eligible subscription (team OR custom_*)
- Has personal credits (e.g., 100 credits)
- Has personal stories (e.g., 3 stories)

**Team Creation Process:**
1. User navigates to `/team-management`
2. User enters team name and clicks "Create Team"
3. API creates Clerk Organization
4. API calls `create_team_with_owner_and_transfer_all()`
5. Stored procedure executes:
   - Creates team record with clerk_org_id
   - Adds owner as team_member (role: 'owner', can_manage_credits: true)
   - Transfers ALL user credits to team
   - **Does NOT transfer stories** (owner's stories remain personal)
   - Logs `team_create` activity

**Expected Result:**
```json
{
  "creditsTransferred": 100,
  "storiesTransferred": 0,
  "teamCreated": true
}
```

**Database State After:**
```sql
-- Team created with Clerk org
SELECT clerk_org_id FROM teams WHERE id = '<team_id>';
-- Returns: org_clerk_xxx

-- Owner credits: 0 (transferred to team)
SELECT get_user_credit_balance('<owner_id>');
-- Returns: 100 (team balance - owner is team member)

-- Team credits: 100 (from owner's transferred credits)
-- No separate query needed - get_user_credit_balance() auto-detects team membership

-- Personal stories: Still 3 (team_id = NULL)
SELECT COUNT(*) FROM stories WHERE user_id = '<owner_id>' AND team_id IS NULL;
-- Returns: 3 (stories NOT transferred)
```

**Story Transfer Rationale:**
- **Owner**: Pre-existing stories remain personal (user's portfolio)
- **Member**: Pre-existing stories transfer to team (joining = contributing)
- **Going Forward**: Both create new stories as team stories

**Acceptance Criteria:**
- ✅ Team created with Clerk Organization
- ✅ Owner added with full permissions
- ✅ ALL credits transferred to team
- ✅ Stories remain personal (NOT transferred)
- ✅ Owner can create team stories going forward
- ✅ Activity logged with team creation details

---

## Role-Based Permissions

### REQ-PERM-001: Owner Permissions
**Status**: ✅ Implemented
**Priority**: Critical

**Owner Capabilities:**
- ✅ Invite new members
- ✅ Remove members
- ✅ Cancel pending invitations
- ✅ Use team credits
- ✅ Manage team credits (transfer, allocate)
- ✅ Update team settings (name, description)
- ✅ Create and edit team stories
- ✅ Delete team
- ✅ View team analytics (future)

**Database Permissions:**
```sql
-- Owner permissions in team_members table
role = 'owner'
can_use_credits = true
can_manage_credits = true
```

**Permission Checks:**
```typescript
// Backend permission validation
if (requestingMember.role !== 'owner') {
  return HttpProblems.forbidden(request, context, {
    detail: "Only team owners can perform this action"
  });
}
```

**Acceptance Criteria:**
- ✅ Only owner can invite members
- ✅ Only owner can remove members
- ✅ Only owner can manage credits
- ✅ Owner can use credits like members
- ✅ API enforces owner-only permissions

---

### REQ-PERM-002: Member Permissions
**Status**: ✅ Implemented
**Priority**: High

**Member Capabilities:**
- ✅ View team details and members
- ✅ Use team credits (if `can_use_credits = true`)
- ✅ Create team stories
- ✅ Edit team stories
- ✅ View team story library
- ❌ Cannot invite members
- ❌ Cannot remove members
- ❌ Cannot manage credits
- ❌ Cannot update team settings
- ❌ Cannot delete team

**Database Permissions:**
```sql
-- Member permissions in team_members table
role = 'member'
can_use_credits = true  -- Default for new members
can_manage_credits = false
```

**Frontend Permission Checks:**
```typescript
// Frontend permission helper
const isTeamOwner = () => {
  if (!team || !user?.id) return false;
  const member = team.members.find(m => m.userId === user.id);
  return member?.role === 'owner';
};

// Usage in UI
{isTeamOwner() && (
  <Button onClick={inviteMember}>Invite Member</Button>
)}
```

**Acceptance Criteria:**
- ✅ Members can create/edit team stories
- ✅ Members can use team credits
- ✅ Members cannot invite others
- ✅ Members cannot remove others
- ✅ UI hides management features for members

---

### REQ-PERM-003: Credit Usage Permissions
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Team members can have individual credit usage permissions
- `can_use_credits` flag controls credit access
- `can_manage_credits` flag controls credit management
- Owner always has both permissions
- Members default to `can_use_credits = true`

**Permission Flags:**
```sql
-- team_members table columns
can_use_credits BOOLEAN DEFAULT true
can_manage_credits BOOLEAN DEFAULT false
```

**Credit Operations:**
```typescript
// Check credit permission before use
async useTeamCredits(teamId: string, amount: number): Promise<void> {
  const member = await getTeamMember(teamId, userId);

  if (!member.can_use_credits) {
    throw new Error('No permission to use team credits');
  }

  // Proceed with credit usage
  await supabase.rpc('use_credits', {
    p_team_id: teamId,
    p_amount: amount
  });
}
```

**Acceptance Criteria:**
- ✅ Owner always has both permissions
- ✅ Members can be granted/revoked credit permissions
- ✅ API enforces permission checks before credit operations
- ✅ Clear error messages for permission denied

---

## Team Credits

### REQ-CRED-001: Team Credit Pool
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Each team has shared credit balance
- Credits computed from `credit_transactions` table (ledger model)
- All team members share the same pool
- Balance retrieved via `get_user_credit_balance(user_id)` function
- Credit operations logged in activities table
- Complete audit trail for accountability

**Database Schema:**
```sql
-- credit_transactions table (ledger model with full auditability)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,       -- ALWAYS set (identifies the actor)
  team_id UUID NULL,           -- NULL = personal, NOT NULL = team transaction
  amount INTEGER NOT NULL,     -- Positive = credit, Negative = debit
  transaction_type TEXT NOT NULL,  -- 'usage', 'allocation', 'transfer_in', 'transfer_out'
  description TEXT NOT NULL,
  created_by UUID NOT NULL,    -- User who initiated (usually same as user_id)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Balance computed via function
SELECT get_user_credit_balance('<user_id>');  -- Returns team balance if team member

-- Auditability: Track which team member used credits
SELECT * FROM credit_transactions
WHERE team_id = '<team_id>' AND user_id = '<user_id>';
```

**Credit Operations:**
- ✅ Add credits (purchase, grant)
- ✅ Use credits (AI operations)
- ✅ Transfer from personal to team
- ✅ Check balance before operations
- ✅ Prevent negative balances

**Acceptance Criteria:**
- ✅ Team credit balance visible to all members
- ✅ All credit operations atomic
- ✅ Audit trail captures user, amount, reason
- ✅ Cannot spend more credits than available

---

### REQ-CRED-002: Personal to Team Credit Transfer
**Status**: ✅ Implemented
**Priority**: High

**Requirements:**
- Team members can transfer personal credits to team
- Transfer is one-way (no reverse)
- Atomic operation (all or nothing)
- Logged in activities for both user and team
- Owner's credits auto-transferred on team creation

**Implementation:**
- **Stored Procedure**: `transfer_all_user_credits_to_team()`
- **API Endpoint**: `POST /teams/{teamId}/credits/transfer`
- **Frontend**: Credit transfer dialog in team management

**Transfer Process:**
1. User initiates transfer in UI
2. System validates user has credits
3. System validates team membership
4. Atomic transfer: deduct from user, add to team
5. Log activity for user and team
6. Return new balances

**Acceptance Criteria:**
- ✅ Transfer is atomic (rollback on error)
- ✅ User credit balance decreases
- ✅ Team credit balance increases
- ✅ Activity logged for both user and team
- ✅ Cannot transfer more than user has
- ✅ Owner's credits auto-transferred on team creation

---

### REQ-CRED-003: Credit Usage Tracking
**Status**: ✅ Implemented
**Priority**: High

**Requirements:**
- All credit usage logged with context
- Track which member used credits
- Track what operation used credits (story generation, image, etc.)
- Display credit usage history
- Support for filtering and search

**Activity Logging:**
```typescript
// Credit usage logged in activities table
{
  user_id: "member_who_used",
  team_id: "team_id",
  action_type: "credit_used",
  action_details: "AI story generation",
  metadata: {
    amount: 10,
    operation: "story_generation",
    story_id: "story_uuid"
  }
}
```

**Acceptance Criteria:**
- ✅ All credit operations logged
- ✅ Can see who used credits
- ✅ Can see what credits were used for
- ✅ Audit trail immutable
- ✅ UI displays credit history

---

## Team Story Ownership

### REQ-STORY-001: Team Story Creation
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Team members can create stories owned by team
- Team stories visible to all team members
- Team credits used for AI operations
- Story marked with `team_id` in database
- Syncs across all team members' devices

**Database Schema:**
```sql
-- stories table
user_id TEXT NOT NULL  -- Creator
team_id UUID NULLABLE  -- Team owner (NULL = personal story)
```

**Story Creation Flow:**
1. Team member creates story
2. Story saved with `team_id` populated
3. Story syncs to all team members' IndexedDB
4. All team members see story in their library
5. Team credits used for AI operations

**Acceptance Criteria:**
- ✅ Team member can create team story
- ✅ Story visible to all team members
- ✅ Story uses team credits
- ✅ Story syncs across devices
- ✅ Story appears in team story library

---

### REQ-STORY-002: Personal Story to Team Transfer
**Status**: ✅ Implemented (Automatic on Member Join)
**Priority**: High

**Requirements:**
- Personal stories can be assigned to teams
- Transfer changes ownership to team
- All team members gain access
- Original creator tracked in `user_id`
- Automatic transfer on member onboarding

**Transfer Scenarios:**
1. **Manual Transfer**: User assigns personal story to team
2. **Automatic Transfer**: All personal stories transferred when accepting invitation

**Database Update:**
```sql
-- Transfer story to team
UPDATE stories
SET team_id = '<team_id>'
WHERE id = '<story_id>'
  AND user_id = '<user_id>'
  AND team_id IS NULL;
```

**Acceptance Criteria:**
- ✅ User can assign personal story to team
- ✅ Story becomes visible to all team members
- ✅ Original creator preserved in `user_id`
- ✅ All stories auto-transferred on member onboarding
- ✅ Owner's stories NOT transferred on team creation

---

### REQ-STORY-003: Team Story Library
**Status**: ✅ Implemented
**Priority**: High

**Requirements:**
- Display all team-owned stories
- Show creator and last modified info
- Support filtering and search
- Show team badge on stories
- Sync with backend API

**Implementation:**
- **Component**: `frontend/src/components/TeamStoryManager.tsx`
- **API**: `GET /teams/{teamId}/stories`

**Display Requirements:**
- ✅ Grid/list view of team stories
- ✅ Creator name and avatar
- ✅ Last modified timestamp
- ✅ Story preview thumbnail
- ✅ Team ownership badge
- ✅ Filter by creator
- ✅ Search by title

**Acceptance Criteria:**
- ✅ All team stories displayed
- ✅ Creator attribution shown
- ✅ Team badge visible on stories
- ✅ Search and filter work correctly
- ✅ Responsive mobile design

---

## Data Synchronization

### REQ-SYNC-001: Webhook-Based Membership Sync
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Clerk organization events sync to Supabase via webhooks
- Idempotent webhook processing
- Error handling and retry logic
- Monitoring for sync failures

**Webhook Events:**
```typescript
// Supported Clerk organization events
'organizationMembership.created'  → Add member to team_members
'organizationMembership.updated'  → Update member role/permissions
'organizationMembership.deleted'  → Remove member from team_members
'organizationInvitation.accepted' → Trigger onboarding
'organizationInvitation.revoked'  → Update invitation status
```

**Implementation:**
- **Handler**: `backend/modules/clerk-organization-webhooks.ts`
- **Endpoint**: `POST /webhooks/clerk/organizations`

**Acceptance Criteria:**
- ✅ Webhooks process successfully
- ✅ Idempotent processing (duplicate events handled)
- ✅ Error logging for failed syncs
- ✅ Retry mechanism for transient failures
- ✅ Supabase data consistent with Clerk

---

### REQ-SYNC-002: Cross-Device Team Data Sync
**Status**: ✅ Implemented
**Priority**: High

**Requirements:**
- Team data syncs across user's devices
- Team stories sync to all team members
- Credit balance updates in real-time
- Member list updates on changes
- Offline-first with eventual consistency

**Sync Strategy:**
- **Frontend**: IndexedDB stores team data locally
- **Sync Service**: SimplifiedSyncService handles HTTP polling sync
- **Frequency**: Every 5 minutes (configurable)
- **Conflict Resolution**: Last-write-wins for most data

**Sync Data Types:**
- ✅ Team details (name, description)
- ✅ Team members list
- ✅ Team credit balance
- ✅ Team stories
- ✅ Team invitations

**Acceptance Criteria:**
- ✅ Team data syncs across devices
- ✅ New team members see data immediately after sync
- ✅ Credit balance updates within 5 minutes
- ✅ Team stories appear on all devices
- ✅ Works offline, syncs when online

---

## Security & Access Control

### REQ-SEC-001: Team Membership Validation
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- All team operations validate membership
- User must be team member to access team data
- API enforces membership checks
- No reliance on RLS (using service keys)

**Implementation Pattern:**
```typescript
// Backend membership validation
export async function getTeamData(request: ZuploRequest, context: ZuploContext) {
  const userId = request.headers.get('X-User-Id');
  const teamId = request.params.teamId;

  // Validate membership
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();

  if (!member) {
    return HttpProblems.forbidden(request, context, {
      detail: 'Not a team member'
    });
  }

  // Proceed with operation
}
```

**Acceptance Criteria:**
- ✅ Non-members cannot access team data
- ✅ API returns 403 for non-members
- ✅ Frontend hides team features for non-members
- ✅ Database queries filter by team_id

---

### REQ-SEC-002: Permission-Based Access Control
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Role-based permissions enforced at API level
- Owner-only operations validated
- Credit permissions checked before usage
- Clear error messages for permission denied

**Permission Validation:**
```typescript
// Owner-only operation
if (member.role !== 'owner') {
  return HttpProblems.forbidden(request, context, {
    detail: 'Only team owners can perform this action',
    code: 'OWNER_ONLY'
  });
}

// Credit usage permission
if (!member.can_use_credits) {
  return HttpProblems.forbidden(request, context, {
    detail: 'No permission to use team credits',
    code: 'CREDIT_PERMISSION_DENIED'
  });
}
```

**Acceptance Criteria:**
- ✅ Owner-only operations blocked for members
- ✅ Credit operations require appropriate permissions
- ✅ API returns clear error codes
- ✅ Frontend disables unauthorized actions

---

### REQ-SEC-003: Data Isolation
**Status**: ✅ Implemented
**Priority**: Critical

**Requirements:**
- Team data isolated by team_id
- User can only access teams they belong to
- Credit transactions properly attributed
- Audit trails maintain user context

**Database Filtering:**
```sql
-- All team queries must filter by team_id
SELECT * FROM stories
WHERE team_id = '<team_id>';

-- Validate user membership before queries
SELECT * FROM team_members
WHERE team_id = '<team_id>'
  AND user_id = '<user_id>';
```

**Acceptance Criteria:**
- ✅ No cross-team data leakage
- ✅ All queries filtered by team_id
- ✅ User can only see their teams
- ✅ Audit trails capture correct user context

---

## User Experience Requirements

### REQ-UX-001: Responsive Mobile Design
**Status**: ✅ Implemented (with recent fixes)
**Priority**: High

**Requirements:**
- Team management pages work on mobile
- No horizontal overflow
- Touch-friendly buttons and inputs
- Readable text on small screens
- Stack layout on mobile, side-by-side on desktop

**Mobile Fixes:**
- Email text: `break-all` on mobile to prevent overflow
- Invite button: Full width on mobile, auto on desktop
- Member list: Stack vertically on mobile
- Action buttons: Full width stack on mobile

**Acceptance Criteria:**
- ✅ No horizontal scrolling on mobile
- ✅ All buttons accessible on small screens
- ✅ Text wraps properly
- ✅ Touch targets at least 44x44px
- ✅ Responsive breakpoints work correctly

---

### REQ-UX-002: Empty State Handling
**Status**: ✅ Fixed (2025-01-22)
**Priority**: Medium

**Requirements:**
- Show empty states for no invitations
- Show empty states for no members
- Show empty states for no team stories
- Empty states provide guidance
- Empty states always visible (not conditional)

**Fixed Issue:**
```typescript
// WRONG: Section disappears when empty
{invitations.length > 0 && <InvitationsSection />}

// CORRECT: Section always visible with empty state
<InvitationsSection>
  {invitations.length === 0 ? (
    <EmptyState message="No pending invitations" />
  ) : (
    <InvitationsList invitations={invitations} />
  )}
</InvitationsSection>
```

**Acceptance Criteria:**
- ✅ Sections always visible
- ✅ Clear empty state messages
- ✅ Actionable guidance in empty states
- ✅ No confusing "where did it go?" moments

---

### REQ-UX-003: Real-Time Updates
**Status**: 🚧 Partial (HTTP polling sync)
**Priority**: Medium

**Current Implementation:**
- HTTP polling sync every 5 minutes
- Manual refresh button available
- Webhook updates backend immediately

**Future Enhancement:**
- WebSocket-based real-time updates
- Instant credit balance updates
- Live member status indicators
- Real-time invitation status changes

**Acceptance Criteria:**
- ✅ Updates within 5 minutes (current)
- 🚧 Instant updates on credit usage (future)
- 🚧 Live presence indicators (future)
- 🚧 WebSocket connection (future)

---

## Future Enhancements

### REQ-FUT-001: Custom Roles
**Status**: 📋 Planned
**Priority**: Low

**Requirements:**
- Define custom roles beyond owner/member
- Granular permissions (invite, edit stories, use credits, etc.)
- Role templates (e.g., "Editor", "Viewer", "Contributor")
- UI for role management

**Example Custom Roles:**
- **Editor**: Can edit stories, use credits, but not invite
- **Viewer**: Can view team stories, cannot edit or use credits
- **Contributor**: Can create stories, use limited credits

---

### REQ-FUT-002: Bulk Invitations
**Status**: 📋 Planned
**Priority**: Medium

**Requirements:**
- Invite multiple users at once (CSV upload or paste)
- Progress indicator for bulk operations
- Error handling for invalid emails
- Summary report of successes/failures

---

### REQ-FUT-003: Team Analytics
**Status**: 📋 Planned
**Priority**: Low

**Requirements:**
- Credit usage analytics per member
- Story creation statistics
- Team activity timeline
- Export reports to PDF/CSV

---

### REQ-FUT-004: Team Templates
**Status**: 📋 Planned
**Priority**: Low

**Requirements:**
- Pre-configured team setups
- Templates for common use cases (agency, classroom, family)
- Include default roles and permissions
- One-click team creation from template

---

### REQ-FUT-005: Real-Time Collaboration
**Status**: 📋 Planned
**Priority**: Medium

**Requirements:**
- Live editing indicators (who's editing what)
- Presence system (who's online)
- Real-time credit balance updates
- Live activity feed

---

## Related Documentation

### Architecture Decision Records
- [ADR-009: Team Collaboration Architecture](frontend/docs/adr/ADR-009-team-collaboration-architecture.md)

### Implementation Plans
- [TEAM_INVITATION_REFACTORING_PLAN.md](TEAM_INVITATION_REFACTORING_PLAN.md)
- [TEAM_ONBOARDING_SCENARIOS.md](TEAM_ONBOARDING_SCENARIOS.md)

### Integration Guides
- [CLERK-TEAM-INVITATIONS.md](backend/docs-internal/integrations/CLERK-TEAM-INVITATIONS.md)
- [Team credits.md](backend/docs-internal/integrations/Team credits.md)
- [Supabase Team stories.md](backend/docs-internal/integrations/Supabase Team stories.md)

### Completion Summaries
- [TEAM_STORY_OWNERSHIP_SUMMARY.md](TEAM_STORY_OWNERSHIP_SUMMARY.md)
- [TEAM_AUTO_CREDIT_TRANSFER_COMPLETE.md](TEAM_AUTO_CREDIT_TRANSFER_COMPLETE.md)

---

## Status Legend

- ✅ **Implemented**: Feature is complete and deployed
- 🚧 **In Progress**: Feature is being worked on
- ⚠️ **Pending**: Feature planned but not started
- 📋 **Future**: Feature planned for future release
- ❌ **Not Implemented**: Feature explicitly not implemented

---

## Maintenance Notes

**Last Review**: 2025-10-23
**Review Frequency**: After major feature releases
**Document Owner**: Development Team

**When to Update:**
- New team features implemented
- Architecture changes affecting teams
- Security updates
- User feedback requiring requirement changes
- Bug fixes affecting team functionality
