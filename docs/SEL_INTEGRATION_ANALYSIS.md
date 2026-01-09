# SEL Integration Analysis for iCraftStories

**Date**: 2026-01-05
**Status**: Analysis/Planning
**Author**: Claude Code

## Executive Summary

This document analyzes how to integrate the CASEL (Collaborative for Academic, Social, and Emotional Learning) framework into iCraftStories' AI story generation system. The goal is to provide educators and caregivers with structured, evidence-based story creation that explicitly targets SEL competencies.

---

## 1. CASEL SEL Framework Overview

The CASEL framework identifies **5 core competencies** that form the foundation of social and emotional learning:

### Core Competencies

| Competency | Description | Key Skills |
|------------|-------------|------------|
| **Self-Awareness** | Understanding one's own emotions, thoughts, and values | Identifying emotions, accurate self-perception, recognizing strengths, self-confidence, self-efficacy |
| **Self-Management** | Managing emotions, thoughts, and behaviors effectively | Impulse control, stress management, self-discipline, goal-setting, organizational skills |
| **Social Awareness** | Understanding and empathizing with others | Perspective-taking, empathy, appreciating diversity, respect for others |
| **Relationship Skills** | Establishing and maintaining healthy relationships | Communication, social engagement, teamwork, conflict resolution |
| **Responsible Decision-Making** | Making caring and constructive choices | Problem identification, analyzing situations, solving problems, ethical responsibility, evaluating consequences |

### Contextual Layers (from image)
The CASEL wheel shows these competencies nested within:
- SEL Instruction & Classroom Climate
- Schoolwide Culture, Practices & Policies
- Families & Caregivers
- Communities
- Aligned Learning Opportunities
- Authentic Partnerships

---

## 2. Current State Analysis

### Existing Social Skills (18 total)

The current system has a flat list of "social skills" that map loosely to SEL:

```json
{
  "bravery": "Bravery and Confidence",
  "communication": "Communication",
  "empathy": "Empathy",
  "empathyAndKindness": "Empathy and Kindness",
  "rules": "Following Rules",
  "friendship": "Friendship",
  "honesty": "Honesty",
  "patience": "Patience",
  "perseverance": "Perseverance",
  "problemSolving": "Problem Solving",
  "respect": "Respect for Others",
  "responsibility": "Responsibility",
  "adaptability": "Adaptability",
  "adaptabilityAndFlexibility": "Adaptability and Flexibility",
  "teamwork": "Teamwork",
  "hygiene": "Personal Hygiene",
  "dailyLivingSkillsAndRoutines": "Daily Living Skills & Routines",
  "emotionalRegulation": "Emotional Regulation",
  "listeningAndAttention": "Listening and Attention"
}
```

### Mapping Current Skills to SEL Competencies

| SEL Competency | Current Coverage | Mapped Skills |
|----------------|------------------|---------------|
| **Self-Awareness** | **Weak** | Bravery and Confidence (partial) |
| **Self-Management** | **Moderate** | Emotional Regulation, Patience, Following Rules, Personal Hygiene, Daily Living Skills, Adaptability |
| **Social Awareness** | **Moderate** | Empathy, Empathy and Kindness, Respect for Others |
| **Relationship Skills** | **Strong** | Friendship, Communication, Teamwork, Listening and Attention |
| **Responsible Decision-Making** | **Moderate** | Problem Solving, Honesty, Responsibility, Perseverance |

### Gap Analysis

#### Critical Gaps
1. **Self-Awareness** is severely underrepresented
   - Missing: Identifying emotions, recognizing personal strengths/weaknesses, self-reflection
2. **No hierarchical organization** - skills are flat list, not grouped by competency
3. **No age-appropriate progression** - same skills for all ages
4. **No sub-skill granularity** - e.g., "Communication" could be broken into assertiveness, active listening, expressing needs

#### Redundancies
- `empathy` and `empathyAndKindness` overlap
- `adaptability` and `adaptabilityAndFlexibility` overlap

---

## 3. Proposed SEL-Structured Taxonomy

### New Hierarchical Structure

