#!/bin/bash

# Coordinated deployment script for frontend and backend
set -e

ENVIRONMENT=${1:-dev}

echo "🚀 Deploying iCraftStories to $ENVIRONMENT..."

# Deploy backend first (API needs to be ready for frontend)
echo "🔧 Deploying backend..."
cd backend
case $ENVIRONMENT in
  "dev")
    npm run deploy:dev || echo "⚠️  Backend dev deployment handled by Zuplo GitOps"
    ;;
  "qa") 
    npm run promote:qa || echo "⚠️  Backend QA deployment handled by Zuplo GitOps"
    ;;
  "prod")
    npm run release:production || echo "⚠️  Backend prod deployment handled by Zuplo GitOps"
    ;;
esac
cd ..

# Deploy frontend
echo "⚛️  Deploying frontend..."
cd frontend
case $ENVIRONMENT in
  "dev")
    npm run deploy:dev
    ;;
  "qa")
    npm run deploy:qa  
    ;;
  "prod")
    npm run deploy:prod
    ;;
esac
cd ..

echo "✅ Deployment to $ENVIRONMENT complete!"
echo ""
echo "🔍 Check deployment status:"
echo "  Frontend: cd frontend && npm run tag:status"
echo "  Backend: Check Zuplo dashboard"