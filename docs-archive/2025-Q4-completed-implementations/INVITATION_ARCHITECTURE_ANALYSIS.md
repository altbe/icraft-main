# Team Invitation Architecture Analysis

**Date:** 2025-10-30
**Question:** Should we implement a Zuplo-based invitation acceptance endpoint authenticated via Clerk?

---

## Executive Summary

**Recommendation:** ✅ **YES - Implement Zuplo invitation acceptance endpoint**

**Why:** Current Clerk-only flow has gaps in user experience and control. A hybrid approach (Clerk for state + Zuplo for acceptance logic) provides:
1. ✅ Better error handling and user feedback
2. ✅ Pre-acceptance validation (ToS, team limits)
3. ✅ Atomic credit/story transfer with confirmation
4. ✅ Consistent API patterns with rest of system
5. ✅ Easier debugging and monitoring

---

## Current Architecture (Clerk-First)

### How It Works Now

**Flow:**
1. Backend calls Clerk API to create invitation
2. Clerk sends email with magic link containing `__clerk_ticket`
3. User clicks link → Frontend renders auth UI or confirmation
4. **Clerk handles acceptance internally** (black box)
5. Clerk triggers webhook `organizationMembership.created`
6. Backend receives webhook and calls `onboard_team_member()`

**Current Implementation:**
```
User clicks email → Frontend (AcceptTeamInvitationPage.tsx)
                  → Clerk SDK processes ticket (internal)
                  → Clerk adds user to organization
                  → Webhook to backend
                  → Backend processes transfer
```

---

## Problems with Current Architecture

### 1. **No Control Over Acceptance Process**

**Issue:** Clerk processes invitation acceptance as a black box.

**Impact:**
- Cannot validate ToS acceptance before adding user
- Cannot show transfer preview with confirmation
- Cannot prevent acceptance if user already in another team
- Cannot provide custom error messages

**Example Failure Scenario:**
```
User clicks invitation link
→ Clerk immediately adds user to organization (we don't control timing)
→ Backend webhook fires
→ Backend discovers user already in team
→ Backend must remove user from organization (messy rollback)
→ User sees confusing error after "success"
```

### 2. **Race Condition Between Frontend & Webhook**

**Issue:** Frontend detects organization membership before webhook completes.

**Frontend Code** (`AcceptTeamInvitationPage.tsx:228-245`):
```typescript
useEffect(() => {
  if (isLoaded && isSignedIn && organization && teamId) {
    // User joined organization - redirect immediately
    navigate(`/teams/${teamId}`, { replace: true });
  }
}, [isLoaded, isSignedIn, organization, teamId]);
```

**Problem:**
- Frontend redirects as soon as organization membership detected
- Webhook might still be processing story/credit transfer
- User sees team page before stories appear
- Creates confusion: "Where are my stories?"

**Current Workaround:**
```typescript
setTimeout(() => {
  navigate(`/teams/${teamId}`, { replace: true });
}, 2000); // Hope webhook finishes in 2 seconds?
```

### 3. **Limited Error Handling**

**Issue:** Cannot intercept Clerk errors or provide custom error messages.

**Current Errors:**
- Invalid token → Clerk shows generic error page
- Expired invitation → Clerk shows generic error page
- Email mismatch → Clerk shows generic error page
- Already in team → User added, then removed (bad UX)

**What We Want:**
- Invalid token → "This invitation has expired. Please request a new one from your team admin."
- Already in team → "You're already a member of [Team Name]. Please leave that team first."
- ToS not accepted → "Please accept our Terms of Service to join this team."

### 4. **No Pre-Flight Validation**

**Issue:** Can't check conditions before acceptance.

**Missing Checks:**
- Is user already in a team? (one-team-per-user)
- Has user accepted current ToS version?
- Does user have active individual subscription that will be cancelled?
- Does team have available slots? (future feature)

**Current Flow:**
```
Accept → Add to organization → Webhook → Discover problem → Rollback (messy)
```

**Better Flow:**
```
Accept → Validate → Transfer → Add to organization → Success (clean)
```

### 5. **Webhook Dependency for Core Flow**

**Issue:** Critical business logic depends on webhook delivery.