```typescript
interface SELCompetency {
  id: string;                    // e.g., "self-awareness"
  name: string;                  // "Self-Awareness"
  description: string;           // CASEL definition
  icon: string;                  // For UI display
  skills: SELSkill[];
}

interface SELSkill {
  id: string;                    // e.g., "identifying-emotions"
  name: string;                  // "Identifying Emotions"
  competencyId: string;          // Parent competency
  description: string;           // What this skill teaches
  ageRanges: AgeRange[];         // Which ages this applies to
  exampleSituations: string[];   // Suggested situations
  promptEnhancement: string;     // Extra AI prompt context
}

type AgeRange = 'young_children' | 'children' | 'tweens' | 'teens' | 'adults';
```

### Complete SEL Taxonomy

#### 1. Self-Awareness (NEW - expanded)
| Skill ID | Skill Name | Age Ranges | Description |
|----------|------------|------------|-------------|
| `identifying-emotions` | Identifying My Emotions | All | Recognizing and naming feelings |
| `understanding-triggers` | Understanding Triggers | Children+ | What causes emotions |
| `self-perception` | Knowing Myself | Children+ | Understanding personal traits |
| `recognizing-strengths` | My Strengths | All | Identifying what I'm good at |
| `growth-mindset` | I Can Learn | All | Belief in ability to improve |
| `self-confidence` | Believing in Myself | All | Trust in own abilities |
| `body-awareness` | Listening to My Body | Young Children, Children | Physical signs of emotions |

#### 2. Self-Management
| Skill ID | Skill Name | Age Ranges | Description |
|----------|------------|------------|-------------|
| `emotional-regulation` | Managing Big Feelings | All | Calming strategies |
| `impulse-control` | Stop and Think | All | Pausing before acting |
| `stress-management` | Handling Stress | Children+ | Coping with pressure |
| `self-discipline` | Self-Control | Children+ | Staying focused |
| `goal-setting` | Setting Goals | Children+ | Making and following plans |
| `patience` | Waiting My Turn | All | Tolerating delays |
| `adaptability` | Going with Changes | All | Flexibility with change |
| `organizational-skills` | Staying Organized | Children+ | Managing tasks/belongings |
| `personal-hygiene` | Taking Care of My Body | All | Self-care routines |
| `daily-routines` | Following Routines | Young Children, Children | Daily living skills |

#### 3. Social Awareness
| Skill ID | Skill Name | Age Ranges | Description |
|----------|------------|------------|-------------|
| `empathy` | Understanding Others' Feelings | All | Recognizing others' emotions |
| `perspective-taking` | Seeing Other Views | Children+ | Understanding different viewpoints |
| `appreciating-diversity` | Celebrating Differences | All | Valuing different backgrounds |
| `respect-for-others` | Showing Respect | All | Treating others with dignity |
| `kindness` | Being Kind | All | Acts of kindness |
| `reading-social-cues` | Understanding Social Signals | Children+ | Non-verbal communication |
| `community-awareness` | Being Part of a Community | Children+ | Understanding social groups |

#### 4. Relationship Skills
| Skill ID | Skill Name | Age Ranges | Description |
|----------|------------|------------|-------------|
| `communication` | Expressing Myself | All | Clear communication |
| `active-listening` | Being a Good Listener | All | Focused attention |
| `making-friends` | Making Friends | All | Initiating friendships |
| `maintaining-friendships` | Keeping Friends | Children+ | Nurturing relationships |
| `teamwork` | Working Together | All | Collaboration |
| `conflict-resolution` | Solving Disagreements | Children+ | Managing conflicts |
| `asking-for-help` | Asking for Help | All | Seeking assistance |
| `assertiveness` | Speaking Up | Children+ | Expressing needs respectfully |
| `cooperation` | Cooperating | All | Working with others |
| `sharing` | Sharing | Young Children, Children | Taking turns, sharing resources |

#### 5. Responsible Decision-Making
| Skill ID | Skill Name | Age Ranges | Description |
|----------|------------|------------|-------------|
| `problem-solving` | Solving Problems | All | Finding solutions |
| `identifying-problems` | Recognizing Problems | All | Noticing issues |
| `analyzing-situations` | Thinking It Through | Children+ | Considering factors |
| `evaluating-consequences` | What Could Happen | Children+ | Predicting outcomes |
| `honesty` | Being Honest | All | Truthfulness |
| `responsibility` | Taking Responsibility | All | Accountability |
| `following-rules` | Following Rules | All | Understanding boundaries |
| `ethical-thinking` | Doing the Right Thing | Children+ | Moral reasoning |
| `perseverance` | Not Giving Up | All | Persistence |
| `bravery` | Being Brave | All | Courage in challenges |

