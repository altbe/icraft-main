# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**iCraftStories** - Full-stack AI-powered illustrated story creation platform with team collaboration, offline-first PWA architecture, and multi-language support.

This is a **monorepo with Git submodules**:
- **Frontend**: `frontend/` (submodule: `icraft-front-v8`) - React PWA with TypeScript, Konva canvas, IndexedDB sync
- **Backend**: `backend/` (submodule: `unico-api`) - Zuplo API Gateway (BFF architecture) with Supabase + Stripe integration

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

## Architecture Overview

### Frontend Stack
- **Framework**: React 18.3.1 + TypeScript + Vite 7
- **Deployment**: Cloudflare Workers with static assets
- **PWA**: VitePWA with service workers, offline-first IndexedDB storage
- **UI**: Tailwind CSS + shadcn/ui components (ADHD/dyslexia-friendly design)
- **Canvas**: Konva.js for interactive story editing
- **Auth**: Clerk React for user management
- **i18n**: i18next with English/Spanish support
- **Payments**: Stripe for subscriptions and credit purchases
- **SEO**: JSON-LD structured data, dynamic sitemaps, analytics tracking
- **Accessibility**: WCAG 2.1 AA compliant, dyslexia-friendly fonts (Lexend, Atkinson Hyperlegible)

### Backend Stack
- **Gateway**: Zuplo API Gateway (Backend-for-Frontend architecture)
- **Runtime**: Node.js 22+ with TypeScript ESM modules
- **Database**: Supabase (PostgreSQL) with Stripe wrapper integration
- **Auth**: Clerk JWT validation at API level (not database RLS)
- **AI Services**: OpenAI GPT-4o-mini, Stability AI, ElevenLabs
- **Storage**: Cloudflare R2 for images and audio assets
- **Payments**: Stripe with direct database integration via Supabase wrapper

### Database Environments

#### Supabase Projects
- **Production**: `icraft prod` (ID: `lgkjfymwvhcjvfkuidis`)
  - Region: us-east-2
  - Host: db.lgkjfymwvhcjvfkuidis.supabase.co

- **Non-Production**: `icraft non-prod` (ID: `jjpbogjufnqzsgiiaqwn`)
  - Region: us-east-2
  - Host: db.jjpbogjufnqzsgiiaqwn.supabase.co

## Key Architectural Patterns

1. **Database-First Backend Logic**: Core business logic implemented in Supabase stored procedures
   - Subscription management via `pg_cron` and database functions (NOT API endpoints)
   - Credit allocation, state transitions, audit trails in database layer
   - API endpoints only for read operations or frontend-triggered actions

2. **Offline-First PWA**: IndexedDB storage with background sync to cloud

3. **API-Level Authentication**: Clerk JWT validation in Zuplo, not database RLS

4. **Stripe Integration**: Direct database access via Supabase Stripe wrapper

5. **Team Collaboration**: Team-owned stories with shared credit pools

6. **Multi-Device Sync**: Conflict resolution with last-write-wins strategy

### Credit System Architecture (Consolidated 2025-10-25)

**Pure Ledger Model** - All credit operations use INSERT-only transactions:

**Core Principles:**
- ✅ **Ledger-Based Balances** - Computed from `credit_transactions` table, no cached balances
- ✅ **Database-First Attribution** - `get_user_team_id()` determines team vs. individual
- ✅ **Auto-Detection** - Single API for all users (team members and individuals)
- ✅ **Semantic Operations** - Specific functions for each business operation
- ✅ **Validation** - `use_credits()` throws exception if insufficient balance

**See:** `backend/CREDIT_SYSTEM_CONSOLIDATED.md` for complete implementation details

## Current Work & Recent Completions

### Active Development

See [`docs-archive/work-sessions/README.md`](./docs-archive/work-sessions/README.md) for completed work history.

### Key Recent Changes (2025-11)

#### Frontend (November 15, 2025)
- ✅ **SEO & Growth**: Comprehensive JSON-LD, dynamic language detection, enhanced sitemaps, analytics
- ✅ **Security**: OWASP Top 10 review complete, sensitive data removed from logs
- ✅ **Accessibility**: WCAG 2.1 AA compliance, ADHD/dyslexia-friendly design
- ✅ **Fonts**: Custom PDF export fonts (Atkinson Hyperlegible, Lexend, Poppins)
- ✅ **PWA**: iOS installation fixes, PageSpeed mobile optimization, offline improvements
- ✅ **Service Worker**: WWW subdomain bypass for Cloudflare redirects

#### Backend (November 2025)
- ✅ Subscription sync function signature mismatch fixed (2025-11-29)
- ✅ UUID/TEXT type mismatch fixed in PostgreSQL functions
- ✅ Clerk webhook migrated to Supabase Edge Function
- ✅ Trial-to-active credit allocation automated
- ✅ Unified image processor with VLLM content analysis

