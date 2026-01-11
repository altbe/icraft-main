# Group Stories Design v2

**Status:** Draft
**Version:** 1.2
**Created:** 2025-01-09
**Last Updated:** 2025-01-09

## Overview

This document specifies the design changes to AI story generation to support distinct skill sets and page frameworks for Individual (Social) Stories versus Group Stories.

**Internal Summary**: Group Stories are whole-group, image-led stories with no names, no individual POV, and 40–60 words per page, designed for shared learning and reuse.

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

### Group Story Framework (New - Fixed 6-Page Structure + Separate Cover)

This framework is based on Carol Gray's Social Story model adapted for group dynamics.

**LOCKED: 6 story pages + separate cover = 7 pages displayed**

**Technical Implementation:**
- `numPages` = 6 (story pages only)
- Cover is handled via `cover_page_coaching_content` and `cover_page_image_instruction` fields
- `pages` array contains only Pages 1-6 (story pages), NOT the cover

| Page | Purpose | Carol's Model Element | Content Focus | Constraints |
|------|---------|----------------------|---------------|-------------|
| **Cover** | Title + Image | Scene setting | Calm establishing group moment | Handled via `cover_page_*` fields; NOT in pages array |
| **Page 1** | Situation | Descriptive | Describes common shared scenario | Neutral, descriptive; no emotions/solutions |
| **Page 2** | Perspective | Perspective | Shows neutral differences in noticing/thinking | No right vs. wrong; uses "some…others…" |
| **Page 3** | Feeling | Affirmative | Uses plural/range-based feelings | Gentle, non-escalated emotional tone |
| **Page 4** | Positive Choice | Directive/Cooperative | Models 1-2 helpful options | Focus on effort, not correctness; no directives |
| **Page 5** | Community Outcome | Consequence | Shows shared benefit to group | Emphasizes belonging, fairness; no praise/rewards |
| **Page 6** | Reinforcement | Control | Forward-looking and reusable | Collective language only; no reflection questions |

**Important:** This framework must not change. Group stories always display 7 pages (cover + 6 story pages), but `numPages` = 6 since cover is handled separately.

### Story Text Rules (All Pages 1-6)

**Word Count (LOCKED):**
- Target: **40-60 words** per page
- If generated text exceeds limits, system auto-shortens or regenerates

**Language Rules:**
| Rule | Description |
|------|-------------|
| No character names | No proper names anywhere in text |
| No first-person child POV | No "I," "my" as narrator |
| Group-based language | Use "we", "the group", "children", "some…others…" |
| No directives | No "must," "should," "have to" |
| No dialogue | No quotation marks or direct speech |
| No time jumps | No "later that week," "after many days" |
| Non-clinical language | No diagnostic or clinical terminology |

### Title Rules (LOCKED)

**Content Rules:**
- No names (no people, classes, locations)
- No "I" language
- No directives (avoid "learning to," "how to," "should")
- No emotional labeling ("feeling angry," "managing anxiety")
- Neutral, descriptive phrasing only

**Length Rules:**
- 2-6 words (max)
- Title Case preferred
- No punctuation required

**Valid Examples:**
- Taking Turns Together
- Sharing Space at School
- Working as a Group
- Getting Back Into Routine

### Support Cue (Pages 1-6 Only)

Each story page (1-6) includes a Support Cue for educators/parents. Not included on Cover.

**Format:**
```
When to Use: [1 short line]
What to Emphasize: [1 short line]
One Line to Reinforce Later: [optional, 1 short line]
```

**Constraints:**
- Each field is 1 short line
- Readable in under 5 seconds
- Supportive, non-instructional tone
- Must align with page step intent
- No individual child focus

**Restricted Words (NEVER use in Support Cue):**
- teach, coach, manage, intervene, correct, assess

### Image Generation Rules

| Page | Image Focus |
|------|-------------|
| **Cover** | Calm establishing group moment |
| **Page 1** | Neutral shared scenario |
| **Page 2** | Subtle different reactions |
| **Page 3** | Gentle, safe emotions |
| **Page 4** | Helpful group behaviors |
| **Page 5** | Shared success |
| **Page 6** | Group continuing activity naturally |

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

**New (fixed 6-page framework, cover handled separately):**
```typescript
content: `The story must have exactly 6 story pages (Pages 1-6). Cover is handled separately via cover_page_* fields.

COVER (handled via cover_page_* fields, NOT in pages array):
- Generate a title (2-6 words, Title Case)
- Title rules: NO names, NO "I" language, NO directives ("learning to," "how to"), NO emotional labeling
- Valid examples: "Taking Turns Together", "Sharing Space at School", "Working as a Group"
- cover_page_coaching_content: Brief intro for educators
- cover_page_image_instruction: Full group portrait showing all characters together

