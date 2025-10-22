# Team Onboarding Scenarios - Stored Procedure Coverage

**Status**: Gap Analysis Complete
**Date**: 2025-01-22
**Related**: TEAM_INVITATION_REFACTORING_PLAN.md

---

## Executive Summary

This document analyzes the three team onboarding scenarios and verifies complete stored procedure coverage. Identifies gaps in the refactoring plan regarding Clerk webhook integration.

**Key Finding**: The refactoring plan is MISSING documentation for `onboard_team_member()` stored procedure and Clerk webhook updates implemented on 2025-10-22.

---

## Three Onboarding Scenarios

### Scenario 1: New User, No Subscription

**Profile**: User accepting team invitation who has never used the platform
- No individual subscription
- 0 credits
- 0 stories
- Example: tech@altgene.net (user_34QVci9hMiAU0rN3K6qB1mBbv8W) in non-prod

**What Happens**:
1. User receives Clerk invitation email
2. User creates account (or signs in if account exists)
3. Clerk fires `organizationMembership.created` webhook
4. Webhook creates `team_members` record
5. Webhook calls `onboard_team_member(user_id, team_id)`
6. Stored procedure:
   - ✅ Transfers 0 credits (gracefully handles empty balance)
   - ✅ Transfers 0 stories (no personal stories exist)
   - ✅ Skips subscription cancellation (no subscription to cancel)
   - ✅ Logs `team_join` activity

**Result**: User becomes team member, uses team subscription and team credits

**Stored Procedure**: `onboard_team_member()` ✅ (implemented 2025-10-22)

**Test Case**:
```sql
SELECT onboard_team_member('user_34QVci9hMiAU0rN3K6qB1mBbv8W', '<team_id>');
-- Expected: success, 0 credits transferred, 0 stories transferred, no subscription cancelled
```

---

### Scenario 2: Existing User With Subscription

**Profile**: User accepting team invitation who already has individual/trial subscription
- Active individual or trial subscription
- Has personal credits (possibly)
- Has personal stories (possibly)
- Example: User with 50 credits, 5 stories, active trial subscription

**What Happens**:
1. User receives Clerk invitation email
2. User signs in with existing account
3. Clerk fires `organizationMembership.created` webhook
4. Webhook creates `team_members` record
5. Webhook calls `onboard_team_member(user_id, team_id)`
6. Stored procedure:
   - ✅ Transfers ALL user credits to team (e.g., 50 credits → team)
   - ✅ Transfers ALL user stories to team ownership (5 stories → team)
   - ✅ Cancels individual/trial subscription (status → 'canceled')
   - ✅ Logs subscription cancellation to `system_logs`
   - ✅ Logs `team_join` activity with full transfer details

**Result**: User's resources migrated to team, subscription cancelled, uses team benefits

**Stored Procedure**: `onboard_team_member()` ✅ (implemented 2025-10-22)

**Test Case**:
```sql
-- Setup: User with credits, stories, and subscription
INSERT INTO user_profiles (id, credit_balance) VALUES ('test_user', 50);
INSERT INTO stories (user_id, team_id) VALUES ('test_user', NULL); -- 5 personal stories
INSERT INTO subscriptions (user_id, plan_id, status) VALUES ('test_user', 'trial', 'active');

-- Execute
SELECT onboard_team_member('test_user', '<team_id>');

-- Verify
-- User credits: 0
-- Team credits: +50
-- Stories team_id: <team_id>
-- Subscription status: 'canceled'
```

---

### Scenario 3: Team Owner (Creating Team)

**Profile**: User creating a new team (not accepting invitation)
- Has active team-eligible subscription (team OR custom_*)
- Has personal credits (possibly)
- Has personal stories (will continue as personal stories)
- Example: User upgrading to Team Business Plan, creates "My Company Team"

