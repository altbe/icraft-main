# Group Stories Design v2

**Status:** Draft
**Created:** 2025-01-09
**Last Updated:** 2025-01-09

## Overview

This document specifies the design changes to AI story generation to support distinct skill sets and page frameworks for Individual (Social) Stories versus Group Stories.

## Design Principles

1. **No changes to existing Individual Stories** - All 17 current social skills remain unchanged
2. **Additive Group Skills** - New dedicated skill list for group stories (10 skills)
3. **Fixed Group Framework** - Group stories use a 6-page framework (must not change)
4. **Strict Skill Lists** - Each story type uses only its designated skills

---

## Story Types

### Individual Stories (Social Stories)

Stories about a single protagonist learning a social skill.

**Characteristics:**
- Single main character with customizable name, age, gender, description
- First or third person point of view
- User-selectable page count (3, 5, or 7 pages)
- Dynamic page framework based on page count

### Group Stories

Stories about a group of friends learning together.

**Characteristics:**
- 3-4 AI-generated diverse characters (no user customization)
- Third person plural narrative only ("they", "the friends", "the group")
- Age range selector instead of specific age
- Fixed 6-page framework (not user-selectable)

---

## Skill Lists

### Individual Story Skills (Unchanged - 17 skills)

These are the existing skills. No changes.

| Skill ID | Display Label (EN) |
|----------|-------------------|
| `bravery` | Bravery and Confidence |
| `communication` | Communication |
| `empathyAndKindness` | Empathy and Kindness |
| `rules` | Following Rules |
| `friendship` | Friendship |
| `honesty` | Honesty |
| `patience` | Patience |
| `perseverance` | Perseverance |
| `problemSolving` | Problem Solving |
| `respect` | Respect for Others |
| `responsibility` | Responsibility |
| `adaptabilityAndFlexibility` | Adaptability and Flexibility |
| `teamwork` | Teamwork |
| `hygiene` | Personal Hygiene |
| `dailyLivingSkillsAndRoutines` | Daily Living Skills & Routines |
| `emotionalRegulation` | Emotional Regulation |
| `listeningAndAttention` | Listening and Attention |

### Group Story Skills (New - 10 skills)

These are new skills designed for collective/group dynamics.

| Skill ID | Display Label (EN) |
|----------|-------------------|
| `collaborationAndSharedCreation` | Collaboration & Shared Creation |
| `conflictResolution` | Conflict Resolution |
| `empathyAndKindnessGroup` | Empathy & Kindness |
| `inclusionAndBelonging` | Inclusion & Belonging |
| `listeningAndUnderstandingOthers` | Listening & Understanding Others |
| `sharedResponsibility` | Shared Responsibility |
| `teamworkAndRoles` | Teamwork & Roles |
| `adaptingTogether` | Adapting Together |
| `respectingPersonalSpace` | Respecting Personal Space |
| `managingFeelingsTogether` | Managing Feelings Together |

**Note:** `empathyAndKindnessGroup` is distinct from the individual `empathyAndKindness` to allow different prompt handling and translations if needed.

---

## Page Frameworks

### Individual Story Framework (Unchanged)

Dynamic framework based on user-selected page count:

**4+ pages:**
- Page 1: Introduction and scene setting
- Pages 2 to (n-2): Presentation of challenges and obstacles
- Page (n-1): Climax
- Page n: Conclusion and resolution with positive reinforcement

