# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**iCraftStories** - Full-stack AI-powered illustrated story creation platform with team collaboration, offline-first PWA architecture, and multi-language support.

This is a **monorepo with Git submodules**:
- **Frontend**: `frontend/` (submodule: `icraft-front-v8`) - React PWA with TypeScript, Konva canvas, IndexedDB sync
- **Backend**: `backend/` (submodule: `unico-api`) - Zuplo API Gateway (BFF architecture) with Supabase + Stripe integration

## Repository Setup

### Initial Setup
```bash
# Clone with submodules
git clone --recursive <main-repo-url>
cd icraft-main

# OR use monorepo setup script
npm run setup    # Initialize submodules and install dependencies
```

### Working with Submodules
```bash
# Update submodules to latest commits
git submodule update --remote
# OR use monorepo script
npm run update

# Work within each submodule
cd frontend  # or cd backend
git checkout main
git pull origin main
```

## Development Commands

### Monorepo Level (`icraft-main/`)
```bash
# Setup and maintenance
npm run setup        # Initialize submodules and install dependencies
npm run update       # Update submodules to latest
npm run clean        # Clean build artifacts in both projects

# Development
npm run dev          # Start both frontend and backend concurrently
npm run dev:frontend # Start frontend only (port 3000)
npm run dev:backend  # Start backend only

# Building and validation
npm run build        # Build both projects
npm run build:frontend  # Build frontend only
npm run build:backend   # Build backend only
npm run lint         # Lint both projects
npm run lint:frontend   # Lint frontend only
npm run lint:backend    # Lint backend only
npm run test         # Run tests for both projects
npm run test:frontend   # Test frontend only
npm run test:backend    # Test backend only

# Deployment orchestration
npm run deploy       # Deploy both services
npm run deploy:dev   # Deploy to development
npm run deploy:qa    # Deploy to QA
npm run deploy:prod  # Deploy to production

# Repository management
npm run repo:status  # View repo info and submodule status
npm run repo:issues  # List recent issues
npm run repo:prs     # List recent pull requests
npm run pr:create    # Create PR in web interface
npm run pr:view      # View current PR in web interface
npm run clone:fresh  # Clone repo with submodules using gh CLI
```

### Frontend (`frontend/`)
```bash
cd frontend

# Development
npm run dev          # Start Vite dev server (port 3000)
npm run build        # Build for production (includes typecheck)
npm run build:dev    # Build with development version info
npm run compile      # TypeScript compilation check only
npm run preview      # Preview production build locally
npm run clean        # Clean build artifacts

# Code quality
npm run lint         # Run ESLint checks
npm run lint:fix     # Fix ESLint issues automatically
npm run lint:staged  # Lint staged files (for pre-commit hooks)

# Deployment management (Tag-based with GitHub Actions)
npm run tag:create   # Interactive tag creation for QA/prod deployment
npm run tag:status   # Check deployment status across environments

# Wrangler/Cloudflare (manual deployment - rarely used)
npm run wrangler:dev    # Run with wrangler locally
npm run wrangler:login  # Authenticate with Cloudflare
```

### Backend (`backend/`)
```bash
cd backend

# Development
npm run dev          # Start Zuplo dev server (includes clean + compile)
npm run test         # Run Zuplo test suite (includes clean + compile)
npm run compile      # TypeScript compilation check only
npm run clean        # Clean build artifacts

# Environment validation
npm run validate:preview     # Validate QA environment config
npm run validate:production  # Validate production environment config

# GitOps Deployment (Branch-based automatic deployment)
npm run deploy:dev                    # Deploy to development
npm run promote:qa                    # develop → preview branch (QA)
npm run release:production            # preview → main branch (Production)

# Environment resets
npm run reset:dev-from-production     # Reset develop from main
npm run reset:qa-from-production      # Reset preview from main
npm run reset:dev-from-qa            # Reset develop from preview

# Hotfix workflow
npm run hotfix:create <name>         # Create hotfix branch from main
npm run hotfix:test <name>           # Test hotfix in QA environment
npm run hotfix:deploy <name>         # Deploy hotfix to production

# Production rollback
npm run rollback:production          # Interactive rollback to previous release
npm run rollback:production <tag>    # Rollback to specific release tag

# Stripe management
npm run stripe:sync-prod-to-test     # Sync Stripe products from prod to test
```

## Architecture Overview

### Frontend Stack
- **Framework**: React 18.3.1 + TypeScript + Vite 6.1.0
- **Deployment**: Cloudflare Workers with static assets
- **PWA**: VitePWA with service workers, offline-first IndexedDB storage
- **UI**: Tailwind CSS + shadcn/ui components
- **Canvas**: Konva.js for interactive story editing
- **Auth**: Clerk React for user management
- **State**: React hooks for state management
- **i18n**: i18next with English/Spanish support
- **Storage**: IndexedDB with sync capabilities to backend
- **Payments**: Stripe for subscriptions and credit purchases

