# Team-Only Model Design Document

**Version**: 1.1
**Date**: 2025-10-20
**Status**: Ready for Review

**v1.1 Update**: Improved schema design using `owner_type` discriminator instead of separate `team_id` column for simpler schema and better performance.

## Executive Summary

This document specifies the **Team-Only Model** architecture where users on Team Business Plan have ALL their stories belong to their team, with no personal story management. This approach eliminates the complexity of managing personal vs team stories and provides a clearer business model.

### Key Design Decisions

1. **Two User States**:
   - **Individual Plan Users**: Personal stories only, no team features
   - **Team Business Plan Users**: All stories belong to team, no personal stories

2. **Migration Flow**: On team creation or accepting team invitation:
   - Show dialog warning that ALL personal stories + credits will be transferred to team
   - User must explicitly accept (or decline and cancel)
   - Migration happens atomically - all stories + credits transfer together

3. **Simplifications**:
   - No context switching in Library UI
   - No personal/team story distinction for Team Business Plan users
   - Single credit pool (team credits)
   - Single story list (team stories)

---

## 1. Architecture Overview

### User States and Story Ownership

```
┌─────────────────────────────────────────────────────────────────┐
│                     INDIVIDUAL PLAN USER                         │
│                                                                  │
│  Stories: Personal stories only                                  │
│  Credits: Personal credit balance                                │
│  Library: Shows personal stories                                 │
│  Features: Cannot create/join teams                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 TEAM BUSINESS PLAN USER (in team)                │
│                                                                  │
│  Stories: ALL stories belong to team                             │
│  Credits: Team credit pool (shared with 5 members)               │
│  Library: Shows team stories                                     │
│  Features: Collaborate with team members on all stories          │
└─────────────────────────────────────────────────────────────────┘
```

### Business Logic Rules

| Scenario | Story Ownership | Credit Source | Library View |
|----------|----------------|---------------|--------------|
| Individual Plan user | User's personal stories | Personal credits | Personal stories only |
| Team Business Plan owner creates team | All personal stories migrate to team | Personal credits transfer to team | Team stories only |
| Team Business Plan member joins team | All personal stories migrate to team | Personal credits transfer to team | Team stories only |
| Team member leaves team | Stories remain with team | No credit transfer | Back to empty personal library |

**Critical Rule**: Once stories migrate to team, they cannot be transferred back. If user leaves team, they start with empty personal story library.

---

## 2. User Flows

### Flow 1: Team Owner Creates Team

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: User clicks "Create Team"                                │
│   - User has Team Business Plan subscription                     │
│   - User has N personal stories and M credits                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Create Team Dialog Opens                                 │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐   │
│   │  Create Team                                           │   │
│   │                                                        │   │
│   │  Team Name: [________________]                         │   │
│   │                                                        │   │
│   │  ⚠️  Migration Notice                                  │   │
│   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│   │
│   │  When you create a team, the following will be        │   │
│   │  transferred to your team:                             │   │
│   │                                                        │   │
│   │  • All personal stories (N stories)                    │   │
│   │  • All personal credits (M credits)                    │   │
│   │                                                        │   │
│   │  This action cannot be undone. Your team will own     │   │
│   │  these stories, and all team members will be able to  │   │
│   │  view and edit them.                                   │   │
│   │                                                        │   │
│   │  [Cancel]  [Create Team and Transfer All]             │   │
│   └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: User Clicks "Create Team and Transfer All"               │
│   - Backend creates team                                         │
│   - Backend migrates stories (owner_id stays, owner_type='team') │
│   - Backend transfers M credits to team                          │
│   - Frontend navigates to team management page                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Success                                                  │
│   - User sees team with N stories in Library                     │
│   - Team credit balance shows M credits                          │
│   - Activity log shows "Created team with N stories transferred" │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 2: Team Member Accepts Invitation

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: User receives team invitation email from Clerk           │
│   - User clicks link in email                                    │
│   - Clerk handles authentication                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: User lands on invitation acceptance page                 │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐   │
│   │  Team Invitation                                       │   │
│   │                                                        │   │
│   │  You've been invited to join "Acme Team"              │   │
│   │  Role: Member                                          │   │
│   │                                                        │   │
│   │  ⚠️  Migration Notice                                  │   │
│   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│   │
│   │  When you accept this invitation, the following will  │   │
│   │  be transferred to the team:                           │   │
│   │                                                        │   │
│   │  • All your personal stories (N stories)               │   │
│   │  • All your personal credits (M credits)               │   │
│   │                                                        │   │
│   │  This action cannot be undone. The team will own      │   │
│   │  these stories, and all team members will be able to  │   │
│   │  view and edit them.                                   │   │
│   │                                                        │   │
│   │  [Decline]  [Accept and Transfer All]                 │   │
│   └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: User Clicks "Accept and Transfer All"                    │
│   - Backend adds user to team_members                            │
│   - Backend migrates stories (owner_id=team_id, owner_type='team')│
│   - Backend transfers M credits to team                          │
│   - Frontend navigates to team page                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Success                                                  │
│   - User sees team stories (including their migrated stories)    │
│   - Team credit balance increased by M                           │
│   - Activity log shows "User joined with N stories transferred"  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Changes

### Stories Table Update

**Design Decision**: Reuse `owner_id` column with type discriminator instead of adding separate `team_id` column.

**Benefits**:
- Simpler schema (no nullable columns)
- Better query performance (single composite index)
- Clearer semantics (owner concept works for both users and teams)
- Easier migration logic (update in place, not move between columns)

