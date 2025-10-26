# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Work Session (2025-10-23)

### ✅ Just Completed (2025-10-23)

#### Team Member Requirements Documentation
- Created comprehensive `TEAM_MEMBER_REQUIREMENTS.md` with all team collaboration requirements
- Documented three member onboarding scenarios (new user, existing user, team owner)
- Captured role-based permissions (owner/member)
- Documented team credit management and story ownership
- Added future enhancement roadmap
- Updated CLAUDE.md with requirements documentation references

#### One-Team-Per-User Enforcement (Database-First Implementation) ✅
- **Discovered**: Database already enforces one-team-per-user constraint (migration 002)
- **Gap Identified**: API doesn't validate before sending invitation (bad UX - invitation succeeds but fails on accept)
- **Solution Implemented**: Full-stack pre-flight validation with database-first architecture
- **Database Layer** (Migration 011):
  - Created stored procedure `check_user_team_membership_by_email(p_email TEXT)`
  - Three-tier email lookup: team_members.email → user_profiles.email → teams.owner_id
  - Applied to both non-prod (jjpbogjufnqzsgiiaqwn) and prod (lgkjfymwvhcjvfkuidis)
- **Backend API** (`backend/modules/clerk-team-invitations.ts:144-172`):
  - Calls stored procedure before sending Clerk invitation
  - Returns specific error codes: `USER_ALREADY_IN_TEAM`, `USER_ALREADY_OWNS_TEAM`
  - Includes team metadata (name, ID, role) in error response
  - Fail-open strategy: allows invitation if validation fails (better UX than blocking)
- **Frontend UI** (`frontend/src/components/TeamInvitationDialog.tsx:96-106`):
  - Detects error codes and extracts team metadata
  - Shows informational error message with existing team name
  - Translations added for English and Spanish
- **Files Modified**:
  - `backend/modules/clerk-team-invitations.ts` (added validation + security)
  - `frontend/src/components/TeamInvitationDialog.tsx` (added error handling)
  - `frontend/src/services/TeamInvitationService.ts` (added robust sanitization)
  - `frontend/src/locales/en/teams.json` (added translations)
  - `frontend/src/locales/es/teams.json` (added translations)
- **Security Enhancements** (Zod-Based Validation):
  - **Zod Schema Validation**: Type-safe email validation with `.email()` built-in
  - **Frontend & Backend Consistency**: Same Zod schema logic on both sides
  - **Sanitization Transform**: Auto-removes control chars, null bytes, HTML tags
  - **Progressive Real-Time UX**: Green/yellow/red visual feedback as user types
  - **Injection Prevention**: Custom `.refine()` detects XSS, protocol injection, directory traversal
  - **Length Limits**: 3-320 characters (RFC 5322 compliant)
  - **Detailed Error Messages**: Zod provides user-friendly validation feedback
  - **Security Logging**: Backend logs failed validations with input preview
  - **Input Masking**: Frontend strips dangerous characters in real-time
- **Documentation Updated**:
  - `TEAM_MEMBER_REQUIREMENTS.md` - REQ-INV-003 marked as implemented with security details
  - `ONE_TEAM_PER_USER_SOLUTION.md` - implementation checklist updated with security phase

#### Story & Credit Transfer Implementation (2025-10-24) ✅ Partially Complete

**Status**: Team invitation flow fully working | Subscription upgrade flow needs implementation

**What's Implemented:**
- ✅ **Team Invitation Acceptance Transfer** - FULLY WORKING (deployed to prod & non-prod)
  - Database: `onboard_team_member()` transfers ALL stories and credits automatically
  - Database: `transfer_all_user_stories_to_team()` with full audit trail
  - Database: `story_transfers` table for immutable transaction history
  - Backend: Clerk webhook calls `onboard_team_member()` on `organizationMembership.created`
  - Cancels individual/trial subscriptions automatically
  - Logs comprehensive `team_join` activity with transfer counts
  - Transaction history preserved (stories + credits)

