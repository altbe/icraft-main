# Team Member Requirements and One-Team-Per-User Implementation

**Date Completed**: 2025-10-23 to 2025-10-24
**Status**: ✅ Partially Complete (Team invitation flow working | Subscription upgrade flow pending)

## Team Member Requirements Documentation
- Created comprehensive `TEAM_MEMBER_REQUIREMENTS.md` with all team collaboration requirements
- Documented three member onboarding scenarios (new user, existing user, team owner)
- Captured role-based permissions (owner/member)
- Documented team credit management and story ownership
- Added future enhancement roadmap
- Updated CLAUDE.md with requirements documentation references

## One-Team-Per-User Enforcement (Database-First Implementation)

### Discovery
Database already enforces one-team-per-user constraint (migration 002). API doesn't validate before sending invitation (bad UX).

### Solution Implemented
Full-stack pre-flight validation with database-first architecture.

### Database Layer (Migration 011)
- Created stored procedure `check_user_team_membership_by_email(p_email TEXT)`
- Three-tier email lookup: team_members.email → user_profiles.email → teams.owner_id
- Applied to both non-prod and prod

### Backend API
`backend/modules/clerk-team-invitations.ts:144-172`
- Calls stored procedure before sending Clerk invitation
- Returns specific error codes: `USER_ALREADY_IN_TEAM`, `USER_ALREADY_OWNS_TEAM`
- Includes team metadata in error response
- Fail-open strategy for better UX

### Frontend UI
`frontend/src/components/TeamInvitationDialog.tsx:96-106`
- Detects error codes and extracts team metadata
- Shows informational error message with existing team name
- Translations added for English and Spanish

### Security Enhancements (Zod-Based Validation)
- **Zod Schema Validation**: Type-safe email validation
- **Frontend & Backend Consistency**: Same Zod schema logic
- **Sanitization Transform**: Auto-removes control chars, null bytes, HTML tags
- **Progressive Real-Time UX**: Visual feedback as user types
- **Injection Prevention**: Detects XSS, protocol injection, directory traversal
- **Length Limits**: 3-320 characters (RFC 5322 compliant)
- **Security Logging**: Backend logs failed validations
- **Input Masking**: Frontend strips dangerous characters

## Story & Credit Transfer Implementation

### What's Implemented ✅
**Team Invitation Acceptance Transfer** - FULLY WORKING (deployed to prod & non-prod)
- Database: `onboard_team_member()` transfers ALL stories and credits automatically
- Database: `transfer_all_user_stories_to_team()` with full audit trail
- Database: `story_transfers` table for immutable transaction history
- Backend: Clerk webhook calls `onboard_team_member()` on `organizationMembership.created`
- Cancels individual/trial subscriptions automatically
- Logs comprehensive `team_join` activity with transfer counts
- Transaction history preserved (stories + credits)

### What's Missing ❌
**Subscription Upgrade Transfer** - NOT IMPLEMENTED
- Stripe webhook doesn't detect plan upgrades
- No logic to trigger onboarding when user upgrades to team plan
- No confirmation dialogs or success notifications

### Database Functions (Deployed)
- `onboard_team_member(p_user_id, p_team_id)`
- `transfer_all_user_stories_to_team(p_user_id, p_team_id, p_description)`
- `transfer_all_user_credits_to_team(p_user_id, p_team_id, p_description)`
- `story_transfers` audit table

### Migration Policy for Existing Users

**Decision**: Only migrate users who have active team subscriptions.

**Criteria**:
- ✅ **Migrate**: Users with active team/custom subscriptions
- ❌ **Exclude**: Individual users (even if they own empty team entities)

### Completed Migration (2025-10-24)
- 4 users migrated successfully
- 143 stories transferred to teams
- 1 subscription optimized
- 0 errors, 100% success rate

## Documentation
- `TEAM_MEMBER_REQUIREMENTS.md`
- `ONE_TEAM_PER_USER_SOLUTION.md`
- `NON_PROD_DATA_MIGRATION_PLAN.md`
- `STORY_CREDIT_TRANSFER_GAP_ANALYSIS.md`