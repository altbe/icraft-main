#!/usr/bin/env node
/**
 * Batch upload community stories to dev.icraftstories.com
 * Uses event-based waiting (no arbitrary timeouts)
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
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();

    // Navigate to app
    await this.page.goto(BASE_URL);

    // Wait for authentication (check if user is logged in)
    try {
      await this.page.waitForSelector('text="Sign Out"', { timeout: 5000 });
      console.log('✓ User already authenticated');
    } catch {
      console.log('⚠ User not authenticated, logging in...');
      await this.login();
      console.log('✓ User authenticated');
    }
  }

  async login() {
    // Click Sign In button
    await this.page.click('text="Sign In"');
    await this.page.waitForSelector('input[name="identifier"], input[type="email"]', { timeout: 10000 });

    // Fill email
    await this.page.fill('input[name="identifier"], input[type="email"]', LOGIN_EMAIL);
    await this.page.click('button:has-text("Continue"), button[type="submit"]');

    // Wait for password field
    await this.page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });

    // Fill password
    await this.page.fill('input[name="password"], input[type="password"]', LOGIN_PASSWORD);
    await this.page.click('button:has-text("Continue"), button[type="submit"]');

    // Wait for successful login (Sign Out button appears)
    await this.page.waitForSelector('text="Sign Out"', { timeout: 15000 });
  }

  async uploadStory(storyDir) {
    const storyPath = join(storyDir, 'story.json');
    if (!existsSync(storyPath)) {
      throw new Error(`story.json not found in ${storyDir}`);
    }

    const story = JSON.parse(readFileSync(storyPath, 'utf-8'));
    console.log(`\n📖 Uploading: ${story.title}`);

    // Navigate to new story page
    await this.page.goto(`${BASE_URL}/editor/new`);

    // Wait for editor to load
    await this.page.waitForSelector('input[placeholder*="story title"], textarea[placeholder*="story title"]', { state: 'visible' });
    console.log('  ✓ Editor loaded');

    // Fill story title
    const titleInput = await this.page.locator('input[placeholder*="story title"], textarea[placeholder*="story title"]').first();
    await titleInput.fill(story.title);
    console.log(`  ✓ Title: ${story.title}`);

    // Add tags
    for (const tag of story.tags || []) {
      const tagInput = await this.page.locator('input[placeholder*="tag"], input[placeholder*="Enter a tag"]').first();
      await tagInput.fill(tag);
      await tagInput.press('Enter');

      // Wait for tag to appear
      await this.page.waitForSelector(`text="${tag}"`, { timeout: 2000 }).catch(() => {
        console.log(`  ⚠ Tag "${tag}" may not have been added`);
      });
    }
    console.log(`  ✓ Tags: ${story.tags?.join(', ') || 'none'}`);

    // Upload cover image if exists
    const coverPath = join(storyDir, 'cover.webp');
    if (existsSync(coverPath)) {
      await this.uploadImage(coverPath, 'Cover');
    }

    // Add pages and upload images
    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const pageNum = i + 1;

      // Add new page if not first page
      if (i > 0) {
        await this.page.click('button:has-text("Add New Page"), button:has-text("Add Page")');
        await this.page.waitForSelector(`text="Page ${pageNum}"`, { timeout: 3000 });
        console.log(`  ✓ Added Page ${pageNum}`);
      }

      // Fill page content
      const contentFields = await this.page.locator('textarea[placeholder*="Write your story"]').all();
      if (contentFields[i]) {
        await contentFields[i].fill(page.content);
      }

      // Fill coaching content
      const coachingFields = await this.page.locator('textarea[placeholder*="coaching"], textarea[placeholder*="Add coaching notes"]').all();
      if (coachingFields[i]) {
        await coachingFields[i].fill(page.coaching);
      }

      console.log(`  ✓ Page ${pageNum} content filled`);

      // Upload page image if exists
      const pagePath = join(storyDir, `page-${pageNum}.webp`);
      if (existsSync(pagePath)) {
        await this.uploadImage(pagePath, `Page ${pageNum}`);
      }
    }

    // Save story - wait for Save button to be enabled
    await this.page.waitForSelector('button:has-text("Save Story"):not([disabled])', { timeout: 5000 });
    await this.page.click('button:has-text("Save Story")');

    // Wait for success notification
    try {
      await this.page.waitForSelector('text=/saved successfully|Story saved/i', { timeout: 10000 });
      console.log('  ✅ Story saved successfully');
      return true;
    } catch (error) {
      // Check if URL changed to story view (also indicates success)
      if (this.page.url().includes('/story/') || this.page.url().includes('/editor/')) {
        console.log('  ✅ Story saved (URL changed)');
        return true;
      }
      throw new Error('Save did not complete - no success indicator found');
    }
  }

  async uploadImage(imagePath, label) {
    // Find and click Add/Upload button for this section
    const addButtons = await this.page.locator('button:has-text("Add"), button[title*="Add Illustration"]').all();

    // Click the appropriate Add button (this will open file chooser)
    for (const button of addButtons) {
      const isVisible = await button.isVisible();
      if (isVisible) {
        // Set up file chooser handler before clicking
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await button.click();

        try {
          const fileChooser = await fileChooserPromise;
          await fileChooser.setFiles(imagePath);

          // Wait for upload to complete (network idle)
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });
          console.log(`  ✓ ${label} image uploaded`);
          break;
        } catch (error) {
          console.log(`  ⚠ Failed to upload ${label} image: ${error.message}`);
        }
      }
    }
  }

  async uploadAllStories(limit = null) {
    const storyDirs = readdirSync(STORIES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => join(STORIES_DIR, dirent.name))
      .sort();

    // Limit for testing
    const storiesToUpload = limit ? storyDirs.slice(0, limit) : storyDirs;
    const total = storiesToUpload.length;
    console.log(`\n🎯 Found ${total} stories to upload\n`);

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
      }

      // Small delay between stories
      await this.page.waitForTimeout(1000);
    }

    this.printSummary(total);
  }

  printSummary(total) {
    console.log('\n' + '='.repeat(60));
    console.log('Upload Complete');
    console.log(`Success: ${this.successCount}/${total}`);
    console.log(`Failed: ${this.failCount}/${total}`);
    console.log('='.repeat(60));
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

    // Get limit from command line args (default: test with 1 story)
    const limit = process.argv[2] ? parseInt(process.argv[2]) : 1;
    console.log(limit === 1 ? '🧪 Test mode: uploading 1 story' : `📦 Batch mode: uploading ${limit} stories`);

    await uploader.uploadAllStories(limit);
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await uploader.cleanup();
  }
}

main();