**What's Missing:**
- ❌ **Subscription Upgrade Transfer** - NOT IMPLEMENTED
  - Stripe webhook receives `customer.subscription.updated` but doesn't detect plan upgrades
  - No logic to trigger `onboard_team_member()` when user upgrades individual → team/custom
  - Users who upgrade subscription don't get automatic transfer
- ⚠️ **User Communication** - MISSING
  - No confirmation dialog before accepting invitation (user doesn't know transfer will happen)
  - No success notification showing transfer results (X stories, Y credits transferred)
  - No subscription upgrade warning about automatic transfer

**Database Functions** (Deployed to both environments):
- `onboard_team_member(p_user_id, p_team_id)` - backend/sql/team-member-onboarding.sql:23-162
- `transfer_all_user_stories_to_team(p_user_id, p_team_id, p_description)` - backend/sql/story-transfer-implementation.sql:69-203
- `transfer_all_user_credits_to_team(p_user_id, p_team_id, p_description)` - Referenced by onboard function
- `story_transfers` audit table - backend/sql/story-transfer-implementation.sql:22-63

**Backend Webhook Handlers**:
- `clerk-organization-webhooks.ts:182-286` - Team invitation webhook (WORKING)
- `webhook-manager.ts:325-407` - Stripe subscription webhook (MISSING UPGRADE DETECTION)

**Migration Status**:
- Non-Prod: 20251020084711 (onboarding), 20251022174649 (story transfer)
- Production: 20251020085732 (onboarding), 20251022174744 (story transfer)

**Migration Policy for Existing Users** (Established 2025-10-24):

**Decision**: Only migrate users who have **active team subscriptions**. Individual users are excluded.

**Criteria**:
- ✅ **Migrate**: Users with `teams.subscription_status IN ('active', 'trialing', 'team')` OR user has active team/custom subscription
- ❌ **Exclude**: Users with `teams.subscription_status = 'none'` (treated as individual users, even if they own a team entity)

**Rationale**:
- Team subscription = User is actively using team features → Stories should be team-owned
- No team subscription = Individual user → Stories should stay personal, subscription should stay active
- Prevents accidentally breaking individual users who own empty team entities

**Implementation**:
1. Run analysis query to identify users with active team subscriptions AND personal stories
2. Create migration snapshot (rollback capability)
3. Execute `onboard_team_member()` for each affected user
4. Validate results (0 remaining personal stories for team users)

**See**:
- `NON_PROD_DATA_MIGRATION_PLAN.md` - Complete migration plan with queries and procedures
- `STORY_CREDIT_TRANSFER_GAP_ANALYSIS.md` - Implementation details and gaps

**Completed Work**:
1. ✅ Implement subscription upgrade transfer detection (Priority 1) - COMPLETE
2. ✅ Add frontend confirmation dialogs and success notifications (Priority 2) - COMPLETE
3. ✅ Update Terms of Service and documentation (Priority 3) - COMPLETE
4. ✅ Execute existing user migration in non-prod - COMPLETE (2025-10-24)
   - 4 users migrated successfully
   - 143 stories transferred to teams
   - 1 subscription optimized (double-paying eliminated)
   - 0 errors, 100% success rate

---

## Previous Work Sessions

### Work Session (2025-01-06)

### Recently Completed Work

#### ✅ Phase 1: Database Foundation (Partial)
- Created `search_custom_images()` database function (simplified version)
- MLX Qwen2.5-VL processing scripts for image categorization
- Generated Spanish translations and category updates
- Batch import scripts ready (`backend/scripts/`)

#### ✅ Backend Integration
- Updated `icraft-images.ts` API endpoint to use new search function
- Removed deprecated `icraft-custom-images.ts` module
- Basic search functionality working

#### ✅ Frontend Improvements
- Enhanced ImageSearch component with better error handling
- Fixed token alignment by subscription plan
- Added Playwright test suite for responsive layouts
- Updated PWA service worker utilities

#### ✅ Configuration
- Added `.mcp.json` with Stripe, Supabase, and Playwright MCP servers (excluded from git)

### ✅ Recently Completed (2025-01-08)

#### AI-Powered Semantic Search Implementation
- ✅ **Database**: pgvector extension with 1024-dim BGE-M3 embeddings for all 1,196 images
- ✅ **API Integration**: BGE-M3 embedding generation via Cloudflare Workers AI
- ✅ **Search Functions**: `search_custom_images_vector()` with vector similarity search
- ✅ **Frontend**: UnifiedImageSearch component with semantic search support
- ✅ **Multilingual**: Language-agnostic embeddings work for English/Spanish
- ✅ **Performance**: ~400-600ms total search latency achieved
- ✅ **Fallback**: Graceful degradation to text search if embedding fails

### ✅ Testing Infrastructure (2025-01-17)

#### Playwright Browser Testing
- **Dynamic Version Detection**: No hardcoded browser versions for better cross-environment support
- **Auto-Installation**: Browsers install automatically on `devbox shell` if missing
- **MCP Integration**: Playwright MCP server configured for browser automation
- **Cross-Platform**: Works on WSL2, Ubuntu, and other Linux environments
- **Test Scripts**:
  - `test-browsers.js` - Test Chromium and Firefox browsers
  - `scripts/install-playwright-browsers.sh` - Dynamic browser installer with `--check` mode

### 🚧 In Progress / Next Steps

#### Monitoring & Optimization
- [ ] Monitor embedding generation success rate in production
- [ ] Fine-tune similarity threshold (currently 0.3) based on user feedback
- [ ] Analyze search patterns for further improvements
- [ ] Consider adding search suggestions based on popular queries
- [ ] Batch update all images with BGE-M3 embeddings
- [ ] Deploy semantic search function to production
- [ ] Monitor Cloudflare Workers AI costs (~$0.03/month)

### Notes
- Full implementation plan in `IMAGE_SEARCH_ENHANCEMENTS.md` (updated with BGE-M3 design)
- BGE-M3 provides multilingual semantic search without OpenAI dependency
- Cost: ~$0.03/month for 3,000 searches (78% savings vs GPT-4o-mini)
- Schema migration SQL ready: `backend/scripts/add-vector-embeddings.sql`

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

1. **Database-First Backend Logic**: Core business logic implemented in Supabase stored procedures
   - Subscription management via `pg_cron` and database functions (NOT API endpoints)
   - Credit allocation, state transitions, audit trails in database layer
   - API endpoints only for read operations or frontend-triggered actions
   - Scheduled jobs run directly in PostgreSQL via `pg_cron` extension

2. **Offline-First PWA**: IndexedDB storage with background sync to cloud

3. **API-Level Authentication**: Clerk JWT validation in Zuplo, not database RLS

4. **Stripe Integration**: Direct database access via Supabase Stripe wrapper

5. **Team Collaboration**: Team-owned stories with shared credit pools

6. **Multi-Device Sync**: Conflict resolution with last-write-wins strategy

7. **AI-Powered Content**: Story and image generation with credit-based usage

### Credit System Architecture (Consolidated 2025-10-25)

**Pure Ledger Model** - All credit operations use INSERT-only transactions:

**Core Principles:**
- ✅ **Ledger-Based Balances** - Computed from `credit_transactions` table, no cached balances
- ✅ **Database-First Attribution** - `get_user_team_id()` determines team vs. individual
- ✅ **Auto-Detection** - Single API for all users (team members and individuals)
- ✅ **Semantic Operations** - Specific functions for each business operation
- ✅ **Validation** - `use_credits()` throws exception if insufficient balance

**Credit Functions:**
```typescript
// Balance query (auto-detects team membership)
const balance = await supabase.rpc('get_user_credit_balance', { p_user_id: userId });

// Credit usage (with validation)
await supabase.rpc('use_credits', {
  p_user_id: userId, p_amount: 10, p_description: 'AI generation'
});

// Credit allocation
await supabase.rpc('allocate_subscription_credits', { p_user_id: userId, p_amount: 300 });
await supabase.rpc('allocate_trial_credits', { p_user_id: userId, p_amount: 30 });

// Credit transfer (user → team)
await supabase.rpc('transfer_all_user_credits_to_team', {
  p_user_id: userId, p_team_id: teamId
});
```

**Removed (2025-10-25):**
- ❌ `get_team_credit_balance()`, `use_team_credits()`, `update_user_credit_balance()`
- ❌ `/team/credits/*` endpoints - Use `/credits/*` (auto-detects team)

**See:** `backend/CREDIT_SYSTEM_CONSOLIDATED.md` for complete details

## Code Style Guidelines

### Universal Patterns

#### Async Operations - ALWAYS Wait for Completion
**CRITICAL**: Never use arbitrary timeouts to wait for operations. Always wait for actual completion events with timeout only as exception fallback.

❌ **Wrong**: `await upload(); await new Promise(r => setTimeout(r, 1000)); // hope it's done?`

✅ **Correct**: Wait for actual event (`onload`, callback, promise resolution) with timeout only for hung/error cases

See `frontend/CLAUDE.md` → "Async Operations Pattern" for detailed examples and implementation.

### Frontend
- **TypeScript**: Strict typing, avoid `any`, use path aliases (`@/*`)
- **Components**: Function components with React hooks, PascalCase names
- **Imports**: React first, external libraries, then local imports
- **Styling**: Tailwind utilities with shadcn/ui components (never modify shadcn components directly)
- **Error Handling**: ErrorBoundary for UI errors, unified notification system
- **Async Operations**: Event-based waiting with exception fallback only (see Universal Patterns above)

### Backend
- **Modules**: ESM syntax (`type: "module"`)
- **Types**: Explicit interfaces, strict null checks
- **Error Handling**: try/catch with context.log.error(), return HttpProblems for API errors
- **Auth**: Extract X-User-Id header, validate Clerk JWT tokens
- **Testing**: @zuplo/test framework with chai assertions
- **Async Operations**: Event-based waiting with exception fallback only (see Universal Patterns above)

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
develop branch → Development (unico-api-develop-b2f4ce8.zuplo.app)
preview branch → QA (unico-api-preview-27dea59.zuplo.app)
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

### Requirements Documentation
- `TEAM_MEMBER_REQUIREMENTS.md` - **Complete team collaboration requirements** (onboarding, roles, permissions, credits, stories)
- `TEAM_INVITATION_REFACTORING_PLAN.md` - Team invitation system refactoring plan
- `TEAM_ONBOARDING_SCENARIOS.md` - Three member onboarding scenarios with test cases
- `FEATURES.md` - Complete feature list

### Frontend Documentation
- `frontend/docs/adr/` - Architecture Decision Records
- `frontend/docs/adr/ADR-009-team-collaboration-architecture.md` - Team collaboration architecture
- `frontend/docs/development/` - Development patterns and guides
- `frontend/CLAUDE.md` - Frontend-specific guidance

### Backend Documentation
- `backend/CREDIT_SYSTEM_CONSOLIDATED.md` - **Credit system architecture** (consolidated ledger model, 2025-10-25)
- `backend/docs-internal/api-reference.md` - API documentation
- `backend/docs-internal/operations/GITOPS-WORKFLOW.md` - GitOps workflow
- `backend/docs-internal/decisions/` - Architecture decisions
- `backend/docs-internal/integrations/` - Integration guides
- `backend/docs-internal/integrations/CLERK-TEAM-INVITATIONS.md` - Clerk-first team invitations
- `backend/docs-internal/integrations/Supabase Team stories.md` - Team story ownership
- `backend/TARGET-STATE-ARCHITECTURE.md` - Target architecture
- `backend/CLAUDE.md` - Backend-specific guidance
- `backend/docs-archive/legacy-credit-system/` - **Archived** legacy credit documentation (do not use)

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
- always use playwright-mcp before playwright