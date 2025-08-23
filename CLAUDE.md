# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**iCraftStories** - Full-stack AI-powered illustrated story creation platform with team collaboration, offline-first PWA architecture, and multi-language support.

- **Frontend**: `icraft-front-v8/` - React PWA with TypeScript, Konva canvas, IndexedDB sync
- **Backend**: `unico-api/` - Zuplo API Gateway (BFF architecture) with Supabase + Stripe integration

## Development Commands

### Frontend (`icraft-front-v8/`)
```bash
cd icraft-front-v8
npm run dev          # Start Vite development server (port 3000)
npm run build        # Build for production (includes typecheck)
npm run compile      # TypeScript compilation check only
npm run lint         # Run ESLint checks
npm run lint:fix     # Fix ESLint issues automatically
npm run preview      # Preview production build locally

# Deployment (Cloudflare Workers)
npm run deploy:dev   # Deploy to development environment
npm run deploy:qa    # Deploy to QA environment
npm run deploy:prod  # Deploy to production environment
npm run tag:create   # Create deployment tags for QA/production
npm run tag:status   # Check deployment status across environments
```

### Backend (`unico-api/`)
```bash
cd unico-api
npm run dev          # Start Zuplo development server (includes clean + compile)
npm run test         # Run Zuplo test suite (includes clean + compile)
npm run compile      # TypeScript compilation check only
npm run clean        # Remove build artifacts (dist/ directory)

# GitOps Deployment (Zuplo automatically deploys branches)
npm run promote:qa                    # develop → QA
npm run release:production            # QA → production
npm run reset:dev-from-production     # Reset dev to match production
npm run reset:qa-from-production      # Reset QA to match production
npm run reset:dev-from-qa            # Reset dev to match QA
npm run rollback:production <tag>     # Rollback to specific release tag

# Hotfix Workflow
npm run hotfix:create <name>         # Create hotfix branch
npm run hotfix:test <name>           # Test hotfix in QA
npm run hotfix:deploy <name>         # Deploy hotfix to production
```

## Architecture Overview

### Frontend Stack
- **Framework**: React 18.3.1 + TypeScript + Vite 6.1.0
- **Deployment**: Cloudflare Workers with static assets
- **PWA**: VitePWA with service workers, offline-first IndexedDB storage
- **UI**: Tailwind CSS + shadcn/ui components
- **Canvas**: Konva.js for interactive story editing
- **Auth**: Clerk React for user management
- **State**: React hooks + RxJS for reactive programming
- **i18n**: i18next with English/Spanish support
- **Storage**: IndexedDB with sync capabilities to backend
- **Payments**: Stripe for subscriptions and credit purchases

### Backend Stack
- **Gateway**: Zuplo API Gateway (Backend-for-Frontend architecture)
- **Runtime**: Node.js 22+ with TypeScript ESM modules
- **Database**: Supabase (PostgreSQL) with Stripe wrapper integration
- **Auth**: Clerk JWT validation at API level (not database RLS)
- **AI Services**: OpenAI GPT, Stability AI, ElevenLabs via Cloudflare AI Gateway
- **Storage**: Cloudflare R2 for images and audio assets
- **Payments**: Stripe with direct database integration via Supabase wrapper

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
- **API Health**: Always check API availability before service calls using `@/lib/api-client` helpers

### Backend
- **Modules**: ESM syntax (`type: "module"`)
- **Types**: Explicit interfaces, strict null checks
- **Error Handling**: try/catch with context.log.error(), return HttpProblems for API errors
- **Auth**: Extract X-User-Id header, validate Clerk JWT tokens
- **Testing**: @zuplo/test framework with chai assertions

## Critical Integration Points

### API Health Monitoring
All frontend services must integrate with health monitoring:

```typescript
import { isApiServiceDown, checkApiAvailability, handleApiUnavailable } from '@/lib/api-client';

// Read operations - return fallbacks
async getPlans(): Promise<SubscriptionPlan[]> {
  if (isApiServiceDown()) {
    return handleApiUnavailable('ServiceName', 'methodName', []);
  }
  // ... API call
}

// Write operations - throw clear errors
async createSubscription(): Promise<void> {
  checkApiAvailability('ServiceName', 'methodName');
  // ... API call
}
```

### Supabase Projects
- **Production**: `icraft prod` (lgkjfymwvhcjvfkuidis.supabase.co)
- **Legacy**: `icraftstories.com` (jjpbogjufnqzsgiiaqwn.supabase.co) - backup only

### Environment Configuration
- Frontend: Copy `.env.example` and configure Clerk, API endpoints
- Backend: Configure in `local-config/api-keys.json` for Supabase, Stripe, AI services

## Common Development Patterns

1. **Sync-First Operations**: Check sync status before major operations
2. **Credit Validation**: Verify credits before AI operations
3. **Offline Graceful Degradation**: Handle API unavailability with local fallbacks  
4. **Team Context**: Pass team_id for team-owned resources
5. **Internationalization**: Use i18next keys, support English/Spanish
6. **Canvas State Management**: Persist Konva state changes to IndexedDB
7. **Service Worker Caching**: Leverage PWA caching for offline image access

## Testing

- **Frontend**: No test framework configured (development needed)
- **Backend**: Zuplo test framework with endpoint testing in `tests/` directory
- **API Testing**: Use Bruno collection in `bruno/unico.health/`

## Documentation

- **Architecture Decisions**: See `icraft-front-v8/docs/adr/` for detailed ADRs
- **API Reference**: `unico-api/docs-internal/api-reference.md`
- **Sync Documentation**: `icraft-front-v8/docs/SYNC.md`
- **Target Architecture**: `unico-api/TARGET-STATE-ARCHITECTURE.md`

## Webhook Infrastructure and Sync Implementation

### Current Webhook Status (Verified June 2025)
- ✅ **User Lifecycle Webhooks**: Complete implementation in `unico-api/modules/icraft-clerk.ts`
  - `user.created`, `user.updated`, `user.deleted` events handled
  - Creates user profiles with default credits and settings
- ✅ **Organization Webhooks**: Team membership sync via `unico-api/modules/clerk-organization-webhooks.ts`
- ✅ **Stripe Integration Webhooks**: User creation with Stripe customer setup

### Sync Architecture
- **Unidirectional Sync**: Clerk → Supabase (implemented)
- **Bidirectional Preference Sync**: Not yet implemented (see TODO list)
- **Conflict Resolution**: Last-write-wins for user data
- **Audit Trail**: All user changes logged in Supabase with timestamps

### Webhook Testing
- Test webhook handler: `unico-api/rerunClerkWebhook.js`
- Webhook routes configured in `unico-api/config/routes.oas.json`

## Data Auditing and Record Keeping

✅ **Current Implementation:**
- Local audit tables in Supabase track all user and team events
- Critical Clerk user/team metadata mirrored in application database  
- Webhook-driven sync ensures real-time data consistency
- Complete audit trails for creation, modification, and deletion events
- GDPR compliance through comprehensive activity logging

⏳ **Pending Enhancements:**
- Bidirectional preference sync between Clerk metadata and local storage
- Enhanced consistency checks for missed webhook events