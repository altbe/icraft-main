# Implementation Plan: Group Stories Feature

**Requirements Document**: [GROUP_STORIES_REQUIREMENTS.md](./GROUP_STORIES_REQUIREMENTS.md)
**Design Document**: [GROUP_STORIES_DESIGN_V2.md](./GROUP_STORIES_DESIGN_V2.md)
**Version**: 1.2
**Last Updated**: 2025-01-09

**Total Estimated Effort**: 9-12 days (updated for v1.2 requirements)

---

## Phase 1: Frontend UI (3-4 days)

### Task 1.1: Update Type Definitions
**File**: `frontend/src/types.ts`
**Effort**: 0.5 day

- [ ] Add `protagonistType: 'individual' | 'group'` to `AIGeneratorParams`
- [ ] Add `ageRange?: 'young_children' | 'children' | 'tweens' | 'teens'` to `AIGeneratorParams`
- [ ] Make `character` field optional (required only when `protagonistType === 'individual'`)
- [ ] Update any related type exports

```typescript
// Changes to AIGeneratorParams
export interface AIGeneratorParams {
  protagonistType: 'individual' | 'group';  // NEW
  ageRange?: 'young_children' | 'children' | 'tweens' | 'teens';  // NEW
  character?: {  // Now optional
    name: string;
    age: number;
    gender: 'neutral' | 'male' | 'female';
    description?: string;
  };
  // ... rest unchanged
}
```

### Task 1.2: Update SSE Hook Interface
**File**: `frontend/src/hooks/useStoryGenerationSSE.ts`
**Effort**: 0.25 day

- [ ] Update `StoryGenerationParams` interface to match `AIGeneratorParams` changes
- [ ] Ensure backward compatibility with existing calls

### Task 1.3: Add Translation Strings
**Files**:
- `frontend/src/locales/en/components/aiGenerator.json`
- `frontend/src/locales/es/components/aiGenerator.json`
**Effort**: 0.5 day

English strings to add:
```json
{
  "protagonistType": {
    "label": "Who is the story about?",
    "individual": {
      "label": "Individual",
      "description": "A story about one child"
    },
    "group": {
      "label": "Group",
      "description": "A story about friends learning together"
    }
  },
  "ageRange": {
    "label": "Age Range",
    "helpText": "The AI will create a diverse group of friends in this age range.",
    "options": {
      "young_children": "Young Children (4-6)",
      "children": "Children (7-10)",
      "tweens": "Tweens (11-13)",
      "teens": "Teens (14-17)"
    }
  }
}
```

Spanish translations:
```json
{
  "protagonistType": {
    "label": "¿De quién trata la historia?",
    "individual": {
      "label": "Individual",
      "description": "Una historia sobre un niño"
    },
    "group": {
      "label": "Grupo",
      "description": "Una historia sobre amigos aprendiendo juntos"
    }
  },
  "ageRange": {
    "label": "Rango de edad",
    "helpText": "La IA creará un grupo diverso de amigos en este rango de edad.",
    "options": {
      "young_children": "Niños pequeños (4-6)",
      "children": "Niños (7-10)",
      "tweens": "Preadolescentes (11-13)",
      "teens": "Adolescentes (14-17)"
    }
  }
}
```

### Task 1.4: Update AIStoryGenerator Component
**File**: `frontend/src/components/AIStoryGenerator.tsx`
**Effort**: 2 days

#### Sub-task 1.4.1: Add State for New Fields
- [ ] Add `protagonistType` state with default `'individual'`
- [ ] Add `ageRange` state with default `'children'`

```typescript
const [protagonistType, setProtagonistType] = useState<'individual' | 'group'>('individual');
const [ageRange, setAgeRange] = useState<'young_children' | 'children' | 'tweens' | 'teens'>('children');
```

#### Sub-task 1.4.2: Add Protagonist Type Radio Buttons
- [ ] Create radio button group as first form field
- [ ] Style with large tap targets for mobile
- [ ] Add descriptions below each option

