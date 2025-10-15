#!/usr/bin/env python3
"""
Event-based story upload using Playwright MCP
Waits for actual UI events, not arbitrary timeouts
"""

import json
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

class EventBasedStoryUploader:
    def __init__(self, base_url="https://dev.icraftstories.com"):
        self.base_url = base_url
        self.playwright = None
        self.browser = None
        self.page = None

    async def setup(self):
        """Initialize browser and navigate to app"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        await self.page.goto(self.base_url)

        # Wait for app to be ready (check for user profile or dashboard)
        try:
            await self.page.wait_for_selector('[data-testid="dashboard"]', timeout=10000)
            print("✓ App loaded and user authenticated")
        except PlaywrightTimeout:
            print("⚠ Please log in manually...")
            await self.page.wait_for_selector('[data-testid="dashboard"]', timeout=60000)

    async def wait_for_upload_complete(self, identifier="upload"):
        """Wait for upload to complete by checking for success indicators"""
        # Option 1: Wait for success notification
        try:
            await self.page.wait_for_selector(
                'text="Upload successful"',
                timeout=10000
            )
            return True
        except PlaywrightTimeout:
            pass

        # Option 2: Wait for image preview to appear
        try:
            await self.page.wait_for_selector(
                f'[data-testid="{identifier}-preview"]',
                state="visible",
                timeout=10000
            )
            return True
        except PlaywrightTimeout:
            pass

        # Option 3: Wait for loading spinner to disappear
        try:
            await self.page.wait_for_selector(
                '[data-testid="upload-spinner"]',
                state="hidden",
                timeout=10000
            )
            return True
        except PlaywrightTimeout:
            pass

        # Fallback: Wait for network idle
        await self.page.wait_for_load_state("networkidle")
        return True

    async def upload_image_and_wait(self, file_path: Path, identifier: str):
        """Upload image and wait for UI to confirm completion"""
        # Click upload button
        await self.page.click(f'[data-testid="{identifier}-upload-btn"]')

        # Handle file chooser
        async with self.page.expect_file_chooser() as fc_info:
            file_chooser = await fc_info.value
            await file_chooser.set_files(str(file_path))

        # Wait for upload to complete (event-based, not timeout)
        await self.wait_for_upload_complete(identifier)
        print(f"  ✓ {identifier} uploaded")

    async def set_as_background_and_wait(self, identifier: str):
        """Set image as background and wait for canvas to update"""
        # Click "Set as Background" button
        await self.page.click(f'[data-testid="{identifier}-set-background"]')

        # Wait for canvas to update (check for background-image style)
        await self.page.wait_for_function(
            f"""() => {{
                const canvas = document.querySelector('[data-testid="{identifier}-canvas"]');
                return canvas && canvas.style.backgroundImage;
            }}""",
            timeout=5000
        )
        print(f"  ✓ {identifier} set as background")

    async def fill_form_and_wait(self, title: str, tags: list, coaching: str = ""):
        """Fill form fields and wait for validation"""
        # Fill title
        await self.page.fill('[data-testid="story-title"]', title)
        await self.page.wait_for_function(
            f"""() => document.querySelector('[data-testid="story-title"]').value === "{title}" """
        )

        # Fill tags (assuming tag input component)
        for tag in tags:
            await self.page.fill('[data-testid="tag-input"]', tag)
            await self.page.press('[data-testid="tag-input"]', 'Enter')
            await self.page.wait_for_selector(f'text="{tag}"')

        print(f"  ✓ Form filled")

    async def save_story_and_wait(self):
        """Save story and wait for success confirmation"""
        # Click save button
        await self.page.click('[data-testid="save-story-btn"]')

        # Wait for one of these success indicators:
        selectors = [
            'text="Story saved successfully"',
            '[data-testid="story-saved-notification"]',
            'text="Saved"'
        ]

        try:
            await self.page.wait_for_selector(
                ','.join(selectors),  # Wait for any of these
                timeout=15000
            )
            print("  ✓ Story saved successfully")
            return True
        except PlaywrightTimeout:
            # Check if we navigated away (also indicates success)
            if '/stories/' in self.page.url:
                print("  ✓ Story saved (navigated to story page)")
                return True
            raise Exception("Save did not complete - no success indicator found")

    async def upload_story(self, story_dir: Path):
        """Upload a complete story using event-based waiting"""
        # Load story data
        with open(story_dir / "story.json") as f:
            story_data = json.load(f)

        print(f"\n📖 Uploading: {story_data['title']}")

        # Navigate to new story page
        await self.page.goto(f"{self.base_url}/stories/new")
        await self.page.wait_for_selector('[data-testid="story-editor"]')

        # Upload cover
        cover_path = story_dir / "cover.webp"
        if cover_path.exists():
            await self.upload_image_and_wait(cover_path, "cover")
            await self.set_as_background_and_wait("cover")

        # Upload pages
        for i, page_data in enumerate(story_data["pages"], 1):
            page_path = story_dir / f"page-{i}.webp"
            if page_path.exists():
                # Navigate to page
                await self.page.click(f'[data-testid="page-{i}-tab"]')

                # Upload image
                await self.upload_image_and_wait(page_path, f"page-{i}")
                await self.set_as_background_and_wait(f"page-{i}")

                # Fill page content
                await self.page.fill(
                    f'[data-testid="page-{i}-content"]',
                    page_data["content"]
                )
                await self.page.fill(
                    f'[data-testid="page-{i}-coaching"]',
                    page_data["coaching"]
                )

        # Fill story metadata
        await self.fill_form_and_wait(
            story_data["title"],
            story_data["tags"]
        )

        # Save story
        await self.save_story_and_wait()

        return True

    async def upload_all_stories(self, stories_dir: Path):
        """Upload all stories in directory"""
        success_count = 0
        fail_count = 0

        story_dirs = sorted([d for d in stories_dir.iterdir() if d.is_dir()])
        total = len(story_dirs)

        print(f"\n🚀 Starting upload of {total} stories")
        print(f"Using event-based waiting (no arbitrary timeouts)")

        for i, story_dir in enumerate(story_dirs, 1):
            try:
                print(f"\n[{i}/{total}] {story_dir.name}")
                await self.upload_story(story_dir)
                success_count += 1
                print(f"✅ Success ({success_count}/{i})")
            except Exception as e:
                fail_count += 1
                print(f"❌ Failed: {e}")
                # Continue with next story

        print(f"\n{'='*60}")
        print(f"Upload Complete")
        print(f"Success: {success_count}/{total}")
        print(f"Failed: {fail_count}/{total}")
        print(f"{'='*60}")

    async def cleanup(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


async def main():
    stories_dir = Path("stories-tmp/processed")

    uploader = EventBasedStoryUploader()
    try:
        await uploader.setup()
        await uploader.upload_all_stories(stories_dir)
    finally:
        await uploader.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