**Risks:**
- Webhook fails → User in organization but stories/credits not transferred
- Webhook delayed → User sees empty team
- Webhook retry → Duplicate transfers (need idempotency)
- Webhook order → Wrong sequence (invitation.accepted before membership.created)

**Current Mitigation:**
- `onboard_team_member()` is idempotent
- Frontend has 5-second timeout fallback
- Logs webhook failures

**But:**
- Still creates bad UX during webhook delays
- Hard to debug when webhook failures occur
- Cannot retry from user perspective

### 6. **Debugging Challenges**

**Issue:** Black box makes troubleshooting difficult.

**What We Can't See:**
- Why did Clerk reject the ticket?
- What validation failed?
- When exactly did Clerk process the invitation?
- What was the exact sequence of events?

**What We Can See:**
- Webhook arrived (after the fact)
- Logs from our webhook handler
- Final database state

---

## Proposed Architecture (Zuplo Hybrid)

### How It Would Work

**Flow:**
1. Backend calls Clerk API to create invitation ✅ (keep as-is)
2. Clerk sends email with magic link ✅ (keep as-is)
3. User clicks link → **Zuplo endpoint** (NEW)
4. Zuplo validates token, checks conditions, transfers assets
5. Zuplo calls Clerk API to add user to organization
6. Zuplo returns success with transfer results
7. Frontend redirects with complete data

**Proposed Implementation:**
```
User clicks email → Zuplo API Endpoint (NEW)
                  ↓
                  Validate Clerk invitation token
                  ↓
                  Validate ToS acceptance
                  ↓
                  Validate one-team-per-user
                  ↓
                  Call onboard_team_member()
                  ↓
                  Add user to Clerk organization
                  ↓
                  Return success with results
                  ↓
                  Frontend shows complete results
```

---

## Benefits of Zuplo Approach

### 1. ✅ **Complete Control Over Acceptance**

**Before (Clerk-First):**
```typescript
// Frontend - no control
<SignIn /> // Clerk decides when to accept
```

**After (Zuplo):**
```typescript
// Frontend
const response = await api.post('/teams/invitations/accept', {
  invitationToken: ticket,
  acceptedToS: true
}, { headers: authHeaders });

// Backend - full control
export async function acceptTeamInvitation(request, context) {
  // 1. Validate Clerk token
  // 2. Check ToS acceptance
  // 3. Validate one-team-per-user
  // 4. Transfer stories/credits atomically
  // 5. Add to Clerk organization
  // 6. Return complete results
}
```

### 2. ✅ **Pre-Acceptance Validation**

**Checks Before Adding to Organization:**
```typescript
// Validate invitation token with Clerk
const invitation = await validateClerkInvitation(ticket);
if (!invitation.valid) {
  return HttpProblems.badRequest(request, context, {
    detail: 'Invalid or expired invitation'
  });
}

// Check ToS acceptance
if (!acceptedToS) {
  return HttpProblems.forbidden(request, context, {
    detail: 'Terms of Service acceptance required',
    code: 'TOS_ACCEPTANCE_REQUIRED'
  });
}

// Check one-team-per-user
const existingMembership = await checkUserTeamMembership(userId);
if (existingMembership) {
  return HttpProblems.conflict(request, context, {
    detail: `Already a member of ${existingMembership.teamName}`,
    code: 'USER_ALREADY_IN_TEAM',
    metadata: { existingTeamName: existingMembership.teamName }
  });
}

// All checks passed - safe to proceed
```

### 3. ✅ **Atomic Transfer with Confirmation**

**Single Transaction:**
```typescript
// Transfer everything before adding to organization
const transferResult = await supabase.rpc('onboard_team_member', {
  p_user_id: userId,
  p_team_id: teamId
});

// Only add to organization if transfer succeeds
if (transferResult.error) {
  return HttpProblems.internalServerError(request, context, {
    detail: 'Transfer failed - you have not been added to the team'
  });
}

// Transfer succeeded - now add to organization
await addUserToClerkOrganization(userId, organizationId);

// Return complete results
return {
  success: true,
  team: { id: teamId, name: teamName },
  transfer: {
    storiesTransferred: transferResult.stories_transferred,
    creditsTransferred: transferResult.credits_transferred,
    subscriptionCancelled: transferResult.subscription_cancelled
  }
};
```