```sql
-- Add owner_type discriminator column
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

-- owner_id now contains either a user ID or team ID
-- owner_type indicates which type of entity owns the story

-- Create efficient composite index
CREATE INDEX idx_stories_owner ON stories(owner_id, owner_type);

-- Keep created_by for permission checks (always a user ID)
-- created_by already exists in stories table
CREATE INDEX idx_stories_created_by ON stories(created_by);

-- Add constraint: owner_id must not be null
ALTER TABLE stories
ADD CONSTRAINT chk_story_owner_not_null
  CHECK (owner_id IS NOT NULL);
```

**Schema After Migration**:
```sql
stories {
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,           -- User ID or Team ID
  owner_type TEXT NOT NULL,          -- 'user' | 'team'
  created_by TEXT NOT NULL,          -- Always user ID (for permissions)
  title TEXT,
  content JSONB,
  -- ... other fields
}
```

### Migration Tracking

```sql
-- Add metadata to activities table to track story migrations
-- (activities table already exists, no schema change needed)
-- We'll use metadata JSONB field to store:
--   - storiesMigrated: number of stories migrated
--   - creditsTransferred: number of credits transferred
```

---

## 4. Stored Procedure Updates

### New Procedure: `create_team_with_stories_migration()`

```sql
CREATE OR REPLACE FUNCTION create_team_with_stories_migration(
  p_owner_id TEXT,
  p_team_name TEXT,
  p_team_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  team_id TEXT,
  stories_migrated INTEGER,
  credits_transferred INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id TEXT;
  v_stories_count INTEGER;
  v_credits_amount INTEGER;
BEGIN
  -- 1. Validate user has Team Business Plan
  IF NOT EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_owner_id
      AND status = 'active'
      AND plan_id IN (
        SELECT id FROM subscription_plans
        WHERE name LIKE '%Team%' AND name LIKE '%Business%'
      )
  ) THEN
    RAISE EXCEPTION 'User must have active Team Business Plan subscription';
  END IF;

  -- 2. Check if user already has a team (single team limit)
  IF EXISTS (SELECT 1 FROM team_members WHERE user_id = p_owner_id) THEN
    RAISE EXCEPTION 'User already belongs to a team';
  END IF;

  -- 3. Get user's current credit balance
  SELECT COALESCE(credit_balance, 0) INTO v_credits_amount
  FROM user_profiles
  WHERE id = p_owner_id;

  -- 4. Count user's personal stories
  SELECT COUNT(*) INTO v_stories_count
  FROM stories
  WHERE owner_id = p_owner_id AND owner_type = 'user';

  -- 5. Create team (using existing teams table structure)
  INSERT INTO teams (owner_id, name, description)
  VALUES (p_owner_id, p_team_name, p_team_description)
  RETURNING id INTO v_team_id;

  -- 6. Add owner as team member
  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (v_team_id, p_owner_id, 'owner', NOW());

  -- 7. Migrate all personal stories to team
  UPDATE stories
  SET owner_id = v_team_id,
      owner_type = 'team',
      updated_at = NOW()
  WHERE owner_id = p_owner_id AND owner_type = 'user';

  -- 8. Transfer credits from user to team
  -- Deduct from user
  UPDATE user_profiles
  SET credit_balance = 0,
      updated_at = NOW()
  WHERE id = p_owner_id;

  -- Add to team (team credits stored in user_profiles with id = team_id)
  INSERT INTO user_profiles (id, credit_balance, created_at, updated_at)
  VALUES (v_team_id, v_credits_amount, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET credit_balance = user_profiles.credit_balance + v_credits_amount,
      updated_at = NOW();

  -- 9. Log activity
  INSERT INTO activities (
    user_id,
    action_type,
    entity_type,
    entity_id,
    metadata,
    created_at,
    updated_at
  )
  VALUES (
    p_owner_id,
    'team_create',
    'team',
    v_team_id::uuid,
    jsonb_build_object(
      'teamName', p_team_name,
      'storiesMigrated', v_stories_count,
      'creditsTransferred', v_credits_amount
    ),
    NOW(),
    NOW()
  );

  -- 10. Return results
  RETURN QUERY
  SELECT v_team_id, v_stories_count, v_credits_amount;
END;
$$;
```

### New Procedure: `accept_invitation_with_stories_migration()`

```sql
CREATE OR REPLACE FUNCTION accept_invitation_with_stories_migration(
  p_user_id TEXT,
  p_team_id TEXT,
  p_role TEXT DEFAULT 'member'
)
RETURNS TABLE (
  success BOOLEAN,
  stories_migrated INTEGER,
  credits_transferred INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stories_count INTEGER;
  v_credits_amount INTEGER;
  v_team_name TEXT;
BEGIN
  -- 1. Validate team exists
  SELECT name INTO v_team_name
  FROM teams
  WHERE id = p_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- 2. Check if user already in team
  IF EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already a member of this team';
  END IF;

  -- 3. Check team capacity (max 5 members)
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id) >= 5 THEN
    RAISE EXCEPTION 'Team is full (maximum 5 members)';
  END IF;

  -- 4. Get user's current credit balance
  SELECT COALESCE(credit_balance, 0) INTO v_credits_amount
  FROM user_profiles
  WHERE id = p_user_id;

  -- 5. Count user's personal stories
  SELECT COUNT(*) INTO v_stories_count
  FROM stories
  WHERE owner_id = p_user_id AND owner_type = 'user';

  -- 6. Add user to team
  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (p_team_id, p_user_id, p_role, NOW());

  -- 7. Migrate all personal stories to team
  UPDATE stories
  SET owner_id = p_team_id,
      owner_type = 'team',
      updated_at = NOW()
  WHERE owner_id = p_user_id AND owner_type = 'user';

  -- 8. Transfer credits from user to team
  -- Deduct from user
  UPDATE user_profiles
  SET credit_balance = 0,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Add to team
  UPDATE user_profiles
  SET credit_balance = credit_balance + v_credits_amount,
      updated_at = NOW()
  WHERE id = p_team_id;

  -- 9. Log activity
  INSERT INTO activities (
    user_id,
    action_type,
    entity_type,
    entity_id,
    metadata,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'team_join',
    'team',
    p_team_id::uuid,
    jsonb_build_object(
      'teamName', v_team_name,
      'storiesMigrated', v_stories_count,
      'creditsTransferred', v_credits_amount
    ),
    NOW(),
    NOW()
  );

  -- 10. Return results
  RETURN QUERY
  SELECT true, v_stories_count, v_credits_amount;
END;
$$;
```

