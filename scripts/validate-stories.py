#!/usr/bin/env python3
"""
Validate Stories - Pre-flight check before batch processing

This script validates the story folders to ensure they have:
- One .docx file
- One Cover*.png file
- At least one Page*.png file
"""

import os
import sys
from pathlib import Path
from subprocess import run, PIPE

# ANSI colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
NC = '\033[0m'  # No Color

def slugify(name):
    """Convert folder name to slug (lowercase, replace spaces/special chars with hyphens)"""
    import re
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9-]', '-', slug)
    slug = re.sub(r'--+', '-', slug)
    slug = slug.strip('-')
    return slug

def get_image_dimensions(image_path):
    """Get image dimensions using ImageMagick identify"""
    try:
        result = run(['identify', '-format', '%wx%h', str(image_path)],
                    capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except:
        return "unknown"

def validate_story(story_dir):
    """Validate a single story directory"""
    story_name = story_dir.name
    story_slug = slugify(story_name)

    has_error = False
    has_warning = False
    messages = []

    messages.append(f"  Slug: {story_slug}")

    # Check for .docx or .pdf file
    docx_files = list(story_dir.glob("*.docx"))
    pdf_files = list(story_dir.glob("*.pdf"))
    story_files = docx_files + pdf_files

    if len(story_files) == 0:
        messages.append(f"  {RED}✗ No .docx or .pdf file found{NC}")
        has_error = True
    elif len(story_files) > 1:
        messages.append(f"  {YELLOW}⚠ Multiple story files found ({len(story_files)}){NC}")
        has_warning = True
    else:
        messages.append(f"  ✓ Story: {story_files[0].name}")

    # Check for cover image
    cover_files = list(story_dir.glob("[Cc]over*.png"))
    if len(cover_files) == 0:
        messages.append(f"  {RED}✗ No Cover*.png file found{NC}")
        has_error = True
    elif len(cover_files) > 1:
        messages.append(f"  {YELLOW}⚠ Multiple cover images found ({len(cover_files)}){NC}")
        has_warning = True
    else:
        cover_size = get_image_dimensions(cover_files[0])
        messages.append(f"  ✓ Cover: {cover_files[0].name} ({cover_size})")

    # Check for page images (handle multiple naming patterns)
    page_patterns = ["[Pp]age*.png", "[Pp]g*.png", "[Pp]g *.png"]
    page_files = []
    for pattern in page_patterns:
        page_files.extend(story_dir.glob(pattern))

    # Remove duplicates and sort
    page_files = sorted(set(page_files))

    if len(page_files) == 0:
        messages.append(f"  {RED}✗ No page images found (tried: Page*.png, Pg*.png){NC}")
        has_error = True
    else:
        page_size = get_image_dimensions(page_files[0]) if page_files else "unknown"
        messages.append(f"  ✓ Pages: {len(page_files)} files (sample: {page_size})")

    return {
        'name': story_name,
        'slug': story_slug,
        'has_error': has_error,
        'has_warning': has_warning,
        'messages': messages
    }

def main():
    source_dir = Path("stories-tmp/New Stories")

    if not source_dir.exists():
        print(f"{RED}Error: Source directory not found: {source_dir}{NC}")
        return 1

    print("=== Story Validation Report ===")
    print(f"Source: {source_dir}")
    print()

    # Get all story directories
    story_dirs = sorted([d for d in source_dir.iterdir() if d.is_dir()])

    total = len(story_dirs)
    valid = 0
    warnings = 0
    errors = 0

    # Process each story
    for i, story_dir in enumerate(story_dirs, 1):
        result = validate_story(story_dir)

        print(f"[{i}] {result['name']}")
        for msg in result['messages']:
            print(msg)
        print()

        if result['has_error']:
            errors += 1
        elif result['has_warning']:
            warnings += 1
        else:
            valid += 1

    # Summary
    print("=== Summary ===")
    print(f"Total stories: {total}")
    print(f"{GREEN}Valid: {valid}{NC}")
    print(f"{YELLOW}Warnings: {warnings}{NC}")
    print(f"{RED}Errors: {errors}{NC}")

    if errors > 0:
        print()
        print(f"{RED}⚠ Fix errors before running batch-process-stories.sh{NC}")
        return 1
    elif warnings > 0:
        print()
        print(f"{YELLOW}⚠ Review warnings - batch processing will use the first file found{NC}")
        return 0
    else:
        print()
        print(f"{GREEN}✓ All stories are valid! Ready to run batch-process-stories.sh{NC}")
        return 0

if __name__ == "__main__":
    sys.exit(main())
