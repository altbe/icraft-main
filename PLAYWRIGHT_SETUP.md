# Playwright Browser Testing Setup

## Overview

This repository includes Playwright browser testing with dynamic version detection for better cross-environment compatibility between WSL2, Ubuntu, and other Linux environments.

## Key Features

### Dynamic Version Detection
- **No Hardcoded Versions**: The setup automatically detects installed browser versions instead of looking for specific versions like `chromium-1187`
- **Auto-Updates**: Browsers stay in sync with your Playwright version
- **Cross-Platform**: Works seamlessly across different development environments

### Automatic Installation
- Browsers install automatically when you enter the devbox shell
- Quick check mode minimizes shell startup overhead
- System dependencies install automatically on Ubuntu/Debian (may require sudo)

## Architecture

### Components

1. **Devbox Init Hook** (`devbox.json`)
   - Sets `PLAYWRIGHT_BROWSERS_PATH` environment variable
   - Runs quick check for browser presence
   - Triggers installation if browsers are missing

2. **Installation Script** (`scripts/install-playwright-browsers.sh`)
   - Dynamic browser detection using glob patterns
   - `--check` mode for quick detection
   - Automatic system dependency installation
   - Version synchronization with @playwright/test package

3. **MCP Integration** (`.mcp.json`)
   - Playwright MCP server for browser automation
   - Enables Claude to interact with browsers directly
   - Used for testing navigation and UI interactions

## Usage

### Manual Installation/Update
```bash
# Install or update browsers
bash scripts/install-playwright-browsers.sh

# Quick check if browsers are installed
bash scripts/install-playwright-browsers.sh --check
```

### Running Tests
```bash
# Test browsers with example script
node test-browsers.js

# Use Playwright directly
npx playwright test

# Update to latest browser versions
npx playwright install
```

### Environment Variables
```bash
# Set in devbox.json automatically
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/playwright"
```

## Troubleshooting

### Missing System Dependencies
If you see warnings about missing system dependencies:
```bash
# Ubuntu/Debian/WSL2
sudo npx playwright install-deps

# Or manually install the packages shown in the error message
sudo apt-get install libglib2.0-0 libdbus-1-3 libcups2 libgbm1 libpango-1.0-0
```

### Browser Version Mismatch
If tests fail due to browser version issues:
```bash
# Force reinstall browsers matching your Playwright version
npx playwright install --force chromium firefox
```

### Checking Installed Versions
```bash
# List installed browser versions
ls -la $HOME/.cache/playwright/

# Check Playwright version
npx playwright --version
```

## Best Practices

1. **Don't Hardcode Versions**: Use glob patterns (`chromium-*`, `firefox-*`) for detection
2. **Keep Browsers Updated**: Run `npx playwright install` periodically
3. **Use Check Mode**: In scripts, use `--check` mode for quick detection
4. **Handle Multiple Versions**: Sort and use the latest version when multiple exist
5. **Document Dependencies**: System packages may need sudo installation

## Why Dynamic Detection?

### Problems with Hardcoded Versions
- Playwright updates browsers frequently
- Different environments may have different versions
- Manual updates required in multiple places
- Version drift between team members

### Benefits of Dynamic Approach
- Automatic compatibility with Playwright updates
- No manual version tracking needed
- Works across different OS versions and architectures
- Easier onboarding for new developers
- Reduced maintenance burden

## Files

- `devbox.json` - Devbox configuration with init hooks
- `scripts/install-playwright-browsers.sh` - Browser installation script
- `test-browsers.js` - Example browser test script
- `.mcp.json` - MCP server configuration (including Playwright)