**What Happens**:
1. User navigates to /team-management
2. User enters team name and clicks "Create Team"
3. API calls Clerk to create organization
4. API calls `create_team_with_owner_and_transfer_all()`
5. Stored procedure:
   - ✅ Creates team record with clerk_org_id
   - ✅ Adds owner as team_member (role: 'owner', can_manage_credits: true)
   - ✅ Transfers ALL user credits to team
   - ❌ **Does NOT transfer stories** (owner's existing stories remain personal)
   - ✅ Logs `team_create` activity

**Result**: New team created, credits transferred, owner has full permissions

**Stored Procedure**: `create_team_with_owner_and_transfer_all()` ✅ (already exists)

**Story Transfer Rationale**:
- **Team Owner**: Stories created BEFORE team remain personal (user's portfolio)
- **Team Member**: Stories created BEFORE joining team become team assets (joining = contributing)
- Going forward, both owner and members create new stories as team stories

**Test Case**:
```sql
-- Setup: User with team subscription, credits, and stories
INSERT INTO subscriptions (user_id, plan_id, status) VALUES ('owner_user', 'team', 'active');
INSERT INTO user_profiles (id, credit_balance) VALUES ('owner_user', 100);
INSERT INTO stories (user_id, team_id) VALUES ('owner_user', NULL); -- 3 personal stories

-- Execute via API (Zuplo calls stored procedure)
-- API creates Clerk org first, then:
SELECT create_team_with_owner_and_transfer_all(
  'My Team',
  'Team description',
  'owner_user',
  'org_clerk123'
);

-- Verify
-- Team created with clerk_org_id
-- Owner credits: 0
-- Team credits: 100
-- Personal stories: Still 3 (team_id = NULL) ← Stories NOT transferred
-- team_members: owner_user with role='owner'
```

---

## Stored Procedure Inventory

### ✅ Implemented Procedures

1. **`create_team_with_owner_and_transfer_all()`**
   - **File**: `backend/sql/team-auto-transfer-implementation.sql`
   - **Purpose**: Create team with owner, transfer credits only
   - **Scenario**: Team owner creating new team
   - **Transfers**: Credits ✅, Stories ❌

2. **`onboard_team_member()`**
   - **File**: `backend/sql/team-member-onboarding.sql`
   - **Purpose**: Onboard member via Clerk invitation
   - **Scenario**: New or existing user accepting invitation
   - **Transfers**: Credits ✅, Stories ✅, Cancel Subscription ✅
   - **Implemented**: 2025-10-22

3. **`accept_invitation_and_transfer_all()`**
   - **File**: `backend/sql/team-auto-transfer-implementation.sql`
   - **Purpose**: Accept legacy database invitation
   - **Scenario**: Legacy invitation system (being deprecated)
   - **Status**: ⚠️ Will be removed after Clerk migration
   - **Transfers**: Credits ✅, Stories ✅, Cancel Subscription ✅

4. **`transfer_all_user_credits_to_team()`**
   - **File**: `backend/sql/team-auto-transfer-implementation.sql`
   - **Purpose**: Transfer credits atomically (called by other procedures)
   - **Returns**: amount_transferred, balance details

---

## Gaps in Refactoring Plan

### Gap 1: Missing `onboard_team_member()` Documentation

**Issue**: The refactoring plan (TEAM_INVITATION_REFACTORING_PLAN.md) does NOT document the `onboard_team_member()` stored procedure.

**Impact**: Plan doesn't reflect actual implementation for Clerk webhook integration

**Required Update**: Add section documenting:
- Stored procedure creation (lines 290-488 discuss legacy `accept_invitation_and_transfer_all` instead)
- Clerk webhook handler update to call procedure
- Test cases for all three scenarios

**Location in Plan**: Should be added to "Code Changes → Backend Changes" section

---

### Gap 2: Clerk Webhook Handler Updates Not Documented

**Issue**: Plan doesn't mention updating `clerk-organization-webhooks.ts` to call onboarding procedure

**Actual Implementation** (2025-10-22):
```typescript
// backend/modules/clerk-organization-webhooks.ts:225-250
const { data: onboardingResult, error: onboardingError } = await supabase
  .rpc('onboard_team_member', {
    p_user_id: user.id,
    p_team_id: team.id
  });
```

**Required Update**: Document webhook handler changes in "Code Changes → Backend Changes" section

---

### Gap 3: Scenario Coverage Not Explicitly Verified

**Issue**: Plan doesn't map the three user scenarios to specific stored procedures

**Required Update**: Add "Onboarding Scenarios" section verifying:
- Scenario 1 (new user, no subscription) → `onboard_team_member()` ✅
- Scenario 2 (existing user with subscription) → `onboard_team_member()` ✅
- Scenario 3 (team owner) → `create_team_with_owner_and_transfer_all()` ✅

---

### Gap 4: Story Transfer Behavior Not Documented

**Issue**: Plan doesn't explain why owner's stories are NOT transferred on team creation

**Rationale**:
- **Design Decision**: Team owner's pre-existing stories represent personal work/portfolio
- **Member Join**: Member's pre-existing stories are contributed to team (joining = sharing)
- **Going Forward**: Both create new stories as team stories (team_id populated)

**Required Update**: Document story transfer logic in "Database Schema Changes" or "Migration Strategy" section

---

## Implementation Status

### ✅ Completed (2025-10-22)

1. Created `onboard_team_member()` stored procedure
2. Updated `clerk-organization-webhooks.ts` to call procedure
3. Applied to both databases:
   - Production: lgkjfymwvhcjvfkuidis ✅
   - Non-production: jjpbogjufnqzsgiiaqwn ✅
4. Git commits:
   - Backend: `ec2d580` - feat(teams): Implement automatic member onboarding
   - Monorepo: `87f3d5d` - chore: Update backend submodule

### ⚠️ Pending

1. Update TEAM_INVITATION_REFACTORING_PLAN.md to include:
   - `onboard_team_member()` documentation
   - Webhook handler updates
   - Scenario coverage verification
   - Story transfer behavior explanation

2. Test all three scenarios in non-prod:
   - [ ] Scenario 1: New user acceptance (tech@altgene.net)
   - [ ] Scenario 2: Existing user with subscription
   - [ ] Scenario 3: Team owner creation

---

## Testing Checklist

### Scenario 1: New User (tech@altgene.net)

```bash
# 1. Send invitation to tech@altgene.net from g@altgene.net's team
# 2. tech@altgene.net accepts invitation
# 3. Verify database state

# Expected Results:
SELECT * FROM team_members WHERE user_id = 'user_34QVci9hMiAU0rN3K6qB1mBbv8W';
-- role: 'member', can_use_credits: true

SELECT * FROM activities WHERE user_id = 'user_34QVci9hMiAU0rN3K6qB1mBbv8W' AND action_type = 'team_join';
-- metadata: {"creditsTransferred": 0, "storiesTransferred": 0, "subscriptionCancelled": false}
```

### Scenario 2: Existing User With Subscription

```bash
# 1. Create test user with trial subscription, 50 credits, 3 stories
# 2. Send invitation, user accepts
# 3. Verify transfers

# Expected Results:
SELECT credit_balance FROM user_profiles WHERE id = '<test_user>';
-- 0 (transferred to team)

SELECT COUNT(*) FROM stories WHERE user_id = '<test_user>' AND team_id = '<team_id>';
-- 3 (all transferred)

SELECT status FROM subscriptions WHERE user_id = '<test_user>' AND plan_id = 'trial';
-- 'canceled'
```

### Scenario 3: Team Owner Creation

```bash
# 1. User with team subscription creates new team
# 2. Verify team created with Clerk org
# 3. Verify credits transferred, stories NOT transferred

# Expected Results:
SELECT clerk_org_id FROM teams WHERE id = '<new_team_id>';
-- org_clerk_xxx (populated)

SELECT credit_balance FROM user_profiles WHERE id = '<owner_id>';
-- 0 (transferred to team)

SELECT COUNT(*) FROM stories WHERE user_id = '<owner_id>' AND team_id IS NULL;
-- Still 5 (NOT transferred - remain personal)
```

---

## Recommendations

### 1. Update Refactoring Plan

Add new section after line 488 in TEAM_INVITATION_REFACTORING_PLAN.md:

```markdown
#### 7. Clerk Webhook Integration (Implemented 2025-10-22)

**File: `backend/modules/clerk-organization-webhooks.ts`**

**Purpose**: Automatically onboard new team members when they accept Clerk invitations

**Implementation**:
```typescript
// After creating team_members record (line 223)
const { data: onboardingResult, error: onboardingError } = await supabase
  .rpc('onboard_team_member', {
    p_user_id: user.id,
    p_team_id: team.id
  });
```

**Stored Procedure: `onboard_team_member()`**
- Transfers ALL user credits to team
- Transfers ALL user stories to team
- Cancels individual/trial subscriptions
- Logs comprehensive team_join activity
```

### 2. Add Scenario Coverage Table

Add to "Success Criteria" section:

```markdown
### Onboarding Scenario Coverage

| Scenario | Stored Procedure | Credits | Stories | Subscription | Status |
|----------|-----------------|---------|---------|--------------|--------|
| New user, no subscription | `onboard_team_member()` | 0 → Team | 0 → Team | N/A | ✅ Implemented |
| Existing user with subscription | `onboard_team_member()` | All → Team | All → Team | Cancelled | ✅ Implemented |
| Team owner creating team | `create_team_with_owner_and_transfer_all()` | All → Team | Remain Personal | N/A | ✅ Implemented |
```

### 3. Document Story Transfer Logic

Add clarification note:

```markdown
**Story Transfer Behavior**:
- **Team Owner Creation**: Pre-existing stories remain personal (user's portfolio)
- **Member Joining Team**: Pre-existing stories transfer to team (contributing assets)
- **Rationale**: Owner creates team to manage future work; member joins to contribute existing work
```

---

## Next Steps

1. [ ] Update TEAM_INVITATION_REFACTORING_PLAN.md with gaps identified above
2. [ ] Test Scenario 1 with tech@altgene.net in non-prod
3. [ ] Create test users for Scenario 2 and Scenario 3
4. [ ] Verify all success criteria met
5. [ ] Proceed with Phase 0 (remove auto-creation trigger) per refactoring plan