**3 pages:**
- Page 1: Introduction and scene setting
- Page 2: Combined challenges, obstacles, and climax
- Page 3: Resolution (don't present solution, let character experience feelings)

**1 page:**
- Single concise story combining all elements

### Group Story Framework (New - Fixed 6 Pages)

This framework is based on Carol Gray's Social Story model adapted for group dynamics.

| Page | Purpose | Carol's Model Element | Content Focus |
|------|---------|----------------------|---------------|
| Cover | Shared Group Moment | Scene setting | Group together, introducing the setting |
| Page 1 | Situation | Descriptive | What's happening to the group |
| Page 2 | Perspective | Perspective | How different members see/understand it |
| Page 3 | Feeling | Affirmative | Emotions within the group, validation |
| Page 4 | Positive Choice | Directive/Cooperative | Group decides on positive action |
| Page 5 | Community Outcome | Consequence | Results of working together |
| Page 6 | Reinforcement | Control | Carry-forward lesson, reflection |

**Important:** This framework must not change. Group stories are always 6 pages (plus cover).

---

## UI Changes

### Skill Selector

**Current behavior:** Single dropdown with all 17 skills for both story types.

**New behavior:**
- Individual stories: Show Individual Story Skills (17)
- Group stories: Show Group Story Skills (10)

```typescript
// AIStoryGenerator.tsx
const INDIVIDUAL_SKILLS = [
  'bravery', 'communication', 'empathyAndKindness', 'rules', 'friendship',
  'honesty', 'patience', 'perseverance', 'problemSolving', 'respect',
  'responsibility', 'adaptabilityAndFlexibility', 'teamwork', 'hygiene',
  'dailyLivingSkillsAndRoutines', 'emotionalRegulation', 'listeningAndAttention'
];

const GROUP_SKILLS = [
  'collaborationAndSharedCreation', 'conflictResolution', 'empathyAndKindnessGroup',
  'inclusionAndBelonging', 'listeningAndUnderstandingOthers', 'sharedResponsibility',
  'teamworkAndRoles', 'adaptingTogether', 'respectingPersonalSpace',
  'managingFeelingsTogether'
];

// Conditional rendering
const availableSkills = protagonistType === 'group' ? GROUP_SKILLS : INDIVIDUAL_SKILLS;
```

### Page Count Selector

**Current behavior:** User selects 3, 5, or 7 pages for all story types.

**New behavior:**
- Individual stories: User selects 3, 5, or 7 pages (unchanged)
- Group stories: Hidden or locked at 6 pages

```typescript
// AIStoryGenerator.tsx
{protagonistType === 'individual' && (
  <Select value={numPages} onValueChange={setNumPages}>
    <SelectItem value="3">3 pages</SelectItem>
    <SelectItem value="5">5 pages</SelectItem>
    <SelectItem value="7">7 pages</SelectItem>
  </Select>
)}

{protagonistType === 'group' && (
  <div className="text-muted-foreground">
    {t('groupSkills.fixedPageCount', '6 pages (fixed framework)')}
  </div>
)}
```

---

## Backend Changes

### Prompt Updates

The group story prompt (`buildGroupStoryPromptMessages`) needs to be updated to use the fixed 6-page framework.

**Current (dynamic):**
```typescript
content: `The story must be exactly ${storyParams.numPages} pages...
- If numPages is 4 or more: [dynamic structure]
- If numPages is 3: [compressed structure]
- If numPages is 1: [single page]`
```

**New (fixed 6-page framework):**
```typescript
content: `The story must be exactly 6 pages following this framework:

Page 1 - SITUATION: Introduce the friend group and describe what's happening.
Set the scene where the group encounters a challenge or opportunity related to ${storyParams.socialSkill}.
Focus on descriptive sentences about the setting and characters.

Page 2 - PERSPECTIVE: Show how different group members see or understand the situation.
Each character may have a different viewpoint, concern, or idea.
Include perspective sentences showing what characters might be thinking.

Page 3 - FEELING: Acknowledge and validate the emotions within the group.
Show how different characters feel about the situation.
Include affirmative sentences that validate these feelings as normal and okay.

Page 4 - POSITIVE CHOICE: The group discusses and decides on a positive action together.
Show the collaborative decision-making process.
Include cooperative sentences about how characters help each other.

Page 5 - COMMUNITY OUTCOME: Show the positive results of working together.
The group experiences the benefits of their collective choice.
Connect the outcome to the social skill being learned.

Page 6 - REINFORCEMENT: Reinforce the lesson and show how it carries forward.
The group reflects on what they learned about ${storyParams.socialSkill}.
End with a forward-looking statement about using this skill in the future.`
```

### Validation Schema Updates

Update `validation-schemas.ts` to include the new group skills:

```typescript
const individualSkills = z.enum([
  'bravery', 'communication', 'empathyAndKindness', 'rules', 'friendship',
  'honesty', 'patience', 'perseverance', 'problemSolving', 'respect',
  'responsibility', 'adaptabilityAndFlexibility', 'teamwork', 'hygiene',
  'dailyLivingSkillsAndRoutines', 'emotionalRegulation', 'listeningAndAttention'
]);

const groupSkills = z.enum([
  'collaborationAndSharedCreation', 'conflictResolution', 'empathyAndKindnessGroup',
  'inclusionAndBelonging', 'listeningAndUnderstandingOthers', 'sharedResponsibility',
  'teamworkAndRoles', 'adaptingTogether', 'respectingPersonalSpace',
  'managingFeelingsTogether'
]);

// In GenerateStorySchema
socialSkill: z.union([individualSkills, groupSkills]),
```

---

## Translation Updates

### English (`aiGenerator.json`)

Add new section for group skills:

```json
{
  "groupSkills": {
    "label": "Group Skill",
    "collaborationAndSharedCreation": "Collaboration & Shared Creation",
    "conflictResolution": "Conflict Resolution",
    "empathyAndKindnessGroup": "Empathy & Kindness",
    "inclusionAndBelonging": "Inclusion & Belonging",
    "listeningAndUnderstandingOthers": "Listening & Understanding Others",
    "sharedResponsibility": "Shared Responsibility",
    "teamworkAndRoles": "Teamwork & Roles",
    "adaptingTogether": "Adapting Together",
    "respectingPersonalSpace": "Respecting Personal Space",
    "managingFeelingsTogether": "Managing Feelings Together",
    "fixedPageCount": "6 pages (fixed framework)"
  }
}
```

### Spanish (`aiGenerator.json`)

```json
{
  "groupSkills": {
    "label": "Habilidad de Grupo",
    "collaborationAndSharedCreation": "Colaboracion y Creacion Compartida",
    "conflictResolution": "Resolucion de Conflictos",
    "empathyAndKindnessGroup": "Empatia y Amabilidad",
    "inclusionAndBelonging": "Inclusion y Pertenencia",
    "listeningAndUnderstandingOthers": "Escuchar y Entender a Otros",
    "sharedResponsibility": "Responsabilidad Compartida",
    "teamworkAndRoles": "Trabajo en Equipo y Roles",
    "adaptingTogether": "Adaptarse Juntos",
    "respectingPersonalSpace": "Respetar el Espacio Personal",
    "managingFeelingsTogether": "Manejar Sentimientos Juntos",
    "fixedPageCount": "6 paginas (estructura fija)"
  }
}
```

---

## Database Considerations

### Backward Compatibility

- Existing stories with old skills remain accessible and functional
- No migration needed - skills are stored as strings
- Old group stories (using individual skills) will display correctly

### New Stories

- Group stories created after this change will only use group skills
- Frontend validation prevents selecting individual skills for group stories
- Backend validation ensures skill matches protagonist type

---

## Modular Code Structure

### Frontend Structure

```
frontend/src/
├── types.ts                          # Add skill constants and types
│   ├── INDIVIDUAL_SKILLS             # Existing 17 skills (as const array)
│   ├── GROUP_SKILLS                  # New 10 skills (as const array)
│   ├── IndividualSkill               # Type derived from array
│   ├── GroupSkill                    # Type derived from array
│   └── SocialSkill                   # Union type for all skills
│
├── components/
│   └── AIStoryGenerator.tsx          # Import skills from types.ts
│       └── Use conditional: protagonistType === 'group' ? GROUP_SKILLS : INDIVIDUAL_SKILLS
│
└── locales/
    ├── en/components/aiGenerator.json  # Add nested groupSkills section
    └── es/components/aiGenerator.json  # Add nested groupSkills section
```

### Backend Structure

```
backend/modules/
├── story-prompts.ts                  # NEW: Modular prompt builders
│   ├── INDIVIDUAL_PAGE_FRAMEWORK     # Existing dynamic framework config
│   ├── GROUP_PAGE_FRAMEWORK          # New fixed 6-page framework config
│   ├── buildIndividualStoryPrompt()  # Extract from icraft-genAi.ts
│   ├── buildGroupStoryPrompt()       # Extract from icraft-genAi.ts
│   └── buildSecurePrompt()           # Shared security wrapper
│
├── icraft-genAi.ts                   # Import from story-prompts.ts
│   └── generateStory()               # Uses imported prompt builders
│
└── validation-schemas.ts             # Import skill types
    └── GenerateStorySchema           # Validate skill matches protagonist type
```

---

## Frontend Type Definitions

### `types.ts` - Skill Constants and Types

```typescript
// ========== STORY SKILL DEFINITIONS ==========

/**
 * Individual Story Skills (Social Stories)
 * For stories about a single protagonist learning a social skill.
 * These are the original 17 skills - DO NOT MODIFY.
 */
export const INDIVIDUAL_SKILLS = [
  'bravery',
  'communication',
  'empathyAndKindness',
  'rules',
  'friendship',
  'honesty',
  'patience',
  'perseverance',
  'problemSolving',
  'respect',
  'responsibility',
  'adaptabilityAndFlexibility',
  'teamwork',
  'hygiene',
  'dailyLivingSkillsAndRoutines',
  'emotionalRegulation',
  'listeningAndAttention',
] as const;

/**
 * Group Story Skills
 * For stories about a group of friends learning together.
 * Designed for collective/group dynamics.
 */
export const GROUP_SKILLS = [
  'collaborationAndSharedCreation',
  'conflictResolution',
  'empathyAndKindnessGroup',
  'inclusionAndBelonging',
  'listeningAndUnderstandingOthers',
  'sharedResponsibility',
  'teamworkAndRoles',
  'adaptingTogether',
  'respectingPersonalSpace',
  'managingFeelingsTogether',
] as const;

// Derived types
export type IndividualSkill = typeof INDIVIDUAL_SKILLS[number];
export type GroupSkill = typeof GROUP_SKILLS[number];
export type SocialSkill = IndividualSkill | GroupSkill;

/**
 * Get skills array based on protagonist type
 */
export function getSkillsForProtagonistType(
  protagonistType: 'individual' | 'group'
): readonly string[] {
  return protagonistType === 'group' ? GROUP_SKILLS : INDIVIDUAL_SKILLS;
}

/**
 * Check if a skill is valid for a protagonist type
 */
export function isValidSkillForProtagonistType(
  skill: string,
  protagonistType: 'individual' | 'group'
): boolean {
  const validSkills = getSkillsForProtagonistType(protagonistType);
  return validSkills.includes(skill as any);
}
```

---

## Backend Prompt Module

### `story-prompts.ts` - Modular Prompt Builders

```typescript
/**
 * Story Prompt Builders
 *
 * Modular prompt construction for AI story generation.
 * Separates individual and group story logic for maintainability.
 */

// ========== PAGE FRAMEWORKS ==========

/**
 * Individual Story Page Framework
 * Dynamic structure based on user-selected page count.
 */
export const INDIVIDUAL_PAGE_FRAMEWORK = {
  getFrameworkPrompt: (numPages: number): string => {
    if (numPages >= 4) {
      return `The story must be exactly ${numPages} pages:
- Page 1: Introduction and scene setting.
- Pages 2 to ${numPages - 2}: Presentation of challenges and obstacles.
- Page ${numPages - 1}: Climax.
- Page ${numPages}: Conclusion and resolution with positive reinforcement.`;
    } else if (numPages === 3) {
      return `The story must be exactly 3 pages:
- Page 1: Introduction and scene setting.
- Page 2: Combined presentation of challenges, obstacles, and climax.
- Page 3: Resolution. Don't present solution. Let them experience their feelings.`;
    } else {
      return `The story must be exactly 1 page:
- A single, concise story combining introduction, challenges, climax, and resolution.`;
    }
  }
};

