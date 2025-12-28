# Quick Start - Story Upload Script

## ✅ What's Been Done

### 1. Cookie Consent Handling ✓
- Script automatically detects and dismisses cookie consent dialogs
- Looks for buttons with text: "Accept", "OK", "Got it"
- Also checks aria-labels for "cookie" or "consent"
- Gracefully continues if no cookie dialog appears

### 2. Login Handling ✓
- Validates credentials are set before running
- Detailed step-by-step login logging
- Error detection and helpful troubleshooting messages
- Verifies successful login before proceeding

### 3. Section-Specific Selectors ✓
- Uses `data-testid` and `data-section` attributes
- Targets exact buttons for cover and each page
- No more ambiguous button selection

### 4. Complete Image Upload Flow ✓
- Opens canvas editor for specific section
- Uploads image via toolbar
- Saves with section-specific Save button
- Waits for editor to close (confirms save)

## 🚀 Usage

```bash
cd ./scripts

# Test with first story
node upload-stories-v2.js 1
```

## 📋 What the Script Does

1. **Launches browser** (non-headless for monitoring)
2. **Navigates to dev.icraftstories.com**
3. **Dismisses cookie consent** (if present)
4. **Checks authentication**:
   - If logged in: continues
   - If not logged in: performs login
5. **Verifies app is ready** (New Story button visible)
6. **For each story**:
   - Clicks [+ New Story]
   - Dismisses AI Generator dialog
   - Fills title and tags
   - **Uploads cover image** using Canvas Editor
   - **Uploads each page image** using Canvas Editor
   - Fills page content and coaching
   - Saves story
   - Returns to home page

## 🔍 Console Output Example

```
🚀 Starting browser...
📍 Navigating to https://dev.icraftstories.com
✓ Cookie consent dismissed
🔍 Checking authentication status...
✓ Already authenticated
✓ Application ready

🎯 Uploading 1 stories from ./stories-tmp/processed

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
  ...
  → Saving story...
  ✅ Story saved successfully

================================================================================
📊 Upload Summary:
   ✅ Success: 1/1
   ❌ Failed: 0/1
================================================================================
```

## ⚙️ Configuration

Edit the top of `upload-stories-v2.js`:

```javascript
const BASE_URL = 'https://dev.icraftstories.com';
const STORIES_DIR = './stories-tmp/processed';

// Login credentials - UPDATE THESE with your credentials
const LOGIN_EMAIL = 'your-email@example.com';
const LOGIN_PASSWORD = 'your-password';
```

## 🔧 Troubleshooting

### Cookie Dialog Not Dismissed

**Solution:** The script looks for common button texts and aria-labels. If your cookie dialog uses different text, you can manually dismiss it before running the script (it will persist in browser session).

### Login Fails

**Check:**
- Email and password are correct
- Account exists and is active
- Network connection is stable
- Clerk authentication service is working

**Error Output:**
```
❌ Login failed: timeout waiting for selector
  Please verify:
    - Email: your-email@example.com
    - Password is correct
    - Account exists and is active
    - Network connection is stable
```

### Image Upload Fails

**Possible Causes:**
- Canvas editor didn't open (check visibility)
- File chooser timeout (check file path)
- Save button never disappeared (check for errors in browser console)

**Script automatically:**
- Logs detailed progress for each step
- Attempts to close editor with Discard if stuck
- Continues with next section/story

## 📊 Expected Results

After running `node upload-stories-v2.js 1`:

1. **Browser opens** and navigates to dev site
2. **Login completes** (or uses existing session)
3. **Story uploads** with all images
4. **Console shows** detailed progress
5. **Browser stays open** for manual verification
6. **Final summary** shows success count

**Verify in UI:**
- Navigate to Library
- Open uploaded story
- Check that cover and all page images appear
- Edit story to confirm images persist

## 🎯 Next Steps

1. **Test with one story:**
   ```bash
   node upload-stories-v2.js 1
   ```

2. **Verify upload:**
   - Check cover image appears
   - Check all page images appear
   - Open in editor to confirm persistence

3. **Upload all 75 stories:**
   ```bash
   node upload-stories-v2.js
   ```

## 📖 Additional Documentation

- **Full Guide:** `UPLOAD_GUIDE.md` - Technical details and workflow diagrams
- **Script:** `upload-stories-v2.js` - Enhanced version with all improvements

## 🔒 Security Note

**Login credentials are stored in plain text** in the script. For production use, consider:
- Using environment variables
- Using a secure credential store
- Removing credentials after testing

Example with environment variables:
```bash
LOGIN_EMAIL=your@email.com LOGIN_PASSWORD=yourpass node upload-stories-v2.js 1
```

Then in script:
```javascript
const LOGIN_EMAIL = process.env.LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;
```
