# Requirements Analysis: Group Stories - Group as Protagonist Approach

## Summary

This document analyzes the requirements for adding **group stories** to iCraftStories where the **group itself is the protagonist** - not a main character with supporting characters. This approach dramatically simplifies the user experience by reducing group story inputs from 9 fields to just 5, while letting the AI generate the entire character ensemble.

**Key Insight**: For group stories, the GROUP is the protagonist. There is no "main character" - the friends/siblings/teammates share the spotlight equally.

**Key Principle**: Less input = faster story creation for busy families.

---

## 1. Current State Analysis

### 1.1 Current Story Generation Flow (Individual Protagonist)

**Current 9 User Inputs:**

| # | Field | Required | Description |
|---|-------|----------|-------------|
| 1 | Social Skill | Yes | What lesson the story teaches (17 options) |
| 2 | Situation | Yes | Free-text description of the scenario (10-999 chars) |
| 3 | Character Name | Yes | Protagonist's name (2-50 chars) |
| 4 | Character Age | Yes | Protagonist's age (1-120) |
| 5 | Character Gender | No | Male/Female/Neutral (default: Male) |
| 6 | Character Description | No | Appearance/personality (0-999 chars) |
| 7 | Point of View | No | First person / Third person (default: Third) |
| 8 | Target Audience | No | Children/Young Adult/Adult (default: Children) |
| 9 | Number of Pages | No | 1-10 pages (default: 6) |

### 1.2 Current Social Skills Available

1. Bravery and Confidence
2. Communication
3. Empathy and Kindness
4. Following Rules
5. Friendship
6. Honesty
7. Patience
8. Perseverance
9. Problem Solving
10. Respect for Others
11. Responsibility
12. Adaptability and Flexibility
13. Teamwork
14. Personal Hygiene
15. Daily Living Skills & Routines
16. Emotional Regulation
17. Listening and Attention

### 1.3 Current AI Prompt Structure

**Story Prompt** (`icraft-genAi.ts:1850-1884`):
```
Main character is named ${name} is a ${age}-year-old ${gender}
Their appearance is as follows: ${description}
The lesson of the story is ${socialSkill}
```

**AI Response Includes**:
- `main_characters_overall_appearance` - Character description for illustrations
- Per-page `image_instruction` - Scene descriptions

---

## 2. New Approach: Group as Protagonist

### 2.1 Core Concept

**Individual Story**: One child is the protagonist
- "Emma learns about teamwork..."
- Uses first or third person singular ("I", "she", "he")

**Group Story**: The group IS the protagonist
- "The friends learn about teamwork together..."
- Uses third person plural ("they", "the friends", "the group")
- No single "main character" - all characters share the spotlight

### 2.2 Input Comparison

| Aspect | Individual (9 inputs) | Group (5 inputs) |
|--------|----------------------|------------------|
| Protagonist Type | Individual (default) | Group |
| Social Skill | Required | Required |
| Situation | Required | Required |
| Character Name | Required | **REMOVED** |
| Character Age | Required | **REPLACED** with Age Range |
| Character Gender | Optional | **REMOVED** |
| Character Description | Optional | **REMOVED** |
| Point of View | Optional (first/third) | **FORCED** third person plural |
| Target Audience | Optional | Optional |
| Number of Pages | Optional | Optional |
| **Age Range** | N/A | **NEW** - Required |

### 2.3 Why This Works Better

1. **Simpler UX**: 5 inputs vs 9 inputs for group stories
2. **Faster Creation**: Parents can create group stories in under 1 minute
3. **Better Stories**: AI can create balanced, diverse character ensembles
4. **Natural Narrative**: "They" and "the friends" works better than awkward "main character plus others"
5. **Equal Representation**: No child feels like a "supporting character"

---

## 3. Functional Requirements

### FR-1: Protagonist Type Selection

**User Story**: As a parent, I want to choose whether my story features one child or a group, so I can create stories that match different social situations.

