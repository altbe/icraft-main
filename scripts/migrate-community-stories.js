#!/usr/bin/env node
/**
 * Community Stories Migration Script
 * Migrates all community stories from non-prod to production
 *
 * Usage: node scripts/migrate-community-stories.js
 */

import { createClient } from '@supabase/supabase-js';

// Environment configuration
const NON_PROD_URL = 'https://jjpbogjufnqzsgiiaqwn.supabase.co';
const PROD_URL = 'https://lgkjfymwvhcjvfkuidis.supabase.co';
const TARGET_USER_ID = 'user_34w00wW4m51e2xSOoJH6pzfGvs9';

// Get service keys from environment
const NON_PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_NONPROD;
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;

if (!NON_PROD_KEY || !PROD_KEY) {
  console.error('Error: Missing Supabase service role keys');
  console.error('Set SUPABASE_SERVICE_ROLE_KEY_NONPROD and SUPABASE_SERVICE_ROLE_KEY_PROD');
  process.exit(1);
}

// Create Supabase clients
const nonProdClient = createClient(NON_PROD_URL, NON_PROD_KEY);
const prodClient = createClient(PROD_URL, PROD_KEY);

async function migrateStories() {
  console.log('Starting community stories migration...\n');

  // Step 1: Fetch all stories from non-prod
  console.log('Fetching stories from non-prod...');
  const { data: stories, error: fetchError } = await nonProdClient
    .from('community_stories')
    .select('*')
    .order('shared_at', { ascending: false });

  if (fetchError) {
    console.error('Error fetching stories:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${stories.length} stories to migrate\n`);

  // Step 2: Import stories to production
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const storyNum = i + 1;

    try {
      // Prepare story data for import
      const importData = {
        id: story.id,
        title: story.title,
        original_story_id: null, // Stories don't exist in production
        original_user_id: TARGET_USER_ID, // Assign to target user
        likes_count: story.likes_count || 0,
        views_count: story.views_count || 0,
        shared_at: story.shared_at,
        is_featured: story.is_featured || false,
        is_approved: story.is_approved !== false, // Default true
        cover_coaching_content: story.cover_coaching_content,
        cover_canvas_editor_id: story.cover_canvas_editor_id,
        cover_canvas_state: story.cover_canvas_state,
        pages: story.pages,
        ai_generator_history: story.ai_generator_history || [],
        tags: story.tags || []
      };

      // Insert into production
      const { error: insertError } = await prodClient
        .from('community_stories')
        .insert(importData);

      if (insertError) {
        console.error(`✗ Story ${storyNum}/${stories.length}: "${story.title}" - ERROR`);
        console.error(`  ${insertError.message}`);
        errors.push({ story: story.title, error: insertError.message });
        errorCount++;
      } else {
        console.log(`✓ Story ${storyNum}/${stories.length}: "${story.title}"`);
        successCount++;
      }
    } catch (err) {
      console.error(`✗ Story ${storyNum}/${stories.length}: "${story.title}" - EXCEPTION`);
      console.error(`  ${err.message}`);
      errors.push({ story: story.title, error: err.message });
      errorCount++;
    }
  }

  // Step 3: Print summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total stories: ${stories.length}`);
  console.log(`✓ Successfully imported: ${successCount}`);
  console.log(`✗ Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.story}: ${err.error}`);
    });
  }

  // Step 4: Validate results
  console.log('\nValidating migration...');
  const { data: prodStories, error: countError } = await prodClient
    .from('community_stories')
    .select('id', { count: 'exact', head: true });

  if (!countError) {
    const prodCount = prodStories || 0;
    console.log(`Production now has ${prodCount} community stories`);

    if (prodCount === stories.length) {
      console.log('✓ Migration successful - counts match!');
    } else {
      console.log(`⚠ Warning: Expected ${stories.length} but got ${prodCount}`);
    }
  }

  console.log('\nMigration complete!');
  process.exit(errorCount > 0 ? 1 : 0);
}

// Run migration
migrateStories().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
