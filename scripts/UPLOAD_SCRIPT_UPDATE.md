# Upload Script Update - Cover Coaching Support

**Date**: 2025-10-11

## Changes Made

Updated `scripts/batch-upload-community-stories.js` to include the `cover_coaching` field when uploading stories.

### Added Step 5

After adding tags and before uploading the cover image, the script now:

1. Checks if `story.cover_coaching` exists and has content
2. Locates the coaching textarea in the Cover Page section
3. Fills the coaching content using `pressSequentially` (with 20ms delay for stability)
4. Logs success or warning if field not found

### Code Addition (Lines 123-139)

```javascript
// 5. Add cover coaching content if available
if (story.cover_coaching && story.cover_coaching.trim().length > 0) {
  try {
    // Look for coaching textarea in the Cover Page section
    const coverCoachingTextarea = this.page.locator('textarea[placeholder*="coaching"]').first();
    await coverCoachingTextarea.waitFor({ state: 'visible', timeout: 3000 });
    await coverCoachingTextarea.click();
    await this.page.waitForTimeout(100);
    await coverCoachingTextarea.clear();
    await this.page.waitForTimeout(100);
    await coverCoachingTextarea.pressSequentially(story.cover_coaching.trim(), { delay: 20 });
    await this.page.waitForTimeout(300);
    console.log(`  ✓ Cover coaching`);
  } catch (error) {
    console.log(`  ⚠ Cover coaching field not found or failed: ${error.message}`);
  }
}
```

### Upload Flow (Updated)

1. Click New Story
2. Dismiss AI Generator dialog
3. Fill title
4. Add tags
5. **Add cover coaching content** ← NEW
6. Upload cover image
7. Process all pages (content, coaching, images)
8. Navigate back to library

### Compatibility

- **Graceful degradation**: If cover_coaching field doesn't exist in UI, logs warning and continues
- **Backward compatible**: Works with stories that don't have cover_coaching
- **Error handling**: Wrapped in try-catch to prevent upload failures

### Testing Recommendation

Before batch upload of all 75 stories:
1. Test with 1 story first: `node scripts/batch-upload-community-stories.js 1`
2. Verify cover coaching appears in the uploaded story
3. Check console output for "✓ Cover coaching" confirmation