### In Progress
- [ ] Monitor BGE-M3 embedding success rate in production
- [ ] Deploy semantic search to production
- [ ] Complete subscription upgrade transfer flow

## Code Style Guidelines

### Universal Patterns

#### Async Operations - ALWAYS Wait for Completion
**CRITICAL**: Never use arbitrary timeouts to wait for operations. Always wait for actual completion events with timeout only as exception fallback.

❌ **Wrong**: `await upload(); await new Promise(r => setTimeout(r, 1000)); // hope it's done?`

✅ **Correct**: Wait for actual event (`onload`, callback, promise resolution) with timeout only for hung/error cases

### Frontend
- **TypeScript**: Strict typing, avoid `any`, use path aliases (`@/*`)
- **Components**: Function components with React hooks, PascalCase names
- **Styling**: Tailwind utilities with shadcn/ui components (never modify shadcn components directly)
- **Error Handling**: ErrorBoundary for UI errors, unified notification system

### Backend
- **Modules**: ESM syntax (`type: "module"`)
- **Types**: Explicit interfaces, strict null checks
- **Error Handling**: try/catch with context.log.error(), return HttpProblems for API errors
- **Auth**: Extract X-User-Id header, validate Clerk JWT tokens

## Development Commands

### Monorepo Level (`icraft-main/`)
```bash
# Setup and maintenance
npm run setup        # Initialize submodules and install dependencies
npm run update       # Update submodules to latest

# Development
npm run dev          # Start both frontend and backend concurrently
npm run dev:frontend # Start frontend only (port 3000)
npm run dev:backend  # Start backend only

# Building
npm run build        # Build both projects
npm run lint         # Lint both projects
npm run test         # Run tests for both projects
```

### Frontend Deployment (Tag-based with GitHub Actions)
```bash
cd frontend
npm run tag:create   # Interactive tag creation for QA/prod deployment
npm run tag:status   # Check deployment status across environments
```

### Backend Deployment (Branch-based GitOps)
```bash
cd backend
npm run deploy:dev                    # Deploy to development
npm run promote:qa                    # develop → preview branch (QA)
npm run release:production            # preview → main branch (Production)
npm run rollback:production          # Interactive rollback to previous release
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

### Requirements & Architecture
- `TEAM_MEMBER_REQUIREMENTS.md` - Team collaboration requirements
- `FEATURES.md` - Complete feature list
- `backend/TARGET-STATE-ARCHITECTURE.md` - Target architecture
- `backend/CREDIT_SYSTEM_CONSOLIDATED.md` - Credit system implementation

### Frontend Documentation
- `frontend/docs/adr/` - Architecture Decision Records
- `frontend/docs/adr/ADR-009-team-collaboration-architecture.md` - Team collaboration
- `frontend/CLAUDE.md` - Frontend-specific guidance

### Backend Documentation
- `backend/docs-internal/api-reference.md` - API documentation
- `backend/docs-internal/operations/GITOPS-WORKFLOW.md` - GitOps workflow
- `backend/docs-internal/integrations/` - Integration guides
- `backend/CLAUDE.md` - Backend-specific guidance

### Archived Documentation
- `docs-archive/work-sessions/` - Historical work session details
- `docs-archive/2025-Q4-*` - Completed feature implementations
- `backend/docs-archive/legacy-credit-system/` - Legacy documentation (do not use)

## Documentation Scope Alignment Rules

**Principle:** Single Source of Truth (SSOT) - Each piece of information should be documented in exactly ONE authoritative location.

### Documentation Ownership
- **Top-Level (`icraft-main/`)**: Cross-cutting concerns, integration plans, deployment orchestration
- **Backend (`backend/`)**: Implementation details, API contracts, database schema, backend TODOs
- **Frontend (`frontend/`)**: Component architecture, state management, PWA specifics, frontend TODOs

### Update Workflow
1. **Identify Scope**: Which repositories are affected?
2. **Update SSOT First**: Update authoritative document
3. **Update Cross-References**: Update documents that reference the SSOT
4. **Verify Alignment**: Check consistency across all docs
5. **Commit Atomically**: Group related changes

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

### Sync Stripe Products
```bash
cd backend
npm run stripe:sync-prod-to-test
```

## Project Structure

### Monorepo Root
```
icraft-main/
├── frontend/                # Frontend submodule
├── backend/                 # Backend submodule
├── scripts/                 # Monorepo orchestration scripts
├── docs-archive/           # Archived documentation
│   └── work-sessions/      # Historical work sessions
├── package.json            # Monorepo package configuration
├── TODO.md                 # Immediate action items
├── FEATURES.md             # Complete feature list
└── CLAUDE.md               # This file
```

## Testing

### Frontend
- TypeScript compilation: `npm run compile`
- Linting: `npm run lint`
- Playwright tests for browser automation

### Backend
- Test files: `backend/tests/`
- Run all tests: `npm run test`
- Run single test: `npx zuplo test tests/[filename].ts`