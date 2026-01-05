# Implementation Plan: Group Stories Feature

**Requirements Document**: [GROUP_STORIES_REQUIREMENTS.md](./GROUP_STORIES_REQUIREMENTS.md)

**Total Estimated Effort**: 7-9 days

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

## Phase 2: Backend Changes (2-3 days)

### Task 2.1: Update Validation Schema
**File**: `backend/modules/validation-schemas.ts`
**Effort**: 0.5 day

- [ ] Add `protagonistType` enum validation
- [ ] Add `ageRange` enum validation
- [ ] Add conditional validation (character required for individual, ageRange for group)
- [ ] Ensure backward compatibility (default to 'individual')

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
**Effort**: 1.5 days

#### Sub-task 2.2.1: Add Age Range Label Mapping
```typescript
const AGE_RANGE_LABELS: Record<string, string> = {
  'young_children': 'preschool or kindergarten age children (4-6 years old)',
  'children': 'elementary school age children (7-10 years old)',
  'tweens': 'middle school age tweens (11-13 years old)',
  'teens': 'high school age teenagers (14-17 years old)',
};
```

#### Sub-task 2.2.2: Create Group Story Prompt Template
- [ ] Create new prompt section for group stories
- [ ] Include character generation instructions
- [ ] Include narrative style requirements
- [ ] Include image description requirements

```typescript
const buildGroupStoryPrompt = (params: GenerateStoryParams): string => {
  const ageRangeLabel = AGE_RANGE_LABELS[params.ageRange!];

  return `
You are a social story creator. Create a story that is accurate, descriptive,
meaningful, and safe for a ${params.audience} audience.

PROTAGONIST TYPE: GROUP
This is a story about a group of friends who learn together.

AGE RANGE: ${ageRangeLabel}
Generate 3-4 diverse child characters appropriate for this age range.

SOCIAL SKILL: ${params.socialSkill}
The group learns this lesson together through their shared experience.

SITUATION: ${params.situation}

CHARACTER GENERATION REQUIREMENTS:
1. Create 3-4 distinct characters with different names, appearances, and personalities
2. Include diverse representation (mix of genders, appearances)
3. All characters are EQUAL protagonists - no "main" character
4. Characters should have distinct but complementary traits
5. Each character should contribute meaningfully to the story

NARRATIVE REQUIREMENTS:
1. Use third person plural throughout ("they", "the friends", "the group")
2. Give each character moments to shine
3. Show the group working together and supporting each other
4. The lesson is learned collectively, not by one character teaching others

In main_characters_overall_appearance, describe ALL characters distinctly.
Example format: "Maya is a 9-year-old girl with curly brown hair and glasses.
Jordan is an 8-year-old boy with short black hair and a big smile.
Sam is a 9-year-old non-binary child with blonde hair in a ponytail..."
`;
};
```

#### Sub-task 2.2.3: Update Main Prompt Builder
- [ ] Branch based on `protagonistType`
- [ ] Use existing prompt for individual stories
- [ ] Use new prompt for group stories

```typescript
const buildStoryPrompt = (params: GenerateStoryParams): string => {
  if (params.protagonistType === 'group') {
    return buildGroupStoryPrompt(params);
  }
  return buildIndividualStoryPrompt(params); // Existing logic
};
```

### Task 2.3: Backend Testing
**Effort**: 0.5 day

- [ ] Unit test validation schema with individual story params
- [ ] Unit test validation schema with group story params
- [ ] Unit test validation rejects invalid combinations
- [ ] Test prompt generation for group stories
- [ ] Integration test: generate a group story end-to-end

---

## Phase 3: Integration & Polish (1-2 days)

### Task 3.1: End-to-End Testing
**Effort**: 0.5 day

- [ ] Test individual story creation (full flow, no regression)
- [ ] Test group story creation (all age ranges)
- [ ] Test form validation errors display correctly
- [ ] Test generated story has multiple characters
- [ ] Test illustrations show group (not single character)

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
| Phase 2: Backend | 3 tasks | 2-3 days |
| Phase 3: Integration | 5 tasks | 1-2 days |
| Phase 4: Deployment | 3 tasks | 0.5 day |
| **Total** | **16 tasks** | **7-9 days** |

---

## Files Modified Summary

### Frontend (5 files)
1. `src/types.ts` - Type definitions
2. `src/components/AIStoryGenerator.tsx` - Main UI changes
3. `src/hooks/useStoryGenerationSSE.ts` - Hook interface
4. `src/locales/en/components/aiGenerator.json` - English translations
5. `src/locales/es/components/aiGenerator.json` - Spanish translations

### Backend (2 files)
1. `modules/validation-schemas.ts` - Request validation
2. `modules/icraft-genAi.ts` - AI prompt generation

### No New Files Required
All changes are modifications to existing files.
