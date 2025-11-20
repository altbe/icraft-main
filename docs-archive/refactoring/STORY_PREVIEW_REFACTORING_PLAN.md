# Story Preview Page Refactoring Plan

**Status**: Planning Phase
**Priority**: High
**Estimated Effort**: 2-3 hours
**Target Date**: TBD
**Owner**: TBD

---

## Executive Summary

The `StoryPreviewPage.tsx` component has grown to **1,237 lines** and has **significant accessibility issues** due to extensive use of explicit color values instead of theme tokens. This refactoring will improve maintainability, testability, and accessibility by extracting reusable components and hooks.

**Key Benefits:**
- ✅ Reduce main file from 1,237 → ~400 lines (67% reduction)
- ✅ Fix 50+ instances of explicit color values
- ✅ Improve WCAG 2.1 AA compliance
- ✅ Enable component-level testing
- ✅ Increase code reusability across the app

---

## Current State Analysis

### File Breakdown (1,237 lines)

| Section | Lines | Complexity | Reusability | Refactor Priority |
|---------|-------|------------|-------------|-------------------|
| Setup & Story Loading | 1-199 | Medium | Low | Keep in main |
| Preview State Sync | 200-259 | Low | Low | Keep in main |
| Navigation Handlers | 278-331 | Medium | High | **Extract to hook** |
| Image Dimensions | 333-457 | High | Medium | **Extract to utility** |
| Page Content Rendering | 459-550 | Medium | High | **Extract to component** |
| Current Page Memoization | 552-658 | High | Medium | **Extract to component** |
| TTS & Audio | 660-778 | High | High | **Extract to hook** |
| Effects (URL sync, audio) | 780-850 | Low | Low | Keep in main |
| PDF Export | 852-910 | Medium | Medium | **Extract to hook** |
| SEO & Meta Tags | 912-1049 | Medium | High | **Extract to hook** |
| JSX Rendering | 1051-1236 | Low | High | **Extract to components** |

### Accessibility Issues Inventory

| Issue Type | Count | Severity | Location |
|------------|-------|----------|----------|
| Explicit color values | 50+ | Critical | Throughout |
| Missing `<main>` landmark | 1 | Moderate | Line 1052 |
| Missing dialog roles | 2 | Moderate | Lines 530, 625 |
| Missing ARIA labels | 8 | Moderate | Image position controls |
| Decorative icons not hidden | 15+ | Minor | Throughout |

---

## Target Architecture

### Directory Structure

```
frontend/src/
├── components/
│   ├── story-preview/
│   │   ├── StoryPreviewHeader.tsx         (NEW - ~100 lines)
│   │   ├── StoryPreviewFooter.tsx         (NEW - ~50 lines)
│   │   ├── StoryPageContent.tsx           (NEW - ~150 lines)
│   │   ├── StoryCoverPage.tsx             (NEW - ~100 lines)
│   │   ├── CoachingOverlay.tsx            (NEW - ~50 lines)
│   │   ├── LoginRequiredOverlay.tsx       (NEW - ~50 lines)
│   │   └── ImagePositionControls.tsx      (NEW - ~80 lines)
│   │
├── hooks/
│   ├── story-preview/
│   │   ├── useStoryNavigation.ts          (NEW - ~100 lines)
│   │   ├── useTextToSpeech.ts             (NEW - ~150 lines)
│   │   ├── useStoryPreviewSEO.ts          (NEW - ~150 lines)
│   │   └── usePDFExport.ts                (NEW - ~80 lines)
│   │
├── lib/
│   ├── story-preview/
│   │   ├── dimensionCalculations.ts       (NEW - ~150 lines)
│   │   └── previewThemeColors.ts          (NEW - ~100 lines)
│   │
└── pages/
    └── StoryPreviewPage.tsx                (REFACTORED - ~400 lines)
```

### Component Hierarchy

