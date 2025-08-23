#!/bin/bash

# Update all submodules to latest commits
set -e

echo "🔄 Updating submodules..."

# Update to latest commits from remote
git submodule update --remote --merge

# Show current submodule status
echo ""
echo "📊 Submodule status:"
git submodule status

echo ""
echo "🎯 To commit these updates:"
echo "  git add ."
echo "  git commit -m 'Update submodules to latest'"