**Acceptance Criteria**:
- Given I open the AI Story Generator
- When the form loads
- Then I see "Protagonist Type" as the first question
- And options are "Individual" and "Group" with clear descriptions
- And "Individual" is selected by default (current behavior preserved)

**UI Design**:
```
+------------------------------------------+
|  Who is the story about? *               |
+------------------------------------------+
|                                          |
|  (*) Individual                          |
|      A story about one child             |
|                                          |
|  ( ) Group                               |
|      A story about friends learning      |
|      together                            |
|                                          |
+------------------------------------------+
```

**Business Rules**:
- Default: "Individual" (preserves existing UX)
- Selection determines which fields are shown
- No additional cost for group stories (same credit pricing)

### FR-2: Age Range Selection (Group Stories Only)

**User Story**: As a parent, I want to specify a general age range for the group, so the AI creates age-appropriate characters and language.

**Acceptance Criteria**:
- Given I select "Group" as protagonist type
- When the form updates
- Then I see an "Age Range" dropdown instead of "Character Age"
- And options are predefined age ranges

**Age Range Options**:

| Value | Display Label | Description |
|-------|--------------|-------------|
| `young_children` | Young Children (4-6) | Preschool, kindergarten |
| `children` | Children (7-10) | Elementary school |
| `tweens` | Tweens (11-13) | Middle school |
| `teens` | Teens (14-17) | High school |

**Business Rules**:
- Required when protagonist type is "Group"
- Default: "Children (7-10)" (most common use case)
- Influences AI character generation and vocabulary level

### FR-3: Conditional Form Display

**User Story**: As a parent, I want to see only the relevant fields for my story type, so I'm not overwhelmed with options.

**Acceptance Criteria**:

**When "Individual" selected**:
- Show ALL current fields (9 inputs)
- No changes to existing behavior

**When "Group" selected**:
- Show: Protagonist Type, Social Skill, Age Range, Situation, Target Audience, Number of Pages (5 inputs)
- Hide: Character Name, Character Age, Character Gender, Character Description, Point of View

### FR-4: AI Prompt for Group Stories

**User Story**: As the AI system, I need specific instructions to generate group protagonist stories.

**Acceptance Criteria**:
- Given a group story request
- When generating the story
- Then the prompt instructs AI to create 3-4 diverse characters
- And specifies third person plural narrative ("they", "the friends")
- And all characters share equal prominence in the story

**New Group Story Prompt**:
```
Create a social story about a group of ${ageRange} kids who learn about ${socialSkill}.

STORY CONTEXT:
${situation}

CHARACTER GENERATION:
- Generate 3-4 diverse characters as the group protagonists
- Include a mix of genders and appearances
- All characters are equal protagonists (no "main" character)
- Characters should be age-appropriate for ${ageRange}

NARRATIVE STYLE:
- Use third person plural throughout ("they", "the friends", "the group")
- Each character should have moments to contribute
- The group learns the lesson together

In main_characters_overall_appearance, describe ALL characters distinctly for consistent illustrations.
```

### FR-5: Image Generation for Group Stories

**User Story**: As the image generation system, I need character descriptions for all group members.

**Acceptance Criteria**:
- Given a group story
- When the AI generates `main_characters_overall_appearance`
- Then it describes ALL 3-4 characters with distinct visual traits
- And illustrations show the group together (not focused on one character)

**Technical Note**: The existing `buildStoryImagePrompt()` already includes:
- `CHARACTER APPEARANCE: ${characterAppearance}` - Will contain all group members
- `CRITICAL SIZE RULES: All children in this scene are the SAME AGE` - Already enforced

### FR-6: Data Model Update

**User Story**: As a developer, I need to store group story parameters for regeneration and analytics.

