# Story Upload Guide - Enhanced Version with Section-Specific Selectors

## Overview

The enhanced upload script (`upload-stories-v2.js`) uses the new section-specific selectors added to the frontend to reliably upload stories with images to dev.icraftstories.com.

## Key Improvements

### 1. Section-Specific Selectors

The frontend now includes `data-testid` and `data-section` attributes on all key buttons:

**Illustration Buttons:**
- Cover: `data-testid="illustration-add-cover"` / `illustration-edit-cover`
- Page 1: `data-testid="illustration-add-page-1"` / `illustration-edit-page-1`
- Page N: `data-testid="illustration-add-page-N"` / `illustration-edit-page-N`

**Canvas Editor Toolbar:**
- Upload Image: `data-testid="canvas-upload-image-{sectionId}"`
- Add Text: `data-testid="canvas-add-text-{sectionId}"`
- Generate Image: `data-testid="canvas-generate-image-{sectionId}"`

**Canvas Editor Actions:**
- Save: `data-testid="canvas-save-{sectionId}"`
- Discard: `data-testid="canvas-discard-{sectionId}"`

Where `{sectionId}` is:
- `cover` for the cover page
- `page-1`, `page-2`, ... `page-N` for story pages

### 2. Event-Based Waiting

The script uses proper event-based waiting instead of arbitrary timeouts:

```javascript
// ❌ OLD: Arbitrary timeout (unreliable)
await page.click('button:has-text("Add")');
await page.waitForTimeout(2000); // Hope it's done?

// ✅ NEW: Wait for actual UI events
await page.click(`button[data-testid="illustration-add-${sectionId}"]`);
await page.waitForSelector(
  `button[data-testid="canvas-upload-image-${sectionId}"]`,
  { state: 'visible', timeout: 10000 }
);
```

### 3. Complete Image Upload Flow

The script now implements the full workflow:

1. **Click Illustration Add/Edit button** for specific section
2. **Wait for canvas editor to open** (toolbar buttons visible)
3. **Click Upload Image button** in toolbar (section-specific)
4. **Handle file chooser** and select image file
5. **Wait for canvas to render** the uploaded image
6. **Click Save button** (section-specific)
7. **Wait for canvas editor to close** (save button hidden)
8. **Verify preview image** appears in the section

### 4. Error Recovery

If any step fails, the script:
- Logs detailed error information
- Attempts to close the canvas editor with Discard button
- Continues with the next section/story
- Provides a summary of successes and failures

## Usage

### Prerequisites

```bash
# Install dependencies (if not already installed)
cd ./scripts
npm install playwright
```

### Run the Script

```bash
cd ./scripts

# Upload first story (for testing)
node upload-stories-v2.js 1

# Upload first 5 stories
node upload-stories-v2.js 5

# Upload all 75 stories
node upload-stories-v2.js
```

### What to Expect

**Console Output:**
```
🚀 Starting browser...
✓ Already authenticated

📦 Uploading first 1 story

================================================================================

[1/1] parking-lot-safety

📖 Parking Lot Safety
  ✓ Title filled
  ✓ Tags added (3)
    → Opening canvas editor for Cover...
    → Canvas editor opened for Cover
    → Image file selected for Cover
    → Save clicked for Cover
    ✓ Cover uploaded and saved
  → Page 1:
    ✓ Content filled
    ✓ Coaching filled
    → Opening canvas editor for Page 1...
    → Canvas editor opened for Page 1
    → Image file selected for Page 1
    → Save clicked for Page 1
    ✓ Page 1 uploaded and saved
  → Page 2:
    ✓ Content filled
    ✓ Coaching filled
    → Opening canvas editor for Page 2...
    → Canvas editor opened for Page 2
    → Image file selected for Page 2
    → Save clicked for Page 2
    ✓ Page 2 uploaded and saved
  → Saving story...
  ✅ Story saved successfully

================================================================================
📊 Upload Summary:
   ✅ Success: 1/1
   ❌ Failed: 0/1
================================================================================
```

