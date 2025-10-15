# Hybrid Upload Workflow

## Process for Each Story (Using playwright-mcp)

### 1. Click "New Story" → Dismiss AI Generator
- snapshot → click New Story → wait → click Cancel

### 2. Fill Title + Tags
- snapshot → type title → add tags (skip "English")

### 3. Upload Cover Image
- snapshot → click Cover Add button → click Upload Image → click Upload image → file_upload → wait for dialog → Set as Background → Save

### 4. For Each Page (1-6):
   - **If page doesn't exist**: Click "Add New Page" → wait
   - snapshot → fill content textarea
   - snapshot → fill coaching textarea
   - snapshot → click Page Add button → Upload Image → file_upload → Set as Background → Save
   - Wait 2 seconds for auto-save

### 5. Navigate Back
- snapshot → click "Back to Library" → wait for library page

## Efficiency Improvements:
- Minimize snapshots (only when needed for new refs)
- Batch similar actions
- Skip unnecessary waits
- Handle errors gracefully (continue to next story)

## Story Counter:
Track: `[current]/75`
