# Team Invitation Flow - Accept & Decline

**Date:** 2025-10-30
**Status:** ✅ FULLY IMPLEMENTED - Clerk-First Architecture

---

## Executive Summary

Team invitations are handled **entirely by Clerk Organizations**, not by custom API endpoints. The backend only validates pre-conditions (one-team-per-user) and processes post-acceptance webhooks (credit transfer, story transfer, subscription cancellation).

---

## Architecture: Clerk-First Invitation System

### Core Principle

**Clerk is the single source of truth for invitation state.**

- ✅ Clerk sends invitation emails
- ✅ Clerk validates invitation tokens
- ✅ Clerk adds users to organizations
- ✅ Clerk tracks invitation status (pending, accepted, revoked)
- ✅ Backend receives webhooks for post-processing

### Why Clerk-First?

1. **Security**: Clerk handles email verification, token generation, expiration
2. **Reliability**: Clerk's battle-tested invitation infrastructure
3. **Simplicity**: No custom invitation state management needed
4. **Consistency**: Same flow for all Clerk organizations

---

## Complete Invitation Flow

### Step 1: Invitation Creation (Backend Validation)

**Frontend Action:**
```typescript
// User clicks "Invite Member" in TeamManagementPage
await teamService.inviteMember(teamId, email, userId, token, 'member');
```

**Backend Processing** (`clerk-team-invitations.ts:sendClerkTeamInvitation`):

1. **Pre-Flight Validation** (lines 144-211):
   ```typescript
   // Check if user already has team membership
   const { data: membership } = await supabase.rpc('check_user_team_membership_by_email', {
     p_email: email
   });

   if (membership) {
     // Return error BEFORE sending Clerk invitation
     return HttpProblems.conflict(request, context, {
       detail: `User is already ${membership.user_role === 'owner' ? 'an owner' : 'a member'} of team "${membership.team_name}"`,
       code: isOwner ? 'USER_ALREADY_OWNS_TEAM' : 'USER_ALREADY_IN_TEAM',
       metadata: {
         existingTeamName: membership.team_name,
         existingTeamId: membership.team_id,
         userRole: membership.user_role
       }
     });
   }
   ```

2. **Create Clerk Invitation** (lines 213-243):
   ```typescript
   const invitationPayload = {
     email_address: email,
     role: 'org:member',
     redirect_url: `${FRONTEND_URL}/accept-team-invitation?team_id=${teamId}`,
     public_metadata: {
       team_id: teamId,
       team_name: team.name,
       invited_by: userId,
       invitation_source: 'icraft_api'
     }
   };

   const clerkResponse = await fetch(
     `${CLERK_API_BASE}/organizations/${team.clerk_org_id}/invitations`,
     {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify(invitationPayload)
     }
   );
   ```

3. **Clerk Sends Email** (automatic):
   - Email includes magic link with `__clerk_ticket` parameter
   - Link format: `https://icraftstories.com/accept-team-invitation?__clerk_ticket=XXXX&team_id=YYYY`

**Result:**
- ✅ Invitation created in Clerk system
- ✅ Email sent to invitee
- ✅ Invitation visible in Clerk dashboard
- ✅ Frontend receives invitation ID

---

### Step 2: User Receives Email & Clicks Link

**Email Content** (sent by Clerk):
```
You've been invited to join [Team Name]

To accept this invitation, click here:
https://icraftstories.com/accept-team-invitation?__clerk_ticket=ABC123&team_id=org_456
```

**URL Parameters:**
- `__clerk_ticket` - Clerk-generated invitation token (validates email, handles expiration)
- `team_id` - Team's Clerk organization ID (for redirect after acceptance)
- `__clerk_status` - Added by Clerk after processing ticket

---

### Step 3: Frontend Invitation Page

**Component:** `AcceptTeamInvitationPage.tsx`

**Three Scenarios Based on `__clerk_status`:**

#### Scenario A: `__clerk_status=sign_up` (New User)

