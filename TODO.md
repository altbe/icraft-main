# iCraftStories TODO

**Last Updated:** November 12, 2025
**Project:** iCraftStories Monorepo (Frontend + Backend)

## ✅ CRITICAL BUGS - FIXED (2025-10-30)

### Backend (`backend/`) - ALL COMPLETE

- [x] **✅ FIXED Credit Purchase Handler** - `modules/stripe-checkout-completion.ts:162`
  - **Issue**: Used `verify_and_allocate_payment()` which called non-existent `get_team_credit_balance()`
  - **Impact**: Credit purchases were FAILING for all team members
  - **Fix Applied**: Replaced with `allocate_credits()` + manual idempotency check
  - **Status**: ✅ DEPLOYED TO PRODUCTION (2025-10-30)
  - **Risk**: Team accepted - deployed without testing validation

- [x] **✅ FIXED Webhook Fallback** - `modules/webhook-manager.ts:493`
  - **Issue**: Used `process_credit_purchase_webhook()` which called broken function
  - **Impact**: Webhook fallback was FAILING for team members
  - **Fix Applied**: Replaced with `allocate_credits()` directly
  - **Status**: ✅ DEPLOYED TO PRODUCTION (2025-10-30)

- [x] **✅ DEPRECATED Legacy Webhook** - `/icraft-stripe-webhook`
  - **Action**: Endpoint now returns 410 Gone with migration instructions
  - **Archive**: `backend/legacy-webhooks-archive/` with complete rollback docs
  - **Status**: ✅ DEPRECATED (2025-10-30)
  - **Safe to Remove**: 2026-01-28 (90 days)

- [x] **✅ DROPPED Deprecated Functions** - Database cleanup complete
  - **Action**: Dropped 8 deprecated credit functions from both environments
  - **Migration**: Applied to non-prod and production (2025-10-30)
  - **Validation**: All modern functions operational
  - **Status**: ✅ COMPLETE

**Completion Report**: See `CREDIT_SYSTEM_CLEANUP_COMPLETE.md` for full details
**Executive Summary**: See `EXECUTIVE_SUMMARY.md` for high-level overview
**Completed**: 2025-10-30 (~3 hours total)

---

## 🚨 Critical - Immediate Actions

### Frontend (`frontend/`)
- [ ] **Fix Lint Errors** - 393 remaining lint errors (mostly unused variables)
  - Run `npm run lint:fix` for auto-fixes
  - Blocking CI/CD confidence

- [ ] **Setup Testing Framework** - No tests currently exist
  - Choose framework (Vitest recommended for Vite projects)
  - Add basic component and integration tests
  - Critical for production confidence

### Backend (`backend/`)
- [ ] **Validate Webhook Endpoints** - Test Stripe/Clerk webhooks with Edge Functions
  - Verify Edge Function processes subscription renewals correctly
  - Test with real Stripe test mode transactions
  - Ensure audit logging works

## 📍 High Priority - Next Sprint

### Deployment & Monitoring
- [ ] **Production Deployment** - Deploy recent fixes and SDK upgrades
  - Frontend: Create production tag via `npm run tag:create`
  - Backend: Run `npm run release:production`
  
- [ ] **Performance Monitoring** - Check for regressions from SDK updates
  - Monitor API response times
  - Check frontend bundle size impact
  - Verify PWA offline functionality

### Clerk Integration Optimization
- [ ] **Bidirectional User Metadata Sync** (`add-user-metadata-webhook`)
  - Enhance `/modules/icraft-clerk.ts` webhook
  - Sync preferences between Clerk metadata and `user_profiles.preferences`
  - Current: One-way sync (Clerk → Supabase only)
  - **Effort:** 4-6 hours

- [ ] **Preferences Sync Integration** (`sync-preferences-clerk-local`)
  - Update `/modules/user-preferences.ts` for bidirectional sync
  - Modify frontend to read from Clerk metadata when available
  - **Effort:** 3-4 hours