```tsx
<div className="space-y-3">
  <Label>{t('protagonistType.label')} *</Label>
  <RadioGroup value={protagonistType} onValueChange={setProtagonistType}>
    <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
      <RadioGroupItem value="individual" id="protagonist-individual" />
      <div>
        <Label htmlFor="protagonist-individual" className="font-medium">
          {t('protagonistType.individual.label')}
        </Label>
        <p className="text-sm text-muted-foreground">
          {t('protagonistType.individual.description')}
        </p>
      </div>
    </div>
    <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
      <RadioGroupItem value="group" id="protagonist-group" />
      <div>
        <Label htmlFor="protagonist-group" className="font-medium">
          {t('protagonistType.group.label')}
        </Label>
        <p className="text-sm text-muted-foreground">
          {t('protagonistType.group.description')}
        </p>
      </div>
    </div>
  </RadioGroup>
</div>
```

#### Sub-task 1.4.3: Add Age Range Dropdown (Conditional)
- [ ] Show only when `protagonistType === 'group'`
- [ ] Add help text below dropdown

```tsx
{protagonistType === 'group' && (
  <div className="space-y-2">
    <Label>{t('ageRange.label')} *</Label>
    <Select value={ageRange} onValueChange={setAgeRange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="young_children">{t('ageRange.options.young_children')}</SelectItem>
        <SelectItem value="children">{t('ageRange.options.children')}</SelectItem>
        <SelectItem value="tweens">{t('ageRange.options.tweens')}</SelectItem>
        <SelectItem value="teens">{t('ageRange.options.teens')}</SelectItem>
      </SelectContent>
    </Select>
    <p className="text-sm text-muted-foreground">{t('ageRange.helpText')}</p>
  </div>
)}
```

#### Sub-task 1.4.4: Implement Conditional Field Display
- [ ] Hide character fields when `protagonistType === 'group'`
- [ ] Hide POV dropdown when `protagonistType === 'group'`
- [ ] Add smooth transition animation

```tsx
{protagonistType === 'individual' && (
  <div className="space-y-4 animate-in fade-in duration-200">
    {/* Character Name */}
    {/* Character Age */}
    {/* Character Gender */}
    {/* Character Description */}
    {/* Point of View */}
  </div>
)}
```

#### Sub-task 1.4.5: Update Validation Logic
- [ ] Make character fields required only for individual
- [ ] Make ageRange required only for group
- [ ] Update form validation state

```typescript
const isFormValid = useMemo(() => {
  // Common validations
  if (!socialSkill || situation.length < 10) return false;

  if (protagonistType === 'individual') {
    if (!character.name || character.name.length < 2) return false;
    if (!character.age || character.age < 1) return false;
  } else {
    if (!ageRange) return false;
  }

  return true;
}, [protagonistType, socialSkill, situation, character, ageRange]);
```

#### Sub-task 1.4.6: Update API Parameter Building
- [ ] Include `protagonistType` in request
- [ ] Include `ageRange` for group stories
- [ ] Force `pointOfView: 'third'` for group stories
- [ ] Exclude character fields for group stories

```typescript
const buildParams = (): AIGeneratorParams => {
  const baseParams = {
    protagonistType,
    socialSkill,
    situation,
    audience,
    numPages,
    language: i18n.language,
    storyId,
    userId,
    deviceId,
  };

  if (protagonistType === 'individual') {
    return {
      ...baseParams,
      character: {
        name: characterName,
        age: characterAge,
        gender: characterGender,
        description: characterDescription,
      },
      pointOfView,
    };
  } else {
    return {
      ...baseParams,
      ageRange,
      pointOfView: 'third', // Forced for groups
    };
  }
};
```

### Task 1.5: Testing & Polish
**Effort**: 0.5 day

- [ ] Test individual story flow (no regression)
- [ ] Test group story flow (new feature)
- [ ] Test form switching between individual/group
- [ ] Test mobile responsiveness
- [ ] Test keyboard navigation
- [ ] Verify translations display correctly

---

## Phase 2: Backend Changes (4-5 days)

### Task 2.1: Update Validation Schema
**File**: `backend/modules/validation-schemas.ts`
**Effort**: 0.5 day

- [ ] Add `protagonistType` enum validation
- [ ] Add `ageRange` enum validation
- [ ] Add conditional validation (character required for individual, ageRange for group)
- [ ] Ensure backward compatibility (default to 'individual')
- [ ] Add group skills enum validation (separate from individual skills)