### Updated Procedure: `get_team_activities()` - Include Story Activities

```sql
CREATE OR REPLACE FUNCTION get_team_activities(
  p_team_id TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  activity_id UUID,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  action_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Count total activities for team (both team and story activities)
  SELECT COUNT(*) INTO v_total_count
  FROM activities a
  WHERE (
    -- Team-level activities
    (a.entity_type = 'team' AND a.entity_id = p_team_id::uuid)
    OR
    -- Story activities for team stories
    (a.entity_type = 'story' AND
     EXISTS (
       SELECT 1 FROM stories s
       WHERE s.id::text = a.entity_id::text
       AND s.owner_id = p_team_id
       AND s.owner_type = 'team'
     ))
  );

  RETURN QUERY
  SELECT
    a.id as activity_id,
    a.user_id,
    COALESCE(up.email, '') as user_email,
    COALESCE(up.display_name, '') as user_name,
    a.action_type,
    a.entity_type,
    a.entity_id,
    a.metadata,
    a.created_at,
    a.updated_at,
    v_total_count as total_count
  FROM activities a
  LEFT JOIN user_profiles up ON up.id = a.user_id
  WHERE (
    -- Team-level activities
    (a.entity_type = 'team' AND a.entity_id = p_team_id::uuid)
    OR
    -- Story activities for team stories
    (a.entity_type = 'story' AND
     EXISTS (
       SELECT 1 FROM stories s
       WHERE s.id::text = a.entity_id::text
       AND s.owner_id = p_team_id
       AND s.owner_type = 'team'
     ))
  )
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
```

---

## 5. Backend API Changes

### Update: `POST /teams` (Team Creation)

**File**: `backend/modules/team-management.ts`

```typescript
// Replace existing createTeam function
export async function createTeam(request: ZuploRequest, context: ZuploContext) {
  const { requireUserWithProfile } = await import('./auth-utils');
  const { userId } = await requireUserWithProfile(request, context);

  const body = await request.json();
  const { name, description } = body;

  if (!name || name.trim().length === 0) {
    return HttpProblems.badRequest(request, context, {
      detail: "Team name is required"
    });
  }

  try {
    // Call new stored procedure that handles migration atomically
    const { data, error } = await supabase
      .rpc('create_team_with_stories_migration', {
        p_owner_id: userId,
        p_team_name: name.trim(),
        p_team_description: description?.trim() || null
      });

    if (error) {
      if (error.message.includes('already belongs to a team')) {
        return HttpProblems.badRequest(request, context, {
          detail: "You already belong to a team"
        });
      }
      if (error.message.includes('Team Business Plan')) {
        return HttpProblems.badRequest(request, context, {
          detail: "Active Team Business Plan subscription required"
        });
      }
      throw error;
    }

    const result = data[0];

    return new Response(JSON.stringify({
      teamId: result.team_id,
      storiesMigrated: result.stories_migrated,
      creditsTransferred: result.credits_transferred,
      message: `Team created successfully. ${result.stories_migrated} stories and ${result.creditsTransferred} credits transferred.`
    }), {
      status: HttpStatusCode.Created,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    context.log.error('Error creating team:', error);
    return HttpProblems.internalServerError(request, context);
  }
}
```

### Update: Team Invitation Acceptance Handler

**File**: `backend/modules/team-invitations.ts` (or similar)

```typescript
export async function acceptInvitation(request: ZuploRequest, context: ZuploContext) {
  const { requireUserWithProfile } = await import('./auth-utils');
  const { userId } = await requireUserWithProfile(request, context);

  const body = await request.json();
  const { teamId, invitationId } = body;

  try {
    // Verify invitation exists and is valid (Clerk handles this via webhook)
    // Assume Clerk webhook already validated invitation

    // Call stored procedure that handles migration atomically
    const { data, error } = await supabase
      .rpc('accept_invitation_with_stories_migration', {
        p_user_id: userId,
        p_team_id: teamId,
        p_role: 'member' // Or get from invitation metadata
      });

    if (error) {
      if (error.message.includes('already a member')) {
        return HttpProblems.badRequest(request, context, {
          detail: "You are already a member of this team"
        });
      }
      if (error.message.includes('Team is full')) {
        return HttpProblems.badRequest(request, context, {
          detail: "Team has reached maximum capacity (5 members)"
        });
      }
      throw error;
    }

    const result = data[0];

    return new Response(JSON.stringify({
      success: true,
      storiesMigrated: result.stories_migrated,
      creditsTransferred: result.credits_transferred,
      message: `Successfully joined team. ${result.stories_migrated} stories and ${result.credits_transferred} credits transferred.`
    }), {
      status: HttpStatusCode.OK,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    context.log.error('Error accepting invitation:', error);
    return HttpProblems.internalServerError(request, context);
  }
}
```

