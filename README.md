# iCraftStories - Monorepo

Full-stack AI-powered illustrated story creation platform with team collaboration, offline-first PWA architecture, and multi-language support.

## Architecture

This repository uses Git submodules to manage two separate applications:

- **Frontend**: `frontend/` - React PWA with TypeScript, Konva canvas, IndexedDB sync
- **Backend**: `backend/` - Zuplo API Gateway (BFF architecture) with Supabase + Stripe integration

## Quick Start

```bash
# Clone with submodules (using gh CLI)
npm run clone:fresh
# OR traditional git
git clone --recursive https://github.com/altbe/icraft-main.git
cd icraft-main

# Setup and development
npm run setup    # Initialize submodules and install dependencies
npm run dev      # Start both frontend and backend
```

## Available Commands

### Development
```bash
npm run dev              # Start both services
npm run dev:frontend     # Frontend only (port 3000)
npm run dev:backend      # Backend only
```

### Building & Testing
```bash
npm run build           # Build both projects
npm run test            # Run all tests
npm run lint            # Lint both projects
npm run clean           # Clean build artifacts
```

### Repository Management
```bash
npm run setup           # Initialize submodules and dependencies
npm run update          # Update submodules to latest
npm run repo:status     # View repo info and submodule status
npm run repo:issues     # List recent issues
npm run repo:prs        # List recent pull requests
```

### Pull Requests
```bash
npm run pr:create       # Create PR in web interface
npm run pr:view         # View current PR in web interface
```

### Deployment
```bash
npm run deploy:dev      # Deploy to development
npm run deploy:qa       # Deploy to QA
npm run deploy:prod     # Deploy to production
```

## Submodule Management

```bash
# Update submodules to latest
git submodule update --remote

# Pull latest changes for all submodules
git submodule foreach git pull origin main

# Update to specific commit
cd frontend
git checkout <commit-hash>
cd ..
git add frontend
git commit -m "Update frontend to v1.2.3"
```

## Development Workflow

1. Work on features in individual repositories (`frontend/`, `backend/`)
2. Test integration points between services
3. Update main repository with specific submodule versions for releases
4. Tag releases in main repository for deployment coordination

## Deployment

- **Frontend**: Cloudflare Workers (via `frontend/` repository CI/CD)
- **Backend**: Zuplo GitOps (via `backend/` repository CI/CD)
- **Orchestration**: Use tags in this repository to coordinate releases

## Repository Links

- Frontend: https://github.com/altbe/icraft-front-v8
- Backend: https://github.com/altgene/unico-api