**Flow:**
1. User clicks link, doesn't have account
2. Clerk sets `__clerk_status=sign_up`
3. Frontend shows Clerk's `<SignUp>` component
4. User creates account
5. Clerk automatically adds user to organization
6. Frontend receives organization membership via `useOrganization()` hook
7. Redirect to team page

**Code** (lines 379-406):
```typescript
if (status === 'sign_up') {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignUp
        appearance={{ /* styling */ }}
        routing="hash"
        signInUrl={`/accept-team-invitation?${searchParams.toString()}`}
        afterSignUpUrl={teamId ? `/teams/${teamId}` : '/teams-management'}
        localization={i18n.language === 'es' ? spanishTranslations : undefined}
      />
    </div>
  );
}
```

#### Scenario B: `__clerk_status=sign_in` (Existing User, Not Signed In)

**Flow:**
1. User clicks link, has account but not signed in
2. Clerk sets `__clerk_status=sign_in`
3. Frontend shows Clerk's `<SignIn>` component
4. User signs in
5. Clerk automatically adds user to organization
6. Frontend receives organization membership via `useOrganization()` hook
7. Redirect to team page

**Code** (lines 408-435):
```typescript
if (status === 'sign_in') {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn
        appearance={{ /* styling */ }}
        routing="hash"
        signUpUrl={`/accept-team-invitation?${searchParams.toString()}`}
        afterSignInUrl={teamId ? `/teams/${teamId}` : '/teams-management'}
        localization={i18n.language === 'es' ? spanishTranslations : undefined}
      />
    </div>
  );
}
```

#### Scenario C: `__clerk_status=complete` (Already Signed In)

**Flow:**
1. User clicks link, already signed in
2. Clerk sets `__clerk_status=complete`
3. Frontend shows **confirmation dialog** with warnings:
   - Stories will be transferred to team
   - Credits will be transferred to team
   - Individual subscription will be cancelled
4. User clicks "Accept Invitation"
5. Clerk adds user to organization (handles ticket validation)
6. Frontend detects organization membership change
7. Redirect to team page

**Code** (lines 351-377):
```typescript
if (status === 'complete' || isSignedIn) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <InvitationConfirmation
        teamId={teamId}
        onAccept={handleAcceptInvitation}
        onCancel={() => navigate('/teams-management')}
        accepting={accepting}
      />
    </div>
  );
}
```

---

### Step 4: Clerk Processes Acceptance

**What Clerk Does (Automatic):**

1. ✅ Validates invitation ticket (not expired, valid email)
2. ✅ Adds user to organization with `org:member` role
3. ✅ Updates invitation status to `accepted`
4. ✅ Triggers webhook: `organizationMembership.created`

**Frontend Detection** (lines 228-245):
```typescript
useEffect(() => {
  if (isLoaded && isSignedIn && organization && teamId) {
    logger.info('User successfully joined organization', {
      orgId: organization.id,
      teamId
    });

    toast({
      title: t('teams:joinSuccess', 'Successfully joined team'),
      description: t('teams:joinedTeam', { teamName: organization.name }),
    });

    setTimeout(() => {
      navigate(`/teams/${teamId}`, { replace: true });
    }, 2000);
  }
}, [isLoaded, isSignedIn, organization, teamId]);
```

---

### Step 5: Backend Webhook Processing

**Webhook:** `clerk-organization-webhooks.ts:handleMembershipCreated`

**Triggered By:** `organizationMembership.created` event from Clerk

**Processing** (lines 182-286):

1. **Create Team Member Record** (lines 214-250):
   ```typescript
   // Check if member already exists
   const { data: existingMember } = await supabase
     .from('team_members')
     .select('id, role')
     .eq('team_id', team.id)
     .eq('user_id', user.id)
     .single();

   if (existingMember) {
     // Update existing member
     await supabase
       .from('team_members')
       .update({
         role: memberRole,
         email: userEmail,
         updated_at: new Date().toISOString()
       })
       .eq('id', existingMember.id);
   } else {
     // Insert new member
     await supabase
       .from('team_members')
       .insert({
         team_id: team.id,
         user_id: user.id,
         role: memberRole,
         email: userEmail
       });
   }
   ```

