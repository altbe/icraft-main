# Team Stories Library Integration Plan

**Date**: 2025-10-20
**Status**: 📋 Planning Phase
**Priority**: High - Core collaboration feature

---

## Problem Statement

Currently, team stories are **isolated** in the TeamStoryManager component, accessible only from the team management page. Team members **cannot see each other's stories** in the main Library, which defeats the purpose of team collaboration.

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Library (StoryLibrary.tsx)                                  │
│ - Shows: Personal stories only (where teamId is null)       │
│ - Missing: Team stories from all user's teams               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TeamStoryManager (TeamStoryManager.tsx)                     │
│ - Shows: Stories for ONE specific team                       │
│ - Location: /teams/:teamId (buried in team management)      │
│ - Issue: Must navigate to each team separately              │
└─────────────────────────────────────────────────────────────┘
```

### What's Missing

1. **Unified view**: Team members can't see all team stories in one place
2. **Context switching**: No easy way to switch between personal/team contexts
3. **Discovery**: Team members don't know what stories their teammates are working on
4. **Collaboration**: Can't easily find and contribute to team stories

---

## Existing Infrastructure

### ✅ Backend Support (Already Implemented)

```typescript
// StoryService.ts:467
async getTeamStories(teamId: string, userId: string, token: string): Promise<Story[]>

// Story type already has teamId
export interface Story {
  id: string;
  userId: string;
  teamId?: string; // Team that owns this story
  // ... other fields
}
```

**Backend endpoints**:
- `GET /teams/:teamId/stories` - Get stories for specific team
- `POST /teams/:teamId/stories` - Create story for team

### ✅ Components Exist

- **TeamStoryManager** - Manages team stories (already working)
- **StoryCard** - Displays individual stories (reusable)
- **StoryLibrary** - Main library component (needs enhancement)

---

## Proposed Solution: Enhanced Library with Team Context

### Design Principles

1. **Unified Experience**: All stories (personal + team) in one place
2. **Clear Context**: Visual indication of story ownership
3. **Easy Switching**: Toggle between personal/team views
4. **Progressive Disclosure**: Don't overwhelm with too many options
5. **Maintain Performance**: Efficient data fetching

---

## Implementation Plan

### Phase 1: Add Team Stories to Library Data Model

**File**: `frontend/src/components/StoryLibrary.tsx`

#### 1.1 Enhance Data Fetching

```typescript
// Current: Only personal stories
const loadStories = async () => {
  const personalStories = await storyService.getAllStories(userId);
  setStories(personalStories);
};

// Proposed: Personal + All team stories
const loadStories = async () => {
  const token = await getTokenOrRefresh();

  // Fetch user's teams
  const userTeams = await teamService.getUserTeams(userId, token);

  // Fetch personal stories
  const personalStories = await storyService.getAllStories(userId);

  // Fetch stories from all teams (parallel)
  const teamStoriesArrays = await Promise.all(
    userTeams.map(team =>
      storyService.getTeamStories(team.id, userId, token)
    )
  );

  // Flatten and combine
  const allTeamStories = teamStoriesArrays.flat();
  const allStories = [...personalStories, ...allTeamStories];

  setStories(allStories);
  setTeams(userTeams); // Store for context switching
};
```

#### 1.2 Add State Management

```typescript
const [stories, setStories] = React.useState<Story[]>([]);
const [teams, setTeams] = React.useState<Team[]>([]);
const [selectedContext, setSelectedContext] = React.useState<'all' | 'personal' | string>('all');
// selectedContext can be: 'all', 'personal', or a team ID
```

### Phase 2: UI Enhancements

#### 2.1 Context Switcher Component

Add a dropdown/tabs component at the top of the library:

```typescript
<ContextSwitcher>
  <Option value="all">
    <Icon: Grid /> All Stories ({allStories.length})
  </Option>
  <Option value="personal">
    <Icon: User /> My Stories ({personalStories.length})
  </Option>
  {teams.map(team => (
    <Option key={team.id} value={team.id}>
      <Icon: Users /> {team.name} ({teamStoryCounts[team.id]})
    </Option>
  ))}
</ContextSwitcher>
```

**Location**: Above search bar, below page title

**Design**:
- Desktop: Horizontal tabs (like current tabs in TeamManagementPage)
- Mobile: Dropdown select for better space usage

#### 2.2 Visual Story Indicators

Enhance StoryCard to show team ownership:

```typescript
<StoryCard story={story}>
  {story.teamId && (
    <TeamBadge>
      <Icon: Users />
      {getTeamName(story.teamId)}
    </TeamBadge>
  )}