**New/Modified Fields in `AIGeneratorParams`**:
```typescript
export interface AIGeneratorParams {
  // NEW: Protagonist type (determines which fields are used)
  protagonistType: 'individual' | 'group';  // Default: 'individual'

  // EXISTING: Used for Individual stories only
  character: {
    name: string;
    age: number;
    gender: 'neutral' | 'male' | 'female';
    description?: string;
  };

  // NEW: Used for Group stories only
  ageRange?: 'young_children' | 'children' | 'tweens' | 'teens';

  // EXISTING: Used for both
  socialSkill: string;
  situation: string;
  audience: 'children' | 'youngAdult' | 'adult';
  numPages: number;

  // EXISTING: Used for Individual only (forced to 'third' for Group)
  pointOfView: 'first' | 'third';

  // ... rest unchanged (language, storyId, deviceId, userId, updatedAt)
}
```

**Backend Validation Update**:
```typescript
const GenerateStorySchema = z.object({
  // NEW: Protagonist type
  protagonistType: z.enum(['individual', 'group']).default('individual'),

  // EXISTING: Required for Individual, ignored for Group
  character: z.object({
    name: PromptSafeString(50, 'Character name'),
    age: z.coerce.number().int().min(1).max(120),
    gender: z.enum(['neutral', 'male', 'female']),
    description: PromptSafeStringAllowEmpty(999, 'Character description').optional()
  }).optional(),

  // NEW: Required for Group stories
  ageRange: z.enum(['young_children', 'children', 'tweens', 'teens']).optional(),

  // EXISTING fields...
  socialSkill: PromptSafeString(100, 'Social skill'),
  situation: PromptSafeString(999, 'Situation'),
  audience: z.enum(['children', 'youngAdult', 'adult']).default('children'),
  pointOfView: z.enum(['first', 'third']).default('third'),
  numPages: z.coerce.number().int().min(1).max(10).default(6),
  // ...
}).refine(
  data => {
    if (data.protagonistType === 'individual') {
      return data.character && data.character.name && data.character.age;
    }
    return true;
  },
  { message: 'Character name and age are required for individual stories' }
).refine(
  data => {
    if (data.protagonistType === 'group') {
      return data.ageRange !== undefined;
    }
    return true;
  },
  { message: 'Age range is required for group stories' }
);
```

---

## 4. UX Design

### 4.1 Form Layout - Individual Story (Current)

```
+------------------------------------------+
|  AI Story Generator                      |
|  (fields marked with * are required)     |
+------------------------------------------+

+------------------------------------------+
|  Who is the story about? *               |
+------------------------------------------+
|  (*) Individual - A story about one child|
|  ( ) Group - A story about friends       |
+------------------------------------------+

+------------------------------------------+
|  Social Skill *                          |
+------------------------------------------+
|  [ Bravery and Confidence      v ]       |
+------------------------------------------+

+------------------------------------------+
|  Situation *                             |
+------------------------------------------+
|  [ Describe the scenario...            ] |
+------------------------------------------+

+------------------------------------------+
|  Character                               |
+------------------------------------------+
|  Name * [________________]               |
|  Age *  [-] [8] [+]                      |
|  Gender [ Male v ]                       |
|  Description (optional)                  |
|  [________________________________]      |
+------------------------------------------+

+------------------------------------------+
|  Point of View                           |
+------------------------------------------+
|  [ Third Person v ]                      |
+------------------------------------------+

[> Advanced Options]
   - Target Audience
   - Number of Pages

+------------------------------------------+
|         [Cancel]  [Generate Story]       |
+------------------------------------------+
```

### 4.2 Form Layout - Group Story (New Simplified)

```
+------------------------------------------+
|  AI Story Generator                      |
|  (fields marked with * are required)     |
+------------------------------------------+

+------------------------------------------+
|  Who is the story about? *               |
+------------------------------------------+
|  ( ) Individual - A story about one child|
|  (*) Group - A story about friends       |
+------------------------------------------+

+------------------------------------------+
|  Age Range *                             |
+------------------------------------------+
|  [ Children (7-10)             v ]       |
|                                          |
|  The AI will create a diverse group of   |
|  friends in this age range.              |
+------------------------------------------+

+------------------------------------------+
|  Social Skill *                          |
+------------------------------------------+
|  [ Teamwork                    v ]       |
+------------------------------------------+

+------------------------------------------+
|  Situation *                             |
+------------------------------------------+
|  [ The friends are working on a class  ] |
|  [ project together...                 ] |
+------------------------------------------+

[> Advanced Options]
   - Target Audience
   - Number of Pages

+------------------------------------------+
|         [Cancel]  [Generate Story]       |
+------------------------------------------+
```

