#!/usr/bin/env python3
"""
Normalize Filenames - Standardize page image naming

This script renames page images to a consistent pattern:
- Pg1.png → Page1.png
- Pg 1.png → Page1.png
- pg1.png → Page1.png

Run with --dry-run to preview changes
"""

import os
import re
import sys
from pathlib import Path

def normalize_filename(filename):
    """Convert Pg* patterns to Page* pattern"""
    # Match patterns like: Pg1.png, Pg 1.png, pg1.png, Pg1 Something.png
    match = re.match(r'^[Pp]g\s*(\d+)(.*)\.png$', filename)
    if not match:
        return None

    number = match.group(1)
    suffix = match.group(2).strip()

    if suffix:
        return f"Page{number} {suffix}.png"
    else:
        return f"Page{number}.png"

def main():
    source_dir = Path("stories-tmp/New Stories")
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=== DRY RUN MODE - No files will be changed ===")
        print()

    print("=== Normalizing Filenames ===")
    print(f"Source: {source_dir}")
    print()

    if not source_dir.exists():
        print(f"Error: Source directory not found: {source_dir}")
        return 1

    total_renamed = 0
    total_stories = 0

    # Process each story directory
    for story_dir in sorted(source_dir.iterdir()):
        if not story_dir.is_dir():
            continue

        total_stories += 1
        story_name = story_dir.name
        renamed_count = 0

        # Find files matching Pg patterns
        pg_files = list(story_dir.glob("[Pp]g*.png"))

        for pg_file in pg_files:
            filename = pg_file.name
            new_filename = normalize_filename(filename)

            if not new_filename:
                continue

            # Skip if already correct
            if filename == new_filename:
                continue

            new_path = story_dir / new_filename

            # Check if target already exists
            if new_path.exists():
                print(f"  ⚠ Skipping: {filename} → {new_filename} (target exists)")
                continue

            if dry_run:
                print(f"  Would rename: {filename} → {new_filename}")
            else:
                pg_file.rename(new_path)
                print(f"  ✓ Renamed: {filename} → {new_filename}")

            renamed_count += 1

        if renamed_count > 0:
            print(f"[{total_stories}] {story_name}: {renamed_count} files {'would be ' if dry_run else ''}renamed")
            print()
            total_renamed += renamed_count

    # Summary
    print("=== Summary ===")
    print(f"Stories processed: {total_stories}")
    print(f"Files {'to be ' if dry_run else ''}renamed: {total_renamed}")

    if dry_run:
        print()
        print("This was a DRY RUN. Run without --dry-run to apply changes.")

    return 0

if __name__ == "__main__":
    sys.exit(main())