</StoryCard>
```

**Badge styles**:
- Personal stories: No badge (clean)
- Team stories: Subtle badge with team name, different color

#### 2.3 Filtered Story Display

```typescript
const getFilteredStories = () => {
  if (selectedContext === 'all') {
    return stories; // Show everything
  }

  if (selectedContext === 'personal') {
    return stories.filter(s => !s.teamId);
  }

  // Specific team selected
  return stories.filter(s => s.teamId === selectedContext);
};
```

### Phase 3: IndexedDB Integration

Team stories should also be cached locally for offline access:

```typescript
// StoryService.ts enhancement
async getAllStoriesIncludingTeams(userId: string, teams: Team[]): Promise<Story[]> {
  await this.initialize();

  // Get personal stories from IndexedDB
  const personalStories = await db.getAllFromIndex('stories', 'userId', userId);

  // Get team stories from IndexedDB
  const teamStories: Story[] = [];
  for (const team of teams) {
    const storiesForTeam = await db.getAllWhere('stories',
      (story: Story) => story.teamId === team.id
    );
    teamStories.push(...storiesForTeam);
  }

  return [...personalStories, ...teamStories];
}
```

**Sync behavior**:
- SimplifiedSyncService should sync team stories alongside personal stories
- Store team stories in same `stories` IndexedDB store (they have different IDs)
- Add `teamId` index to stories store for efficient querying

### Phase 4: Search & Filter Enhancement

Team stories should respect existing filters:

```typescript
const filteredStories = getFilteredStories()
  .filter(story => {
    // Existing search logic
    const matchesSearch = story.title.toLowerCase().includes(searchTerm);

    // Existing tag filter logic
    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => story.tags.includes(tag));

    // NEW: Context filter
    const matchesContext =
      selectedContext === 'all' ||
      (selectedContext === 'personal' && !story.teamId) ||
      (story.teamId === selectedContext);

    return matchesSearch && matchesTags && matchesContext;
  });
```

### Phase 5: URL State Management

Add context to URL for bookmarking and sharing:

```
/library                    → All stories
/library?context=personal   → Personal stories only
/library?context=team-abc123 → Stories from specific team
```

```typescript
// Read from URL
const contextParam = searchParams.get('context') || 'all';
setSelectedContext(contextParam);

// Update URL when context changes
const handleContextChange = (newContext: string) => {
  setSelectedContext(newContext);
  searchParams.set('context', newContext);
  setSearchParams(searchParams);
};
```

---

## User Experience Flows

### Flow 1: Team Member Viewing Stories

```
1. User opens Library (/library)
2. Default view: "All Stories" (personal + all teams)
3. Stories display with team badges where applicable
4. User clicks "Marketing Team" tab
5. View filters to show only Marketing Team stories
6. User can edit any team story (collaboration!)
```

### Flow 2: Creating Team Story from Library

**Option A**: Context-aware "New Story" button
```typescript
const handleCreateNew = () => {
  if (selectedContext === 'personal' || selectedContext === 'all') {
    createPersonalStory();
  } else {
    // Team context selected
    createTeamStory(selectedContext);
  }
};
```

**Option B**: Dropdown on "New Story" button (more explicit)
```
[New Story ▼]
  → Create Personal Story
  → Create Story for Team A
  → Create Story for Team B
```

### Flow 3: Converting Personal → Team Story

Add button to StoryCard actions:
```
[Edit] [Share] [Assign to Team ▼]
                  → Marketing Team
                  → Product Team
