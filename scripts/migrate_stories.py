#!/usr/bin/env python3
"""
Community Stories Migration Script
Migrates all community stories from non-prod to production
"""

import os
import sys
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed")
    print("Install with: ../venv/bin/pip install supabase")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: python-dotenv not installed")
    print("Install with: ../venv/bin/pip install python-dotenv")
    sys.exit(1)

# Load environment variables from .env file
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

# Configuration
NON_PROD_URL = "https://jjpbogjufnqzsgiiaqwn.supabase.co"
PROD_URL = "https://lgkjfymwvhcjvfkuidis.supabase.co"
TARGET_USER_ID = "user_34w00wW4m51e2xSOoJH6pzfGvs9"

# Get service keys from .env file
NON_PROD_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY_NONPROD")
PROD_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY_PROD")

if not NON_PROD_KEY or not PROD_KEY:
    print("Error: Missing Supabase service role keys")
    print("Set SUPABASE_SERVICE_ROLE_KEY_NONPROD and SUPABASE_SERVICE_ROLE_KEY_PROD")
    sys.exit(1)

# Create clients
nonprod: Client = create_client(NON_PROD_URL, NON_PROD_KEY)
prod: Client = create_client(PROD_URL, PROD_KEY)

def migrate_stories():
    print("Starting community stories migration...\n")

    # Fetch all stories from non-prod
    print("Fetching stories from non-prod...")
    response = nonprod.table("community_stories").select("*").order("shared_at", desc=True).execute()
    stories = response.data

    print(f"Found {len(stories)} stories to migrate\n")

    success_count = 0
    error_count = 0
    errors = []

    for idx, story in enumerate(stories, 1):
        try:
            # Prepare story for import
            import_data = {
                "id": story["id"],
                "title": story["title"],
                "original_story_id": None,  # Stories don't exist in production
                "original_user_id": TARGET_USER_ID,
                "likes_count": story.get("likes_count", 0),
                "views_count": story.get("views_count", 0),
                "shared_at": story["shared_at"],
                "is_featured": story.get("is_featured", False),
                "is_approved": story.get("is_approved", True),
                "cover_coaching_content": story.get("cover_coaching_content"),
                "cover_canvas_editor_id": story.get("cover_canvas_editor_id"),
                "cover_canvas_state": story.get("cover_canvas_state"),
                "pages": story.get("pages", []),
                "ai_generator_history": story.get("ai_generator_history", []),
                "tags": story.get("tags", [])
            }

            # Insert into production
            prod.table("community_stories").insert(import_data).execute()

            print(f"✓ Story {idx}/{len(stories)}: \"{story['title']}\"")
            success_count += 1

        except Exception as e:
            print(f"✗ Story {idx}/{len(stories)}: \"{story['title']}\" - ERROR")
            print(f"  {str(e)}")
            errors.append({"story": story["title"], "error": str(e)})
            error_count += 1

    # Print summary
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total stories: {len(stories)}")
    print(f"✓ Successfully imported: {success_count}")
    print(f"✗ Errors: {error_count}")

    if errors:
        print("\nErrors:")
        for idx, err in enumerate(errors, 1):
            print(f"  {idx}. {err['story']}: {err['error']}")

    # Validate results
    print("\nValidating migration...")
    count_response = prod.table("community_stories").select("id", count="exact").execute()
    prod_count = count_response.count

    print(f"Production now has {prod_count} community stories")

    if prod_count == len(stories):
        print("✓ Migration successful - counts match!")
    else:
        print(f"⚠ Warning: Expected {len(stories)} but got {prod_count}")

    print("\nMigration complete!")
    return 0 if error_count == 0 else 1

if __name__ == "__main__":
    sys.exit(migrate_stories())