```
StoryPreviewPage (orchestration layer)
├── StoryPreviewHeader
│   ├── BackButton
│   ├── CoachingToggleButton
│   ├── ImagePositionControls (conditional)
│   ├── PDFExportButton
│   └── ShareMenu (conditional)
│
├── Main Content Area
│   ├── StoryCoverPage (when currentPage === 0)
│   │   ├── Title
│   │   ├── CanvasPreview
│   │   └── CoachingOverlay (conditional)
│   │
│   ├── StoryPageContent (when currentPage > 0)
│   │   ├── CanvasPreview
│   │   ├── PageText
│   │   └── CoachingOverlay (conditional)
│   │
│   └── LoginRequiredOverlay (conditional)
│
└── StoryPreviewFooter
    ├── PreviousButton
    ├── ReadAloudButton
    ├── PageCounter
    └── NextButton
```

---

## Detailed Component Specifications

### 1. StoryPreviewHeader.tsx

**Purpose**: Top toolbar with all action buttons

**Props Interface**:
```typescript
interface StoryPreviewHeaderProps {
  // Navigation
  onBack: () => void;

  // Coaching
  showCoaching: boolean;
  onToggleCoaching: () => void;
  hasCoachingContent: boolean;

  // Image Position (only for non-cover pages)
  currentPage: number;
  imagePosition?: 'above' | 'below' | 'left' | 'right';
  onImagePositionChange?: (position: 'above' | 'below' | 'left' | 'right') => void;

  // PDF Export
  onExportPDF: () => void;
  isExportingPDF: boolean;
  isLoading: boolean;

  // Share (only for community stories)
  isCommunityStory: boolean;
  storyId?: string;
  storyTitle?: string;
  storySlug?: string;
}
```

**Accessibility Features**:
- ✅ All buttons use theme color tokens
- ✅ Proper `aria-label` on all buttons
- ✅ Disabled states clearly indicated
- ✅ Focus ring styles using theme tokens
- ✅ Icons hidden with `aria-hidden="true"`

**Theme Colors**:
```typescript
const headerColors = {
  back: 'border-border text-foreground bg-background hover:bg-muted',
  coaching: 'bg-primary text-primary-foreground hover:bg-primary/90',
  imagePosition: {
    active: 'bg-primary text-primary-foreground',
    inactive: 'bg-muted text-muted-foreground hover:bg-muted/80'
  },
  pdf: 'bg-primary text-primary-foreground hover:bg-primary/90',
  share: 'bg-accent text-accent-foreground hover:bg-accent/90'
};
```

**File Location**: `frontend/src/components/story-preview/StoryPreviewHeader.tsx`

---

### 2. StoryPreviewFooter.tsx

**Purpose**: Bottom navigation controls

**Props Interface**:
```typescript
interface StoryPreviewFooterProps {
  // Navigation
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;

  // Read Aloud
  onReadAloud: () => void;
  isGenerating: boolean;
  isPlaying: boolean;
  story: Story | null;
}
```

**Accessibility Features**:
- ✅ All buttons use theme color tokens
- ✅ `aria-label` with translated text ("Previous page", "Next page", etc.)
- ✅ Disabled states with `aria-disabled`
- ✅ Loading states announced with `role="status"`
- ✅ Visual and programmatic indication of current page

**Theme Colors**:
```typescript
const footerColors = {
  navigation: {
    enabled: 'bg-primary text-primary-foreground hover:bg-primary/90',
    disabled: 'bg-muted text-muted-foreground cursor-not-allowed'
  },
  readAloud: {
    idle: 'bg-accent text-accent-foreground hover:bg-accent/90',
    playing: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    generating: 'bg-muted text-muted-foreground cursor-wait'
  },
  pageCounter: 'bg-muted text-foreground'
};
```

**File Location**: `frontend/src/components/story-preview/StoryPreviewFooter.tsx`

---

### 3. CoachingOverlay.tsx