STORY TEXT RULES (apply to all pages 1-6):
- Word count: 40-60 words per page (STRICT)
- NO character names (no proper names anywhere)
- NO first-person POV (no "I," "my")
- Use group language: "we", "the group", "children", "some…others…"
- NO directives ("must," "should," "have to")
- NO dialogue or quotation marks
- NO time jumps ("later that week," "after many days")
- Non-clinical language only

Page 1 - SITUATION:
- Describes a common shared scenario
- Neutral and descriptive only
- NO emotions or solutions introduced
- Image: Neutral shared scenario

Page 2 - PERSPECTIVE:
- Shows neutral differences in noticing or thinking
- NO right vs. wrong framing
- Uses inclusive phrasing ("some…others…")
- Image: Subtle different reactions

Page 3 - FEELING:
- Uses plural or range-based feelings
- Gentle, non-escalated emotional tone
- NO single emotional arc
- Image: Gentle, safe emotions

Page 4 - POSITIVE CHOICE:
- Models 1-2 helpful options
- Focus on effort, NOT correctness
- NO directives or commands
- Image: Helpful group behaviors

Page 5 - COMMUNITY OUTCOME:
- Shows shared benefit to the group
- Emphasizes belonging, fairness, or flow
- NO praise, rewards, or evaluation
- Image: Shared success

Page 6 - REINFORCEMENT:
- Forward-looking and reusable
- Collective language only ("we," "friends")
- NO reflection questions
- NO assessment or goals
- Image: Group continuing activity naturally

SUPPORT CUE (generate for Pages 1-6 only, NOT cover):
For each page, include a support_cue object with:
- when_to_use: [1 short line]
- what_to_emphasize: [1 short line]
- reinforce_later: [optional, 1 short line]

Support Cue Rules:
- Each field max 1 short line, readable in under 5 seconds
- Supportive, non-instructional tone
- NEVER use words: teach, coach, manage, intervene, correct, assess
- No individual child focus`
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
 * Group Story Page Framework (v1.2)
 * Fixed 6-page structure + separate cover based on Carol Gray's Social Story model.
 * Cover is handled via cover_page_* fields, NOT in pages array.
 * This framework MUST NOT be changed.
 */
export const GROUP_PAGE_FRAMEWORK = {
  totalPages: 6,  // Story pages only (cover is separate)
  contentPages: 6,  // Pages 1-6
  // Cover config (handled separately via cover_page_* fields)
  cover: {
    purpose: 'Cover',
    carolModel: 'Scene Setting',
    contentFocus: 'Calm establishing group moment',
    imageGuidance: 'Full group portrait showing all characters together',
  },
  // Story pages only (pages 1-6), cover is NOT in this array
  pages: [
    {
      page: 1,
      purpose: 'Situation',
      carolModel: 'Descriptive',
      contentFocus: 'Describes common shared scenario',
      constraints: 'Neutral, descriptive; no emotions or solutions introduced',
      imageGuidance: 'Neutral shared scenario',
      hasSupportCue: true
    },
    {
      page: 2,
      purpose: 'Perspective',
      carolModel: 'Perspective',
      contentFocus: 'Shows neutral differences in noticing/thinking',
      constraints: 'No right vs. wrong framing; uses "some…others…"',
      imageGuidance: 'Subtle different reactions',
      hasSupportCue: true
    },
    {
      page: 3,
      purpose: 'Feeling',
      carolModel: 'Affirmative',
      contentFocus: 'Uses plural/range-based feelings',
      constraints: 'Gentle, non-escalated emotional tone; no single emotional arc',
      imageGuidance: 'Gentle, safe emotions',
      hasSupportCue: true
    },
    {
      page: 4,
      purpose: 'Positive Choice',
      carolModel: 'Directive/Cooperative',
      contentFocus: 'Models 1-2 helpful options',
      constraints: 'Focus on effort, not correctness; no directives or commands',
      imageGuidance: 'Helpful group behaviors',
      hasSupportCue: true
    },
    {
      page: 5,
      purpose: 'Community Outcome',
      carolModel: 'Consequence',
      contentFocus: 'Shows shared benefit to group',
      constraints: 'Emphasizes belonging, fairness, flow; no praise, rewards, or evaluation',
      imageGuidance: 'Shared success',
      hasSupportCue: true
    },
    {
      page: 6,
      purpose: 'Reinforcement',
      carolModel: 'Control',
      contentFocus: 'Forward-looking and reusable',
      constraints: 'Collective language only; no reflection questions, assessment, or goals',
      imageGuidance: 'Group continuing activity naturally',
      hasSupportCue: true
    }
  ],

  // Title generation rules
  titleRules: {
    minWords: 2,
    maxWords: 6,
    format: 'Title Case',
    prohibited: ['names', 'I language', 'directives', 'emotional labeling'],
    examples: ['Taking Turns Together', 'Sharing Space at School', 'Working as a Group']
  },

  // Story text rules (applies to pages 1-6)
  textRules: {
    wordCount: { min: 40, max: 60 },
    prohibited: {
      characterNames: true,
      firstPersonPOV: true,
      directives: ['must', 'should', 'have to'],
      dialogue: true,
      timeJumps: true,
      clinicalLanguage: true
    },
    required: {
      groupLanguage: ['we', 'the group', 'children', 'some…others…']
    }
  },

  // Support cue rules (pages 1-6 only)
  supportCueRules: {
    format: {
      whenToUse: '1 short line',
      whatToEmphasize: '1 short line',
      reinforceLater: 'optional, 1 short line'
    },
    maxReadTime: '5 seconds',
    tone: 'supportive, non-instructional',
    restrictedWords: ['teach', 'coach', 'manage', 'intervene', 'correct', 'assess'],
    noIndividualChildFocus: true
  },

  getFrameworkPrompt: (socialSkill: string): string => {
    // Pages array contains only pages 1-6 (cover is handled separately via cover_page_* fields)
    const storyPageInstructions = GROUP_PAGE_FRAMEWORK.pages
      .map(p => `Page ${p.page} - ${p.purpose.toUpperCase()}:
