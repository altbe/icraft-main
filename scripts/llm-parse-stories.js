#!/usr/bin/env node
/**
 * LLM-based Story Parser with OpenAI Structured Output
 *
 * Uses OpenAI API to parse markdown stories into structured JSON with:
 * - Title extraction
 * - Page content (clean, without markdown artifacts)
 * - Coaching notes per page
 * - Cover coaching (1-2 sentence summary)
 * - Tags (generate if missing)
 *
 * This handles all markdown format variations and generates missing data.
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';

// Load .env from scripts directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

// Configuration
const PROCESSED_DIR = 'stories-tmp/processed';
const LOGS_DIR = 'stories-tmp/logs';
const PROGRESS_FILE = 'stories-tmp/.llm-progress.json';

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL = 'gpt-4o-mini';

// Ensure logs directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync(LOGS_DIR, { recursive: true });
} catch (error) {
  // Directory already exists
}

// Initialize log files
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const LOG_FILE = join(LOGS_DIR, `llm-parsing-${timestamp}.log`);
const ERROR_LOG = join(LOGS_DIR, `llm-errors-${timestamp}.log`);

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  try {
    writeFileSync(LOG_FILE, logMessage + '\n', { flag: 'a' });
  } catch (error) {
    // Ignore write errors
  }
}

function error(message) {
  const timestamp = new Date().toISOString();
  const errorMessage = `[${timestamp}] ERROR: ${message}`;
  console.error(errorMessage);
  try {
    writeFileSync(ERROR_LOG, errorMessage + '\n', { flag: 'a' });
  } catch (err) {
    // Ignore write errors
  }
}

function loadProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (err) {
    error(`Failed to load progress: ${err.message}`);
  }
  return { processed: [], failed: [], skipped: [] };
}

function saveProgress(progress) {
  try {
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    error(`Failed to save progress: ${err.message}`);
  }
}

async function parseStoryWithLLM(mdContent, storySlug) {
  /**
   * Use OpenAI API to parse markdown into structured JSON
   */

  const prompt = `Parse this social story markdown into structured JSON. Extract:

1. **title**: The story title (clean, no extra asterisks or quotes)
2. **cover_coaching**: A 1-2 sentence summary of the main coaching points for parents/caregivers
3. **pages**: Array of page objects with:
   - number: Page number (integer)
   - content: Story text (clean, without "**Story Text:**" or other markdown labels)
   - coaching: Parent/caregiver coaching note (empty string if not present)
4. **tags**: Array of relevant topic tags (5-10 tags). Generate appropriate tags based on content if not present in markdown.

Guidelines:
- Remove ALL markdown formatting from content (no **, \\, or labels)
- Keep content natural and readable
- If coaching notes are missing, generate brief, helpful coaching tips
- Tags should cover: main topic, age group, skills taught, emotional themes
- cover_coaching should synthesize all page coaching into 1-2 sentences

Respond with ONLY valid JSON, no other text.

Markdown content:
${mdContent}`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that parses social story markdown into clean, structured JSON. Always respond with valid JSON only, no other text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: 'json_object' } // Force JSON response
    });

    const jsonText = completion.choices[0].message.content.trim();

    // Parse JSON
    const storyData = JSON.parse(jsonText);

    // Validate structure
    const requiredFields = ['title', 'cover_coaching', 'pages', 'tags'];
    for (const field of requiredFields) {
      if (!(field in storyData)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate pages
    for (const page of storyData.pages) {
      if (!('number' in page && 'content' in page && 'coaching' in page)) {
        throw new Error(`Invalid page structure: ${JSON.stringify(page)}`);
      }
    }

    return storyData;

  } catch (err) {
    if (err instanceof SyntaxError) {
      error(`JSON parse error for ${storySlug}: ${err.message}`);
    } else {
      error(`LLM parsing error for ${storySlug}: ${err.message}`);
    }
    return null;
  }
}