### 4.3 Visual Comparison

```
INDIVIDUAL STORY                    GROUP STORY
(9 inputs)                          (5 inputs)
------------------                  ------------------
[*] Protagonist Type                [*] Protagonist Type
[*] Social Skill                    [*] Age Range (NEW)
[*] Situation                       [*] Social Skill
[*] Character Name                  [*] Situation
[*] Character Age                   [ ] Target Audience
[ ] Character Gender                [ ] Number of Pages
[ ] Character Description
[ ] Point of View                   REMOVED:
[ ] Target Audience                 - Character Name
[ ] Number of Pages                 - Character Age
                                    - Character Gender
                                    - Character Description
                                    - Point of View
```

### 4.4 Mobile-First Design

On mobile (< 640px):
- Protagonist type uses large radio buttons with full-width tap targets
- Age range dropdown is full-width
- Form sections stack vertically
- Advanced options collapsed by default

### 4.5 Transition Animation

When switching between Individual and Group:
- Smooth fade/slide transition for appearing/disappearing fields
- No jarring layout jumps
- Focus moves to first relevant field after transition

---

## 5. Input Matrix by Protagonist Type

### 5.1 Complete Field Comparison

| Field | Individual | Group | Notes |
|-------|------------|-------|-------|
| **Protagonist Type** | Shown (default) | Shown | NEW - First question |
| **Social Skill** | Required | Required | Unchanged |
| **Situation** | Required | Required | Unchanged |
| **Character Name** | Required | HIDDEN | Not applicable for group |
| **Character Age** | Required | HIDDEN | Replaced by Age Range |
| **Age Range** | HIDDEN | Required | NEW - Group only |
| **Character Gender** | Optional | HIDDEN | AI generates diverse group |
| **Character Description** | Optional | HIDDEN | AI generates all characters |
| **Point of View** | Optional | HIDDEN | Forced to third person plural |
| **Target Audience** | Advanced | Advanced | Unchanged |
| **Number of Pages** | Advanced | Advanced | Unchanged |

### 5.2 Field Count Summary

| Protagonist Type | Required Fields | Optional Fields | Total |
|-----------------|-----------------|-----------------|-------|
| Individual | 4 | 5 | 9 |
| Group | 4 | 2 | **5** (44% reduction) |

---

## 6. AI Prompt Engineering

### 6.1 Individual Story Prompt (Existing)

```
You are a social story creator. Create a story that is accurate, descriptive,
meaningful, and safe for a ${audience} audience.

Main character is named ${name} is a ${age}-year-old ${gender}.
Their appearance is as follows: ${description}.
The lesson of the story is ${socialSkill}.

Generate a story about ${situation}.
Use ${pointOfView} perspective.
```

### 6.2 Group Story Prompt (New)

```
You are a social story creator. Create a story that is accurate, descriptive,
meaningful, and safe for a ${audience} audience.

PROTAGONIST TYPE: GROUP
This is a story about a group of friends who learn together.

AGE RANGE: ${ageRangeLabel}
Generate 3-4 diverse child characters appropriate for this age range.

SOCIAL SKILL: ${socialSkill}
The group learns this lesson together through their shared experience.

SITUATION: ${situation}

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

In main_characters_overall_appearance, describe ALL characters distinctly:
Example format: "Maya is a 9-year-old girl with curly brown hair and glasses.
Jordan is an 8-year-old boy with short black hair and a big smile.
Sam is a 9-year-old non-binary child with blonde hair in a ponytail..."
```