**Purpose**: Reusable dialog for displaying coaching content

**Props Interface**:
```typescript
interface CoachingOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  isCoverPage?: boolean;
}
```

**Accessibility Features**:
- ✅ Proper dialog semantics: `role="dialog"` with `aria-labelledby`
- ✅ Focus trap when open
- ✅ Escape key to close
- ✅ Theme-aware overlay color (not `bg-yellow-700/75`)
- ✅ Close button with proper `aria-label`

**Theme Colors**:
```typescript
const overlayColors = {
  background: 'bg-accent/90', // Instead of bg-yellow-700/75
  text: 'text-accent-foreground',
  closeButton: 'text-accent-foreground hover:text-accent-foreground/80'
};
```

**File Location**: `frontend/src/components/story-preview/CoachingOverlay.tsx`

---

### 4. StoryPageContent.tsx

**Purpose**: Render a single story page with image and text

**Props Interface**:
```typescript
interface StoryPageContentProps {
  page: Story['pages'][0];
  orientation: 'portrait' | 'landscape';
  imagePosition: 'above' | 'below' | 'left' | 'right';
  imageDimensions: { width: number; height: number };
  showCoaching: boolean;
  onCloseCoaching: () => void;
  viewport: ViewportState;
}
```

**Accessibility Features**:
- ✅ Text uses `text-foreground` instead of `text-gray-800`
- ✅ Proper semantic structure (`<article>` or `<section>`)
- ✅ Image has proper alt text
- ✅ Text content is properly marked up

**Theme Colors**:
```typescript
const pageColors = {
  text: 'text-foreground',
  background: 'bg-background'
};
```

**File Location**: `frontend/src/components/story-preview/StoryPageContent.tsx`

---

### 5. StoryCoverPage.tsx

**Purpose**: Render the cover page with title and cover image

**Props Interface**:
```typescript
interface StoryCoverPageProps {
  story: Story;
  imageDimensions: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  showCoaching: boolean;
  onCloseCoaching: () => void;
}
```

**Accessibility Features**:
- ✅ Title uses proper heading level (`<h1>`)
- ✅ Cover image has alt text
- ✅ Theme-aware text colors

**Theme Colors**:
```typescript
const coverColors = {
  title: 'text-foreground',
  background: 'bg-background'
};
```

**File Location**: `frontend/src/components/story-preview/StoryCoverPage.tsx`

---

### 6. LoginRequiredOverlay.tsx

**Purpose**: Show login prompt for unauthenticated users viewing community stories

**Props Interface**:
```typescript
interface LoginRequiredOverlayProps {
  onSignIn: () => void;
  message?: string;
  title?: string;
}
```

**Accessibility Features**:
- ✅ Uses theme colors instead of `bg-blue-50 border-blue-200`
- ✅ Proper heading hierarchy
- ✅ Clear call-to-action button

**Theme Colors**:
```typescript
const loginOverlayColors = {
  background: 'bg-primary/5 border-primary/20',
  heading: 'text-primary',
  text: 'text-primary/90',
  button: 'bg-primary text-primary-foreground hover:bg-primary/90'
};
```

**File Location**: `frontend/src/components/story-preview/LoginRequiredOverlay.tsx`

---

### 7. ImagePositionControls.tsx

**Purpose**: Toggle buttons for image positioning

**Props Interface**:
```typescript
interface ImagePositionControlsProps {
  currentPosition: 'above' | 'below' | 'left' | 'right';
  onChange: (position: 'above' | 'below' | 'left' | 'right') => void;
  disabled?: boolean;
}
```

**Accessibility Features**:
- ✅ Each button has proper `aria-label` (not just `title`)
- ✅ Icons hidden with `aria-hidden="true"`
- ✅ Active state indicated with `aria-pressed`
- ✅ Theme colors instead of `bg-blue-500` and `bg-gray-400`