---

## 4. Implementation Options

### Option A: Minimal Change (Quick Win)
**Scope**: UI-only reorganization
**Effort**: Low (1-2 days)
**Impact**: Medium

Changes:
1. Group existing skills under SEL competency headers in UI
2. Add competency descriptions/tooltips
3. No backend changes

```tsx
// Frontend only - group existing skills
const SEL_GROUPS = {
  'self-awareness': ['bravery'],
  'self-management': ['emotionalRegulation', 'patience', 'rules', 'hygiene', 'dailyLivingSkillsAndRoutines', 'adaptability'],
  'social-awareness': ['empathy', 'empathyAndKindness', 'respect'],
  'relationship-skills': ['friendship', 'communication', 'teamwork', 'listeningAndAttention'],
  'responsible-decision-making': ['problemSolving', 'honesty', 'responsibility', 'perseverance']
};
```

### Option B: Expanded Skills with SEL Structure (Recommended)
**Scope**: Frontend + Backend prompt enhancement
**Effort**: Medium (3-5 days)
**Impact**: High

Changes:
1. Expand skill taxonomy with new SEL-aligned skills
2. Two-tier selection UI: Competency → Skill
3. Enhanced AI prompts with SEL context
4. Backward compatibility with existing stories

```typescript
// New API parameter structure
interface AIGeneratorParams {
  // ... existing fields
  selCompetency: string;        // "self-awareness"
  selSkill: string;             // "identifying-emotions"
  // socialSkill kept for backward compat
}
```

AI Prompt Enhancement:
```
This story should help the reader develop ${selCompetency} skills,
specifically ${selSkill}. The narrative should naturally demonstrate
how ${skillDescription} through the character's experiences.

${skillPromptEnhancement}
```

### Option C: Full SEL Framework Integration
**Scope**: Frontend + Backend + Database schema
**Effort**: High (1-2 weeks)
**Impact**: Very High

Changes:
1. All of Option B
2. SEL competency tracking in database
3. Progress dashboards for parents/educators
4. Multi-skill stories (address 2-3 skills per story)
5. SEL "curriculum" feature - suggested story sequences
6. Integration with educational standards (state SEL standards)

---

## 5. Recommended Implementation: Option B

### Phase 1: Data Model Updates

#### 1.1 New Translation File Structure

```json
// aiGenerator.json
{
  "selCompetencies": {
    "self-awareness": {
      "label": "Self-Awareness",
      "description": "Understanding your own emotions, thoughts, and values",
      "icon": "brain"
    },
    "self-management": {
      "label": "Self-Management",
      "description": "Managing emotions and behaviors effectively",
      "icon": "target"
    },
    "social-awareness": {
      "label": "Social Awareness",
      "description": "Understanding and empathizing with others",
      "icon": "users"
    },
    "relationship-skills": {
      "label": "Relationship Skills",
      "description": "Building and maintaining healthy relationships",
      "icon": "heart-handshake"
    },
    "responsible-decision-making": {
      "label": "Responsible Decision-Making",
      "description": "Making caring and constructive choices",
      "icon": "scale"
    }
  },
  "selSkills": {
    "self-awareness": {
      "identifying-emotions": {
        "label": "Identifying My Emotions",
        "description": "Learning to recognize and name feelings"
      },
      // ... more skills
    },
    // ... more competencies
  }
}
```

#### 1.2 TypeScript Types

```typescript
// types/sel.ts
export type SELCompetency =
  | 'self-awareness'
  | 'self-management'
  | 'social-awareness'
  | 'relationship-skills'
  | 'responsible-decision-making';

export interface SELSkillDefinition {
  id: string;
  label: string;
  description: string;
  ageRanges: AgeRange[];
  promptContext?: string;
}

export interface SELCompetencyDefinition {
  id: SELCompetency;
  label: string;
  description: string;
  icon: string;
  skills: SELSkillDefinition[];
}
```

### Phase 2: UI Changes

#### 2.1 Two-Tier Selection Component

