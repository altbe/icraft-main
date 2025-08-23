#!/bin/bash

# iCraftStories Development Setup Script
set -e

echo "🚀 Setting up iCraftStories development environment..."

# Initialize submodules if not already done
echo "📦 Initializing submodules..."
git submodule init
git submodule update --recursive

# Frontend setup
if [ -d "frontend" ]; then
    echo "⚛️  Setting up frontend..."
    cd frontend
    if [ -f "package.json" ]; then
        npm install
        echo "✅ Frontend dependencies installed"
    fi
    cd ..
fi

# Backend setup  
if [ -d "backend" ]; then
    echo "🔧 Setting up backend..."
    cd backend
    if [ -f "package.json" ]; then
        npm install
        echo "✅ Backend dependencies installed"
    fi
    cd ..
fi

echo "🎉 Setup complete! Use these commands:"
echo ""
echo "  Frontend dev:  cd frontend && npm run dev"
echo "  Backend dev:   cd backend && npm run dev"
echo ""
echo "  Update submodules: ./scripts/update.sh"