**Theme Colors**:
```typescript
const positionControlColors = {
  active: 'bg-primary text-primary-foreground',
  inactive: 'bg-muted text-muted-foreground hover:bg-muted/80'
};
```

**File Location**: `frontend/src/components/story-preview/ImagePositionControls.tsx`

---

## Hook Specifications

### 1. useStoryNavigation.ts

**Purpose**: Handle all page navigation logic

**Return Interface**:
```typescript
interface UseStoryNavigationReturn {
  currentPage: number;
  totalPages: number;
  handlePrevious: () => void;
  handleNext: () => void;
  handleBack: () => void;
  setCurrentPage: (page: number) => void;
}
```

**Responsibilities**:
- ✅ Previous/Next page navigation
- ✅ Back button logic (with returnTo URL handling)
- ✅ Login prompt for unauthenticated users on restricted pages
- ✅ Page validation and clamping
- ✅ URL query param synchronization

**File Location**: `frontend/src/hooks/story-preview/useStoryNavigation.ts`

---

### 2. useTextToSpeech.ts

**Purpose**: Manage text-to-speech generation and playback

**Return Interface**:
```typescript
interface UseTextToSpeechReturn {
  isPlaying: boolean;
  isGenerating: boolean;
  handleReadAloud: () => void;
  stopReadAloud: () => void;
}
```

**Responsibilities**:
- ✅ TTS API calls
- ✅ Audio playback management
- ✅ Double-submit prevention
- ✅ Loading states
- ✅ Error handling
- ✅ Audio cleanup

**File Location**: `frontend/src/hooks/story-preview/useTextToSpeech.ts`

---

### 3. useStoryPreviewSEO.ts

**Purpose**: Manage SEO meta tags, JSON-LD, and hreflang

**Return Interface**:
```typescript
interface UseStoryPreviewSEOReturn {
  // No return - side effects only
}
```

**Responsibilities**:
- ✅ Update document title
- ✅ Update Open Graph meta tags
- ✅ Update Twitter Card meta tags
- ✅ Add JSON-LD structured data
- ✅ Add hreflang tags
- ✅ Cleanup on unmount

**File Location**: `frontend/src/hooks/story-preview/useStoryPreviewSEO.ts`

---

### 4. usePDFExport.ts

**Purpose**: Handle PDF export with coaching toggle

**Return Interface**:
```typescript
interface UsePDFExportReturn {
  isExporting: boolean;
  exportPDF: (includeCoaching: boolean) => Promise<void>;
}
```

**Responsibilities**:
- ✅ Call PDF export library
- ✅ Show loading state
- ✅ Handle success/error toasts
- ✅ Authentication check

**File Location**: `frontend/src/hooks/story-preview/usePDFExport.ts`

---

## Utility Specifications

### 1. dimensionCalculations.ts

**Purpose**: Calculate image dimensions based on viewport and layout

**Exports**:
```typescript
export function calculateImageDimensions(
  orientation: 'portrait' | 'landscape',
  imagePosition: 'above' | 'below' | 'left' | 'right',
  textLength: number,
  isCoverPage: boolean,
  viewport: ViewportState,
  availableHeight: number
): { width: number; height: number };

export function calculateTextHeight(
  textLength: number,
  isHorizontalLayout: boolean,
  viewport: ViewportState
): number;
```

**File Location**: `frontend/src/lib/story-preview/dimensionCalculations.ts`

---

### 2. previewThemeColors.ts

**Purpose**: Centralized theme color mappings for preview components

**Exports**:
```typescript
export const previewTheme = {
  header: {
    back: 'border-border text-foreground bg-background hover:bg-muted',
    coaching: 'bg-primary text-primary-foreground hover:bg-primary/90',
    // ... etc
  },
  footer: {
    // ...
  },
  overlays: {
    coaching: 'bg-accent/90',
    login: 'bg-primary/5 border-primary/20'
  },
  buttons: {
    // ...
  }
};
```