/**
 * Group Story Page Framework
 * Fixed 6-page structure based on Carol Gray's Social Story model.
 * This framework MUST NOT be changed.
 */
export const GROUP_PAGE_FRAMEWORK = {
  pageCount: 6,
  pages: [
    {
      page: 1,
      purpose: 'Situation',
      carolModel: 'Descriptive',
      prompt: 'Introduce the friend group and describe what\'s happening. Set the scene where the group encounters a challenge or opportunity related to the social skill. Focus on descriptive sentences about the setting and characters.'
    },
    {
      page: 2,
      purpose: 'Perspective',
      carolModel: 'Perspective',
      prompt: 'Show how different group members see or understand the situation. Each character may have a different viewpoint, concern, or idea. Include perspective sentences showing what characters might be thinking.'
    },
    {
      page: 3,
      purpose: 'Feeling',
      carolModel: 'Affirmative',
      prompt: 'Acknowledge and validate the emotions within the group. Show how different characters feel about the situation. Include affirmative sentences that validate these feelings as normal and okay.'
    },
    {
      page: 4,
      purpose: 'Positive Choice',
      carolModel: 'Directive/Cooperative',
      prompt: 'The group discusses and decides on a positive action together. Show the collaborative decision-making process. Include cooperative sentences about how characters help each other.'
    },
    {
      page: 5,
      purpose: 'Community Outcome',
      carolModel: 'Consequence',
      prompt: 'Show the positive results of working together. The group experiences the benefits of their collective choice. Connect the outcome to the social skill being learned.'
    },
    {
      page: 6,
      purpose: 'Reinforcement',
      carolModel: 'Control',
      prompt: 'Reinforce the lesson and show how it carries forward. The group reflects on what they learned about the social skill. End with a forward-looking statement about using this skill in the future.'
    }
  ],

  getFrameworkPrompt: (socialSkill: string): string => {
    const pageInstructions = GROUP_PAGE_FRAMEWORK.pages
      .map(p => `Page ${p.page} - ${p.purpose.toUpperCase()}: ${p.prompt.replace('the social skill', socialSkill)}`)
      .join('\n\n');

    return `The story must be exactly 6 pages following this framework:

${pageInstructions}`;
  }
};

