#!/bin/bash

# Playwright Browser Installation Script
# This script ensures Playwright browsers are properly installed
# Supports dynamic version detection - no hardcoded versions

set -e

# Set the browsers path to user's home directory
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/playwright"

# Check-only mode for init hook
if [ "$1" = "--check" ]; then
  # Quick check if any chromium and firefox directories exist
  if ls "$PLAYWRIGHT_BROWSERS_PATH"/chromium-* >/dev/null 2>&1 && \
     ls "$PLAYWRIGHT_BROWSERS_PATH"/firefox-* >/dev/null 2>&1; then
    echo "installed"
  else
    echo "missing"
  fi
  exit 0
fi

echo "🎭 Installing Playwright Browsers"
echo "================================"

# Check if @playwright/test is installed
if [ ! -d "node_modules/@playwright/test" ]; then
  echo "📦 Installing @playwright/test package..."
  npm install -D @playwright/test
fi

# Dynamic browser detection - check for ANY version of browsers
CHROMIUM_DIRS=$(ls -d "$PLAYWRIGHT_BROWSERS_PATH"/chromium-* 2>/dev/null || true)
FIREFOX_DIRS=$(ls -d "$PLAYWRIGHT_BROWSERS_PATH"/firefox-* 2>/dev/null || true)

BROWSERS_MISSING=false

if [ -z "$CHROMIUM_DIRS" ]; then
  echo "❌ Chromium: Not found"
  BROWSERS_MISSING=true
else
  echo "✅ Chromium: Found $(echo "$CHROMIUM_DIRS" | wc -l) version(s)"
  for dir in $CHROMIUM_DIRS; do
    echo "   - $(basename "$dir")"
  done
fi

if [ -z "$FIREFOX_DIRS" ]; then
  echo "❌ Firefox: Not found"
  BROWSERS_MISSING=true
else
  echo "✅ Firefox: Found $(echo "$FIREFOX_DIRS" | wc -l) version(s)"
  for dir in $FIREFOX_DIRS; do
    echo "   - $(basename "$dir")"
  done
fi

# Install or update browsers if missing
if [ "$BROWSERS_MISSING" = true ]; then
  echo ""
  echo "📥 Installing missing browsers..."
  npx playwright install chromium firefox

  # Install system dependencies if needed (for WSL2/Ubuntu)
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" = "ubuntu" ] || [ "$ID" = "debian" ]; then
      echo "📦 Installing system dependencies for Ubuntu/Debian..."
      npx playwright install-deps chromium firefox 2>/dev/null || \
        echo "⚠️  Could not install system dependencies (may need sudo)"
    fi
  fi
else
  echo ""
  echo "🔄 Checking for browser updates..."

  # Get the current Playwright version
  PLAYWRIGHT_VERSION=$(npm list @playwright/test --depth=0 2>/dev/null | grep '@playwright/test@' | sed 's/.*@//' || echo "unknown")

  echo "📌 Current @playwright/test version: $PLAYWRIGHT_VERSION"

  # Check if browsers match the installed Playwright version
  # This will update browsers if they're out of sync with the Playwright version
  npx playwright install chromium firefox --with-deps 2>/dev/null || \
    npx playwright install chromium firefox
fi

# Final verification
echo ""
echo "🔍 Final verification:"
echo "----------------------"

CHROMIUM_DIRS=$(ls -d "$PLAYWRIGHT_BROWSERS_PATH"/chromium-* 2>/dev/null || true)
FIREFOX_DIRS=$(ls -d "$PLAYWRIGHT_BROWSERS_PATH"/firefox-* 2>/dev/null || true)

if [ -n "$CHROMIUM_DIRS" ]; then
  LATEST_CHROMIUM=$(echo "$CHROMIUM_DIRS" | sort -V | tail -n1)
  echo "✅ Chromium: $(basename "$LATEST_CHROMIUM")"
else
  echo "❌ Chromium: Installation failed"
fi

if [ -n "$FIREFOX_DIRS" ]; then
  LATEST_FIREFOX=$(echo "$FIREFOX_DIRS" | sort -V | tail -n1)
  echo "✅ Firefox: $(basename "$LATEST_FIREFOX")"
else
  echo "❌ Firefox: Installation failed"
fi

echo ""
echo "💡 Usage:"
echo "  - Run tests: node test-browsers.js"
echo "  - Update browsers: npx playwright install"
echo "  - Check versions: npx playwright --version"
echo ""
echo "🎭 Playwright setup complete!"