```

This reuses existing `storyService.createTeamStory()` logic.

---

## Technical Considerations

### Performance

**Problem**: Loading stories from multiple teams = multiple API calls

**Solutions**:

1. **Parallel fetching** (current plan):
   ```typescript
   await Promise.all(teams.map(team => getTeamStories(team.id)))
   ```

2. **Backend optimization** (future):
   ```typescript
   // New endpoint: GET /stories?includeTeams=true
   // Returns all stories (personal + all teams) in one call
   ```

3. **Progressive loading**:
   - Load personal stories first (fast)
   - Load team stories in background
   - Show loading indicator per team

### Permissions

**Read access**: If user is team member → can view all team stories ✅
**Edit access**:
- Option A: All team members can edit all team stories (full collaboration)
- Option B: Only story creator + team admins can edit (more controlled)
- **Recommendation**: Option A for now (simpler, matches "team" concept)

**Delete access**:
- Only story creator OR team owner/admin can delete
- Show delete button conditionally based on permissions

### Data Consistency

**Challenge**: Team stories appear in both Library and TeamStoryManager

**Solution**:
- Both use same `storyService.getTeamStories()`
- IndexedDB caching ensures consistency
- SimplifiedSyncService keeps everything in sync
- When story updates → sync propagates to all views

---

## Translation Keys Needed

### English (`frontend/src/locales/en/library.json`)

```json
{
  "context": {
    "all": "All Stories",
    "personal": "My Stories",
    "teamStories": "Team Stories"
  },
  "teamBadge": {
    "team": "Team: {{teamName}}"
  },
  "createTeamStory": {
    "title": "Create Story For",
    "personal": "Personal Story",
    "selectTeam": "Select team..."
  }
}
```

### Spanish (`frontend/src/locales/es/library.json`)

```json
{
  "context": {
    "all": "Todas las Historias",
    "personal": "Mis Historias",
    "teamStories": "Historias del Equipo"
  },
  "teamBadge": {
    "team": "Equipo: {{teamName}}"
  },
  "createTeamStory": {
    "title": "Crear Historia Para",
    "personal": "Historia Personal",
    "selectTeam": "Seleccionar equipo..."
  }
}
```

---

## Files to Modify

### Frontend

1. **`frontend/src/components/StoryLibrary.tsx`** (Major changes)
   - Add team context state
   - Fetch team stories alongside personal
   - Add context switcher UI
   - Filter stories by selected context
   - Update URL parameters

2. **`frontend/src/components/StoryCard.tsx`** (Minor changes)
   - Add team badge display
   - Show team name for team stories

3. **`frontend/src/services/StoryService.ts`** (Minor changes)
   - Add `getAllStoriesIncludingTeams()` helper
   - Ensure IndexedDB queries support teamId filtering

4. **`frontend/src/services/SimplifiedSyncService.ts`** (Check)
   - Verify team stories are synced
   - Add team story sync if missing

5. **`frontend/src/locales/en/library.json`** (Additions)
   - Context switcher labels
   - Team badge text

6. **`frontend/src/locales/es/library.json`** (Additions)
   - Spanish translations

### New Components (Optional)

1. **`frontend/src/components/LibraryContextSwitcher.tsx`**
   - Reusable context switcher
   - Handles desktop tabs + mobile dropdown
   - Displays team counts

2. **`frontend/src/components/TeamStoriesBadge.tsx`**
   - Team badge for StoryCard
   - Shows team icon + name
   - Consistent styling

---

## Backend Considerations

### Current Backend Status

✅ **Already supports team stories**:
- `GET /teams/:teamId/stories` - Works
- `POST /teams/:teamId/stories` - Works
- Stories have `team_id` column
- Permission checks verify team membership

### Potential Backend Enhancements

#### Enhancement 1: Bulk Fetch Endpoint (High Priority)

**Problem**: Frontend makes N+1 API calls (1 per team)

**Solution**: New endpoint to fetch all team stories at once

```typescript
// New endpoint
GET /stories?includeTeams=true