// ========== PROMPT BUILDERS ==========

export interface StoryPromptParams {
  protagonistType: 'individual' | 'group';
  audience: string;
  pointOfView: string;
  numPages: number;
  socialSkill: string;
  situation: string;
  language: string;
  // Individual-specific
  character?: {
    name: string;
    age: number;
    gender: string;
    description?: string;
  };
  // Group-specific
  ageRange?: string;
}

/**
 * Build prompts for individual story generation
 */
export function buildIndividualStoryPrompts(params: StoryPromptParams): Array<{ role: string; content: string }> {
  // ... existing individual prompt logic
}

/**
 * Build prompts for group story generation
 */
export function buildGroupStoryPrompts(params: StoryPromptParams): Array<{ role: string; content: string }> {
  const ageRangeLabel = AGE_RANGE_LABELS[params.ageRange || 'children'];

  return [
    {
      role: 'system',
      content: `You are a social story creator...` // Base system prompt
    },
    {
      role: 'system',
      content: `CHARACTER GENERATION REQUIREMENTS:
1. Create 3-4 distinct child characters who are ${ageRangeLabel}
2. Include diverse representation (mix of genders, ethnicities, appearances)
3. All characters are EQUAL protagonists - no single "main" character
...`
    },
    {
      role: 'system',
      content: `NARRATIVE REQUIREMENTS:
1. Use third person plural throughout ("they", "the friends", "the group")
2. Give each character moments to shine and contribute
3. The lesson of ${params.socialSkill} is learned COLLECTIVELY
...`
    },
    {
      role: 'system',
      content: GROUP_PAGE_FRAMEWORK.getFrameworkPrompt(params.socialSkill)
    },
    {
      role: 'system',
      content: `Generate the story in ${params.language}.`
    },
    {
      role: 'system',
      content: `Respond in JSON format...` // JSON schema instructions
    },
    {
      role: 'user',
      content: `Create a social story about a group of friends...`
    }
  ];
}