## 🔧 Medium Priority - Technical Debt

### Code Quality
- [ ] **Remove Custom Invitation UI** (`remove-custom-invitation-ui`)
  - Remove duplicate invitation forms in frontend
  - Keep `team_invitations` table for audit trail
  - Use only Clerk Organizations for team management
  - **Effort:** 2-3 hours

- [ ] **Audit Clerk API Dependencies** (`audit-clerk-api-dependencies`)
  - Review services for unnecessary Clerk API calls
  - Use local cached data where possible
  - Reduce external API dependencies
  - **Effort:** 4-5 hours

## 🎯 Future Enhancements - Backlog

### Legal & Compliance
- [ ] **Terms of Service System** (`implement-tos-system`)
  - Database schema: `terms_of_service`, `tos_acceptances`
  - Bilingual ToS support (EN/ES) with markdown content
  - User acceptance flow (signup, existing users, team invitations)
  - Audit trail for legal compliance
  - Complete implementation plan available
  - **Effort:** 2-3 weeks
  - **Priority:** Medium (compliance)
  - **See:** TOS_IMPLEMENTATION_PLAN.md (comprehensive 787-line plan)

## 🎯 Image Search Enhancements - IN PROGRESS

### Completed (September 7, 2025)
- [x] **Phase 1: Database Foundation**
  - Deployed all schema to prod/non-prod environments
  - Generated and stored 1,196 BGE-M3 embeddings
  - Created 2,392 translations (EN/ES)
  - Added 20 categories with i18n support
  - Deployed `search_custom_images_vector` stored procedure
  - Updated backend API to use new search function

### Next Priority
- [ ] **Phase 2: Query Embeddings**
  - Implement Cloudflare Workers AI with @cf/baai/bge-m3
  - Enable vector search in stored procedure
  - Test multilingual semantic search

- [ ] **Phase 3: Frontend Integration**
  - Update UI components for language toggle
  - Implement client-side caching
  - Add offline support with IndexedDB

## ✅ Recently Completed

### November 2025

#### Double-Submit Prevention Implementation
- [x] **Comprehensive Double-Submit Prevention** - November 12
  - **Problem**: Duplicate authentication emails due to missing form submission debouncing
  - **Components Fixed**: 9 critical components across 8 files
    - Authentication forms (LocalizedAuth.tsx) - Event capture phase interception
    - Payment operations (CreditPurchase, SubscriptionActionHandlers) - 4 methods protected
    - AI operations (AIStoryGenerator, AIImageGenerator) - Credit consumption protection
    - Team operations (TeamInvitationDialog) - Invitation spam prevention
    - Community features (ShareStoryDialog) - Credit reward protection
    - TTS operations (StoryPreviewPage) - Text-to-speech API protection
  - **Pattern**: Synchronous ref-based state tracking with time-based debouncing
  - **Testing**: TypeScript compilation successful, no errors
  - **Documentation**: `DOUBLE_SUBMIT_PREVENTION_SUMMARY.md`
  - **Metrics**: ~300 lines added, 12+ operations protected

### October 2025

#### Team Collaboration Features
- [x] **Story & Credit Transfer Implementation** - October 20-24
  - Automatic transfer on team invitation acceptance
  - Database stored procedure `onboard_team_member()` deployed
  - Story transfer audit table `story_transfers` created
  - Non-prod migration executed (4 users, 143 stories, 1 subscription)
  - Information consolidated into `TEAM_MEMBER_REQUIREMENTS.md`

- [x] **One-Team-Per-User Enforcement** - October 23
  - Database stored procedure `check_user_team_membership_by_email()`
  - Pre-flight validation before sending invitations
  - Frontend/backend error handling with team metadata
  - Zod-based security enhancements (XSS, injection prevention)
  - Progressive real-time UX with validation feedback