### 4. ✅ **Better Error Messages**

**Specific Error Codes:**
```typescript
// Frontend can show contextual errors
try {
  await acceptInvitation(token);
} catch (error) {
  switch (error.response.data.code) {
    case 'INVITATION_EXPIRED':
      showError('This invitation has expired. Please request a new one.');
      break;
    case 'USER_ALREADY_IN_TEAM':
      const teamName = error.response.data.metadata.existingTeamName;
      showError(`You're already in ${teamName}. Please leave that team first.`);
      break;
    case 'TOS_ACCEPTANCE_REQUIRED':
      showToSDialog();
      break;
    default:
      showError('Failed to accept invitation');
  }
}
```

### 5. ✅ **Synchronous Response**

**No More Webhook Dependency:**
```typescript
// OLD (Webhook-based)
Accept → Clerk adds user → Wait for webhook → Transfer (2-10 seconds)
Frontend: "Joining team..." (spinner for unknown duration)

// NEW (Synchronous)
Accept → Transfer → Add to Clerk → Return (500-1000ms)
Frontend: Shows exact results immediately
```

### 6. ✅ **Easier Debugging**

**Complete Visibility:**
```typescript
// Every step logged in single request
context.log.info('Step 1: Validating invitation token', { ticket });
context.log.info('Step 2: Checking ToS acceptance', { accepted: true });
context.log.info('Step 3: Validating team membership', { existing: null });
context.log.info('Step 4: Transferring assets', { storiesTransferred: 5 });
context.log.info('Step 5: Adding to organization', { orgId, userId });
context.log.info('Step 6: Success', { totalTime: '850ms' });

// vs current webhook-based approach
// Webhook logs appear seconds later, in separate request
```

### 7. ✅ **Consistent API Pattern**

**Matches Rest of System:**
```typescript
// Current pattern for other operations
POST /credits/transfer          // Zuplo endpoint
POST /subscriptions/purchase    // Zuplo endpoint
POST /stories/{id}/copy         // Zuplo endpoint

// New invitation pattern (consistent)
POST /teams/invitations/accept  // Zuplo endpoint
```

---

## Proposed Implementation

### Backend Endpoint

**Route:** `POST /teams/invitations/accept` (new)

**Handler:** `modules/team-invitation-acceptance.ts` (new file)

```typescript
import { ZuploRequest, ZuploContext } from '@zuplo/runtime';
import { HttpProblems } from '@zuplo/runtime';
import { createClient } from '@supabase/supabase-js';

const CLERK_API_BASE = 'https://api.clerk.com/v1';

/**
 * Accept team invitation with full control over validation and transfer
 *
 * POST /teams/invitations/accept
 * Body: {
 *   invitationToken: string,    // Clerk invitation token from email
 *   acceptedToS: boolean         // User must accept ToS
 * }
 */
