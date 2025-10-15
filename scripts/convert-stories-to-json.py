#!/usr/bin/env python3
"""
Convert Story Markdown to JSON

Reads all story.md files from stories-tmp/processed/ and converts them
to structured JSON format for easier upload automation.

Output: story.json in each story directory
"""

import sys
import json
import re
from pathlib import Path

# Directories
PROCESSED_DIR = Path("stories-tmp/processed")

def slugify_to_title(slug):
    """Convert slug to title case (e.g., 'adult-train-ride-story' -> 'Adult Train Ride')"""
    # Remove trailing '-story' suffix if present
    slug = re.sub(r'-story$', '', slug)
    # Replace hyphens with spaces and title case
    return slug.replace('-', ' ').title()

def parse_story_md(md_content, fallback_slug=None):
    """
    Parse markdown content into structured format.

    Args:
        md_content: The markdown content
        fallback_slug: Folder name to use if title not found in markdown

    Returns:
        {
            "title": str,
            "pages": [{"number": int, "content": str, "coaching": str}],
            "tags": [str]
        }
    """

    # Extract title - try multiple formats
    title = None

    # Format 1: ***Title: XYZ***
    title_match = re.search(r'\*\*\*Title:\s*(.+?)\*\*\*', md_content)
    if title_match:
        title = title_match.group(1).strip()

    # Format 2: Title: XYZ (at start of file)
    if not title:
        title_match = re.search(r'^Title:\s*(.+?)$', md_content, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()

    # Format 3: Derive from folder name
    if not title and fallback_slug:
        title = slugify_to_title(fallback_slug)

    if not title:
        raise ValueError("No title found in markdown and no fallback slug provided")

    # Clean up title
    title = title.strip()

    # Extract tags
    tags_match = re.search(r'\*\*Tags:\*\*\s*(.+?)(?:\n|$)', md_content)
    tags = []
    if tags_match:
        tags_str = tags_match.group(1).strip()
        tags = [tag.strip() for tag in tags_str.split(',')]

    # Split by pages
    pages = []
    page_pattern = r'\*\*Page (\d+)\*\*\\?\s*(.+?)(?=\*\*Page \d+\*\*|\*\*Tags:\*\*|$)'

    for match in re.finditer(page_pattern, md_content, re.DOTALL):
        page_num = int(match.group(1))
        page_text = match.group(2).strip()

        # Split content and coaching note
        # Match coaching note - handle word-wrapped "Coaching Note" across lines
        # Continue until end of sentence (period + optional quote + optional whitespace)
        coaching_match = re.search(r'\*\*Coaching\s*Note:\*\*\s*(.+?[.!?]["\']?)\s*(?=\n|$)', page_text, re.DOTALL)

        if coaching_match:
            coaching = coaching_match.group(1).strip()
            # Remove coaching note from content (including the label)
            content = re.sub(r'\*\*Coaching\s*Note:\*\*\s*.+?[.!?]["\']?\s*', '', page_text, flags=re.DOTALL).strip()
        else:
            coaching = ""
            content = page_text

        # Clean up content:
        # 1. Replace backslash line breaks with spaces
        content = re.sub(r'\\\s*\n', ' ', content)
        content = re.sub(r'\\\s+', ' ', content)
        # 2. Remove any remaining trailing backslashes
        content = re.sub(r'\\\s*$', '', content)
        # 3. Normalize whitespace (including newlines to spaces)
        content = re.sub(r'\s+', ' ', content).strip()
        coaching = re.sub(r'\s+', ' ', coaching).strip()

        pages.append({
            "number": page_num,
            "content": content,
            "coaching": coaching
        })

    # Sort pages by number
    pages.sort(key=lambda p: p['number'])

    return {
        "title": title,
        "pages": pages,
        "tags": tags
    }

def convert_story(story_dir):
    """Convert a single story from .md to .json"""
    story_slug = story_dir.name
    md_file = story_dir / "story.md"
    json_file = story_dir / "story.json"

    if not md_file.exists():
        print(f"❌ {story_slug}: story.md not found")
        return False

    try:
        # Read markdown
        with open(md_file, 'r', encoding='utf-8') as f:
            md_content = f.read()

        # Parse to structured format (pass slug as fallback)
        story_data = parse_story_md(md_content, fallback_slug=story_slug)

        # Mark if title was derived from folder name
        story_data['title_source'] = 'markdown' if '***Title:' in md_content or md_content.startswith('Title:') else 'folder_name'

        # Write JSON
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(story_data, f, indent=2, ensure_ascii=False)

        print(f"✓ {story_slug}: {len(story_data['pages'])} pages, {len(story_data['tags'])} tags")
        return True

    except Exception as e:
        print(f"❌ {story_slug}: {e}")
        return False

def main():
    """Convert all stories"""
    print("=== Converting Stories to JSON ===")
    print(f"Source: {PROCESSED_DIR}")

    if not PROCESSED_DIR.exists():
        print(f"❌ Directory not found: {PROCESSED_DIR}")
        return 1

    # Find all story directories
    story_dirs = sorted([d for d in PROCESSED_DIR.iterdir() if d.is_dir()])
    total = len(story_dirs)

    print(f"Found {total} stories\n")

    # Convert each story
    success = 0
    failed = 0

    for story_dir in story_dirs:
        if convert_story(story_dir):
            success += 1
        else:
            failed += 1

    # Summary
    print(f"\n=== Conversion Complete ===")
    print(f"Success: {success}")
    print(f"Failed: {failed}")
    print(f"Total: {total}")

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