### Backend Stack
- **Gateway**: Zuplo API Gateway (Backend-for-Frontend architecture)
- **Runtime**: Node.js 22+ with TypeScript ESM modules
- **Database**: Supabase (PostgreSQL) with Stripe wrapper integration
- **Auth**: Clerk JWT validation at API level (not database RLS)
- **AI Services**: OpenAI GPT-4o-mini, Stability AI, ElevenLabs
- **Storage**: Cloudflare R2 for images and audio assets
- **Payments**: Stripe with direct database integration via Supabase wrapper
- **Testing**: Zuplo test framework with chai assertions

### Database Environments

#### Supabase Projects
- **Production**: `icraft prod` (ID: `lgkjfymwvhcjvfkuidis`)
  - Region: us-east-2
  - Host: db.lgkjfymwvhcjvfkuidis.supabase.co
  
- **Non-Production**: `icraft non-prod` (ID: `jjpbogjufnqzsgiiaqwn`)
  - Region: us-east-2
  - Host: db.jjpbogjufnqzsgiiaqwn.supabase.co

### Key Architectural Patterns

1. **Offline-First PWA**: IndexedDB storage with background sync to cloud
2. **API-Level Authentication**: Clerk JWT validation in Zuplo, not database RLS
3. **Stripe Integration**: Direct database access via Supabase Stripe wrapper
4. **Team Collaboration**: Team-owned stories with shared credit pools
5. **Multi-Device Sync**: Conflict resolution with last-write-wins strategy
6. **AI-Powered Content**: Story and image generation with credit-based usage

## Code Style Guidelines

### Frontend
- **TypeScript**: Strict typing, avoid `any`, use path aliases (`@/*`)
- **Components**: Function components with React hooks, PascalCase names
- **Imports**: React first, external libraries, then local imports
- **Styling**: Tailwind utilities with shadcn/ui components (never modify shadcn components directly)
- **Error Handling**: ErrorBoundary for UI errors, unified notification system

### Backend
- **Modules**: ESM syntax (`type: "module"`)
- **Types**: Explicit interfaces, strict null checks
- **Error Handling**: try/catch with context.log.error(), return HttpProblems for API errors
- **Auth**: Extract X-User-Id header, validate Clerk JWT tokens
- **Testing**: @zuplo/test framework with chai assertions

## Deployment Automation

### Frontend Deployment (GitHub Actions + Cloudflare Workers)

The frontend uses **tag-based deployment** with GitHub Actions:

#### Environments and URLs
- **Development**: https://icraft-frontend-dev.altgene.workers.dev (auto-deploys from `main` branch)
- **QA**: https://icraft-frontend-qa.altgene.workers.dev (deploys via `qa-*` tags)
- **Production**: https://icraftstories.com (deploys via `prod-*` tags)

#### GitHub Actions Workflows (`frontend/.github/workflows/`)
- `deploy-dev.yml` - Auto-deploys on push to `main`
- `deploy-qa.yml` - Deploys when `qa-*` tags are pushed
- `deploy-prod.yml` - Deploys when `prod-*` tags are pushed
- `auto-merge-dependabot.yml` - Auto-merge dependabot PRs

#### Deployment Scripts (`frontend/scripts/`)
- `create-tag.js` - Interactive tag creation for QA/prod deployments
- `deployment-status.js` - Check deployment status across all environments
- `generate-version.js` - Generate version info for builds
- `generate-sitemap.js` - Generate sitemap for SEO

### Backend Deployment (Zuplo GitOps)

The backend uses **branch-based deployment** with automatic Zuplo deployments:

#### Branch-to-Environment Mapping
```
develop branch → Development (unico-api-develop-551bdfd.d2.zuplo.dev)
preview branch → QA (unico-api-preview-551bdfd.d2.zuplo.dev)
main branch    → Production (api.icraftstories.com)
```

#### Deployment Scripts (`backend/scripts/`)
- `validate-environment.sh` - Validate environment configurations

#### Development Scripts (`backend/scripts/development/`)
- `deploy-to-dev.sh` - Deploy to development environment
- `promote-to-qa.sh` - Promote develop to QA
- `release-to-production.sh` - Release QA to production
- `create-hotfix.sh` - Create hotfix branches
- `test-hotfix.sh` - Test hotfixes in QA
- `deploy-hotfix.sh` - Deploy hotfixes to production
- `rollback-production.sh` - Rollback production to previous release
- `reset-dev-from-main.sh` - Reset develop from main
- `reset-dev-from-qa.sh` - Reset develop from preview
- `reset-qa-from-main.sh` - Reset preview from main
- `syncStripeProducts.sh` - Sync Stripe products between environments
- `processStripeSync.js` - Process Stripe sync operations
- `rerunClerkWebhook.js` - Re-run Clerk webhooks for testing

