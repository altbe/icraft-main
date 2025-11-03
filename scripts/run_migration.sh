#!/bin/bash
#
# Community Stories Migration Runner
# This script helps you run the migration with proper environment setup
#

echo "=================================================="
echo "Community Stories Migration Runner"
echo "=================================================="
echo ""

# Check if service keys are set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY_NONPROD" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY_NONPROD is not set"
    echo ""
    echo "Get your non-prod service key from:"
    echo "https://supabase.com/dashboard/project/jjpbogjufnqzsgiiaqwn/settings/api"
    echo ""
    echo "Then run:"
    echo "export SUPABASE_SERVICE_ROLE_KEY_NONPROD=\"<your-key>\""
    echo ""
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY_PROD" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY_PROD is not set"
    echo ""
    echo "Get your production service key from:"
    echo "https://supabase.com/dashboard/project/lgkjfymwvhcjvfkuidis/settings/api"
    echo ""
    echo "Then run:"
    echo "export SUPABASE_SERVICE_ROLE_KEY_PROD=\"<your-key>\""
    echo ""
    exit 1
fi

echo "✓ Environment variables set"
echo ""

# Change to scripts directory
cd "$(dirname "$0")"

# Run migration using virtual environment Python
echo "Starting migration..."
echo ""
../venv/bin/python3 migrate_stories.py

exit $?