### New Endpoint: `GET /users/:userId/story-count`

**File**: `backend/modules/story-count.ts` (new file)

```typescript
import { ZuploRequest, ZuploContext } from "@zuplo/runtime";
import { createClient } from '@supabase/supabase-js';
import { HttpProblems, HttpStatusCode } from './http-utils';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getPersonalStoryCount(request: ZuploRequest, context: ZuploContext) {
  const { requireUserWithProfile } = await import('./auth-utils');
  const { userId: requestingUserId } = await requireUserWithProfile(request, context);

  try {
    // Count personal stories (owner_type = 'user')
    const { count, error } = await supabase
      .from('stories')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', requestingUserId)
      .eq('owner_type', 'user');

    if (error) throw error;

    return new Response(JSON.stringify({
      storyCount: count || 0
    }), {
      status: HttpStatusCode.OK,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    context.log.error('Error getting story count:', error);
    return HttpProblems.internalServerError(request, context);
  }
}
```

---

## 6. Frontend Component Changes

### New Component: `MigrationWarningDialog.tsx`

**File**: `frontend/src/components/teams/MigrationWarningDialog.tsx`

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MigrationWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  storyCount: number;
  creditCount: number;
  isLoading: boolean;
  actionType: 'create' | 'join';
  teamName?: string;
}