// Returns
{
  personal: Story[],
  teams: {
    [teamId: string]: Story[]
  }
}
```

**Backend Implementation** (`backend/modules/icraft-stories.ts`):
```typescript
export async function getUserStoriesIncludingTeams(
  request: ZuploRequest,
  context: ZuploContext
) {
  const userId = request.headers.get('X-User-Id');
  const includeTeams = request.query.includeTeams === 'true';

  // Get personal stories
  const { data: personalStories } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .is('team_id', null);

  if (!includeTeams) {
    return { stories: personalStories };
  }

  // Get user's teams
  const teams = await supabase.rpc('get_user_teams_with_details', {
    p_user_id: userId
  });

  // Get stories for all teams (use IN query for efficiency)
  const teamIds = teams.map(t => t.team_id);
  const { data: teamStories } = await supabase
    .from('stories')
    .select('*')
    .in('team_id', teamIds);

  return {
    personal: personalStories,
    team: teamStories
  };
}
```

#### Enhancement 2: Team Story Activities (Already Discussed)

Expand `get_team_activities()` to include story activities:

```sql
WHERE (
  (a.entity_type = 'team' AND a.entity_id = p_team_id::uuid)
  OR
  (a.entity_type = 'story' AND a.entity_id IN (
    SELECT id FROM stories WHERE team_id = p_team_id::uuid
  ))
)
```

---

## Testing Plan

### Manual Testing Checklist

#### Team Story Display
- [ ] Personal stories show without team badge
- [ ] Team stories show with correct team badge
- [ ] "All Stories" shows personal + all team stories
- [ ] "My Stories" shows only personal stories
- [ ] Selecting specific team shows only that team's stories
- [ ] Story counts are accurate in context switcher

#### Story Creation
- [ ] Can create personal story from "My Stories" context
- [ ] Can create team story from team context
- [ ] Created team story appears in correct team
- [ ] Created team story appears for all team members

#### Search & Filters
- [ ] Search works across personal + team stories
- [ ] Tag filters work across personal + team stories
- [ ] Context filter + search/tags work together
- [ ] Pagination works with context switching

#### Offline/Sync
- [ ] Team stories cache to IndexedDB
- [ ] Team stories available offline
- [ ] Team story edits sync when back online
- [ ] Sync works for multiple teams

#### Permissions
- [ ] Team members can view all team stories
- [ ] Team members can edit team stories
- [ ] Non-members cannot see team stories
- [ ] Delete permissions enforced correctly

#### URL State
- [ ] Context persists in URL
- [ ] Can bookmark specific context
- [ ] Back/forward buttons work correctly
- [ ] Context + search + tags all persist in URL

### Edge Cases

- [ ] User with no teams → "My Stories" tab only
- [ ] User with 5+ teams → UI doesn't break
- [ ] Empty team (no stories) → shows empty state
- [ ] Story assigned to deleted team → graceful handling
- [ ] Large number of stories (100+) → performance OK

---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1)
- Implement basic context switching
- Team stories visible in Library
- Test with travel team in non-prod

### Phase 2: Beta Testing (Week 2)
- Add team badges to StoryCard
- Implement URL state management
- Gather feedback from team users

### Phase 3: Polish & Optimization (Week 3)
- Backend bulk fetch endpoint
- Performance optimizations
- Accessibility improvements

### Phase 4: Production Launch (Week 4)
- Deploy to production
- Monitor performance metrics
- User documentation/tutorials

---

## Success Metrics

1. **Feature Adoption**:
   - % of team users who view team stories in Library
   - # of team story views per user per week

2. **Performance**:
   - Library load time with team stories < 2s
   - Context switching time < 500ms

3. **Collaboration**:
   - # of team stories created per team per month
   - # of team members editing shared stories

4. **User Satisfaction**:
   - Reduced "where are team stories?" support tickets
   - Positive feedback on unified story view

---

## Future Enhancements

### V2 Features

1. **Advanced Filtering**:
   - Filter by team member (stories created by X)
   - Filter by story status (draft/published)
   - Filter by last modified date

2. **Team Story Collections**:
   - Create collections/folders within teams
   - Organize stories by project/campaign

3. **Real-time Collaboration**:
   - See who's currently editing a team story
   - Live cursors and presence indicators

4. **Story Templates**:
   - Team-wide story templates
   - Standardize story structure across team

5. **Bulk Operations**:
   - Move multiple stories to team
   - Duplicate team stories
   - Export team stories

---

## Related Documentation

- `TEAM_MANAGEMENT_IMPROVEMENTS_2025-10-20.md` - Team management backend
- `TEAM_AUTO_CREDIT_TRANSFER_COMPLETE.md` - Team credit system
- `backend/CLAUDE.md` - Backend architecture guidelines
- `frontend/CLAUDE.md` - Frontend patterns and conventions
- `frontend/src/components/TeamStoryManager.tsx` - Existing team story management

---

## Questions to Resolve

1. **Story Permissions**: Should all team members be able to edit all team stories, or only admins?
   - **Recommendation**: All members can edit (true collaboration)

2. **Default Context**: Should Library default to "All Stories" or "My Stories"?
   - **Recommendation**: "All Stories" (discover team content)

3. **Story Transfer**: Allow moving personal stories to teams? Teams to personal?
   - **Recommendation**: Yes, via "Assign to Team" button

4. **Team Story Deletion**: Who can delete team stories?
   - **Recommendation**: Story creator + team owner/admin

5. **IndexedDB Schema**: Should team stories have separate store or share with personal?
   - **Recommendation**: Share same store (simpler, they're all stories)

---

## Conclusion

Team story integration into the Library is **essential for team collaboration**. The existing infrastructure (backend endpoints, StoryService methods, IndexedDB) makes this a **medium-complexity** enhancement focused primarily on:

1. UI/UX changes to StoryLibrary
2. Context switching logic
3. Data fetching from multiple teams

The implementation can be **incremental**, starting with basic team story display and progressively adding features like context switching, URL state, and backend optimization.

**Estimated Effort**: 3-4 days for core functionality, 1-2 weeks for polished release.

**Risk Level**: Low - leverages existing patterns and infrastructure.

**User Impact**: High - unlocks core team collaboration workflow.