### 6.3 Age Range Mapping

| Value | Label | AI Instruction |
|-------|-------|----------------|
| `young_children` | Young Children (4-6) | "preschool or kindergarten age children (4-6 years old)" |
| `children` | Children (7-10) | "elementary school age children (7-10 years old)" |
| `tweens` | Tweens (11-13) | "middle school age tweens (11-13 years old)" |
| `teens` | Teens (14-17) | "high school age teenagers (14-17 years old)" |

---

## 7. Non-Functional Requirements

### NFR-1: Performance
- Form conditional rendering is instant (no API calls)
- Story generation time unchanged (AI handles character generation)
- No additional API calls for group stories

### NFR-2: Backward Compatibility
- Existing stories continue to work (all have `protagonistType: 'individual'` implicitly)
- API accepts requests without `protagonistType` field (defaults to 'individual')
- No migration needed for existing data

### NFR-3: Accessibility (WCAG 2.1 AA)
- Protagonist type radio buttons have visible focus states
- Age range dropdown is keyboard navigable
- Conditional form updates announced to screen readers (aria-live)
- Error messages associated with specific fields (aria-describedby)

### NFR-4: Security
- Age range is a controlled enum (no injection risk)
- Situation field already has prompt injection protection
- All existing sanitization applies

### NFR-5: Localization
- All new UI strings in English and Spanish
- Age range labels localized
- Help text localized

---

## 8. Risks & Mitigations

### Risk 1: AI Character Generation Quality
**Risk**: AI may generate unbalanced or inappropriate character ensembles
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Explicit prompt instructions for diversity and balance
- QA review of generated stories before launch
- User feedback mechanism to improve prompts

### Risk 2: Illustration Consistency
**Risk**: 3-4 characters may look different across pages
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Detailed `main_characters_overall_appearance` descriptions
- Gemini conversation context maintains consistency
- Test with all image providers

### Risk 3: Narrative Quality with Multiple Protagonists
**Risk**: Story may feel unfocused with no clear main character
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- Prompt instructs balanced spotlight across characters
- Each character gets moments to contribute
- Group learns lesson together (cohesive arc)

### Risk 4: User Expectation Mismatch
**Risk**: Users may want to customize group characters
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- Clear UI messaging: "The AI will create a diverse group of friends"
- Individual stories remain available for full customization
- Consider advanced mode in future version

---

## 9. Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| Age Range Granularity | 4 ranges (4-6, 7-10, 11-13, 14-17) | Covers typical school age groupings |
| Number of Characters | AI decides (3-4) | Keeps UX simple |
| Group Story POV | Force third person plural | First person doesn't work for groups |
| Pricing | Same credits as individual | Encourage adoption |
| Character Customization | None for groups | AI generates ensemble |

---

## 10. File References

### Frontend Files to Modify
- `/frontend/src/types.ts` - Add `protagonistType`, `ageRange`
- `/frontend/src/components/AIStoryGenerator.tsx` - UI changes
- `/frontend/src/hooks/useStoryGenerationSSE.ts` - Update interface
- `/frontend/src/locales/en/components/aiGenerator.json` - English strings
- `/frontend/src/locales/es/components/aiGenerator.json` - Spanish strings

### Backend Files to Modify
- `/backend/modules/validation-schemas.ts` - Validation rules
- `/backend/modules/icraft-genAi.ts` - AI prompt changes

---

## 11. Summary

| Metric | Individual | Group | Improvement |
|--------|-----------|-------|-------------|
| Input Fields | 9 | 5 | 44% fewer |
| Required Fields | 4 | 4 | Same |
| Time to Complete | ~2 min | ~1 min | 50% faster |
| Character Control | Full | AI-generated | Simpler |
| Narrative Style | First/Third | Third plural | Cleaner |

**The Core Insight**: When the group is the protagonist, users don't need to define individuals. They just need to set the context (age range, situation, lesson) and let the AI create the ensemble.