export async function acceptTeamInvitation(
  request: ZuploRequest,
  context: ZuploContext
) {
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    return HttpProblems.unauthorized(request, context);
  }

  const { invitationToken, acceptedToS } = await request.json();

  // Step 1: Validate Clerk invitation token
  context.log.info('Step 1: Validating Clerk invitation token');
  const invitation = await validateClerkInvitation(invitationToken, context);

  if (!invitation.valid) {
    return HttpProblems.badRequest(request, context, {
      detail: invitation.error || 'Invalid or expired invitation',
      code: 'INVITATION_INVALID'
    });
  }

  const teamId = invitation.metadata.team_id;
  const teamName = invitation.metadata.team_name;
  const organizationId = invitation.organization_id;

  // Step 2: Validate ToS acceptance
  context.log.info('Step 2: Checking ToS acceptance');
  if (!acceptedToS) {
    return HttpProblems.forbidden(request, context, {
      detail: 'Terms of Service acceptance required to join team',
      code: 'TOS_ACCEPTANCE_REQUIRED'
    });
  }

  // Step 3: Validate one-team-per-user
  context.log.info('Step 3: Validating team membership');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: existingMembership } = await supabase
    .from('team_members')
    .select('team_id, teams(name)')
    .eq('user_id', userId)
    .single();

  if (existingMembership) {
    return HttpProblems.conflict(request, context, {
      detail: `You are already a member of ${existingMembership.teams.name}`,
      code: 'USER_ALREADY_IN_TEAM',
      metadata: {
        existingTeamName: existingMembership.teams.name,
        existingTeamId: existingMembership.team_id
      }
    });
  }

  // Step 4: Transfer stories, credits, cancel subscription (atomic)
  context.log.info('Step 4: Transferring assets');
  const { data: transferResult, error: transferError } = await supabase.rpc(
    'onboard_team_member',
    {
      p_user_id: userId,
      p_team_id: teamId
    }
  );

  if (transferError) {
    context.log.error('Asset transfer failed:', transferError);
    return HttpProblems.internalServerError(request, context, {
      detail: 'Failed to transfer assets. You have not been added to the team.',
      code: 'TRANSFER_FAILED'
    });
  }

  // Step 5: Add user to Clerk organization
  context.log.info('Step 5: Adding user to Clerk organization');
  const acceptResponse = await fetch(
    `${CLERK_API_BASE}/organizations/${organizationId}/invitations/${invitation.id}/accept`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!acceptResponse.ok) {
    // Rollback transfer
    context.log.error('Failed to add to Clerk organization - rolling back');
    // Note: onboard_team_member needs rollback function
    await supabase.rpc('rollback_team_member_onboarding', {
      p_user_id: userId,
      p_team_id: teamId
    });

    return HttpProblems.internalServerError(request, context, {
      detail: 'Failed to add to team organization',
      code: 'CLERK_ACCEPTANCE_FAILED'
    });
  }

  // Step 6: Record ToS acceptance
  await supabase.from('tos_acceptances').insert({
    user_id: userId,
    version: 'current',
    accepted_at: new Date().toISOString(),
    acceptance_method: 'team_invitation'
  });

  // Step 7: Return success with complete results
  context.log.info('Step 7: Success', {
    userId,
    teamId,
    storiesTransferred: transferResult.stories_transferred,
    creditsTransferred: transferResult.credits_transferred
  });

  return {
    success: true,
    team: {
      id: teamId,
      name: teamName,
      organization_id: organizationId
    },
    transfer: {
      stories_transferred: transferResult.stories_transferred,
      credits_transferred: transferResult.credits_transferred,
      subscription_cancelled: transferResult.subscription_cancelled
    }
  };
}

/**
 * Validate Clerk invitation token
 */