### Monorepo Scripts (`scripts/`)
- `setup.sh` - Initialize submodules and dependencies
- `update.sh` - Update submodules to latest commits
- `deploy.sh` - Orchestrate deployment to specific environments

## Testing

### Frontend
- No test framework currently configured
- TypeScript compilation: `npm run compile`
- Linting: `npm run lint`

### Backend (`backend/tests/`)
- **Test files**: `listings.test.ts`, `stories.ts.test.ts`
- **Run all tests**: `npm run test`
- **Run single test**: `npx zuplo test tests/[filename].ts`

## Project Structure

### Monorepo Root
```
icraft-main/
├── frontend/                # Frontend submodule
├── backend/                 # Backend submodule
├── scripts/                 # Monorepo orchestration scripts
│   ├── setup.sh
│   ├── update.sh
│   └── deploy.sh
├── package.json            # Monorepo package configuration
├── README.md               # Project overview
├── TODO.md                 # Immediate action items
├── COMPREHENSIVE_TODO_LIST.md  # Detailed task tracking
├── FEATURES.md             # Complete feature list
└── CLAUDE.md               # This file
```

### Frontend Structure
```
frontend/
├── src/                    # Source code
├── public/                 # Static assets
├── scripts/                # Deployment and build scripts
├── .github/workflows/      # GitHub Actions
├── docs/                   # Documentation
│   ├── adr/               # Architecture Decision Records
│   └── development/       # Development guides
└── package.json           # Frontend dependencies
```

### Backend Structure
```
backend/
├── modules/                # API endpoints and services
├── config/                 # Zuplo configuration
├── tests/                  # Test files
├── scripts/                # Deployment scripts
│   ├── validate-environment.sh
│   └── development/       # GitOps scripts
├── docs-internal/          # Internal documentation
│   ├── decisions/         # Architecture decisions
│   ├── integrations/      # Integration guides
│   └── operations/        # Operation guides
└── package.json           # Backend dependencies
```

## Environment Configuration

### Frontend Environment Variables
```bash
VITE_API_BASE_URL           # API Gateway URL
VITE_CLERK_PUBLISHABLE_KEY  # Clerk public key
VITE_SYNC_INTERVAL          # Sync interval in ms
VITE_REQUEST_TIMEOUT        # API request timeout
VITE_MAX_RETRIES           # Max retry attempts
VITE_RETRY_DELAY           # Delay between retries
VITE_SENTRY_DSN            # Sentry error tracking
```

### Backend Configuration
- Local development: `local-config/api-keys.json`
- Environment-specific configs managed in Zuplo dashboard

## Documentation References

### Frontend Documentation
- `frontend/docs/adr/` - Architecture Decision Records
- `frontend/docs/development/` - Development patterns and guides
- `frontend/CLAUDE.md` - Frontend-specific guidance

### Backend Documentation
- `backend/docs-internal/api-reference.md` - API documentation
- `backend/docs-internal/operations/GITOPS-WORKFLOW.md` - GitOps workflow
- `backend/docs-internal/decisions/` - Architecture decisions
- `backend/docs-internal/integrations/` - Integration guides
- `backend/TARGET-STATE-ARCHITECTURE.md` - Target architecture
- `backend/CLAUDE.md` - Backend-specific guidance

## Quick Start Guide

1. **Clone and Setup**
   ```bash
   git clone --recursive <repo-url>
   cd icraft-main
   npm run setup
   ```

2. **Start Development**
   ```bash
   npm run dev  # Starts both frontend and backend
   ```

3. **Deploy to QA**
   - Frontend: `cd frontend && npm run tag:create` (select 'qa')
   - Backend: `cd backend && npm run promote:qa`

4. **Deploy to Production**
   - Frontend: `cd frontend && npm run tag:create` (select 'prod')
   - Backend: `cd backend && npm run release:production`

## Common Tasks

### Check Deployment Status
```bash
cd frontend && npm run tag:status  # Frontend status
cd backend && git branch -r        # Backend branches
```

### Create a Hotfix
```bash
cd backend
npm run hotfix:create <name>
# Make fixes
npm run hotfix:test <name>
npm run hotfix:deploy <name>
```

### Rollback Production
```bash
cd backend
npm run rollback:production  # Interactive selection
```

### Sync Stripe Products
```bash
cd backend
npm run stripe:sync-prod-to-test
```