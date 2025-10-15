#!/usr/bin/env python3
"""
Batch Process Stories - Convert community stories for MCP upload

This script processes stories from "stories-tmp/New Stories/" by:
1. Converting .docx → .md (pandoc)
2. Converting PNG → WebP (cwebp, preserving original dimensions)
3. Organizing output into processed/{story-slug}/
4. Generating manifest.json per story

Frontend handles aspect-ratio-preserving display, so no resizing needed!
"""

import sys
import json
import subprocess
import re
from pathlib import Path
from datetime import datetime

# Directories
SOURCE_DIR = Path("stories-tmp/New Stories")
OUTPUT_DIR = Path("stories-tmp/processed")
LOGS_DIR = Path("stories-tmp/logs")
PROGRESS_FILE = Path("stories-tmp/.progress.json")

# Create directories
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Initialize log files
timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
LOG_FILE = LOGS_DIR / f"processing-{timestamp}.log"
ERROR_LOG = LOGS_DIR / f"errors-{timestamp}.log"

def log(message):
    """Log message to console and log file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    with open(LOG_FILE, 'a') as f:
        f.write(log_message + '\n')

def error(message):
    """Log error message"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_message = f"[{timestamp}] ERROR: {message}"
    print(error_message, file=sys.stderr)
    with open(ERROR_LOG, 'a') as f:
        f.write(error_message + '\n')

def slugify(text):
    """Convert text to slug (lowercase, hyphens)"""
    # Convert to lowercase
    text = text.lower()
    # Replace non-alphanumeric characters with hyphens
    text = re.sub(r'[^a-z0-9-]', '-', text)
    # Replace multiple hyphens with single hyphen
    text = re.sub(r'-+', '-', text)
    # Strip leading/trailing hyphens
    text = text.strip('-')
    return text

def load_progress():
    """Load progress tracking file"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    else:
        return {"processed": [], "failed": [], "success": [], "total": 0}

def save_progress(progress):
    """Save progress tracking file"""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def is_processed(slug, progress):
    """Check if story already processed"""
    return slug in progress.get("success", []) or slug in progress.get("processed", [])

def mark_processed(slug, status, progress):
    """Mark story as processed (success or failed)"""
    if status == "success":
        if "success" not in progress:
            progress["success"] = []
        if slug not in progress["success"]:
            progress["success"].append(slug)
    elif status == "failed":
        if "failed" not in progress:
            progress["failed"] = []
        if slug not in progress["failed"]:
            progress["failed"].append(slug)
    save_progress(progress)

def process_story(story_dir, progress):
    """Process a single story"""
    story_name = story_dir.name
    story_slug = slugify(story_name)
    output_story_dir = OUTPUT_DIR / story_slug

    log(f"Processing: {story_name} → {story_slug}")

    # Check if already processed
    if is_processed(story_slug, progress):
        log("  ✓ Already processed, skipping")
        return True

    # Create output directory
    output_story_dir.mkdir(parents=True, exist_ok=True)

    # Find .docx file
    docx_files = list(story_dir.glob("*.docx"))
    if not docx_files:
        error(f"No .docx file found in {story_dir}")
        mark_processed(story_slug, "failed", progress)
        return False

    docx_file = docx_files[0]

    # Convert .docx → .md
    log("  Converting .docx → .md")
    try:
        result = subprocess.run(
            ["pandoc", str(docx_file), "-f", "docx", "-t", "markdown", "-o", str(output_story_dir / "story.md")],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        error(f"Failed to convert {docx_file}: {e.stderr}")
        mark_processed(story_slug, "failed", progress)
        return False

    # Find cover image
    cover_files = list(story_dir.glob("[Cc]over*.png"))
    if not cover_files:
        error(f"No cover image found in {story_dir}")
        mark_processed(story_slug, "failed", progress)
        return False

    cover_file = cover_files[0]

    # Convert cover to WebP
    log("  Converting cover image")
    try:
        result = subprocess.run(
            ["cwebp", "-q", "85", "-quiet", str(cover_file), "-o", str(output_story_dir / "cover.webp")],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        error(f"Failed to convert cover {cover_file}: {e.stderr}")
        mark_processed(story_slug, "failed", progress)
        return False

    # Find and convert page images (sorted by filename)
    page_files = sorted(story_dir.glob("[Pp]age*.png"))
    if not page_files:
        error(f"No page images found in {story_dir}")
        mark_processed(story_slug, "failed", progress)
        return False

    for page_num, page_file in enumerate(page_files, start=1):
        log(f"  Converting page {page_num}")
        try:
            result = subprocess.run(
                ["cwebp", "-q", "85", "-quiet", str(page_file), "-o", str(output_story_dir / f"page-{page_num}.webp")],
                capture_output=True,
                text=True,
                check=True
            )
        except subprocess.CalledProcessError as e:
            error(f"Failed to convert page {page_file}: {e.stderr}")
            mark_processed(story_slug, "failed", progress)
            return False

    # Generate manifest.json
    log("  Generating manifest")
    manifest = {
        "name": story_name,
        "slug": story_slug,
        "docx": docx_file.name,
        "cover": "cover.webp",
        "pages": len(page_files),
        "processed_at": datetime.now().isoformat()
    }

    with open(output_story_dir / "manifest.json", 'w') as f:
        json.dump(manifest, f, indent=2)

    mark_processed(story_slug, "success", progress)
    log(f"  ✓ Complete: {story_slug}")
    return True

def main():
    """Main processing loop"""
    log("=== Starting Batch Story Processing ===")
    log(f"Source: {SOURCE_DIR}")
    log(f"Output: {OUTPUT_DIR}")

    if not SOURCE_DIR.exists():
        error(f"Source directory not found: {SOURCE_DIR}")
        return 1

    # Load progress
    progress = load_progress()

    # Find all story directories
    story_dirs = sorted([d for d in SOURCE_DIR.iterdir() if d.is_dir()])
    total_stories = len(story_dirs)
    log(f"Found {total_stories} story folders")

    # Update progress file with total
    progress["total"] = total_stories
    save_progress(progress)

    # Process each story
    processed = 0
    failed = 0

    for story_dir in story_dirs:
        if process_story(story_dir, progress):
            processed += 1
        else:
            failed += 1

        # Show progress
        remaining = total_stories - processed - failed
        log(f"Progress: {processed} processed, {failed} failed, {remaining} remaining")

    # Final summary
    log("=== Processing Complete ===")
    log(f"Total stories: {total_stories}")
    log(f"Processed successfully: {processed}")
    log(f"Failed: {failed}")
    log(f"Output directory: {OUTPUT_DIR}")
    log(f"Logs: {LOGS_DIR}")

    if failed > 0:
        log(f"⚠ Some stories failed. Check {ERROR_LOG} for details")
        return 1

    log("✓ All stories processed successfully!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
