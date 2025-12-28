# LLM Story Parser

Uses OpenAI API to parse markdown stories into structured JSON with cover coaching.

## Features

- **Handles all markdown format variations** - No fragile regex patterns
- **Cleans content automatically** - Strips `**Story Text:**`, `**Coaching Note:**` labels
- **Generates missing data** - Tags and coaching notes where absent
- **Adds cover_coaching field** - 1-2 sentence summary synthesized from all page coaching

## Setup

### 1. Install dependencies

```bash
cd .
# Dependencies already installed via npm install in scripts/
```

### 2. Set OpenAI API key

```bash
export OPENAI_API_KEY="sk-..."
```

## Usage

### Process single story (for testing)

```bash
node scripts/llm-parse-stories.js --story=fire-drill-story
```

### Process first 5 stories

```bash
node scripts/llm-parse-stories.js --limit=5
```

### Process all stories

```bash
node scripts/llm-parse-stories.js
```

### Reprocess already completed stories

```bash
node scripts/llm-parse-stories.js --force
```

## Output

Creates/updates `story.json` files with this structure:

```json
{
  "title": "Story Title",
  "cover_coaching": "1-2 sentence summary of main coaching points",
  "pages": [
    {
      "number": 1,
      "content": "Clean story text without markdown artifacts",
      "coaching": "Parent/caregiver coaching note"
    }
  ],
  "tags": [
    "Topic 1",
    "Topic 2",
    "Skill Name"
  ],
  "title_source": "llm",
  "parsed_at": "2025-01-11T...",
  "parser_version": "llm-v1"
}
```

## What It Fixes

1. **22 stories with 0 pages** - Parses markdown into page objects
2. **47 stories missing tags** - Generates relevant topic tags
3. **37 stories with markdown artifacts** - Removes `**Story Text:**`, `**Coaching Note:**` labels
4. **9 stories missing coaching** - Generates helpful coaching notes
5. **ALL stories** - Adds `cover_coaching` field (synthesizes from page coaching)

## Progress Tracking

Progress is saved to `stories-tmp/.llm-progress.json`:

```json
{
  "processed": ["story-1", "story-2"],
  "failed": ["story-3"],
  "skipped": ["story-without-md"]
}
```

If interrupted, re-run the same command - it will skip already processed stories (unless `--force` is used).

## Logs

- Success log: `stories-tmp/logs/llm-parsing-TIMESTAMP.log`
- Error log: `stories-tmp/logs/llm-errors-TIMESTAMP.log`

## Cost Estimation

Using `gpt-4o-mini`:
- ~$0.15 per 1M input tokens
- ~$0.60 per 1M output tokens

For 75 stories:
- Input: ~2,000 tokens/story × 75 = 150K tokens = $0.02
- Output: ~1,500 tokens/story × 75 = 112K tokens = $0.07
- **Total: ~$0.09** for all 75 stories

## Example Run

```bash
$ export OPENAI_API_KEY="sk-..."
$ node scripts/llm-parse-stories.js --limit=3

=== LLM Story Parser ===
Model: gpt-4o-mini
Source: stories-tmp/processed
Found 3 stories to process

[1/3] accepting-no-story
  ✓ Already processed, skipping

[2/3] fire-drill-story
  🤖 Parsing with OpenAI API...
  ✓ Success: 6 pages, 7 tags

[3/3] adult-train-ride-story
  🤖 Parsing with OpenAI API...
  ✓ Success: 6 pages, 8 tags

=== Processing Complete ===
Success: 2
Failed: 0
Skipped: 1
Total: 3

✓ All stories processed successfully!
```

## Next Steps

After running the parser:

1. **Verify output** - Spot-check a few story.json files
2. **Re-run upload script** - Upload updated stories with `cover_coaching` field:
   ```bash
   node scripts/upload-stories-v2.js 5  # Test with 5 stories first
   ```

3. **Check frontend** - Verify `cover_coaching` displays correctly on cover page