```tsx
// components/SELSkillSelector.tsx
const SELSkillSelector = ({
  value,
  onChange,
  ageRange
}: SELSkillSelectorProps) => {
  const [competency, setCompetency] = useState<SELCompetency | null>(null);

  return (
    <div className="space-y-4">
      {/* Step 1: Select Competency */}
      <div>
        <Label>{t('sel.selectCompetency')}</Label>
        <div className="grid grid-cols-5 gap-2">
          {SEL_COMPETENCIES.map(comp => (
            <CompetencyCard
              key={comp.id}
              competency={comp}
              selected={competency === comp.id}
              onClick={() => setCompetency(comp.id)}
            />
          ))}
        </div>
      </div>

      {/* Step 2: Select Skill (filtered by age) */}
      {competency && (
        <div>
          <Label>{t('sel.selectSkill')}</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('sel.selectSkillPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {getSkillsForCompetency(competency)
                .filter(skill => skill.ageRanges.includes(ageRange))
                .map(skill => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
```

#### 2.2 Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│  What SEL skill should this story teach?                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │  🧠     │ │  🎯     │ │  👥     │ │  🤝     │ │  ⚖️     ││
│  │  Self-  │ │  Self-  │ │ Social  │ │Relation-│ │Decision-││
│  │Awareness│ │Manage-  │ │Awareness│ │  ship   │ │ Making  ││
│  │ [✓]     │ │  ment   │ │         │ │ Skills  │ │         ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│                                                             │
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║  Self-Awareness                                       ║  │
│  ║  Understanding your own emotions, thoughts, values    ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║  Select a specific skill:                             ║  │
│  ║  ┌───────────────────────────────────────────────┐    ║  │
│  ║  │ ▼ Identifying My Emotions                     │    ║  │
│  ║  └───────────────────────────────────────────────┘    ║  │
│  ║                                                       ║  │
│  ║  Skills available for Children (7-10):                ║  │
│  ║  • Identifying My Emotions                            ║  │
│  ║  • Understanding Triggers                             ║  │
│  ║  • Knowing Myself                                     ║  │
│  ║  • My Strengths                                       ║  │
│  ║  • I Can Learn (Growth Mindset)                       ║  │
│  ║  • Believing in Myself                                ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Backend Prompt Enhancement

#### 3.1 SEL-Aware System Prompt

```typescript
// modules/icraft-genAi.ts

function buildSELPromptContext(
  competency: SELCompetency,
  skill: SELSkillDefinition,
  ageRange: AgeRange
): string {
  const competencyContext = SEL_COMPETENCY_PROMPTS[competency];
  const skillContext = skill.promptContext || '';

  return `
## Social-Emotional Learning Focus

This story targets the SEL competency of **${competency}**, specifically the skill of **${skill.label}**.

### Competency Context
${competencyContext}

### Skill Guidance
${skillContext}

### Age-Appropriate Approach (${ageRange})
${getAgeAppropriateGuidance(skill.id, ageRange)}

### Narrative Integration Requirements
1. The character(s) should naturally encounter a situation where this skill is needed
2. Show the character's internal experience (thoughts, feelings, physical sensations)
3. Demonstrate the skill being practiced (not perfectly, but with effort)
4. Show realistic outcomes - some success, some room for growth
5. Avoid being preachy - the lesson should emerge from the story naturally
6. Include moments of struggle that children can relate to
`;
}

const SEL_COMPETENCY_PROMPTS = {
  'self-awareness': `
The story should help readers understand their own emotions and recognize patterns in how they feel.
Key elements to include:
- A moment where the character notices their own feelings
- Internal dialogue or thought bubbles showing self-reflection
- Recognition of what the character is good at or working on
- Validation that all feelings are okay to have
`,
  'self-management': `
The story should show strategies for managing emotions and behaviors.
Key elements to include:
- A challenge or trigger that creates a strong emotional response
- A pause moment where the character uses a coping strategy
- Realistic effort (not perfect success) at self-regulation
- Acknowledgment that managing feelings takes practice
`,
  // ... other competencies
};
```

#### 3.2 Skill-Specific Prompt Enhancements

```typescript
const SKILL_PROMPT_CONTEXTS: Record<string, string> = {
  'identifying-emotions': `
The story should help readers recognize and name their feelings.
- Use specific emotion words (frustrated, excited, nervous, proud)
- Connect emotions to body sensations ("butterflies in tummy")
- Show that the same situation can cause different feelings
- Validate that naming feelings is the first step to understanding them
`,
  'impulse-control': `
The story should demonstrate the "stop and think" approach.
- Show a moment of impulse (wanting to act immediately)
- Include a pause strategy (counting, breathing, walking away)
- Show what might happen with vs. without the pause
- Celebrate the effort of pausing, even when it's hard
`,
  // ... other skills
};
```

