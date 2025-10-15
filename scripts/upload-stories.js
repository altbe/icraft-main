#!/usr/bin/env node
/**
 * Batch upload community stories to dev.icraftstories.com using Playwright
 * Uses event-based waiting for reliable uploads
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://dev.icraftstories.com';
const STORIES_DIR = '/home/g/_zdev/icraft-main/stories-tmp/processed';
const LOGIN_EMAIL = 'travel@altgene.net';
const LOGIN_PASSWORD = 'travel@altgene.net';

class StoryUploader {
  constructor() {
    this.browser = null;
    this.page = null;
    this.successCount = 0;
    this.failCount = 0;
  }

  async setup() {
    console.log('🚀 Starting browser...');
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 100 // Slight delay for stability
    });
    this.page = await this.browser.newPage();
    await this.page.goto(BASE_URL);

    // Check if already logged in
    const isLoggedIn = await this.page.locator('button:has-text("Sign Out")').count() > 0;

    if (isLoggedIn) {
      console.log('✓ Already authenticated');
    } else {
      console.log('⚠ Logging in...');
      await this.login();
      console.log('✓ Authenticated');
    }
  }

  async login() {
    // Click Sign In
    await this.page.click('button:has-text("Sign In")');

    // Wait for Clerk modal to appear
    await this.page.waitForSelector('input[name="identifier"]', { timeout: 10000 });

    // Fill email
    await this.page.fill('input[name="identifier"]', LOGIN_EMAIL);

    // Find and click the visible Continue button
    const continueButton = this.page.locator('button:has-text("Continue")').first();
    await continueButton.waitFor({ state: 'visible' });
    await continueButton.click();

    // Wait for password field
    await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });

    // Fill password
    await this.page.fill('input[name="password"]', LOGIN_PASSWORD);

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

    // Click [+ New Story] navigation button
    await this.page.click('button:has-text("New Story")');
    await this.page.waitForTimeout(2000); // Wait for editor to load

    // Dismiss AI Generator dialog with Cancel
    await this.page.waitForSelector('button:has-text("Cancel")');
    await this.page.click('button:has-text("Cancel")');
    await this.page.waitForTimeout(500);

    // Wait for editor form to be ready
    await this.page.waitForSelector('textarea[placeholder*="story title"], input[placeholder*="story title"]');

    // Fill title
    const titleInput = this.page.locator('textarea[placeholder*="story title"], input[placeholder*="story title"]').first();
    await titleInput.fill(story.title);
    console.log(`  ✓ Title`);

    // Add tags (skip "English" as it's default)
    if (story.tags && story.tags.length > 0) {
      for (const tag of story.tags) {
        const tagInput = this.page.locator('input[placeholder*="tag"]').first();
        await tagInput.fill(tag);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(200); // Small delay for tag to register
      }
      console.log(`  ✓ Tags (${story.tags.length})`);
    }

    // Upload cover image if exists
    const coverPath = join(storyDir, 'cover.webp');
    if (existsSync(coverPath)) {
      await this.uploadImage(coverPath, 'Cover');
    }

    // Process all pages
    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const pageNum = i + 1;

      // Add new page if not first
      if (i > 0) {
        await this.page.click('button:has-text("Add New Page")');
        await this.page.waitForTimeout(500);
      }

      // Fill page content
      const contentTextareas = await this.page.locator('textarea[placeholder*="Write your story"]').all();
      if (contentTextareas[i]) {
        await contentTextareas[i].fill(page.content);
      }

      // Fill coaching content
      const coachingTextareas = await this.page.locator('textarea[placeholder*="coaching"]').all();
      if (coachingTextareas[i]) {
        await coachingTextareas[i].fill(page.coaching);
      }

      console.log(`  ✓ Page ${pageNum} content`);

      // Upload page image if exists
      const pagePath = join(storyDir, `page-${pageNum}.webp`);
      if (existsSync(pagePath)) {
        await this.uploadImage(pagePath, `Page ${pageNum}`);
      }
    }

    // Save story
    const saveButton = this.page.locator('button:has-text("Save Story")').first();
    await saveButton.waitFor({ state: 'visible' });
    await saveButton.click();

    // Wait for save confirmation
    try {
      await this.page.waitForSelector('text=/saved successfully/i', { timeout: 10000 });
      console.log('  ✅ Saved');
      return true;
    } catch (error) {
      // Check if URL changed (also indicates success)
      if (this.page.url().includes('/story/') || this.page.url().includes('/editor/')) {
        console.log('  ✅ Saved');
        return true;
      }
      throw new Error('Save timeout');
    }
  }

  async uploadImage(imagePath, label) {
    try {
      // Find all Add buttons for illustrations
      const addButtons = await this.page.locator('button:has-text("Add")').all();

      // Find the first visible Add button
      for (const button of addButtons) {
        try {
          const isVisible = await button.isVisible();
          if (!isVisible) continue;

          // Set up file chooser promise before clicking
          const [fileChooser] = await Promise.all([
            this.page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
            button.click().catch(() => null)
          ]);

          if (!fileChooser) continue;

          // Set files
          await fileChooser.setFiles(imagePath);

          // Wait for upload to complete
          await this.page.waitForLoadState('networkidle', { timeout: 10000 });
          console.log(`  ✓ ${label} image`);
          return;
        } catch (error) {
          // Try next button
          continue;
        }
      }

      console.log(`  ⚠ ${label} image upload skipped (no file chooser)`);
    } catch (error) {
      console.log(`  ⚠ ${label} image upload skipped: ${error.message}`);
    }
  }

  async uploadAllStories(limit = null) {
    const storyDirs = readdirSync(STORIES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => join(STORIES_DIR, dirent.name))
      .sort();

    const storiesToUpload = limit ? storyDirs.slice(0, limit) : storyDirs;
    const total = storiesToUpload.length;

    console.log(`\n🎯 Uploading ${total} stories\n`);
    console.log('=' .repeat(60));

    // Navigate to home page to start
    await this.page.goto(BASE_URL);
    await this.page.waitForSelector('button:has-text("New Story")');

    for (let i = 0; i < total; i++) {
      const storyDir = storiesToUpload[i];
      const storyName = storyDir.split('/').pop();

      try {
        console.log(`\n[${i + 1}/${total}] ${storyName}`);
        await this.uploadStory(storyDir);
        this.successCount++;

        // Return to home page after each story
        await this.page.goto(BASE_URL);
        await this.page.waitForSelector('button:has-text("New Story")');
      } catch (error) {
        this.failCount++;
        console.log(`  ❌ Failed: ${error.message}`);

        // Try to recover by going back to home
        try {
          await this.page.goto(BASE_URL);
          await this.page.waitForSelector('button:has-text("New Story")');
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
  const uploader = new StoryUploader();

  try {
    await uploader.setup();

    // Get limit from command line (default: all stories)
    const limit = process.argv[2] ? parseInt(process.argv[2]) : null;

    if (limit) {
      console.log(`📦 Batch mode: uploading ${limit} stories\n`);
    } else {
      console.log(`📦 Batch mode: uploading all stories\n`);
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