```typescript
// Add to GenerateStorySchema
protagonistType: z.enum(['individual', 'group']).default('individual'),

ageRange: z.enum(['young_children', 'children', 'tweens', 'teens']).optional(),

// Update character to be optional
character: z.object({
  name: PromptSafeString(50, 'Character name'),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.enum(['neutral', 'male', 'female']),
  description: PromptSafeStringAllowEmpty(999, 'Character description').optional()
}).optional(),

// Add refinements for conditional validation
.refine(
  data => {
    if (data.protagonistType === 'individual') {
      return data.character?.name && data.character?.age;
    }
    return true;
  },
  { message: 'Character name and age are required for individual stories' }
)
.refine(
  data => {
    if (data.protagonistType === 'group') {
      return data.ageRange !== undefined;
    }
    return true;
  },
  { message: 'Age range is required for group stories' }
)
```

### Task 2.2: Update AI Prompt Generation
**File**: `backend/modules/icraft-genAi.ts`
**Effort**: 2.5 days

#### Sub-task 2.2.1: Add Age Range Label Mapping
```typescript
const AGE_RANGE_LABELS: Record<string, string> = {
  'young_children': 'preschool or kindergarten age children (4-6 years old)',
  'children': 'elementary school age children (7-10 years old)',
  'tweens': 'middle school age tweens (11-13 years old)',
  'teens': 'high school age teenagers (14-17 years old)',
};
```

#### Sub-task 2.2.2: Create Group Story Prompt Template (v1.2)
- [ ] Create new prompt section for group stories with v1.2 requirements
- [ ] Include title generation rules (2-6 words, no names, no directives)
- [ ] Include story text rules (40-60 words per page)
- [ ] Include page-specific content constraints
- [ ] Include support cue generation for pages 1-6
- [ ] Include image guidance per page

```typescript
const buildGroupStoryPrompt = (params: GenerateStoryParams): string => {
  const ageRangeLabel = AGE_RANGE_LABELS[params.ageRange!];

  return `
You are a social story creator. Create a story that is accurate, descriptive,
meaningful, and safe for a ${params.audience} audience.

PROTAGONIST TYPE: GROUP
This is a story about a group of children learning together.

AGE RANGE: ${ageRangeLabel}

SOCIAL SKILL: ${params.socialSkill}
The group learns this lesson together through their shared experience.

SITUATION: ${params.situation}

=== OUTPUT STRUCTURE (6 STORY PAGES + SEPARATE COVER) ===

COVER (handled via cover_page_* fields, NOT in pages array):
- Generate TITLE ONLY (no story text)
- Title Rules:
  - 2-6 words maximum
  - Title Case format
  - NO names (people, classes, locations)
  - NO "I" language
  - NO directives ("learning to," "how to," "should")
  - NO emotional labeling ("feeling angry," "managing anxiety")
  - Valid examples: "Taking Turns Together", "Sharing Space at School"
- Image instruction via cover_page_image_instruction field
- Coaching content via cover_page_coaching_content field

=== STORY TEXT RULES (ALL PAGES 1-6) ===

Word Count: 40-60 words per page (STRICT - regenerate if outside range)

Language Rules:
- NO character names (no proper names anywhere)
- NO first-person child POV (no "I," "my" as narrator)
- USE group-based language: "we", "the group", "children", "some…others…"
- NO directives: "must," "should," "have to"
- NO dialogue or quotation marks
- NO time jumps ("later that week," "after many days")
- Non-clinical, non-diagnostic language only

=== PAGE-SPECIFIC REQUIREMENTS ===

Page 1 - SITUATION:
- Content: Describes a common shared scenario
- Constraints: Neutral, descriptive; NO emotions or solutions introduced
- Image guidance: Neutral shared scenario

Page 2 - PERSPECTIVE:
- Content: Shows neutral differences in noticing or thinking
- Constraints: NO right vs. wrong framing; uses "some…others…"
- Image guidance: Subtle different reactions

Page 3 - FEELING:
- Content: Uses plural or range-based feelings
- Constraints: Gentle, non-escalated emotional tone; no single emotional arc
- Image guidance: Gentle, safe emotions