**File Location**: `frontend/src/lib/story-preview/previewThemeColors.ts`

---

## Migration Strategy

### Phase 1: Setup & Foundation (30 minutes)

**Tasks**:
1. Create new directory structure
   - `frontend/src/components/story-preview/`
   - `frontend/src/hooks/story-preview/`
   - `frontend/src/lib/story-preview/`

2. Create `previewThemeColors.ts`
   - Define all theme color mappings
   - Export centralized color constants
   - Document color usage patterns

3. Create utility files
   - Extract `dimensionCalculations.ts` from main file
   - Export `calculateImageDimensions` and `calculateTextHeight`
   - Add unit tests

**Validation**:
- ✅ Utility functions pass unit tests
- ✅ No breaking changes to existing code

---

### Phase 2: Extract Hooks (45 minutes)

**Tasks**:
1. Create `useStoryNavigation.ts`
   - Move navigation logic (lines 278-331)
   - Add URL param synchronization
   - Add authentication checks

2. Create `useTextToSpeech.ts`
   - Move TTS logic (lines 660-778, 802-850)
   - Preserve double-submit prevention
   - Add cleanup logic

3. Create `useStoryPreviewSEO.ts`
   - Move SEO logic (lines 912-1049)
   - Keep all meta tag updates
   - Ensure cleanup on unmount

4. Create `usePDFExport.ts`
   - Move PDF export logic (lines 852-910)
   - Preserve authentication check
   - Add loading states

**Validation**:
- ✅ Hooks pass unit tests
- ✅ No side effects or memory leaks
- ✅ TypeScript compiles without errors

---

### Phase 3: Extract UI Components (60 minutes)

**Tasks**:
1. Create `CoachingOverlay.tsx`
   - Extract coaching overlay JSX
   - Add dialog role and ARIA
   - Use theme colors
   - Add focus trap

2. Create `LoginRequiredOverlay.tsx`
   - Extract login CTA JSX
   - Use theme colors
   - Proper heading hierarchy

3. Create `ImagePositionControls.tsx`
   - Extract position controls JSX
   - Add ARIA labels
   - Use theme colors
   - Add `aria-pressed` for active state

4. Create `StoryPreviewHeader.tsx`
   - Extract header JSX (lines 1057-1175)
   - Use theme colors
   - Add proper ARIA labels
   - Compose with `ImagePositionControls`

5. Create `StoryPreviewFooter.tsx`
   - Extract footer JSX (lines 1181-1233)
   - Use theme colors
   - Add ARIA labels
   - Add loading announcements

6. Create `StoryPageContent.tsx`
   - Extract page rendering (lines 459-550)
   - Use theme colors
   - Compose with `CoachingOverlay`

7. Create `StoryCoverPage.tsx`
   - Extract cover page rendering (lines 592-644)
   - Use theme colors
   - Compose with `CoachingOverlay`

**Validation**:
- ✅ Components render correctly
- ✅ All theme colors applied
- ✅ ARIA attributes present
- ✅ No TypeScript errors

---

### Phase 4: Update Main File (30 minutes)

**Tasks**:
1. Import extracted components and hooks

2. Replace inline JSX with components
   - Use `<StoryPreviewHeader />` for header
   - Use `<StoryPreviewFooter />` for footer
   - Use `<StoryCoverPage />` or `<StoryPageContent />` for content
   - Use `<LoginRequiredOverlay />` for auth prompt

3. Wrap content in `<main>` landmark

4. Remove extracted code from main file

5. Update any remaining explicit colors

**Validation**:
- ✅ Page renders identically to before
- ✅ All features work (navigation, TTS, PDF, etc.)
- ✅ No console errors
- ✅ TypeScript compiles
- ✅ File reduced to ~400 lines

---

### Phase 5: Testing & Validation (30 minutes)

