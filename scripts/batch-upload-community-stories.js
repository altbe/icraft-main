#!/usr/bin/env node
/**
 * Batch upload community stories to dev.icraftstories.com
 * Based on successful playwright-mcp walkthrough
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://dev.icraftstories.com';
const STORIES_DIR = '/home/g/_zdev/icraft-main/stories-tmp/processed';

class CommunityStoryUploader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.successCount = 0;
    this.failCount = 0;
  }

  async setup() {
    console.log('🚀 Starting browser...');
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
    await this.page.goto(BASE_URL);

    // Accept cookies if prompt appears
    try {
      const acceptButton = this.page.locator('button:has-text("Got it!")');
      await acceptButton.waitFor({ state: 'visible', timeout: 3000 });
      await acceptButton.click();
      console.log('✓ Cookies accepted');
      await this.page.waitForTimeout(500);
    } catch (error) {
      // No cookies prompt or already accepted
    }

    // Check if already logged in
    const signOutButton = await this.page.locator('button:has-text("Sign Out")').count();
    if (signOutButton > 0) {
      console.log('✓ Already authenticated\n');
    } else {
      console.log('⚠ Logging in...');
      await this.login();
      console.log('✓ Authenticated\n');
    }
  }

  async login() {
    // Click Sign In button
    await this.page.click('button:has-text("Sign In")');

    // Wait for Clerk modal email field
    await this.page.waitForSelector('input[name="identifier"]', { timeout: 10000 });

    // Fill email
    await this.page.fill('input[name="identifier"]', 'travel@altgene.net');

    // Click Continue button
    const continueButton = this.page.locator('button:has-text("Continue")').first();
    await continueButton.waitFor({ state: 'visible' });
    await continueButton.click();

    // Wait for password field
    await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });

    // Fill password
    await this.page.fill('input[name="password"]', 'travel@altgene.net');

    // Click Continue again
    const submitButton = this.page.locator('button:has-text("Continue")').first();
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();

    // Wait for successful login
    await this.page.waitForSelector('button:has-text("Sign Out")', { timeout: 15000 });
  }

  async uploadStory(storyDir) {
    const storyPath = join(storyDir, 'story.json');
    if (!existsSync(storyPath)) {
      throw new Error(`story.json not found in ${storyDir}`);
    }

    const story = JSON.parse(readFileSync(storyPath, 'utf-8'));
    console.log(`\n📖 ${story.title}`);

    // 1. Click New Story
    await this.page.click('button:has-text("New Story")');
    await this.page.waitForTimeout(1000);

    // 2. Dismiss AI Generator dialog
    await this.page.waitForSelector('button:has-text("Cancel")', { timeout: 5000 });
    await this.page.click('button:has-text("Cancel")');
    await this.page.waitForTimeout(500);

    // 3. Fill title using pressSequentially with slower delay
    const titleInput = this.page.locator('textarea[placeholder*="story title"], input[placeholder*="story title"]').first();
    await titleInput.waitFor({ state: 'visible' });
    await titleInput.click();
    await this.page.waitForTimeout(100);
    await titleInput.clear();
    await this.page.waitForTimeout(100);
    await titleInput.pressSequentially(story.title, { delay: 20 });
    await this.page.waitForTimeout(300);
    console.log(`  ✓ Title`);

    // 4. Add tags (skip "English" as it's default)
    if (story.tags && story.tags.length > 0) {
      for (const tag of story.tags) {
        if (tag.toLowerCase() === 'english') continue;
        const tagInput = this.page.locator('input[placeholder*="tag"]').first();
        await tagInput.click();
        await this.page.waitForTimeout(50);
        await tagInput.pressSequentially(tag, { delay: 20 });
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(300);
      }
      console.log(`  ✓ Tags (${story.tags.length})`);
    }

    // 5. Upload cover image first (before adding coaching, to allow time for content validation)
    const coverPath = join(storyDir, 'cover.webp');
    if (existsSync(coverPath)) {
      await this.uploadAndSetBackground(coverPath, 'Cover');
    }

    // 6. Add cover coaching content if available (AFTER cover image)
    if (story.cover_coaching && story.cover_coaching.trim().length > 0) {
      try {
        // Look for coaching textarea in the Cover Page section (should be first/only one at this point)
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

    // 7. Process all pages
    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const pageNum = i + 1;

      // Add new page if not first
      if (i > 0) {
        // Dismiss "Close Without Saving" dialog if it appears
        try {
          const closeDialog = this.page.locator('button:has-text("Close Without Saving")');
          if (await closeDialog.isVisible({ timeout: 1000 })) {
            await closeDialog.click();
            await this.page.waitForTimeout(500);
          }
        } catch (error) {
          // No dialog, continue
        }

        await this.page.click('button:has-text("Add New Page")');
        await this.page.waitForTimeout(1000);
      }

      // Fill page content - use pressSequentially with slower delay
      const contentTextareas = await this.page.locator('textarea[placeholder*="Write your story"]').all();
      if (contentTextareas[i]) {
        await contentTextareas[i].click();
        await this.page.waitForTimeout(100);
        await contentTextareas[i].clear();
        await this.page.waitForTimeout(100);
        await contentTextareas[i].pressSequentially(page.content, { delay: 20 });
        await this.page.waitForTimeout(300);
      }

      // Fill coaching content - use pressSequentially with slower delay
      // NOTE: Index i+1 because coaching textareas include cover (index 0) + pages (starting at index 1)
      const coachingTextareas = await this.page.locator('textarea[placeholder*="coaching"]').all();
      const coachingIndex = i + 1; // Skip cover coaching at index 0
      if (coachingTextareas[coachingIndex] && page.coaching && page.coaching.trim().length > 0) {
        await coachingTextareas[coachingIndex].click();
        await this.page.waitForTimeout(100);
        await coachingTextareas[coachingIndex].clear();
        await this.page.waitForTimeout(100);
        await coachingTextareas[coachingIndex].pressSequentially(page.coaching.trim(), { delay: 20 });
        await this.page.waitForTimeout(300);
      }

      console.log(`  ✓ Page ${pageNum} content`);

      // Wait for auto-save to complete
      await this.page.waitForTimeout(2000);

      // Check if auto-save is in progress and wait for it
      try {
        await this.page.waitForFunction(
          () => !document.body.textContent.includes('Saving'),
          { timeout: 5000 }
        );
      } catch (error) {
        // Continue if no "Saving" indicator found
      }

      // Upload page image if exists
      const pagePath = join(storyDir, `page-${pageNum}.webp`);
      if (existsSync(pagePath)) {
        await this.uploadAndSetBackground(pagePath, `Page ${pageNum}`);
      }
    }

    // 8. Navigate back to library
    const backButton = this.page.locator('button:has-text("Back to Library")').first();
    await backButton.waitFor({ state: 'visible', timeout: 10000 });
    await backButton.click();
    await this.page.waitForURL('**/library', { timeout: 10000 });

    console.log('  ✅ Story uploaded successfully');
    return true;
  }

  async uploadAndSetBackground(imagePath, label) {
    try {
      // Determine which section to look for based on label
      // label is either "Cover" or "Page 1", "Page 2", etc.
      const sectionHeading = label === 'Cover' ? 'Cover Page' : label;

      let enabledButton = null;
      let attempts = 0;
      const maxAttempts = 40; // 20 seconds total (increased from 10s)

      // Poll for an enabled Add button in the specific section (content validation can take time)
      while (!enabledButton && attempts < maxAttempts) {
        try {
          // Try multiple selector strategies to find the section
          // Strategy 1: Look for h2, h3, or any element with matching text
          let sectionLocator = this.page.locator(`h2:has-text("${sectionHeading}"), h3:has-text("${sectionHeading}"), [role="heading"]:has-text("${sectionHeading}")`).first().locator('../..');

          // Strategy 2: If first doesn't work, try broader text search
          const sectionExists = await sectionLocator.count().catch(() => 0);
          if (sectionExists === 0) {
            // Find any element containing the section text, then navigate up to find the container
            sectionLocator = this.page.locator(`text="${sectionHeading}"`).first().locator('../..');
          }

          // Find Add button for illustration within this section
          // Look for button with "Add" text AND an svg icon
          const addButton = sectionLocator.locator('button:has-text("Add")').filter({ has: this.page.locator('svg') }).first();

          const isVisible = await addButton.isVisible().catch(() => false);
          if (!isVisible) {
            await this.page.waitForTimeout(500);
            attempts++;
            continue;
          }

          const isEnabled = await addButton.isEnabled().catch(() => false);
          if (!isEnabled) {
            await this.page.waitForTimeout(500);
            attempts++;
            continue;
          }

          enabledButton = addButton;
          break;
        } catch (e) {
          await this.page.waitForTimeout(500);
          attempts++;
        }
      }

      if (!enabledButton) {
        console.log(`  ⚠ ${label} image skipped (no enabled Add button found in ${sectionHeading} section after ${maxAttempts * 500}ms)`);
        return;
      }

      // Click the enabled Add button for this specific section
      await enabledButton.click();

      // Wait for Canvas Editor to actually load (wait for Canvas Editor heading)
      await this.page.waitForSelector('heading:has-text("Canvas Editor")', { timeout: 10000 });
      await this.page.waitForTimeout(500);

      // Wait for Upload Image button to be visible and clickable
      const uploadImageBtn = this.page.locator('button:has-text("Upload Image")');
      await uploadImageBtn.waitFor({ state: 'visible', timeout: 5000 });
      await uploadImageBtn.click();

      // Wait for upload panel to open (wait for "Upload image" button)
      const uploadButton = this.page.locator('button:has-text("Upload image")').first();
      await uploadButton.waitFor({ state: 'visible', timeout: 5000 });

      // Trigger file chooser
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser', { timeout: 5000 }),
        uploadButton.click()
      ]);

      await fileChooser.setFiles(imagePath);

      // Wait for image upload to complete and dialog to appear
      await this.page.waitForSelector('button:has-text("Set as Background")', { timeout: 10000 });

      // Click Set as Background
      await this.page.click('button:has-text("Set as Background")');
      await this.page.waitForTimeout(1000);

      // Click Save button in Canvas Editor (NOT "Save Story" button)
      // The Canvas Editor Save button is near the "Discard" button
      const saveBtns = await this.page.locator('button').all();
      let canvasEditorSaveBtn = null;

      for (const btn of saveBtns) {
        try {
          const text = await btn.textContent();
          if (text && text.trim() === 'Save') {
            // Check if this is the Canvas Editor Save button by checking if Discard button is nearby
            const parent = await btn.evaluateHandle(el => el.parentElement);
            const parentText = await parent.evaluate(el => el.textContent);
            if (parentText && parentText.includes('Discard')) {
              canvasEditorSaveBtn = btn;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!canvasEditorSaveBtn) {
        throw new Error('Canvas Editor Save button not found');
      }

      await canvasEditorSaveBtn.click();

      // Wait for canvas editor to close
      await this.page.waitForTimeout(2000);

      console.log(`  ✓ ${label} image`);
      return;
    } catch (error) {
      console.log(`  ⚠ ${label} image failed: ${error.message}`);
    }
  }

  async uploadAllStories(limit = null) {
    const storyDirs = readdirSync(STORIES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => join(STORIES_DIR, dirent.name))
      .sort();

    const storiesToUpload = limit ? storyDirs.slice(0, limit) : storyDirs;
    const total = storiesToUpload.length;

    console.log(`\n🎯 Uploading ${total} stories`);
    console.log('=' .repeat(60) + '\n');

    for (let i = 0; i < total; i++) {
      const storyDir = storiesToUpload[i];
      const storyName = storyDir.split('/').pop();

      try {
        console.log(`[${i + 1}/${total}] ${storyName}`);
        await this.uploadStory(storyDir);
        this.successCount++;
      } catch (error) {
        this.failCount++;
        console.log(`  ❌ Failed: ${error.message}`);

        // Try to recover by going back to library
        try {
          await this.page.goto(`${BASE_URL}/library`);
          await this.page.waitForSelector('button:has-text("New Story")', { timeout: 5000 });
        } catch (recoveryError) {
          console.log(`  ⚠ Could not recover, continuing...`);
        }
      }

      // Brief pause between stories
      await this.page.waitForTimeout(1000);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Success: ${this.successCount}/${total}`);
    console.log(`❌ Failed: ${this.failCount}/${total}`);
    console.log('='.repeat(60) + '\n');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const uploader = new CommunityStoryUploader();

  try {
    await uploader.setup();

    // Get limit from command line (default: all stories)
    const limit = process.argv[2] ? parseInt(process.argv[2]) : null;

    if (limit) {
      console.log(`📦 Uploading ${limit} stories\n`);
    } else {
      console.log(`📦 Uploading all stories\n`);
    }

    await uploader.uploadAllStories(limit);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await uploader.cleanup();
  }
}

main();