2. **Call Onboarding Function** (lines 252-286):
   ```typescript
   // Transfer stories, credits, cancel subscription
   const { data: onboardingResult, error: onboardingError } = await supabase.rpc('onboard_team_member', {
     p_user_id: user.id,
     p_team_id: team.id
   });

   if (onboardingError) {
     context.log.error(`Onboarding failed for ${user.id}:`, onboardingError);
   } else {
     context.log.info(`Team member onboarded successfully:`, {
       userId: user.id,
       teamId: team.id,
       storiesTransferred: onboardingResult.stories_transferred,
       creditsTransferred: onboardingResult.credits_transferred,
       subscriptionCancelled: onboardingResult.subscription_cancelled
     });
   }
   ```

**Database Function:** `onboard_team_member()` (lines 23-162 in `team-member-onboarding.sql`):

```sql
CREATE OR REPLACE FUNCTION onboard_team_member(
  p_user_id TEXT,
  p_team_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_stories_transferred INTEGER := 0;
  v_credits_transferred INTEGER := 0;
  v_subscription_cancelled BOOLEAN := FALSE;
BEGIN
  -- Transfer all user stories to team
  UPDATE stories
  SET team_id = p_team_id
  WHERE user_id = p_user_id
    AND (team_id IS NULL OR team_id != p_team_id);

  GET DIAGNOSTICS v_stories_transferred = ROW_COUNT;

  -- Transfer all user credits to team
  SELECT transfer_all_user_credits_to_team(
    p_user_id,
    p_team_id,
    'Automatic transfer on team join'
  ) INTO v_credits_transferred;

  -- Cancel individual/trial subscription
  UPDATE subscriptions
  SET
    status = 'canceled',
    cancel_at_period_end = true,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
    AND plan_id IN (
      SELECT id FROM subscription_plans
      WHERE tier IN ('individual', 'trial')
    );

  GET DIAGNOSTICS v_subscription_cancelled = FOUND;

  -- Log team_join activity
  INSERT INTO activities (
    user_id, activity_type, entity_type, entity_id, entity_name,
    metadata, created_at
  )
  VALUES (
    p_user_id, 'team_join', 'team', p_team_id::TEXT,
    (SELECT name FROM teams WHERE id = p_team_id),
    jsonb_build_object(
      'stories_transferred', v_stories_transferred,
      'credits_transferred', v_credits_transferred,
      'subscription_cancelled', v_subscription_cancelled
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'stories_transferred', v_stories_transferred,
    'credits_transferred', v_credits_transferred,
    'subscription_cancelled', v_subscription_cancelled
  );
END;
$$ LANGUAGE plpgsql;
```

**Result:**
- ✅ User's personal stories → Team stories
- ✅ User's personal credits → Team credits
- ✅ User's individual/trial subscription → Cancelled
- ✅ Activity logged with transfer counts
- ✅ Frontend redirects to team page

---

## Invitation Decline Flow

### How Decline Works

**Three Ways to Decline:**

#### Option 1: Ignore the Email (Passive Decline)
- User simply doesn't click the invitation link
- Invitation remains `pending` in Clerk
- Invitation expires after Clerk's default timeout (typically 7 days)
- No audit trail in our system

#### Option 2: Explicit Decline by Invitee (Active Decline) ⭐ NEW
- User clicks invitation link and authenticates with Clerk
- Frontend shows invitation details with "Decline" and "Continue" buttons
- User clicks "Decline" button
- Backend logs decline to `activities` table with user_id
- User redirected to `/library` with toast notification
- Invitation expires naturally in Clerk (no revocation needed)

**Frontend Handler** (`AcceptTeamInvitationPage.tsx:350-377`):
```typescript
const handleDeclineInvitation = async () => {
  if (!teamId || !userId) {
    logger.error('Missing teamId or userId for decline');
    navigate('/library?declined=error', { replace: true });
    return;
  }

  try {
    const token = await getToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Call backend to log decline
    await teamService.declineInvitation(teamId, token);

    // Navigate to library with declined parameter
    navigate('/library?declined=true', { replace: true });
  } catch (error) {
    logger.error('Failed to decline invitation', error);
    // Still navigate even if logging fails
    navigate('/library?declined=error', { replace: true });
  }
};
```