Page 4 - POSITIVE CHOICE:
- Content: Models 1-2 helpful options
- Constraints: Focus on effort, NOT correctness; NO directives or commands
- Image guidance: Helpful group behaviors

Page 5 - COMMUNITY OUTCOME:
- Content: Shows shared benefit to the group
- Constraints: Emphasizes belonging, fairness, or flow; NO praise, rewards, or evaluation
- Image guidance: Shared success

Page 6 - REINFORCEMENT:
- Content: Forward-looking and reusable
- Constraints: Collective language only ("we," "friends"); NO reflection questions; NO assessment or goals
- Image guidance: Group continuing activity naturally

=== SUPPORT CUE (Pages 1-6 ONLY, NOT Cover) ===

For EACH page 1-6, include a support_cue object with:
- when_to_use: [1 short line - when educator should use this page]
- what_to_emphasize: [1 short line - key point to highlight]
- reinforce_later: [optional, 1 short line - connection to future use]

Support Cue Rules:
- Each field maximum 1 short line
- Readable in under 5 seconds
- Supportive, non-instructional tone
- Must align with page step intent
- NO individual child focus
- NEVER use these words: teach, coach, manage, intervene, correct, assess

=== IMAGE GENERATION ===

In main_characters_overall_appearance, describe the GROUP (not individuals with names):
- Describe 3-4 children in the age range
- Include diverse representation (mix of appearances)
- Do NOT use names - use descriptive terms like "one child", "another child"
- Example: "A group of four children aged 7-10. One has curly brown hair and glasses.
  Another has short black hair and a bright smile. A third has blonde hair in a ponytail..."
`;
};
```

#### Sub-task 2.2.3: Update Main Prompt Builder
- [ ] Branch based on `protagonistType`
- [ ] Use existing prompt for individual stories
- [ ] Use new v1.2 prompt for group stories
- [ ] Force `numPages = 6` for group stories (cover handled separately via cover_page_* fields)

```typescript
const buildStoryPrompt = (params: GenerateStoryParams): string => {
  if (params.protagonistType === 'group') {
    // Force 6 story pages for group stories (cover handled via cover_page_* fields)
    params.numPages = 6;
    return buildGroupStoryPrompt(params);
  }
  return buildIndividualStoryPrompt(params); // Existing logic
};
```

### Task 2.3: Add AI Output Validation
**File**: `backend/modules/validation-schemas.ts` or new `story-validation.ts`
**Effort**: 1 day

- [ ] Create `validateGroupStoryOutput()` function
- [ ] Validate title length (2-6 words)
- [ ] Validate title content (no prohibited words/patterns)
- [ ] Validate page word count (40-60 words each)
- [ ] Validate no character names in text
- [ ] Validate no first-person POV
- [ ] Validate support cue exists for pages 1-6
- [ ] Validate support cue restricted words not used
- [ ] If validation fails, regenerate or flag for review

```typescript
interface GroupStoryValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateGroupStoryOutput(story: GeneratedStory): GroupStoryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Title validation
  const titleWords = story.title.split(/\s+/).length;
  if (titleWords < 2 || titleWords > 6) {
    errors.push(`Title word count ${titleWords} outside 2-6 range`);
  }

  // Check for prohibited title content
  const prohibitedTitlePatterns = [/\bI\b/i, /learning to/i, /how to/i, /should/i];
  // ... validation logic

  // Page word count validation
  for (const page of story.pages.filter(p => p.pageNumber > 0)) {
    const wordCount = page.text.split(/\s+/).length;
    if (wordCount < 40 || wordCount > 60) {
      errors.push(`Page ${page.pageNumber} word count ${wordCount} outside 40-60 range`);
    }
  }

  // Support cue validation for pages 1-6
  const restrictedWords = ['teach', 'coach', 'manage', 'intervene', 'correct', 'assess'];
  // ... validation logic

  return { isValid: errors.length === 0, errors, warnings };
}
```

### Task 2.4: Backend Testing
**Effort**: 1 day