const MigrationWarningDialog: React.FC<MigrationWarningDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  storyCount,
  creditCount,
  isLoading,
  actionType,
  teamName,
}) => {
  const { t } = useTranslation(['teams', 'common']);

  const titleKey = actionType === 'create'
    ? 'teams:migration.createTeamTitle'
    : 'teams:migration.joinTeamTitle';

  const actionButtonKey = actionType === 'create'
    ? 'teams:migration.createAndTransfer'
    : 'teams:migration.acceptAndTransfer';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {t(titleKey, teamName ? { teamName } : undefined)}
          </DialogTitle>
          <DialogDescription>
            {t('teams:migration.description')}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-semibold">
                {t('teams:migration.whatWillTransfer')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>
                  {t('teams:migration.storiesTransfer', { count: storyCount })}
                </li>
                <li>
                  {t('teams:migration.creditsTransfer', { count: creditCount })}
                </li>
              </ul>
              <p className="text-sm font-medium text-orange-700 mt-3">
                {t('teams:migration.cannotUndo')}
              </p>
              <p className="text-sm text-gray-600">
                {t('teams:migration.teamOwnership')}
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? t('common:messages.loading') : t(actionButtonKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MigrationWarningDialog;
```

### Update: `CreateTeamDialog.tsx`

**File**: `frontend/src/components/teams/CreateTeamDialog.tsx`

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/clerk-react';
import { useAuthWithRefresh } from '@/hooks/useAuthWithRefresh';
import { teamService } from '@/services/TeamService';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MigrationWarningDialog from './MigrationWarningDialog';
import logger from '@/services/logger';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateTeamDialog: React.FC<CreateTeamDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useTranslation(['teams', 'common']);
  const { user } = useUser();
  const { getTokenOrRefresh } = useAuthWithRefresh();
  const { toast } = useToast();

  const [teamName, setTeamName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showMigrationWarning, setShowMigrationWarning] = React.useState(false);
  const [storyCount, setStoryCount] = React.useState(0);
  const [creditCount, setCreditCount] = React.useState(0);

  // Fetch user's story and credit counts when dialog opens
  React.useEffect(() => {
    if (open && user?.id) {
      fetchUserCounts();
    }
  }, [open, user?.id]);

  const fetchUserCounts = async () => {
    if (!user?.id) return;

    try {
      const token = await getTokenOrRefresh();
      if (!token) return;

      // Fetch story count
      const storyResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/${user.id}/story-count`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const storyData = await storyResponse.json();
      setStoryCount(storyData.storyCount || 0);

      // Fetch credit balance (assuming user profile endpoint exists)
      const profileResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/users/${user.id}/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const profileData = await profileResponse.json();
      setCreditCount(profileData.creditBalance || 0);
    } catch (error) {
      logger.error('Error fetching user counts:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    // Show migration warning dialog
    setShowMigrationWarning(true);
  };

  const handleConfirmMigration = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const token = await getTokenOrRefresh();
      if (!token) throw new Error('No auth token');

      const result = await teamService.createTeam(
        user.id,
        teamName.trim(),
        '',
        token
      );

      toast({
        title: t('teams:success.teamCreated'),
        description: t('teams:migration.successMessage', {
          stories: result.storiesMigrated || 0,
          credits: result.creditsTransferred || 0,
        }),
      });

      setShowMigrationWarning(false);
      onOpenChange(false);
      setTeamName('');
      onSuccess();
    } catch (error: any) {
      logger.error('Error creating team:', error);
      toast({
        title: t('teams:error.createFailed'),
        description: error.message || t('teams:error.createFailedMessage'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showMigrationWarning} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teams:createTeam')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="teamName">{t('teams:teamName')}</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={t('teams:teamNamePlaceholder')}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common:actions.cancel')}
              </Button>
              <Button type="submit" disabled={!teamName.trim()}>
                {t('common:actions.continue')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MigrationWarningDialog
        open={showMigrationWarning}
        onOpenChange={setShowMigrationWarning}
        onConfirm={handleConfirmMigration}
        storyCount={storyCount}
        creditCount={creditCount}
        isLoading={isLoading}
        actionType="create"
      />
    </>
  );
};

export default CreateTeamDialog;
```

### Update: `StoryLibrary.tsx` - Simplified (No Context Switching)

**File**: `frontend/src/components/StoryLibrary.tsx`

**Key Changes**:
- Remove personal/team story tabs
- Remove context switching UI
- Show team stories if user is in team, otherwise personal stories
- Simplified story list rendering

```typescript
// Simplified version - just show stories based on user's team membership
const StoryLibrary: React.FC = () => {
  const { user } = useUser();
  const { t } = useTranslation(['library', 'common']);
  const [stories, setStories] = React.useState<Story[]>([]);
  const [userTeam, setUserTeam] = React.useState<Team | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (user?.id) {
      loadUserTeamAndStories();
    }
  }, [user?.id]);

  const loadUserTeamAndStories = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const token = await getTokenOrRefresh();
      if (!token) return;

      // Check if user is in a team
      const teams = await teamService.getUserTeams(user.id, token);
      const team = teams.length > 0 ? teams[0] : null;
      setUserTeam(team);

      // Load stories (team stories if in team, personal otherwise)
      let loadedStories: Story[];
      if (team) {
        loadedStories = await storyService.getTeamStories(team.id, user.id, token);
      } else {
        loadedStories = await storyService.getPersonalStories(user.id, token);
      }

      setStories(loadedStories);
    } catch (error) {
      logger.error('Error loading stories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Render simplified library
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {userTeam
              ? t('library:teamStories', { teamName: userTeam.name })
              : t('library:myStories')
            }
          </h1>
          {userTeam && (
            <p className="text-gray-600 mt-1">
              {t('library:teamStoriesDescription')}
            </p>
          )}
        </div>
        <Button onClick={handleCreateStory}>
          <Plus className="h-4 w-4 mr-2" />
          {t('library:createStory')}
        </Button>
      </div>

      {/* Story grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {stories.map(story => (
          <StoryCard
            key={story.id}
            story={story}
            isTeamStory={!!userTeam}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 7. Impact Analysis on Story Features

### 7.1 Story Duplication

**Current Behavior**: Users can duplicate their personal stories

**Team-Only Model Changes**:
- Team members can duplicate team stories → new story belongs to same team
- Individual Plan users can duplicate personal stories → new story belongs to user
- No cross-context duplication (can't duplicate team story to personal, or vice versa)

**Implementation**:
```typescript
// In StoryService.duplicateStory()
async duplicateStory(storyId: string, userId: string, token: string): Promise<Story> {
  const originalStory = await this.getStory(storyId, userId, token);

  const duplicatedStory = {
    ...originalStory,
    id: undefined, // New ID will be generated
    title: `${originalStory.title} (Copy)`,
    // Preserve ownership (user or team)
    ownerId: originalStory.ownerId,
    ownerType: originalStory.ownerType,
    createdBy: userId, // New duplicate created by current user
  };

  return await this.createStory(duplicatedStory, userId, token);
}
```

**UI Changes**: No changes needed in UI - duplication happens in same context

### 7.2 Story Sharing

**Current Behavior**: Users can share stories via public links

**Team-Only Model Changes**:
- Team stories can be shared by any team member (not just owner)
- Shared link attribution shows "Shared by [Team Name]" instead of individual
- Individual Plan users share personal stories normally

**Implementation**:
```typescript
// In story sharing logic
async shareStory(storyId: string, userId: string, token: string): Promise<ShareLink> {
  const story = await this.getStory(storyId, userId, token);

  const attribution = story.ownerType === 'team'
    ? { type: 'team', id: story.ownerId, name: story.team.name }
    : { type: 'user', id: story.ownerId, name: story.owner.displayName };

  const shareLink = await this.createShareLink(storyId, attribution, token);
  return shareLink;
}
```

**UI Changes**:
- Share dialog shows team attribution
- Story card shows "Team Story" badge

### 7.3 Story Deletion

**Current Behavior**: Story owners can delete their stories

**Team-Only Model Changes**:
- **Team owners** can delete any team story
- **Team admins** can delete any team story
- **Team members** can only delete stories they created (tracked via `created_by` field)
- Individual Plan users can delete their personal stories

**Implementation**:
```typescript
async deleteStory(storyId: string, userId: string, token: string): Promise<void> {
  const story = await this.getStory(storyId, userId, token);

  if (story.ownerType === 'team') {
    // Check team permissions
    const team = await teamService.getTeam(story.ownerId, userId, token);
    const member = team.members.find(m => m.userId === userId);

    const canDelete =
      member.role === 'owner' ||
      member.role === 'admin' ||
      (member.role === 'member' && story.createdBy === userId);

    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this story');
    }
  } else {
    // Personal story - check ownership
    if (story.ownerId !== userId) {
      throw new Error('Only story owner can delete personal stories');
    }
  }

  await this.deleteStoryById(storyId, token);
}
```

**UI Changes**:
- Show delete button only when user has permission
- Add role-based permission check in StoryCard component

### 7.4 Story Editing

**Current Behavior**: Story owners can edit their stories

**Team-Only Model Changes**:
- **All team members** (owner, admin, member) can edit team stories
- Collaborative editing with last-write-wins conflict resolution (already implemented)
- Individual Plan users can edit their personal stories

**Implementation**: No changes needed - existing editing logic already supports collaborative editing

**UI Changes**:
- Show "Team members can edit" message in story editor
- Display list of active editors (already implemented)

### 7.5 Community Sharing (Publishing)

**Current Behavior**: Users can publish stories to community

**Team-Only Model Changes**:
- Team stories can be published by any team member
- Published story attribution shows team name
- Individual Plan users publish personal stories normally

**Implementation**:
```typescript
async publishToCommunity(storyId: string, userId: string, token: string): Promise<void> {
  const story = await this.getStory(storyId, userId, token);

  if (story.ownerType === 'team') {
    // Verify user is team member
    const team = await teamService.getTeam(story.ownerId, userId, token);
    if (!team.members.some(m => m.userId === userId)) {
      throw new Error('Only team members can publish team stories');
    }
  }

  await this.publishStory(storyId, {
    publishedBy: userId,
    attribution: story.ownerType === 'team'
      ? { type: 'team', id: story.ownerId, name: story.team.name }
      : { type: 'user', id: story.ownerId, name: story.owner.displayName }
  }, token);
}
```

**UI Changes**:
- Publish button available to all team members
- Published story shows team attribution

---

## 8. Translation Keys (i18n)

### New Keys for `frontend/src/locales/en/teams.json`

```json
{
  "migration": {
    "createTeamTitle": "Create Team",
    "joinTeamTitle": "Join {{teamName}}",
    "description": "Before proceeding, please review what will be transferred",
    "whatWillTransfer": "What will be transferred to the team:",
    "storiesTransfer": "All your personal stories ({{count}} story)",
    "storiesTransfer_plural": "All your personal stories ({{count}} stories)",
    "creditsTransfer": "All your personal credits ({{count}} credit)",
    "creditsTransfer_plural": "All your personal credits ({{count}} credits)",
    "cannotUndo": "⚠️ This action cannot be undone",
    "teamOwnership": "The team will own these stories, and all team members will be able to view and edit them.",
    "createAndTransfer": "Create Team and Transfer All",
    "acceptAndTransfer": "Accept and Transfer All",
    "successMessage": "Successfully transferred {{stories}} stories and {{credits}} credits to the team"
  }
}
```

### New Keys for `frontend/src/locales/en/library.json`

```json
{
  "teamStories": "{{teamName}} Stories",
  "teamStoriesDescription": "Stories shared with your team members",
  "myStories": "My Stories",
  "teamStoryBadge": "Team Story",
  "sharedByTeam": "Shared by {{teamName}}"
}
```

### Spanish Translations (`frontend/src/locales/es/teams.json`)

```json
{
  "migration": {
    "createTeamTitle": "Crear Equipo",
    "joinTeamTitle": "Unirse a {{teamName}}",
    "description": "Antes de continuar, revise qué se transferirá",
    "whatWillTransfer": "Lo que se transferirá al equipo:",
    "storiesTransfer": "Todas tus historias personales ({{count}} historia)",
    "storiesTransfer_plural": "Todas tus historias personales ({{count}} historias)",
    "creditsTransfer": "Todos tus créditos personales ({{count}} crédito)",
    "creditsTransfer_plural": "Todos tus créditos personales ({{count}} créditos)",
    "cannotUndo": "⚠️ Esta acción no se puede deshacer",
    "teamOwnership": "El equipo será propietario de estas historias, y todos los miembros del equipo podrán verlas y editarlas.",
    "createAndTransfer": "Crear Equipo y Transferir Todo",
    "acceptAndTransfer": "Aceptar y Transferir Todo",
    "successMessage": "Se transfirieron exitosamente {{stories}} historias y {{credits}} créditos al equipo"
  }
}
```

---

## 9. Testing Plan

### Manual Testing Checklist

#### Test Case 1: Team Creation with Story Migration
- [ ] User with Team Business Plan has 5 personal stories and 100 credits
- [ ] User clicks "Create Team"
- [ ] Dialog shows correct counts (5 stories, 100 credits)
- [ ] User enters team name and clicks "Create Team and Transfer All"
- [ ] Success message shows "5 stories and 100 credits transferred"
- [ ] Navigate to Library - shows 5 team stories (no personal stories)
- [ ] Check team credit balance - shows 100 credits
- [ ] Check personal credit balance - shows 0 credits
- [ ] Team activity log shows "Created team with 5 stories transferred"

#### Test Case 2: Team Invitation Acceptance with Migration
- [ ] New user with 3 personal stories and 50 credits
- [ ] Owner invites new user via email
- [ ] New user clicks email link
- [ ] Invitation page shows migration warning (3 stories, 50 credits)
- [ ] User clicks "Accept and Transfer All"
- [ ] Success message shows "3 stories and 50 credits transferred"
- [ ] User sees team stories in Library (8 total: 5 from owner + 3 from member)
- [ ] Team credit balance shows 150 credits (100 + 50)
- [ ] User's personal credit balance shows 0
- [ ] Team activity log shows "User joined with 3 stories transferred"

#### Test Case 3: Team Story Collaboration
- [ ] Team member A creates new story
- [ ] Team member B can see story in Library
- [ ] Team member B can edit story
- [ ] Team member C can duplicate story (duplicate remains in team)
- [ ] All team members can see story activities in team activity log

#### Test Case 4: Story Deletion Permissions
- [ ] Team member (non-admin) cannot delete stories created by others
- [ ] Team member can delete stories they created
- [ ] Team admin can delete any story
- [ ] Team owner can delete any story

#### Test Case 5: Edge Cases
- [ ] User with 0 stories and 0 credits creates team - dialog shows 0/0
- [ ] User tries to create team without Team Business Plan - error shown
- [ ] User tries to accept invitation to full team (5/5 members) - error shown
- [ ] User already in team tries to create another team - error shown

---

## 10. Rollout Strategy

### Phase 1: Development & Testing (Week 1)
- Implement database schema changes (add `team_id` to stories table)
- Create stored procedures for migration
- Update backend API endpoints
- Build frontend components (MigrationWarningDialog)
- Manual testing on development environment

### Phase 2: QA Environment Testing (Week 2)
- Deploy to QA environment
- Run full manual test suite
- Test edge cases and error scenarios
- Validate activity logging
- Check analytics and monitoring

### Phase 3: Production Deployment (Week 3)
- Deploy database migrations during low-traffic window
- Deploy backend changes
- Deploy frontend changes
- Monitor error rates and logs
- Prepare rollback plan

### Phase 4: Post-Deployment Monitoring (Week 4)
- Monitor team creation success rate
- Track story migration errors
- Check credit transfer accuracy
- Gather user feedback
- Fix any issues discovered

### Rollback Plan
If critical issues arise:
1. Revert frontend to previous version (no story migration dialog)
2. Disable team creation endpoint temporarily
3. Investigate and fix issues
4. Re-deploy after fixes validated in QA

---

## 11. Open Questions

1. **Story visibility after leaving team**: Current design: user loses access to team stories. Should we create read-only copies before user leaves?

2. **Credit refund on team leave**: Current design: credits stay with team. Should departing members get partial refund?

3. **Team deletion**: What happens to team stories when team is deleted? Archive? Transfer back to members?

4. **Subscription downgrade**: If Team Business Plan user downgrades to Individual Plan, what happens to team stories?

5. **Activity log retention**: How long should we keep team activity history?

---

## 12. Success Metrics

- **Migration Success Rate**: >95% of team creations successfully migrate all stories/credits
- **User Satisfaction**: No increase in support tickets related to story ownership confusion
- **Performance**: Team creation completes in <2 seconds
- **Error Rate**: <1% of team operations result in errors
- **Adoption**: 30% of Team Business Plan users create teams within 30 days

---

## Appendix A: Database Migration SQL

**File**: `backend/sql/team-only-model-migration.sql`

```sql
-- Migration: Add owner_type discriminator to stories table
-- Date: 2025-10-20
-- Description: Adds team ownership support using owner_type discriminator
--
-- Design: Reuse owner_id column with owner_type discriminator instead of
--         adding separate team_id column for cleaner schema and better performance

BEGIN;

-- 1. Add owner_type discriminator column
ALTER TABLE stories
ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'user'
  CHECK (owner_type IN ('user', 'team'));

-- Note: owner_id now contains either a user ID or team ID
--       owner_type indicates which type of entity owns the story

-- 2. Create efficient composite index for owner queries
CREATE INDEX idx_stories_owner ON stories(owner_id, owner_type);

-- 3. Create index for permission checks (created_by is always user ID)
CREATE INDEX idx_stories_created_by ON stories(created_by);

-- 4. Add constraint: owner_id must not be null
ALTER TABLE stories
ADD CONSTRAINT chk_story_owner_not_null
  CHECK (owner_id IS NOT NULL);

-- 5. Create stored procedure: create_team_with_stories_migration
CREATE OR REPLACE FUNCTION create_team_with_stories_migration(
  p_owner_id TEXT,
  p_team_name TEXT,
  p_team_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  team_id TEXT,
  stories_migrated INTEGER,
  credits_transferred INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id TEXT;
  v_stories_count INTEGER;
  v_credits_amount INTEGER;
BEGIN
  -- Validate user has Team Business Plan
  IF NOT EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_owner_id
      AND status = 'active'
      AND plan_id IN (
        SELECT id FROM subscription_plans
        WHERE name LIKE '%Team%' AND name LIKE '%Business%'
      )
  ) THEN
    RAISE EXCEPTION 'User must have active Team Business Plan subscription';
  END IF;

  -- Check if user already has a team
  IF EXISTS (SELECT 1 FROM team_members WHERE user_id = p_owner_id) THEN
    RAISE EXCEPTION 'User already belongs to a team';
  END IF;

  -- Get user's credit balance and story count
  SELECT COALESCE(credit_balance, 0) INTO v_credits_amount
  FROM user_profiles WHERE id = p_owner_id;

  SELECT COUNT(*) INTO v_stories_count
  FROM stories
  WHERE owner_id = p_owner_id AND owner_type = 'user';

  -- Create team
  INSERT INTO teams (owner_id, name, description)
  VALUES (p_owner_id, p_team_name, p_team_description)
  RETURNING id INTO v_team_id;

  -- Add owner as team member
  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (v_team_id, p_owner_id, 'owner', NOW());

  -- Migrate stories: Update owner_id to team_id and set owner_type to 'team'
  UPDATE stories
  SET owner_id = v_team_id,
      owner_type = 'team',
      updated_at = NOW()
  WHERE owner_id = p_owner_id AND owner_type = 'user';

  -- Transfer credits
  UPDATE user_profiles
  SET credit_balance = 0, updated_at = NOW()
  WHERE id = p_owner_id;

  INSERT INTO user_profiles (id, credit_balance, created_at, updated_at)
  VALUES (v_team_id, v_credits_amount, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET credit_balance = user_profiles.credit_balance + v_credits_amount,
      updated_at = NOW();

  -- Log activity
  INSERT INTO activities (
    user_id, action_type, entity_type, entity_id, metadata,
    created_at, updated_at
  )
  VALUES (
    p_owner_id, 'team_create', 'team', v_team_id::uuid,
    jsonb_build_object(
      'teamName', p_team_name,
      'storiesMigrated', v_stories_count,
      'creditsTransferred', v_credits_amount
    ),
    NOW(), NOW()
  );

  RETURN QUERY SELECT v_team_id, v_stories_count, v_credits_amount;
END;
$$;

-- 6. Create stored procedure: accept_invitation_with_stories_migration
CREATE OR REPLACE FUNCTION accept_invitation_with_stories_migration(
  p_user_id TEXT,
  p_team_id TEXT,
  p_role TEXT DEFAULT 'member'
)
RETURNS TABLE (
  success BOOLEAN,
  stories_migrated INTEGER,
  credits_transferred INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stories_count INTEGER;
  v_credits_amount INTEGER;
  v_team_name TEXT;
BEGIN
  -- Validate team exists
  SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;

  -- Check if already member
  IF EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already a member of this team';
  END IF;

  -- Check capacity
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id) >= 5 THEN
    RAISE EXCEPTION 'Team is full (maximum 5 members)';
  END IF;

  -- Get user's credit balance and story count
  SELECT COALESCE(credit_balance, 0) INTO v_credits_amount
  FROM user_profiles WHERE id = p_user_id;

  SELECT COUNT(*) INTO v_stories_count
  FROM stories
  WHERE owner_id = p_user_id AND owner_type = 'user';

  -- Add to team
  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (p_team_id, p_user_id, p_role, NOW());

  -- Migrate stories
  UPDATE stories
  SET owner_id = p_team_id,
      owner_type = 'team',
      updated_at = NOW()
  WHERE owner_id = p_user_id AND owner_type = 'user';

  -- Transfer credits
  UPDATE user_profiles
  SET credit_balance = 0, updated_at = NOW()
  WHERE id = p_user_id;

  UPDATE user_profiles
  SET credit_balance = credit_balance + v_credits_amount, updated_at = NOW()
  WHERE id = p_team_id;

  -- Log activity
  INSERT INTO activities (
    user_id, action_type, entity_type, entity_id, metadata,
    created_at, updated_at
  )
  VALUES (
    p_user_id, 'team_join', 'team', p_team_id::uuid,
    jsonb_build_object(
      'teamName', v_team_name,
      'storiesMigrated', v_stories_count,
      'creditsTransferred', v_credits_amount
    ),
    NOW(), NOW()
  );

  RETURN QUERY SELECT true, v_stories_count, v_credits_amount;
END;
$$;

-- 7. Update get_team_activities to include story activities
CREATE OR REPLACE FUNCTION get_team_activities(
  p_team_id TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  activity_id UUID,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  action_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM activities a
  WHERE (
    (a.entity_type = 'team' AND a.entity_id = p_team_id::uuid)
    OR
    (a.entity_type = 'story' AND EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id::text = a.entity_id::text
      AND s.owner_id = p_team_id
      AND s.owner_type = 'team'
    ))
  );

  RETURN QUERY
  SELECT
    a.id, a.user_id,
    COALESCE(up.email, ''),
    COALESCE(up.display_name, ''),
    a.action_type, a.entity_type, a.entity_id, a.metadata,
    a.created_at, a.updated_at, v_total_count
  FROM activities a
  LEFT JOIN user_profiles up ON up.id = a.user_id
  WHERE (
    (a.entity_type = 'team' AND a.entity_id = p_team_id::uuid)
    OR
    (a.entity_type = 'story' AND EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id::text = a.entity_id::text
      AND s.owner_id = p_team_id
      AND s.owner_type = 'team'
    ))
  )
  ORDER BY a.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;
```

---

## Appendix B: Frontend Type Updates

**File**: `frontend/src/types.ts`

```typescript
// Update Story interface with owner_type discriminator
export interface Story {
  id: string;
  title: string;
  ownerId: string;            // User ID or Team ID (always present)
  ownerType: 'user' | 'team'; // Discriminator: which type owns the story
  createdBy: string;          // Original creator (always user ID, for permissions)
  content: StoryContent;
  coverImage?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  // Additional fields...
}

// Helper type guards for type-safe ownership checks
export function isTeamStory(story: Story): boolean {
  return story.ownerType === 'team';
}

export function isPersonalStory(story: Story): boolean {
  return story.ownerType === 'user';
}

// Team migration result types
export interface TeamCreationResult {
  teamId: string;
  storiesMigrated: number;
  creditsTransferred: number;
  message: string;
}

export interface InvitationAcceptanceResult {
  success: boolean;
  storiesMigrated: number;
  creditsTransferred: number;
  message: string;
}
```

**Backend to Frontend Mapping**:
```typescript
// When fetching stories from backend API
function mapStoryFromBackend(backendStory: any): Story {
  return {
    id: backendStory.id,
    title: backendStory.title,
    ownerId: backendStory.owner_id,       // Maps from owner_id
    ownerType: backendStory.owner_type,   // Maps from owner_type
    createdBy: backendStory.created_by,   // Maps from created_by
    content: backendStory.content,
    coverImage: backendStory.cover_image,
    status: backendStory.status,
    createdAt: backendStory.created_at,
    updatedAt: backendStory.updated_at,
  };
}
```

---

## Document Status

- **Status**: Ready for Review
- **Next Steps**:
  1. Review this design document with stakeholders
  2. Get approval on migration flow and dialog UX
  3. Confirm rollback strategy
  4. Begin Phase 1 implementation

---

**End of Document**