async function validateClerkInvitation(
  token: string,
  context: ZuploContext
): Promise<{
  valid: boolean;
  error?: string;
  id?: string;
  organization_id?: string;
  metadata?: any;
}> {
  try {
    // Query Clerk API for invitation details
    const response = await fetch(
      `${CLERK_API_BASE}/invitations/${token}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`
        }
      }
    );

    if (!response.ok) {
      return { valid: false, error: 'Invalid or expired invitation' };
    }

    const invitation = await response.json();

    // Check invitation status
    if (invitation.status !== 'pending') {
      return {
        valid: false,
        error: `Invitation already ${invitation.status}`
      };
    }

    return {
      valid: true,
      id: invitation.id,
      organization_id: invitation.organization_id,
      metadata: invitation.public_metadata
    };
  } catch (error) {
    context.log.error('Error validating Clerk invitation:', error);
    return { valid: false, error: 'Failed to validate invitation' };
  }
}
```

### Frontend Changes

**Update:** `AcceptTeamInvitationPage.tsx`

**Replace Clerk-direct acceptance with API call:**

```typescript
const handleAcceptInvitation = async () => {
  setAccepting(true);
  setError(null);

  try {
    const token = await getToken();

    // NEW: Call Zuplo endpoint instead of relying on Clerk
    const response = await apiClient.post(
      '/teams/invitations/accept',
      {
        invitationToken: ticket,
        acceptedToS: true
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId
        }
      }
    );

    // Show success with exact transfer results
    toast({
      title: t('teams:joinSuccess', 'Successfully joined team'),
      description: t('teams:transferComplete', {
        stories: response.data.transfer.stories_transferred,
        credits: response.data.transfer.credits_transferred
      })
    });

    // Redirect immediately (no waiting for webhook)
    navigate(`/teams/${response.data.team.id}`, { replace: true });

  } catch (err: any) {
    // Show specific error based on code
    if (err.response?.data?.code === 'USER_ALREADY_IN_TEAM') {
      const teamName = err.response.data.metadata.existingTeamName;
      setError(`You're already in ${teamName}. Please leave that team first.`);
    } else if (err.response?.data?.code === 'TOS_ACCEPTANCE_REQUIRED') {
      // Show ToS dialog
      setShowToSDialog(true);
    } else {
      setError(err.response?.data?.detail || 'Failed to accept invitation');
    }
  } finally {
    setAccepting(false);
  }
};
```

### Database Addition

**Rollback Function** (needed for error recovery):

```sql
CREATE OR REPLACE FUNCTION rollback_team_member_onboarding(
  p_user_id TEXT,
  p_team_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Revert story transfers
  UPDATE stories
  SET team_id = NULL
  WHERE user_id = p_user_id
    AND team_id = p_team_id;

  -- Revert credit transfers (create reversal transactions)
  INSERT INTO credit_transactions (
    user_id, team_id, amount, transaction_type, description
  )
  SELECT
    user_id,
    NULL, -- Back to personal
    -amount, -- Negative to reverse
    'transfer_reversal',
    'Rollback: Invitation acceptance failed'
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND team_id = p_team_id
    AND transaction_type = 'team_transfer'
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Reactivate subscription if it was cancelled
  UPDATE subscriptions
  SET
    status = 'active',
    cancel_at_period_end = false,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND status = 'canceled'
    AND updated_at > NOW() - INTERVAL '5 minutes';

  -- Delete team_join activity
  DELETE FROM activities
  WHERE user_id = p_user_id
    AND entity_id = p_team_id::TEXT
    AND activity_type = 'team_join'
    AND created_at > NOW() - INTERVAL '5 minutes';

END;
$$ LANGUAGE plpgsql;
```

---

## Migration Path

### Phase 1: Implement Zuplo Endpoint (Parallel)

1. ✅ Create new endpoint `POST /teams/invitations/accept`
2. ✅ Add rollback function to database
3. ✅ Deploy to development
4. ✅ Test with real Clerk invitations
5. ✅ Deploy to QA

**Risk:** Low - new endpoint doesn't affect existing flow

### Phase 2: Update Frontend (Feature Flag)

1. ✅ Add feature flag `USE_ZUPLO_INVITATION_ACCEPTANCE`
2. ✅ Update `AcceptTeamInvitationPage.tsx` with conditional logic
3. ✅ Test both flows (Clerk-direct and Zuplo)
4. ✅ Deploy to QA with flag OFF
5. ✅ Enable flag for internal testing

**Risk:** Low - feature flag allows rollback

### Phase 3: Gradual Rollout

1. ✅ Enable for 10% of users
2. ✅ Monitor error rates and success rates
3. ✅ Enable for 50% of users
4. ✅ Monitor for 24 hours
5. ✅ Enable for 100% of users

**Risk:** Medium - gradual rollout allows early detection

### Phase 4: Cleanup (After 30 Days)

1. ✅ Remove Clerk-direct acceptance code
2. ✅ Remove feature flag
3. ✅ Update documentation

**Risk:** Low - sufficient production validation

---

## Comparison: Current vs Proposed

| Aspect | Current (Clerk-First) | Proposed (Zuplo Hybrid) |
|--------|----------------------|------------------------|
| **Control** | ❌ Black box | ✅ Full control |
| **Validation** | ❌ After acceptance | ✅ Before acceptance |
| **Error Messages** | ❌ Generic Clerk errors | ✅ Custom contextual errors |
| **Response Time** | ❌ 2-10 seconds (webhook) | ✅ 500-1000ms (synchronous) |
| **Debugging** | ❌ Limited visibility | ✅ Complete request logs |
| **UX** | ❌ "Joining..." spinner | ✅ Immediate results |
| **Rollback** | ❌ Manual removal | ✅ Automatic rollback |
| **ToS Enforcement** | ❌ Cannot enforce | ✅ Enforced before acceptance |
| **Implementation** | ✅ Already working | ⚠️ Requires development |
| **Maintenance** | ✅ Clerk maintains | ⚠️ We maintain |

---

## Risks & Mitigation

### Risk 1: Clerk API Changes

**Risk:** Clerk changes invitation API, breaking our integration

**Likelihood:** Low (stable API)

**Mitigation:**
- Version Clerk SDK
- Monitor Clerk changelog
- Test new Clerk versions in QA before production
- Keep Clerk-direct flow as fallback

### Risk 2: Webhook Still Fires

**Risk:** Clerk webhook fires after our endpoint completes, causing duplicate processing

**Likelihood:** High (webhook will still be configured)

**Mitigation:**
- Make `onboard_team_member()` idempotent (already done)
- Add `processed_via` field to track acceptance source
- Webhook checks if already processed via API endpoint
- Log but skip processing if already handled

```typescript
// In webhook handler
const { data: member } = await supabase
  .from('team_members')
  .select('processed_via')
  .eq('user_id', userId)
  .eq('team_id', teamId)
  .single();

if (member?.processed_via === 'api_endpoint') {
  context.log.info('Already processed via API endpoint - skipping webhook');
  return new Response(JSON.stringify({ received: true, skipped: true }), {
    status: 200
  });
}
```

### Risk 3: Increased Latency

**Risk:** API endpoint adds latency compared to Clerk-direct

**Likelihood:** Low (should be faster)

**Mitigation:**
- Optimize database queries
- Use parallel operations where possible
- Monitor response times
- Set timeout at 5 seconds (still faster than current webhook)

### Risk 4: More Code to Maintain

**Risk:** Custom endpoint requires ongoing maintenance

**Likelihood:** Medium

**Mitigation:**
- Comprehensive tests (unit + integration)
- Monitor error rates in production
- Document common issues and solutions
- Keep implementation simple

---

## Recommendation

### ✅ YES - Implement Zuplo Endpoint

**Primary Reasons:**

1. **Better UX** - Immediate feedback, no waiting for webhooks
2. **Pre-Validation** - Catch issues before adding to organization
3. **Error Handling** - Custom, actionable error messages
4. **Debugging** - Single request trace, not scattered webhook logs
5. **Control** - We decide when and how acceptance happens

**Implementation Effort:** 8-12 hours
- Backend endpoint: 4-6 hours
- Frontend updates: 2-3 hours
- Testing: 2-3 hours

**Risk Level:** Low-Medium
- Can implement in parallel with existing flow
- Feature flag allows gradual rollout
- Webhook as fallback if API fails

### Alternative: Keep Clerk-First

**Only if:**
- Cannot spare 8-12 hours development time
- Current issues are rare edge cases
- Webhook reliability is acceptable
- Limited control is acceptable

**But:**
- Issues will persist (race conditions, unclear errors)
- Harder to add features (ToS enforcement, team limits)
- Debugging remains challenging

---

## Next Steps (If Approved)

### Week 1: Implementation
1. Create backend endpoint `POST /teams/invitations/accept`
2. Add rollback function to database
3. Update frontend with feature flag
4. Write unit tests for endpoint

### Week 2: Testing
1. Deploy to development
2. Test with real Clerk invitations
3. Test error scenarios
4. Deploy to QA

### Week 3: Rollout
1. Enable for 10% users
2. Monitor for 48 hours
3. Enable for 50% users
4. Monitor for 24 hours
5. Enable for 100% users

### Week 4: Cleanup
1. Monitor for issues
2. Document lessons learned
3. Remove old code if stable
4. Update documentation

---

## Conclusion

The current Clerk-first approach works but has significant limitations in control, error handling, and user experience. Implementing a Zuplo-based acceptance endpoint gives us:

✅ Full control over the acceptance process
✅ Better error messages and pre-validation
✅ Synchronous response (no webhook delays)
✅ Easier debugging and monitoring
✅ Consistent with our API patterns

The effort is reasonable (8-12 hours), the risk is manageable (feature flag + gradual rollout), and the benefits are substantial (better UX, easier debugging, more control).

**Recommendation: Proceed with Zuplo hybrid implementation.**

---

**Last Updated:** 2025-10-30
**Decision Required:** Approve/reject Zuplo invitation acceptance endpoint
**Estimated Effort:** 8-12 hours development + 2 weeks rollout