- [ ] Unit test validation schema with individual story params
- [ ] Unit test validation schema with group story params
- [ ] Unit test validation rejects invalid combinations
- [ ] Test prompt generation for group stories (v1.2 format)
- [ ] Test AI output validation function
- [ ] Test title validation (2-6 words, prohibited patterns)
- [ ] Test word count validation (40-60 per page)
- [ ] Test support cue validation
- [ ] Integration test: generate a group story end-to-end
- [ ] Verify 6 story pages generated (cover handled separately)

---

## Phase 3: Integration & Polish (2-3 days)

### Task 3.1: End-to-End Testing
**Effort**: 1 day

- [ ] Test individual story creation (full flow, no regression)
- [ ] Test group story creation (all age ranges)
- [ ] Test group story creation (all 10 group skills)
- [ ] Test form validation errors display correctly
- [ ] Verify 6 story pages + cover generated (cover via cover_page_* fields)
- [ ] Verify title follows rules (2-6 words, no prohibited content)
- [ ] Verify each page has 40-60 words
- [ ] Verify no character names in text
- [ ] Verify group language used ("we", "the group", etc.)
- [ ] Verify support cues generated for pages 1-6
- [ ] Verify support cues don't use restricted words
- [ ] Test illustrations show group (not single character)
- [ ] Test cover has image and title only (no text in image)

### Task 3.2: Accessibility Testing
**Effort**: 0.25 day

- [ ] Keyboard navigation through all form fields
- [ ] Screen reader announces protagonist type change
- [ ] Focus management when fields show/hide
- [ ] Error messages associated with fields

### Task 3.3: Mobile Testing
**Effort**: 0.25 day

- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Verify tap targets are large enough
- [ ] Verify form fits on small screens

### Task 3.4: QA Review & Bug Fixes
**Effort**: 0.5 day

- [ ] Address any issues found in testing
- [ ] Review generated story quality
- [ ] Verify character diversity in generated stories

### Task 3.5: Documentation
**Effort**: 0.25 day

- [ ] Update any user-facing documentation
- [ ] Add feature to changelog

---

## Phase 4: Deployment

### Task 4.1: Deploy to QA
- [ ] Deploy frontend changes to QA
- [ ] Deploy backend changes to QA
- [ ] Smoke test in QA environment

### Task 4.2: Deploy to Production
- [ ] Deploy frontend to production
- [ ] Deploy backend to production
- [ ] Monitor for errors

### Task 4.3: Post-Launch Monitoring
- [ ] Monitor Sentry for new errors
- [ ] Track protagonist type selection analytics
- [ ] Gather user feedback

---

## Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Frontend UI | 5 tasks | 3-4 days |
| Phase 2: Backend | 4 tasks | 4-5 days |
| Phase 3: Integration | 5 tasks | 2-3 days |
| Phase 4: Deployment | 3 tasks | 0.5 day |
| **Total** | **17 tasks** | **9-12 days** |

### Key v1.2 Changes Implemented

1. **6 Story Pages + Separate Cover**: numPages=6, cover handled via cover_page_* fields (not in pages array)
2. **Title Rules**: 2-6 words, no names, no directives, Title Case
3. **Word Count**: 40-60 words per page (strict enforcement)
4. **Story Text Rules**: No character names, no first-person POV, group language only
5. **Support Cue**: New feature for pages 1-6 with specific format and restricted words
6. **Image Guidance**: Page-specific image requirements
7. **AI Output Validation**: New validation layer for generated content

---

## Files Modified Summary

### Frontend (5 files)
1. `src/types.ts` - Type definitions (add skill constants, SupportCue interface)
2. `src/components/AIStoryGenerator.tsx` - Main UI changes
3. `src/hooks/useStoryGenerationSSE.ts` - Hook interface
4. `src/locales/en/components/aiGenerator.json` - English translations (group skills)
5. `src/locales/es/components/aiGenerator.json` - Spanish translations (group skills)

### Backend (3 files)
1. `modules/validation-schemas.ts` - Request validation + group skills enum
2. `modules/icraft-genAi.ts` - AI prompt generation (v1.2 format)
3. `modules/story-validation.ts` - **NEW**: AI output validation for group stories

### New Functionality Added (v1.2)
- Support Cue generation for pages 1-6
- Title validation (2-6 words, prohibited content)
- Word count validation (40-60 per page)
- Content validation (no names, group language, etc.)