## Troubleshooting

### Issue: "Canvas editor did not open"

**Cause:** The illustration button might not be visible or clickable.

**Solution:**
- Check that images exist in the story directory
- Verify the page has been scrolled into view
- Ensure no modals are blocking the UI

### Issue: "File chooser timeout"

**Cause:** The Upload Image button might not have triggered the file chooser.

**Solution:**
- Check browser console for JavaScript errors
- Verify Playwright has permission to access the file system
- Ensure the image file path is correct

### Issue: "Save button never disappeared"

**Cause:** The canvas editor might be stuck, or save failed silently.

**Solution:**
- Check browser network tab for failed API requests
- Verify user has sufficient credits/permissions
- Check if there are any validation errors on the canvas

### Issue: "Image didn't persist"

**Cause:** Save completed but image preview not showing.

**Solution:**
- Verify the canvas state is being saved to the database
- Check if there are any CORS issues with image URLs
- Ensure the preview image is generated correctly server-side

## Technical Details

### Canvas Editor Workflow

```mermaid
sequenceDiagram
    Script->>+Illustration Button: Click [Add]
    Illustration Button->>+Canvas Editor: Open editor
    Canvas Editor->>-Script: Toolbar visible
    Script->>+Upload Button: Click [Upload Image]
    Upload Button->>+File Chooser: Open chooser
    File Chooser->>-Script: File selected
    Script->>+Canvas: Image loads
    Canvas->>-Script: Image rendered
    Script->>+Save Button: Click [Save]
    Save Button->>+API: Save canvas state
    API->>-Canvas Editor: Success
    Canvas Editor->>-Script: Editor closes
```

### Selector Hierarchy

```
Story Editor
├── Cover Section (data-section="cover")
│   ├── [illustration-add-cover] or [illustration-edit-cover]
│   └── Canvas Editor
│       ├── [canvas-upload-image-cover]
│       ├── [canvas-save-cover]
│       └── [canvas-discard-cover]
│
└── Page Sections (data-section="page-{n}")
    ├── [illustration-add-page-{n}] or [illustration-edit-page-{n}]
    └── Canvas Editor
        ├── [canvas-upload-image-page-{n}]
        ├── [canvas-save-page-{n}]
        └── [canvas-discard-page-{n}]
```

## Next Steps

1. **Test with one story:**
   ```bash
   node upload-stories-v2.js 1
   ```

2. **Verify the upload:**
   - Check that cover and all page images appear
   - Navigate to Library and verify story is saved
   - Open the story in editor to confirm images persist

3. **Upload batch of stories:**
   ```bash
   node upload-stories-v2.js 10
   ```

4. **Monitor for issues:**
   - Watch console output for errors
   - Check success/failure counts
   - Investigate any patterns in failures

5. **Upload all 75 stories:**
   ```bash
   node upload-stories-v2.js
   ```

## Comparison: Old vs New Script

| Feature | Old Script | New Script (v2) |
|---------|-----------|-----------------|
| Selectors | Generic text matching | Section-specific data-testid |
| Waiting | Arbitrary timeouts | Event-based (state changes) |
| Canvas Flow | Incomplete | Full open→upload→save→close |
| Error Handling | Basic | Detailed with recovery |
| Verification | None | Checks for editor close |
| Logging | Minimal | Verbose with progress |

## Additional Resources

- Frontend code: `frontend/src/components/`
  - `IllustrationSection.tsx` - Illustration buttons with selectors
  - `CanvasEditor.tsx` - Canvas editor with save/discard
  - `CanvasEditorToolbar.tsx` - Toolbar with upload button

- Previous upload attempt logs: Check console output from initial run

## Credits

Created to resolve the image upload persistence issue where:
- Cover and Pages 1-2 uploaded successfully
- Pages 3-6 images didn't persist

Root cause: Generic button selectors couldn't distinguish between multiple "Add" buttons for different sections.

Solution: Added section-specific `data-testid` and `data-section` attributes throughout the frontend.
