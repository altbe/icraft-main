#!/usr/bin/env python3
"""
Normalize Cover Names - Fix non-standard cover file naming

This script finds all PNG files containing "cover" (case-insensitive)
and renames them to the standard "Cover.png" pattern.

Run with --dry-run to preview changes
"""

import sys
from pathlib import Path

def main():
    source_dir = Path("stories-tmp/New Stories")
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=== DRY RUN MODE - No files will be changed ===")
        print()

    print("=== Normalizing Cover Names ===")
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

        # Find PNG files containing "cover" (case-insensitive)
        for file_path in story_dir.glob("*.png"):
            filename = file_path.name
            filename_lower = filename.lower()

            # Check if filename contains "cover" (case-insensitive)
            if "cover" in filename_lower:
                new_filename = "Cover.png"
                new_path = story_dir / new_filename

                # Skip if already named correctly
                if filename == new_filename:
                    continue

                # Check if target already exists
                if new_path.exists():
                    print(f"  ⚠ Skipping: {filename} → {new_filename} (target exists)")
                    continue

                if dry_run:
                    print(f"  Would rename: {filename} → {new_filename}")
                else:
                    file_path.rename(new_path)
                    print(f"  ✓ Renamed: {filename} → {new_filename}")

                renamed_count += 1

        if renamed_count > 0:
            print(f"[{total_stories}] {story_name}: {renamed_count} file{'s' if renamed_count > 1 else ''} {'would be ' if dry_run else ''}renamed")
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