/**
 * Wrap prompts with security layer (XML delimiters for injection protection)
 */
export function wrapWithSecurityLayer(
  basePrompts: Array<{ role: string; content: string }>,
  userInputXml: string,
  numPages: number,
  protagonistType: 'individual' | 'group'
): Array<{ role: string; content: string }> {
  // ... security wrapper logic
}

// Age range labels for group stories
const AGE_RANGE_LABELS: Record<string, string> = {
  'young_children': 'preschool or kindergarten age children (4-6 years old)',
  'children': 'elementary school age children (7-10 years old)',
  'tweens': 'middle school age tweens (11-13 years old)',
  'teens': 'high school age teenagers (14-17 years old)',
};
```

---

## Implementation Checklist

### Frontend

- [ ] **types.ts**: Add skill constants (`INDIVIDUAL_SKILLS`, `GROUP_SKILLS`)
- [ ] **types.ts**: Add derived types (`IndividualSkill`, `GroupSkill`, `SocialSkill`)
- [ ] **types.ts**: Add helper functions (`getSkillsForProtagonistType`, `isValidSkillForProtagonistType`)
- [ ] **AIStoryGenerator.tsx**: Import skills from `types.ts`
- [ ] **AIStoryGenerator.tsx**: Use `getSkillsForProtagonistType()` for conditional rendering
- [ ] **AIStoryGenerator.tsx**: Hide page count selector for group stories
- [ ] **aiGenerator.json (en)**: Add nested `groupSkills` section
- [ ] **aiGenerator.json (es)**: Add nested `groupSkills` section

### Backend

- [ ] **story-prompts.ts**: Create new module with prompt builders
- [ ] **story-prompts.ts**: Define `GROUP_PAGE_FRAMEWORK` constant
- [ ] **story-prompts.ts**: Implement `buildGroupStoryPrompts()`
- [ ] **story-prompts.ts**: Implement `wrapWithSecurityLayer()`
- [ ] **icraft-genAi.ts**: Import and use prompt builders from `story-prompts.ts`
- [ ] **icraft-genAi.ts**: Force `numPages = 6` for group stories
- [ ] **validation-schemas.ts**: Import skill types from shared location
- [ ] **validation-schemas.ts**: Add skill/protagonist type validation

### Testing

- [ ] Test individual story generation (unchanged behavior)
- [ ] Test group story generation with new framework
- [ ] Test all 10 group skills generate correctly
- [ ] Verify page framework is followed in generated content
- [ ] Test backward compatibility with existing stories

---

## Open Questions

None - all design decisions finalized.

---

## References

- Carol Gray's Social Story Framework
- Original requirements: `docs/GROUP_STORIES_REQUIREMENTS.md`
- Implementation plan: `docs/GROUP_STORIES_IMPLEMENTATION_PLAN.md`