**Manual Testing Checklist**:
- ✅ Navigation (prev/next/back) works
- ✅ Coaching overlay opens/closes
- ✅ Image position controls work
- ✅ PDF export works
- ✅ Share button works (community stories)
- ✅ TTS generation and playback works
- ✅ Login prompt shows for unauthenticated users
- ✅ Page counter displays correctly
- ✅ SEO meta tags update
- ✅ All colors use theme tokens
- ✅ Keyboard navigation works
- ✅ Screen reader announces state changes

**Automated Testing**:
- ✅ Unit tests for hooks pass
- ✅ Unit tests for utilities pass
- ✅ Component tests pass
- ✅ No TypeScript errors
- ✅ No ESLint warnings

**Accessibility Testing**:
- ✅ axe DevTools reports no violations
- ✅ Keyboard-only navigation works
- ✅ Screen reader announces all state changes
- ✅ Color contrast meets WCAG AA
- ✅ Focus indicators visible

---

## Rollback Plan

**If issues are encountered during refactoring:**

1. **Git Safety**
   - Create feature branch: `refactor/story-preview-components`
   - Make frequent commits at each phase
   - Tag baseline: `git tag before-preview-refactor`

2. **Rollback Procedure**
   ```bash
   # If in middle of work
   git reset --hard HEAD

   # If committed but not pushed
   git reset --hard before-preview-refactor

   # If pushed to remote
   git revert <commit-range>
   ```

3. **Incremental Deployment**
   - Deploy to dev environment first
   - Test thoroughly in QA
   - Deploy to production only after validation

---

## Success Metrics

### Code Quality
- ✅ Main file reduced from 1,237 → ~400 lines (67% reduction)
- ✅ Zero explicit color values in preview components
- ✅ 100% TypeScript type coverage
- ✅ All components under 150 lines

### Accessibility
- ✅ Zero critical WCAG violations (axe DevTools)
- ✅ Zero moderate WCAG violations
- ✅ All interactive elements have ARIA labels
- ✅ All decorative icons hidden from screen readers
- ✅ Proper semantic HTML (`<main>`, `<dialog>`, etc.)

### Maintainability
- ✅ Each component has single responsibility
- ✅ Hooks are independently testable
- ✅ Theme colors centralized
- ✅ Clear separation of concerns

### Performance
- ✅ No performance regression (Lighthouse score)
- ✅ Components properly memoized
- ✅ No memory leaks (Chrome DevTools)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Medium | High | Comprehensive testing, incremental deployment |
| Introducing accessibility regressions | Low | High | Automated accessibility testing, manual validation |
| Performance degradation | Low | Medium | Performance profiling before/after |
| TypeScript compilation errors | Medium | Medium | Incremental refactoring, frequent compilation checks |
| Missing edge cases in hooks | Medium | Medium | Unit tests for all hooks, integration tests |
| Theme colors not rendering correctly | Low | Low | Visual regression testing |

---

## Dependencies

**Required Before Starting**:
- ✅ Landing page refactoring complete (for theme color reference)
- ✅ Community page refactoring complete (for theme color reference)
- ✅ All tests passing in current codebase
- ✅ No pending PRs modifying StoryPreviewPage

**Required Tools**:
- ✅ axe DevTools browser extension
- ✅ Chrome DevTools (Performance, Accessibility tabs)
- ✅ TypeScript 5.x
- ✅ ESLint configured

---

## Post-Refactoring Tasks

1. **Documentation**
   - Update component documentation
   - Add Storybook stories for new components
   - Update architecture diagrams

2. **Knowledge Sharing**
   - Team walkthrough of new architecture
   - Update development guidelines

3. **Monitoring**
   - Monitor error rates in production
   - Track performance metrics
   - Collect user feedback

4. **Future Improvements**
   - Consider extracting more reusable components
   - Add more comprehensive unit tests
   - Add visual regression tests

---

## Appendix A: Translation Keys Required

New translation keys needed for extracted components:

```json
{
  "preview": {
    "buttons": {
      "back": "Back",
      "showCoaching": "Show Coaching",
      "hideCoaching": "Hide Coaching",
      "imageLeft": "Image on left",
      "imageRight": "Image on right",
      "imageAbove": "Image above text",
      "imageBelow": "Image below text",
      "exportPdf": "Export PDF",
      "share": "Share",
      "previous": "Previous",
      "next": "Next",
      "readAloud": "Read Aloud",
      "stopReading": "Stop"
    },
    "aria": {
      "backButton": "Go back to story library",
      "showCoachingAria": "Show coaching notes",
      "hideCoachingAria": "Hide coaching notes",
      "imagePositionLeft": "Position image on left side",
      "imagePositionRight": "Position image on right side",
      "imagePositionAbove": "Position image above text",
      "imagePositionBelow": "Position image below text",
      "exportPdfAria": "Export story as PDF",
      "shareAria": "Share this story",
      "previousPageAria": "Go to previous page",
      "nextPageAria": "Go to next page",
      "readAloudAria": "Read page aloud",
      "stopReadingAria": "Stop reading",
      "closeCoaching": "Close coaching notes"
    },
    "coaching": {
      "title": "Coaching Notes",
      "coverTitle": "Cover Coaching Content"
    },
    "pageCounter": "Page {{current}} of {{total}}",
    "loading": "Loading...",
    "exporting": "Exporting..."
  }
}
```

---

## Appendix B: File Size Comparison

**Before Refactoring**:
```
StoryPreviewPage.tsx: 1,237 lines
```

**After Refactoring**:
```
StoryPreviewPage.tsx:                ~400 lines
components/story-preview/:
  StoryPreviewHeader.tsx:            ~100 lines
  StoryPreviewFooter.tsx:             ~50 lines
  StoryPageContent.tsx:              ~150 lines
  StoryCoverPage.tsx:                ~100 lines
  CoachingOverlay.tsx:                ~50 lines
  LoginRequiredOverlay.tsx:           ~50 lines
  ImagePositionControls.tsx:          ~80 lines
hooks/story-preview/:
  useStoryNavigation.ts:             ~100 lines
  useTextToSpeech.ts:                ~150 lines
  useStoryPreviewSEO.ts:             ~150 lines
  usePDFExport.ts:                    ~80 lines
lib/story-preview/:
  dimensionCalculations.ts:          ~150 lines
  previewThemeColors.ts:             ~100 lines
-------------------------------------------
Total:                              ~1,710 lines (38% increase)
```

**Analysis**: While total lines increase by 38%, the code is now:
- Modular (14 files vs 1)
- Testable (each component/hook independently testable)
- Reusable (components can be used elsewhere)
- Maintainable (single responsibility principle)
- Accessible (theme colors throughout)

---

## Questions & Decisions Log

**Q1**: Should we extract dimension calculations to a hook or utility?
**A1**: Utility function - it's a pure calculation with no side effects or state.

**Q2**: Should `CoachingOverlay` be in `components/` or `components/story-preview/`?
**A2**: `components/story-preview/` - it's specific to story preview functionality.

**Q3**: How should we handle the coaching toggle state?
**A3**: Keep in main file - it's shared between header button and overlay display.

**Q4**: Should we create separate components for each button in the header?
**A4**: No - keep buttons in header component for now. Can extract later if needed elsewhere.

**Q5**: How do we handle the viewport dependency in dimension calculations?
**A5**: Pass `viewport` as parameter to utility functions - keep hooks in main file.

---

## Approval Sign-off

- [ ] Technical Lead Review
- [ ] Accessibility Specialist Review
- [ ] Product Owner Approval
- [ ] Estimated Time Approved
- [ ] Dependencies Verified
- [ ] Rollback Plan Approved

---

**Document Version**: 1.0
**Last Updated**: 2025-11-20
**Next Review Date**: Upon completion of refactoring