- Content: ${p.contentFocus}
- Constraints: ${p.constraints}
- Image: ${p.imageGuidance}`)
      .join('\n\n');

    return `The story must have exactly 6 story pages (cover is handled separately via cover_page_* fields):

COVER (separate from pages array):
- Title only (2-6 words, Title Case)
- NO names, NO "I" language, NO directives, NO emotional labeling
- Image instruction via cover_page_image_instruction field
- Coaching content via cover_page_coaching_content field

STORY TEXT RULES (all pages 1-6):
- Word count: 40-60 words per page (STRICT)
- NO character names, NO first-person POV, NO directives, NO dialogue, NO time jumps
- Use group language: "we", "the group", "children", "some…others…"

${storyPageInstructions}

SUPPORT CUE (pages 1-6 only):
Generate support_cue with: when_to_use, what_to_emphasize, reinforce_later (optional)
- Max 1 short line each, readable in 5 seconds
- NEVER use: teach, coach, manage, intervene, correct, assess`;
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
- [ ] **types.ts**: Add `SupportCue` interface for pages 1-6
- [ ] **AIStoryGenerator.tsx**: Import skills from `types.ts`
- [ ] **AIStoryGenerator.tsx**: Use `getSkillsForProtagonistType()` for conditional rendering
- [ ] **AIStoryGenerator.tsx**: Hide page count selector for group stories (fixed at 6 story pages, cover handled separately)
- [ ] **aiGenerator.json (en)**: Add nested `groupSkills` section
- [ ] **aiGenerator.json (es)**: Add nested `groupSkills` section

### Backend

- [ ] **story-prompts.ts**: Create new module with prompt builders
- [ ] **story-prompts.ts**: Define `GROUP_PAGE_FRAMEWORK` constant (v1.2 with 6 story pages + separate cover)
- [ ] **story-prompts.ts**: Implement `buildGroupStoryPrompts()` with:
  - Title rules (2-6 words, no names, no directives)
  - Story text rules (40-60 words, group language, no dialogue)
  - Page-specific constraints for each of 6 story pages
  - Support cue generation for pages 1-6
  - Image guidance per page
- [ ] **story-prompts.ts**: Implement `wrapWithSecurityLayer()`
- [ ] **icraft-genAi.ts**: Import and use prompt builders from `story-prompts.ts`
- [ ] **icraft-genAi.ts**: Force `numPages = 6` for group stories (cover handled separately via cover_page_* fields)
- [ ] **validation-schemas.ts**: Import skill types from shared location
- [ ] **validation-schemas.ts**: Add skill/protagonist type validation
- [ ] **validation-schemas.ts**: Add word count validation (40-60 per page)

### AI Output Validation

- [ ] Validate title length (2-6 words)
- [ ] Validate title content (no names, no "I", no directives)
- [ ] Validate page word count (40-60 words)
- [ ] Validate no character names in text
- [ ] Validate no first-person POV
- [ ] Validate support cue format and restricted words

### Testing

- [ ] Test individual story generation (unchanged behavior)
- [ ] Test group story generation with new 6-page framework (+ separate cover)
- [ ] Test all 10 group skills generate correctly
- [ ] Verify page framework is followed in generated content
- [ ] Verify title rules are enforced
- [ ] Verify word count limits (40-60 per page)
- [ ] Verify support cues generated for pages 1-6 only
- [ ] Verify support cue restricted words not used
- [ ] Test backward compatibility with existing stories

---

## Open Questions

None - all design decisions finalized.

---

## References

- Carol Gray's Social Story Framework
- Original requirements: `docs/GROUP_STORIES_REQUIREMENTS.md`
- Implementation plan: `docs/GROUP_STORIES_IMPLEMENTATION_PLAN.md`
