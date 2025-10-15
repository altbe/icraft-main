#!/usr/bin/env python3
"""
Create Missing Covers - Copy Page1 to Cover.png

This script finds stories that have Page images but no Cover image,
and copies the first page image to Cover.png.

Run with --dry-run to preview changes
"""

import sys
import shutil
from pathlib import Path

def main():
    source_dir = Path("stories-tmp/New Stories")
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=== DRY RUN MODE - No files will be changed ===")
        print()

    print("=== Creating Missing Covers from Page1 ===")
    print(f"Source: {source_dir}")
    print()

    if not source_dir.exists():
        print(f"Error: Source directory not found: {source_dir}")
        return 1

    total_created = 0
    total_stories = 0

    # Process each story directory
    for story_dir in sorted(source_dir.iterdir()):
        if not story_dir.is_dir():
            continue

        total_stories += 1
        story_name = story_dir.name

        # Check if Cover.png or Cover*.png exists
        cover_files = list(story_dir.glob("Cover*.png"))
        if cover_files:
            # Has a cover already
            continue

        # Find first page image (try different patterns)
        page1_patterns = ["Page1.png", "Page 1.png", "Page1 *.png", "Page 1 *.png"]
        page1_file = None

        for pattern in page1_patterns:
            matches = list(story_dir.glob(pattern))
            if matches:
                page1_file = sorted(matches)[0]  # Take first match
                break

        if not page1_file:
            # No Page1 found, skip
            continue

        # Create Cover.png from Page1
        cover_path = story_dir / "Cover.png"

        if dry_run:
            print(f"  Would copy: {page1_file.name} → Cover.png")
        else:
            shutil.copy2(page1_file, cover_path)
            print(f"  ✓ Created: Cover.png from {page1_file.name}")

        print(f"[{total_stories}] {story_name}")
        print()
        total_created += 1

    # Summary
    print("=== Summary ===")
    print(f"Stories processed: {total_stories}")
    print(f"Covers {'to be ' if dry_run else ''}created: {total_created}")

    if dry_run:
        print()
        print("This was a DRY RUN. Run without --dry-run to apply changes.")

    return 0

if __name__ == "__main__":
    sys.exit(main())