- [x] **Subscription Upgrade Transfer Detection** - October 24
  - Stripe webhook detects plan upgrades (individual → team/custom)
  - Automatic `onboard_team_member()` trigger on upgrade
  - Frontend confirmation dialogs and success notifications

#### Documentation & Code Cleanup
- [x] **SQL File Archiving** - October 26
  - Archived 8 obsolete SQL files to `backend/sql/archive/`
  - Created comprehensive `backend/sql/README.md`
  - Added deprecation headers to 3 reference files
  - Documented active vs. reference files (83% obsolete code removed)

- [x] **Documentation Archiving** - October 26
  - Archived 48 completed documentation files across all repos
  - Main repo: 39 files (CRISP, team collaboration, subscription, etc.)
  - Backend: 8 files (migrations, audits, features)
  - Frontend: 5 files (analyses)
  - Created quarterly archive structure (2025-Q3, 2025-Q4)
  - Reduced root directory by 46% (24 → 13 files)

- [x] **MLX Experiments Archiving** - October 26
  - Archived 8 incomplete MLX files to `backend/mlx-archive/`
  - Documented supersession by cloud solutions (vLLM, BGE-M3)
  - Updated CLAUDE.md with accurate implementation status
  - Main processing script never committed, experiments incomplete

- [x] **Documentation Audits** - October 26
  - Created `SQL_AUDIT_REPORT.md` (34 functions in files, 83% obsolete)
  - Created `DOCUMENTATION_AUDIT_2025-10-26.md` (154 files reviewed)
  - Created `TOP_LEVEL_DOCS_REVIEW.md` (24 files analyzed)
  - Created `REMAINING_DOCS_ANALYSIS.md` (13 final files reviewed)

### September 2025
- [x] Image Search Database Migration - September 7
  - BGE-M3 embeddings for 1,196 images
  - Full i18n support with translations
  - Vector search infrastructure ready
- [x] CLERK_WEBHOOK_ICRAFT configured in Zuplo - September 1
- [x] Clerk v5 Migration verified (v5.45.0) - September 1
- [x] Backend API Compilation verified - September 1
- [x] React Hooks Violation fixed in CanvasPreview.tsx - September 1

### January 2025
- [x] SDK upgrades (Clerk, Stripe, Supabase) - January 28, 2025
- [x] Credit Transfer Feature - Complete implementation
  - Backend endpoints and validation
  - Frontend dialog and history components
  - Team creation integration
- [x] API Misalignment Fixes
  - Fixed subscription endpoint paths
  - Fixed team credit endpoint structure
  - Standardized device headers

## 📊 Progress Overview

**Active Tasks:** 9
**Completed Tasks:** 34
**Completion Rate:** 79%

### By Category:
- **Critical Issues:** 3 pending
- **Integration:** 4 pending (all Clerk-related)
- **Deployment:** 1 pending
- **Infrastructure:** ✅ All complete (Stripe, Teams, Credits)
- **Team Features:** ✅ All complete (Story/Credit Transfer, One-Team Enforcement)
- **Documentation:** ✅ Major cleanup complete (64 files archived)

## 🎯 Sprint Planning Recommendations

### Sprint 1 (This Week)
1. Fix frontend lint errors (enable CI/CD)
2. Validate webhook endpoints
3. Deploy to production

### Sprint 2 (Next Week)
1. Setup frontend testing framework
2. Implement bidirectional Clerk sync
3. Performance monitoring setup

### Sprint 3 (Following Week)
1. Code cleanup (remove duplicate UI)
2. API dependency audit
3. Documentation updates

## 📝 Notes

- **Focus on stability first** - Fix lint/test issues before new features
- **Monitor production closely** after SDK upgrades deployment
- **Clerk optimizations** are nice-to-have but not critical (existing sync works)
- **Keep audit tables** even when removing duplicate UI components

---

*Use this file for active development tracking. Historical context available in git history.*