async function processStory(storyDir, progress, force = false) {
  const storySlug = storyDir.split('/').pop();
  const mdFile = join(storyDir, 'story.md');
  const jsonFile = join(storyDir, 'story.json');

  log(`Processing: ${storySlug}`);

  // Skip if already processed (unless force)
  if (!force && progress.processed.includes(storySlug)) {
    log('  ✓ Already processed, skipping');
    return true;
  }

  // Check if markdown exists
  if (!existsSync(mdFile)) {
    log(`  ⚠️  No story.md found, skipping`);
    if (!progress.skipped.includes(storySlug)) {
      progress.skipped.push(storySlug);
      saveProgress(progress);
    }
    return true;
  }

  // Read markdown
  let mdContent;
  try {
    mdContent = readFileSync(mdFile, 'utf-8');
  } catch (err) {
    error(`  ❌ Failed to read ${mdFile}: ${err.message}`);
    progress.failed.push(storySlug);
    saveProgress(progress);
    return false;
  }

  // Parse with LLM
  log('  🤖 Parsing with OpenAI API...');
  const storyData = await parseStoryWithLLM(mdContent, storySlug);

  if (!storyData) {
    error(`  ❌ LLM parsing failed for ${storySlug}`);
    progress.failed.push(storySlug);
    saveProgress(progress);
    return false;
  }

  // Add metadata
  storyData.title_source = 'llm';
  storyData.parsed_at = new Date().toISOString();
  storyData.parser_version = 'llm-v1';

  // Write JSON
  try {
    writeFileSync(jsonFile, JSON.stringify(storyData, null, 2));

    log(`  ✓ Success: ${storyData.pages.length} pages, ${storyData.tags.length} tags`);
    progress.processed.push(storySlug);
    saveProgress(progress);
    return true;

  } catch (err) {
    error(`  ❌ Failed to write ${jsonFile}: ${err.message}`);
    progress.failed.push(storySlug);
    saveProgress(progress);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = {
    force: args.includes('--force'),
    story: args.find(arg => arg.startsWith('--story='))?.split('=')[1],
    limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null
  };

  log('=== LLM Story Parser ===');
  log(`Model: ${MODEL}`);
  log(`Source: ${PROCESSED_DIR}`);

  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    error('OPENAI_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!existsSync(PROCESSED_DIR)) {
    error(`Directory not found: ${PROCESSED_DIR}`);
    process.exit(1);
  }

  // Load progress
  const progress = loadProgress();

  // Get story directories
  let storyDirs;
  if (flags.story) {
    const storyPath = join(PROCESSED_DIR, flags.story);
    if (!existsSync(storyPath)) {
      error(`Story not found: ${flags.story}`);
      process.exit(1);
    }
    storyDirs = [storyPath];
  } else {
    storyDirs = readdirSync(PROCESSED_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => join(PROCESSED_DIR, dirent.name))
      .sort();
  }

  if (flags.limit) {
    storyDirs = storyDirs.slice(0, flags.limit);
  }

  const total = storyDirs.length;
  log(`Found ${total} stories to process\n`);

  // Process stories
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < storyDirs.length; i++) {
    const storyDir = storyDirs[i];
    const storySlug = storyDir.split('/').pop();

    log(`\n[${i + 1}/${total}] ${storySlug}`);
    const result = await processStory(storyDir, progress, flags.force);

    if (result) {
      if (progress.skipped.includes(storySlug)) {
        skipped++;
      } else {
        success++;
      }
    } else {
      failed++;
    }
  }

  // Summary
  log('\n=== Processing Complete ===');
  log(`Success: ${success}`);
  log(`Failed: ${failed}`);
  log(`Skipped: ${skipped}`);
  log(`Total: ${total}`);
  log(`\nLogs: ${LOG_FILE}`);

  if (failed > 0) {
    log(`⚠️  Check errors: ${ERROR_LOG}`);
    process.exit(1);
  }

  log('✓ All stories processed successfully!');
  process.exit(0);
}

main();
