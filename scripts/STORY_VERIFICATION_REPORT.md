# Story JSON Verification Report

Generated: 2025-01-11

## Summary

**Total Stories:** 75

### Overall Status
- ✓ **Ready for upload:** 44 stories (have pages, tags, and full coaching)
- ⚠️ **Need work:** 78 story issues across multiple categories

---

## Issues by Category

### 1. Stories with 0 Pages (22 stories)
**Priority: HIGH** - Need full markdown parsing and structuring

- anxiety-story
- carrollwood-story-1
- carrollwood-story-2
- chuck-e-cheese-story
- fire-drill-story
- going-to-grocery-store-story
- iep-story
- jaydens-basketball-lesson
- military-base
- not-fair-social-story
- quiet-voice-story
- saying-hello-story
- spanish-story-1
- squirrel-story
- staying-calm-upset-story
- story-about-autism
- strangers-story
- sub-teacher-story
- technology-story
- transitioning-car-to-school-story
- using-polite-language-story
- when-my-parent-deploys-story

### 2. Missing Tags (47 stories)
**Priority: MEDIUM** - Need LLM-generated tags

Stories have valid page content but missing categorization tags:
- adult-train-ride-story
- adults-help-children-fix-mistakes
- anxiety-story
- asking-for-help-story
- break-card-story
- carrollwood-story-1
- carrollwood-story-2
- don-t-eat-from-garbage-can-story
- falling-asleep-story
- fc-moving-into-new-home
- fc-moving-to-new-home-girl
- fire-drill-story
- getting-a-new-brother-or-sister-story
- going-to-grocery-store-story
- halloween-social-story
- having-fun-playground-story
- iep-story
- jaydens-basketball-lesson
- joining-other-kids-story
- lone-leader-story
- military-base
- money-story
- not-fair-social-story
- please-thank-you-story
- quiet-voice-story
- riding-bike-story
- saying-goodbye-story
- saying-hello-story
- saying-no-story
- school-pictures-story
- spanish-story-1
- squirrel-story
- standing-up-for-myself-story
- staying-calm-upset-story
- story-about-autism
- strangers-story
- sub-teacher-story
- swimming-social-story
- taking-a-break-story
- technology-story
- therapist-autism-story
- throwing-toys-story
- transitioning-car-to-school-story
- using-an-elevator
- using-polite-language-story
- want-a-hug-story
- when-my-parent-deploys-story
- zoo-story

### 3. Missing Coaching (7 stories)
**Priority: MEDIUM** - Have pages but no coaching notes

- getting-a-new-brother-or-sister-story
- going-to-the-movie-theater-story
- remember-belongings-story
- riding-bike-story
- saying-no-story
- swimming-social-story
- taking-a-break-story

### 4. Partial Coaching (2 stories)
**Priority: MEDIUM** - Some pages have coaching, others don't

- adults-help-children-fix-mistakes (2/6 pages)
- standing-up-for-myself-story (2/5 pages)

### 5. Markdown Artifacts (37 stories)
**Priority: MEDIUM** - Content has leftover markdown formatting

Stories contain artifacts like `**Story Text:**`, `**Coaching Note:**` in page content:
- adult-train-ride-story
- adults-help-children-fix-mistakes
- anxiety-3-3-3-rule
- asking-for-help-story
- break-card-story
- brushing-teeth-2
- don-t-draw-on-furniture-story
- falling-asleep-story
- fc-moving-into-new-home
- fc-moving-to-new-home-girl
- germs-story
- getting-a-new-brother-or-sister-story
- getting-dressed-for-the-winter
- going-to-the-movie-theater-story
- halloween-social-story
- having-fun-playground-story
- joining-other-kids-story
- lone-leader-story
- money-story
- please-thank-you-story
- riding-bike-story
- saying-goodbye-story
- saying-no-story
- school-pictures-story
- swimming-social-story
- taking-a-break-story
- therapist-autism-story
- throwing-toys-story
- using-an-elevator
- want-a-hug-story
- zoo-story
- (and 6 more)

---

## Expected JSON Structure

All story.json files should follow this structure:

```json
{
  "title": "Story Title",
  "pages": [
    {
      "number": 1,
      "content": "Page content without markdown artifacts...",
      "coaching": "Coaching note for parents/caregivers."
    }
  ],
  "tags": [
    "Tag 1",
    "Tag 2",
    "Tag 3"
  ],
  "title_source": "markdown"
}
```

### Requirements
- **title**: Non-empty string
- **pages**: Array of page objects, each with:
  - `number`: Integer page number
  - `content`: Clean text without `**Story Text:**` or other markdown artifacts
  - `coaching`: Parent/caregiver coaching note (can be empty string)
- **tags**: Array of relevant topic tags (should not be empty)

---

## Action Items

### Immediate Actions
1. **Fix 0-page stories (22)**: Run full markdown parsing to extract pages
2. **Clean markdown artifacts (37)**: Strip `**Story Text:**`, `**Coaching Note:**` from content
3. **Generate tags (47)**: Use LLM to generate relevant tags based on story content

### Follow-up Actions
4. **Add coaching notes (9)**: Generate coaching for 7 stories with none + 2 with partial
5. **Re-run convert-stories-to-json.py**: Apply fixes to all stories

---

## Notes

- The recent fix to `convert-stories-to-json.py` addresses backslash handling and coaching note truncation
- Markdown artifacts suggest the parsing regex needs enhancement to strip `**Story Text:**` labels
- Some stories may need manual review if markdown source is malformed

---

## Cover and Page Images

### Cover Images: ✅ COMPLETE
- **All 75 stories have cover.webp** (151 KB average)
- Format: WebP, quality 85
- No missing covers

### Page Images Status

**Statistics:**
- ✅ 52 stories have all expected page images
- ⚠️ 22 stories have images BUT 0 pages in JSON (markdown parsing failed)
- ❌ 1 story missing page image: `riding-bike-story` (has 5/6 images, missing page-6.webp)

**Stories with Images but 0 JSON Pages (22):**
These stories have all page images (webp) but the markdown wasn't parsed:
- anxiety-story (6 images)
- carrollwood-story-1 (6 images)
- carrollwood-story-2 (6 images)
- chuck-e-cheese-story (6 images)
- fire-drill-story (6 images)
- going-to-grocery-store-story (6 images)
- iep-story (6 images)
- jaydens-basketball-lesson (6 images)
- military-base (5 images)
- not-fair-social-story (6 images)
- quiet-voice-story (6 images)
- saying-hello-story (6 images)
- spanish-story-1 (6 images)
- squirrel-story (6 images)
- staying-calm-upset-story (6 images)
- story-about-autism (6 images)
- strangers-story (6 images)
- sub-teacher-story (6 images)
- technology-story (6 images)
- transitioning-car-to-school-story (6 images)
- using-polite-language-story (6 images)
- when-my-parent-deploys-story (6 images)

**File Structure (Example):**
```
story-name/
  ├── cover.webp        (~150 KB)
  ├── page-1.webp       (~100-150 KB)
  ├── page-2.webp
  ├── page-3.webp
  ├── page-4.webp
  ├── page-5.webp
  ├── page-6.webp
  ├── story.md          (~1-2 KB)
  ├── story.json        (~1-2 KB)
  └── manifest.json     (~0.2 KB)
```

### Action Items for Images
1. ✅ Cover images are complete - no action needed
2. ⚠️ Re-run markdown parser for 22 stories with failed parsing
3. ❌ Generate missing page-6.webp for `riding-bike-story`