### Phase 4: Backward Compatibility

#### Migration Strategy

```typescript
// Map old socialSkill values to new SEL structure
const LEGACY_SKILL_MAPPING: Record<string, { competency: SELCompetency, skill: string }> = {
  'bravery': { competency: 'responsible-decision-making', skill: 'bravery' },
  'communication': { competency: 'relationship-skills', skill: 'communication' },
  'empathy': { competency: 'social-awareness', skill: 'empathy' },
  'empathyAndKindness': { competency: 'social-awareness', skill: 'kindness' },
  'rules': { competency: 'responsible-decision-making', skill: 'following-rules' },
  // ... complete mapping
};

function migrateToSELStructure(legacySocialSkill: string): SELSelection {
  const mapping = LEGACY_SKILL_MAPPING[legacySocialSkill];
  if (mapping) {
    return mapping;
  }
  // Default fallback
  return { competency: 'self-management', skill: legacySocialSkill };
}
```

---

## 6. UI/UX Considerations

### For Educators
- Show CASEL alignment badges ("Aligned with CASEL SEL Framework")
- Provide competency descriptions from official CASEL definitions
- Include "SEL Tip" suggestions for extending learning after story

### For Parents
- Use approachable language ("Helps your child..." instead of technical terms)
- Show skill icons consistently for recognition
- Provide simple post-story discussion questions

### For Children (Age-Appropriate Labels)
- Young Children (4-6): Use simpler labels ("Big Feelings" not "Emotional Regulation")
- Children (7-10): Slightly more sophisticated language
- Tweens (11-13): Can handle more nuanced concepts
- Teens (14-17): Adult-appropriate SEL language

---

## 7. Success Metrics

### Adoption Metrics
- % of new stories using SEL-structured selection
- Distribution across competencies (aim for balanced usage)
- Completion rate of two-tier selection flow

### Quality Metrics
- User ratings of "educational value" in story feedback
- Educator testimonials and case studies
- Story content alignment with SEL principles (manual review)

### Business Metrics
- SEL feature as conversion driver for education/school plans
- Retention of educator-type users
- Premium feature potential (curriculum builder, progress tracking)

---

## 8. Future Enhancements (Option C Features)

### Potential Phase 2 Features
1. **SEL Progress Dashboard**: Track which competencies/skills have been practiced
2. **Story Sequences**: Curriculum-like progressions through skills
3. **Multi-Skill Stories**: Stories addressing 2-3 related skills
4. **Educator Mode**: Classroom management, student assignment
5. **Standards Alignment**: Map to state SEL standards (varies by state)
6. **Assessment Integration**: Pre/post story reflection prompts
7. **Family Engagement**: Parent guides, home extension activities

---

## 9. Implementation Checklist

### Phase 1: Data & Types (Day 1)
- [ ] Create `types/sel.ts` with TypeScript definitions
- [ ] Create SEL taxonomy data file (`data/sel-competencies.ts`)
- [ ] Update `aiGenerator.json` with SEL translations
- [ ] Add Spanish translations for SEL content

### Phase 2: Frontend UI (Days 2-3)
- [ ] Create `SELSkillSelector` component
- [ ] Create `CompetencyCard` component
- [ ] Update `AIStoryGenerator.tsx` to use new selector
- [ ] Add age-range filtering for skills
- [ ] Implement backward compatibility for existing `socialSkill` field

### Phase 3: Backend Integration (Days 3-4)
- [ ] Update `AIGeneratorParams` type in backend
- [ ] Add SEL prompt context builder function
- [ ] Enhance story generation prompts with SEL guidance
- [ ] Test with all competencies/skills combinations

### Phase 4: Testing & Polish (Day 5)
- [ ] Test all 40+ skill combinations
- [ ] Verify age-appropriate filtering
- [ ] Review generated stories for SEL alignment
- [ ] Performance testing (no regression)
- [ ] Accessibility review of new components

---

## 10. References

- [CASEL Framework](https://casel.org/fundamentals-of-sel/what-is-the-casel-framework/)
- [CASEL SEL Competencies](https://casel.org/fundamentals-of-sel/what-is-the-casel-framework/#social-emotional-learning-competencies)
- Carol Gray's Social Stories - existing methodology in codebase
- Current implementation: `backend/modules/icraft-genAi.ts`, `frontend/src/components/AIStoryGenerator.tsx`