**Backend Endpoint** (`clerk-team-invitations.ts:502-581`):
```typescript
/**
 * Decline team invitation (authenticated user)
 * POST /teams/onboarding/decline
 */
export async function declineTeamInvitation(request: ZuploRequest, context: ZuploContext) {
  // Get authenticated user from Clerk JWT
  const { requireUserId } = await import('./auth-utils');
  const userId = requireUserId(request, context);

  // Get teamId from request body
  const { teamId } = await request.json();

  // Get team name for activity log
  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .single();

  // Log decline to activities (best effort - don't fail if this fails)
  await supabase.from('activities').insert({
    user_id: userId,
    team_id: teamId,
    action_type: 'invitation_declined',
    entity_type: 'team_invitation',
    entity_id: teamId,
    metadata: {
      team_name: team?.name || 'Unknown',
      declined_at: new Date().toISOString(),
      source: 'accept_invitation_page',
      user_agent: request.headers.get('user-agent') || 'unknown'
    }
  });

  return new Response(JSON.stringify({ success: true }), {
    status: HttpStatusCode.OK,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Frontend Toast** (`StoryLibrary.tsx:93-120`):
```typescript
// Handle invitation decline notification
useSafeEffect(() => {
  const declined = searchParams.get('declined');

  if (declined) {
    if (declined === 'true') {
      toast({
        title: t('teams:invitationDeclined', 'Invitation Declined'),
        description: t('teams:invitationDeclinedMessage', 'You have declined the team invitation.'),
        variant: 'default',
      });
    } else if (declined === 'error') {
      toast({
        title: t('teams:invitationDeclineError', 'Decline Error'),
        description: t('teams:invitationDeclineErrorMessage', 'There was an error declining the invitation, but you can continue using the app.'),
        variant: 'default',
      });
    }

    // Remove declined parameter from URL
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('declined');
      return newParams;
    }, { replace: true });
  }
}, [searchParams, t, toast, setSearchParams], 'StoryLibrary-DeclineNotification');
```

**Result:**
- ✅ User's decline action logged with user_id and team_id
- ✅ Toast notification shown in Library
- ✅ Invitation expires naturally in Clerk (no manual revocation)
- ✅ Audit trail for reporting and analytics

#### Option 3: Revoke via Admin (Admin Action)
- Team admin goes to TeamManagementPage
- Clicks "Cancel Invitation" button
- Frontend calls: `DELETE /teams/{teamId}/invitations/{invitationId}`
- Backend calls Clerk API to revoke invitation
- Clerk updates invitation status to `revoked`
- Clerk triggers webhook: `organizationInvitation.revoked`

**Backend Handler** (`clerk-team-invitations.ts:407-490`):
```typescript
export async function cancelClerkTeamInvitation(request: ZuploRequest, context: ZuploContext) {
  const { teamId, invitationId } = request.params;

  // Call Clerk API to revoke invitation
  const response = await fetch(
    `${CLERK_API_BASE}/organizations/${clerkOrgId}/invitations/${invitationId}/revoke`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return { success: true };
}
```

**Webhook Handler** (`clerk-organization-webhooks.ts:handleInvitationRevoked`):
```typescript
async function handleInvitationRevoked(invitation: ClerkOrganizationInvitationEvent, context: ZuploContext) {
  context.log.info(`Invitation revoked: ${invitation.id} for ${invitation.email_address}`);

  // No action needed in our system since we don't store invitation state
  // The Clerk invitation system is the source of truth

  return new Response(JSON.stringify({ received: true }), {
    status: HttpStatusCode.OK,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## Why No Custom Accept/Decline Endpoints?

### Deprecated Methods in Frontend

**TeamInvitationService.ts** (lines 76-88):

```typescript
/**
 * Accept a team invitation - handled by Clerk directly
 * This method is deprecated as invitations are now handled by Clerk
 */
async acceptInvitation(token: string, userId: string, authToken: string): Promise<AcceptInvitationResponse> {
  logger.warn('acceptInvitation is deprecated - invitations are now handled by Clerk');
  throw new Error('Team invitations are now handled directly by Clerk. Please check your Clerk organization memberships.');
}

/**
 * Decline a team invitation - handled by Clerk directly
 * This method is deprecated as invitations are now handled by Clerk
 */
async declineInvitation(token: string): Promise<void> {
  logger.warn('declineInvitation is deprecated - invitations are now handled by Clerk');
  throw new Error('Team invitations are now handled directly by Clerk. Please decline through the Clerk invitation email.');
}
```

### Rationale for Deprecation

**Before (Custom Endpoints):**
- ❌ Backend stores invitation state in database
- ❌ Backend generates invitation tokens
- ❌ Backend validates tokens on accept
- ❌ Backend sends custom emails
- ❌ Backend handles invitation expiration
- ❌ Backend syncs state with Clerk
- ❌ Complex state management and edge cases

**After (Clerk-First):**
- ✅ Clerk stores invitation state
- ✅ Clerk generates secure tokens
- ✅ Clerk validates tokens automatically
- ✅ Clerk sends branded emails
- ✅ Clerk handles expiration
- ✅ Backend only processes webhooks
- ✅ Simple, reliable, battle-tested

---

## Complete Webhook Flow

### Clerk Organization Webhooks

**Endpoint:** `POST /clerk/organization-webhooks` (in `clerk-organization-webhooks.ts`)

**Webhook Events Handled:**

1. **`organizationInvitation.created`**
   - Triggered: When admin sends invitation via Clerk
   - Action: Log invitation created (no database action needed)

2. **`organizationInvitation.accepted`**
   - Triggered: When user accepts invitation (before membership created)
   - Action: Log acceptance (actual processing in membership.created)

3. **`organizationInvitation.revoked`**
   - Triggered: When admin cancels invitation
   - Action: Log revocation (no database action needed)

4. **`organizationMembership.created`** ⭐ (Most Important)
   - Triggered: When user joins organization (after accepting invitation)
   - Action:
     - Create/update `team_members` record
     - Call `onboard_team_member()` function
     - Transfer stories to team
     - Transfer credits to team
     - Cancel individual subscription
     - Log `team_join` activity

5. **`organizationMembership.deleted`**
   - Triggered: When user is removed from organization
   - Action: Delete `team_members` record

---

## Error Handling

### Pre-Invitation Validation Errors

**Frontend Receives:**
```json
{
  "status": 409,
  "code": "USER_ALREADY_IN_TEAM",
  "detail": "User is already a member of team \"Engineering Team\"",
  "metadata": {
    "existingTeamName": "Engineering Team",
    "existingTeamId": "org_abc123",
    "userRole": "member"
  }
}
```

**Frontend Displays** (`TeamInvitationDialog.tsx:96-106`):
```typescript
if (error.response?.data?.code === 'USER_ALREADY_IN_TEAM') {
  const metadata = error.response.data.metadata;
  const existingTeamName = metadata?.existingTeamName || 'another team';

  setErrorMessage(
    t('teams:alreadyInTeam',
      `This user is already a member of {{teamName}}. Users can only belong to one team at a time.`,
      { teamName: existingTeamName }
    )
  );
}
```

### Invitation Acceptance Errors

**Clerk Handles:**
- Invalid/expired tokens → Clerk shows error page
- Already accepted → Clerk redirects to organization
- Email mismatch → Clerk shows error

**Backend Webhook Errors:**
- Onboarding failure → Logged but user still added to team
- Story transfer failure → Logged but user still added to team
- Credit transfer failure → Logged but user still added to team

**Philosophy:** Fail gracefully - better to add user to team with incomplete transfer than block them entirely.

---

## Security Considerations

### Why Clerk-First is Secure

1. **Token Generation**: Clerk uses cryptographically secure tokens
2. **Email Verification**: Clerk validates email ownership
3. **Expiration**: Clerk handles automatic expiration
4. **Rate Limiting**: Clerk prevents invitation spam
5. **Audit Trail**: Clerk logs all invitation events

### Backend Security Measures

1. **Pre-Flight Validation**: Check one-team-per-user BEFORE sending invitation
2. **Webhook Validation**: Verify Clerk webhook signatures
3. **Database Constraints**: `UNIQUE(user_id)` on `team_members` table
4. **Idempotency**: Onboarding function can be called multiple times safely

---

## Testing & Monitoring

### Testing Invitation Flow

**Manual Test Steps:**

1. **Create Invitation:**
   ```bash
   # Frontend: TeamManagementPage → "Invite Member"
   # Backend: POST /teams/invite
   # Verify: Email received with correct link
   ```

2. **Accept as New User:**
   ```bash
   # Click email link
   # Verify: SignUp component shown
   # Create account
   # Verify: Redirected to team page
   # Verify: Stories/credits transferred
   ```

3. **Accept as Existing User:**
   ```bash
   # Click email link (signed out)
   # Verify: SignIn component shown
   # Sign in
   # Verify: Redirected to team page
   # Verify: Stories/credits transferred
   ```

4. **Accept as Signed-In User:**
   ```bash
   # Click email link (signed in)
   # Verify: Confirmation dialog shown
   # Click "Accept"
   # Verify: Redirected to team page
   # Verify: Stories/credits transferred
   ```

5. **Revoke Invitation:**
   ```bash
   # Frontend: TeamManagementPage → "Cancel Invitation"
   # Backend: DELETE /teams/{teamId}/invitations/{invitationId}
   # Verify: Invitation revoked in Clerk
   # Verify: Link no longer works
   ```

### Monitoring

**Webhook Success:**
```sql
-- Check recent membership webhooks
SELECT log_type, log_message, metadata, created_at
FROM system_logs
WHERE log_type LIKE 'webhook%'
  AND log_message LIKE '%membership%'
ORDER BY created_at DESC
LIMIT 10;
```

**Onboarding Results:**
```sql
-- Check team_join activities
SELECT user_id, entity_name as team_name,
       metadata->>'stories_transferred' as stories,
       metadata->>'credits_transferred' as credits,
       metadata->>'subscription_cancelled' as sub_cancelled,
       created_at
FROM activities
WHERE activity_type = 'team_join'
ORDER BY created_at DESC
LIMIT 10;
```

**Failed Onboardings:**
```sql
-- Check for webhook errors
SELECT log_type, log_message, metadata->>'error' as error, created_at
FROM system_logs
WHERE log_type = 'webhook_error'
  AND log_message LIKE '%onboard%'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Summary

### How Accept Works ✅

1. **User receives email from Clerk** with magic link
2. **User clicks link** → Frontend shows appropriate auth/confirmation UI
3. **Clerk validates token** and adds user to organization
4. **Backend receives webhook** (`organizationMembership.created`)
5. **Backend calls `onboard_team_member()`** to transfer stories/credits
6. **Frontend detects organization membership** and redirects to team page

### How Decline Works ✅

**Option 1 (Passive):**
- User ignores email → Invitation expires automatically (Clerk handles)

**Option 2 (Active):**
- Admin clicks "Cancel Invitation" → Backend calls Clerk API to revoke
- Clerk updates status to `revoked` → Link no longer works

### Why No Custom Endpoints ✅

- Clerk is the **single source of truth** for invitation state
- Backend only validates pre-conditions and processes post-acceptance
- Simpler, more reliable, more secure than custom implementation

### Key Takeaway 🎯

**Accept and decline are NOT API operations - they are Clerk-native flows that our backend observes and reacts to via webhooks.**

---

**Last Updated:** 2025-10-30
**Architecture:** Clerk-First Organization Invitations
**Status:** ✅ FULLY IMPLEMENTED
