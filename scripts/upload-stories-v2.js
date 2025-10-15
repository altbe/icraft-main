#!/usr/bin/env node
/**
 * Enhanced Playwright story uploader with section-specific selectors
 * Uses event-based waiting for reliable uploads
 * Uses WebKit browser (Safari engine)
 *
 * Usage:
 *   node upload-stories-v2.js [limit]
 *
 * Examples:
 *   node upload-stories-v2.js 1     # Upload first story
 *   node upload-stories-v2.js 5     # Upload first 5 stories
 *   node upload-stories-v2.js       # Upload all stories
 */

import { webkit } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://dev.icraftstories.com';
const STORIES_DIR = '/home/g/_zdev/icraft-main/stories-tmp/processed';

// Login credentials - UPDATE THESE with your credentials
const LOGIN_EMAIL = 'travel@altgene.net';
const LOGIN_PASSWORD = 'travel@altgene.net';

// Validate credentials are set
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error('❌ Error: LOGIN_EMAIL and LOGIN_PASSWORD must be set');
  console.error('Please edit the script and add your credentials at the top.');
  process.exit(1);
}

class EnhancedStoryUploader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.successCount = 0;
    this.failCount = 0;
  }

  async setup() {
    console.log('🚀 Starting WebKit browser...');
    this.browser = await webkit.launch({
      headless: false,
      slowMo: 100 // Match old script timing
    });

    this.page = await this.browser.newPage();

    // Set viewport for consistent behavior
    await this.page.setViewportSize({ width: 1920, height: 1080 });

    console.log('📍 Navigating to', BASE_URL);
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Handle cookie consent if it appears
    await this.dismissCookieConsent();

    // Check if already logged in
    console.log('🔍 Checking authentication status...');
    const logoutButton = await this.page.locator('button:has-text("Logout"), button:has-text("Sign Out")').count();

    if (logoutButton > 0) {
      console.log('✓ Already authenticated');
    } else {
      console.log('🔐 Not authenticated, logging in...');
      await this.login();
      console.log('✓ Authentication successful');
    }

    // Verify we can see the New Story button
    try {
      await this.page.waitForSelector('button[data-testid="nav-create-new"]', { timeout: 10000 });
      console.log('✓ New Story button found - Application ready\n');
    } catch (error) {
      console.error('❌ New Story button NOT found - Application may not be ready');
      throw new Error('New Story button not found after authentication');
    }
  }

  async dismissCookieConsent() {
    try {
      // Wait for cookie consent dialog (but don't fail if it doesn't appear)
      const cookieButton = await this.page.waitForSelector(
        'button:has-text("Accept"), button:has-text("OK"), button:has-text("Got it"), button[aria-label*="cookie" i], button[aria-label*="consent" i]',
        { timeout: 3000 }
      );

      if (cookieButton) {
        await cookieButton.click();
        console.log('✓ Cookie consent dismissed');
        await this.page.waitForTimeout(500);
      }
    } catch (error) {
      // Cookie dialog didn't appear or already dismissed - this is fine
      console.log('  (No cookie consent dialog found)');
    }
  }

  async login() {
    try {
      console.log('  → Clicking Sign In button...');
      await this.page.click('button:has-text("Sign In")');

      // Wait for Clerk modal to appear
      console.log('  → Waiting for login modal...');
      await this.page.waitForSelector('input[name="identifier"]', { timeout: 10000 });

      // Fill email
      console.log(`  → Entering email: ${LOGIN_EMAIL}`);
      await this.page.fill('input[name="identifier"]', LOGIN_EMAIL);

      // Click Continue
      console.log('  → Clicking Continue (step 1)...');
      const continueButton = this.page.locator('button:has-text("Continue")').first();
      await continueButton.waitFor({ state: 'visible' });
      await continueButton.click();

      // Wait for password field
      console.log('  → Waiting for password field...');
      await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });

      // Fill password
      console.log('  → Entering password...');
      await this.page.fill('input[name="password"]', LOGIN_PASSWORD);

      // Click Continue again
      console.log('  → Clicking Continue (step 2)...');
      const submitButton = this.page.locator('button:has-text("Continue")').first();
      await submitButton.waitFor({ state: 'visible' });
      await submitButton.click();

      // Wait for successful login
      console.log('  → Verifying login success...');
      await this.page.waitForSelector('button:has-text("Logout"), button:has-text("Sign Out")', { timeout: 15000 });

      // Check for any error messages
      const errorMessage = await this.page.locator('text=/incorrect|invalid|error/i').count();
      if (errorMessage > 0) {
        throw new Error('Login error detected in UI');
      }

      console.log('  → Login successful!');
    } catch (error) {
      console.error('\n❌ Login failed:', error.message);
      console.error('  Please verify:');
      console.error(`    - Email: ${LOGIN_EMAIL}`);
      console.error(`    - Password is correct`);
      console.error('    - Account exists and is active');
      console.error('    - Network connection is stable');
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Upload image to a specific section (cover or page number)
   * Uses section-specific selectors added in the frontend
   */
  async uploadImageToSection(imagePath, sectionId, label) {
    try {
      console.log(`    → Opening canvas editor for ${label}...`);

      // Step 1: Click the illustration Add/Edit button for this section
      const illustrationButton = this.page.locator(
        `button[data-testid^="illustration-"][data-section="${sectionId}"]`
      ).first();

      await illustrationButton.waitFor({ state: 'visible', timeout: 5000 });
      await illustrationButton.click();

      // Step 2: Wait for canvas editor to fully load
      await this.page.waitForSelector(
        `button[data-testid="canvas-upload-image-${sectionId}"]`,
        { state: 'visible', timeout: 10000 }
      );

      console.log(`    → Canvas editor opened for ${label}`);

      // Step 3: Click the Upload Image button in toolbar (opens ImageSearch dialog)
      const uploadButton = this.page.locator(
        `button[data-testid="canvas-upload-image-${sectionId}"]`
      );
      await uploadButton.click();
      console.log(`    → Upload Image button clicked for ${label}`);

      // Step 4: Wait for ImageSearch dialog and file input to appear
      await this.page.waitForSelector('input[data-testid="file-upload-input"]', {
        state: 'attached',
        timeout: 5000
      });

      // Step 5: Set the file directly on the hidden input
      await this.page.setInputFiles('input[data-testid="file-upload-input"]', imagePath);
      console.log(`    → Image file selected for ${label}`);

      // Step 6: Handle rights confirmation dialog if it appears
      try {
        const confirmButton = await this.page.waitForSelector(
          'button:has-text("I Confirm")',
          { timeout: 2000 }
        );
        if (confirmButton) {
          await confirmButton.click();
          console.log(`    → Rights confirmation accepted`);
        }
      } catch (error) {
        // Rights already confirmed, continue
      }

      // Step 7: Wait for image to be processed and check what buttons appear
      console.log(`    → Waiting for image processing...`);
      await this.page.waitForTimeout(2000);

      // Check what buttons are available
      const allButtons = await this.page.locator('button').allTextContents();
      console.log(`    → Available buttons: ${allButtons.join(', ')}`);

      // Check specifically for the buttons we're looking for (correct button text)
      const addAsObjectCount = await this.page.locator('button:has-text("Add as Object")').count();
      const setAsBackgroundCount = await this.page.locator('button:has-text("Set as Background")').count();
      console.log(`    → "Add as Object" found: ${addAsObjectCount} times`);
      console.log(`    → "Set as Background" found: ${setAsBackgroundCount} times`);

      if (addAsObjectCount === 0 && setAsBackgroundCount === 0) {
        throw new Error('Neither "Add as Object" nor "Set as Background" buttons found');
      }

      // Step 8: Click "Set as Background" for all images (cover and pages)
      const buttonText = 'Set as Background';
      console.log(`    → Clicking "${buttonText}"...`);
      await this.page.click(`button:has-text("${buttonText}")`);
      console.log(`    ✓ Selected: ${buttonText}`);

      // Step 9: Wait for ImageSearch dialog to close and image to appear on canvas
      await this.page.waitForTimeout(2000); // Give canvas time to render image

      // Step 10: Click canvas editor Save button with section-specific selector
      const canvasSaveButton = this.page.locator(
        `button[data-testid="canvas-save-${sectionId}"]`
      );

      console.log(`    → Waiting for canvas Save button for ${label}...`);
      await canvasSaveButton.waitFor({ state: 'visible', timeout: 5000 });

      console.log(`    → Clicking canvas Save button for ${label}...`);
      await canvasSaveButton.click();

      console.log(`    → Canvas Save clicked for ${label}`);

      // Step 11: Wait for canvas editor to close (button should disappear)
      console.log(`    → Waiting for canvas editor to close for ${label}...`);
      await this.page.waitForSelector(
        `button[data-testid="canvas-save-${sectionId}"]`,
        { state: 'hidden', timeout: 10000 }
      );
      console.log(`    → Canvas editor closed for ${label}`);

      // Step 12: Verify image preview appears
      await this.page.waitForTimeout(1000); // Brief wait for preview to render

      console.log(`    ✓ ${label} uploaded and saved`);
      return true;

    } catch (error) {
      console.log(`    ⚠ ${label} upload failed: ${error.message}`);

      // Try to close any open dialogs and canvas editor
      try {
        // Try to close ImageSearch dialog if it's open
        const closeImageSearch = this.page.locator('button[aria-label*="Close"]').first();
        if (await closeImageSearch.isVisible()) {
          await closeImageSearch.click();
          await this.page.waitForTimeout(500);
        }
      } catch (closeError) {
        // Ignore
      }

      try {
        // Try to close canvas editor if it's stuck open
        const discardButton = this.page.locator(
          `button[data-testid="canvas-discard-${sectionId}"]`
        );
        if (await discardButton.isVisible()) {
          await discardButton.click();
          await this.page.waitForTimeout(500);
        }
      } catch (closeError) {
        // Ignore
      }

      return false;
    }
  }

  async uploadStory(storyDir) {
    const storyPath = join(storyDir, 'story.json');
    if (!existsSync(storyPath)) {
      throw new Error(`story.json not found in ${storyDir}`);
    }

    const story = JSON.parse(readFileSync(storyPath, 'utf-8'));
    console.log(`\n📖 ${story.title}`);

    // Wait for and click New Story button using data-testid
    console.log('  → Waiting for New Story button...');
    try {
      const newStoryButton = await this.page.waitForSelector('button[data-testid="nav-create-new"]', {
        state: 'visible',
        timeout: 10000
      });

      if (!newStoryButton) {
        console.error('  ❌ New Story button NOT found (returned null)');
        throw new Error('New Story button not found');
      }

      console.log('  ✓ New Story button found');
      console.log('  → Clicking New Story button...');
      await newStoryButton.click();
    } catch (error) {
      console.error('  ❌ Failed to find New Story button:', error.message);
      throw new Error('New Story button not found or not visible');
    }

    // Wait for editor to load (URL should change to /editor?new=true or /editor/{uuid})
    console.log('  → Waiting for editor URL...');
    await this.page.waitForURL(/\/editor/, { timeout: 10000 });
    console.log(`  ✓ Editor loaded: ${this.page.url()}`);

    // Dismiss AI Generator dialog - wait for it to appear
    try {
      await this.page.waitForSelector('button:has-text("Create Manually"), button:has-text("Cancel")', { timeout: 5000 });
      await this.page.click('button:has-text("Create Manually"), button:has-text("Cancel")');
      await this.page.waitForTimeout(500);
      console.log('  ✓ AI dialog dismissed');
    } catch (error) {
      console.log('  ⚠ No AI dialog to dismiss (might already be dismissed)');
    }

    // Wait for editor form to be ready
    await this.page.waitForSelector('textarea[placeholder*="story title"], input[placeholder*="story title"]');
    console.log('  ✓ Editor form ready');

    // Fill title
    const titleInput = this.page.locator('textarea[placeholder*="story title"], input[placeholder*="story title"]').first();
    await titleInput.fill(story.title);
    console.log(`  ✓ Title filled`);

    // Fill Cover Page coaching content if it exists
    // Support both cover_coaching (from LLM parser) and coverCoaching (legacy)
    const coverCoachingText = story.cover_coaching || story.coverCoaching || (story.pages && story.pages[0] && story.pages[0].coverCoaching);
    if (coverCoachingText) {
      const coverSection = this.page.locator('h2:has-text("Cover Page")').locator('..').locator('..');
      const coverCoachingTextarea = coverSection.locator('textarea[placeholder*="coaching"]').first();

      const coverCoachingCount = await coverCoachingTextarea.count();
      if (coverCoachingCount > 0) {
        await coverCoachingTextarea.fill(coverCoachingText);
        const coachingPreview = coverCoachingText.substring(0, 50) + (coverCoachingText.length > 50 ? '...' : '');
        console.log(`  ✓ Cover coaching filled: "${coachingPreview}"`);
      }
    }

    // Add tags
    if (story.tags && story.tags.length > 0) {
      const validTags = story.tags.filter(tag => tag && tag.trim());
      for (const tag of validTags) {
        const tagInput = this.page.locator('input[placeholder*="tag"]').first();
        await tagInput.fill(tag);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(200);
      }
      console.log(`  ✓ Tags added (${validTags.length})`);
    }

    // Upload cover image
    const coverPath = join(storyDir, 'cover.webp');
    if (existsSync(coverPath)) {
      await this.uploadImageToSection(coverPath, 'cover', 'Cover');
    }

    // Process all pages
    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const pageNum = i + 1;
      const sectionId = `page-${pageNum}`;

      // Add new page if not first
      if (i > 0) {
        await this.page.click('button:has-text("Add New Page")');
        await this.page.waitForTimeout(1000); // Wait for page to be added
      }

      // Fill page content
      console.log(`  → Page ${pageNum}:`);

      // Use array index for textareas (simpler approach)
      // Story content textareas (not including title)
      const contentTextareas = await this.page.locator('textarea[placeholder*="Write your story"]').all();
      if (contentTextareas[i]) {
        await contentTextareas[i].fill(page.content);
        const contentPreview = page.content.substring(0, 50) + (page.content.length > 50 ? '...' : '');
        console.log(`    ✓ Content filled: "${contentPreview}"`);
      }

      // Fill coaching content - index i+1 because index 0 is Cover Page coaching
      if (page.coaching) {
        const coachingTextareas = await this.page.locator('textarea[placeholder*="coaching"]').all();
        const coachingIndex = i + 1; // Cover is 0, Page 1 is 1, Page 2 is 2, etc.

        if (coachingTextareas[coachingIndex]) {
          await coachingTextareas[coachingIndex].fill(page.coaching);
          const coachingPreview = page.coaching.substring(0, 50) + (page.coaching.length > 50 ? '...' : '');
          console.log(`    ✓ Coaching filled: "${coachingPreview}"`);
        } else {
          console.log(`    ⚠ Coaching textarea not found at index ${coachingIndex}`);
        }
      } else {
        console.log(`    ℹ No coaching content for page ${pageNum}`);
      }

      // Upload page image
      const pagePath = join(storyDir, `page-${pageNum}.webp`);
      if (existsSync(pagePath)) {
        await this.uploadImageToSection(pagePath, sectionId, `Page ${pageNum}`);
      }
    }

    // Navigate back to library (story auto-saves)
    console.log('  → Clicking Back to Library...');
    const backButton = this.page.locator('button:has-text("Back to Library"), a:has-text("Back to Library")').first();
    await backButton.waitFor({ state: 'visible', timeout: 10000 });
    await backButton.click();

    // Wait for navigation to library
    try {
      await this.page.waitForURL(/\/library|\/$/,  { timeout: 10000 });
      console.log('  ✅ Story completed - returned to library');
      return true;
    } catch (error) {
      console.log('  ⚠ Navigation to library timed out, but story may have been saved');
      return true;
    }
  }

  async uploadAllStories(limit = null) {
    const storyDirs = readdirSync(STORIES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => join(STORIES_DIR, dirent.name))
      .sort();

    const storiesToUpload = limit ? storyDirs.slice(0, limit) : storyDirs;
    const total = storiesToUpload.length;

    console.log(`\n🎯 Uploading ${total} stories from ${STORIES_DIR}\n`);
    console.log('='.repeat(80));

    // Navigate to home page to start
    await this.page.goto(BASE_URL);
    try {
      await this.page.waitForSelector('button[data-testid="nav-create-new"]', { timeout: 10000 });
      console.log('✓ Ready to start uploading\n');
    } catch (error) {
      console.error('❌ New Story button not found on home page');
      throw new Error('Cannot start upload - New Story button not available');
    }

    for (let i = 0; i < total; i++) {
      const storyDir = storiesToUpload[i];
      const storyName = storyDir.split('/').pop();

      try {
        console.log(`\n[${i + 1}/${total}] ${storyName}`);
        await this.uploadStory(storyDir);
        this.successCount++;

        // Return to home page after each story
        await this.page.goto(BASE_URL);
        try {
          await this.page.waitForSelector('button[data-testid="nav-create-new"]', { timeout: 10000 });
          console.log('  ✓ Returned to home page');
        } catch (error) {
          console.error('  ⚠ Warning: New Story button not found after return to home');
        }

        // Brief pause between stories
        await this.page.waitForTimeout(3000);
      } catch (error) {
        this.failCount++;
        console.log(`  ❌ Failed: ${error.message}`);

        // Try to recover by going back to home
        try {
          await this.page.goto(BASE_URL);
          await this.page.waitForSelector('button[data-testid="nav-create-new"]', { timeout: 10000 });
          console.log('  ✓ Recovered - returned to home page');
        } catch (recoveryError) {
          console.error('  ⚠ Could not recover to home page - New Story button not found');
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 Upload Summary:`);
    console.log(`   ✅ Success: ${this.successCount}/${total}`);
    console.log(`   ❌ Failed: ${this.failCount}/${total}`);
    console.log('='.repeat(80) + '\n');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const uploader = new EnhancedStoryUploader();

  try {
    await uploader.setup();

    // Get limit from command line (default: all stories)
    const limit = process.argv[2] ? parseInt(process.argv[2]) : null;

    if (limit) {
      console.log(`📦 Uploading first ${limit} ${limit === 1 ? 'story' : 'stories'}\n`);
    } else {
      console.log(`📦 Uploading all stories\n`);
    }

    await uploader.uploadAllStories(limit);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await uploader.cleanup();
  }
}

main();
