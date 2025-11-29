# iCraftStories TODO

**Last Updated:** November 29, 2025
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

**Completion Report**: See `docs-archive/2025-Q4-credit-system-cleanup/CREDIT_SYSTEM_CLEANUP_COMPLETE.md`
**Executive Summary**: See `docs-archive/2025-Q4-credit-system-cleanup/EXECUTIVE_SUMMARY.md`
**Completed**: 2025-10-30 (~3 hours total)

---

## 🚨 Critical - Immediate Actions

### Frontend (`frontend/`)
- [ ] **Crisp Chat Resilience** - Add retry logic and reduce log severity
  - Reduce Crisp chat error logs from error to warn/debug level
  - Add retry logic for Crisp SDK load failures
  - Handle "Invalid data" errors gracefully with session recovery
  - **Sentry Issues**: ICRAFT-FRONT-7A/7B/7C (153 events in 24h)
  - **Effort**: 1-2 hours

- [ ] **Database Init Log Noise** - Reduce "Already initialized" warnings
  - Change duplicate initialization logs from warn to debug
  - DatabaseService reports 451 events in 24h for expected behavior
  - **Effort**: 30 minutes

- [ ] **Service Worker Update Notifications** - Reduce log severity
  - SW update notifications generating 72 events in 24h
  - Consider moving to debug level or reducing frequency
  - **Effort**: 30 minutes

- [ ] **Sync Service Log Noise** - Reduce background sync info logs
  - SimplifiedSyncService generating 110 info events in 24h
  - Move routine sync logs to debug level
  - **Effort**: 30 minutes

- [x] **Fix Lint Errors** - ✅ COMPLETED (November 16, 2025)
  - Reduced from 596 errors to 0 errors, 254 warnings
  - Enabled ESLint caching (`--cache` flag) for faster linting
  - Enabled TypeScript incremental compilation for faster builds
  - Build optimizations: lint now runs as part of build script
  - CI/CD no longer blocked by lint errors
  - **Commits**: 008a365, 0eb7315, 12d47a8, f652078, 3157da7

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
- [ ] **Setup Testing Framework** - No tests currently exist
  - Choose framework (Vitest recommended for Vite projects)
  - Add basic component and integration tests
  - Would improve production confidence but not blocking
  - **Effort:** 1-2 weeks for comprehensive test suite

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

### Administrative Features (Gaps from FEATURES audit)
- [ ] **Story Approval Workflow UI** - Database has `is_approved` field but no UI
  - Create moderator dashboard to view pending stories
  - Add approve/reject actions
  - Currently: Stories auto-approved on sharing
  - **Effort:** 1-2 weeks
  - **Priority:** Low (moderation)

- [ ] **PWA App Shortcuts** - Not configured in manifest
  - Add shortcuts array to VitePWA config
  - Quick actions: "Create Story", "My Library"
  - **Effort:** 30 minutes
  - **Priority:** Low (UX enhancement)
  - **See:** `STRATEGIC_ENHANCEMENTS.md`

### Performance Optimizations
- [ ] **CDN Image Transformation** - See `STRATEGIC_ENHANCEMENTS.md`
  - Cloudflare Worker for on-the-fly resizing
  - Thumbnails (300×300), previews (800×800)
  - WebP conversion, quality optimization
  - **Effort:** 1-2 days
  - **Priority:** Low (performance)

## 🎯 Image Search Enhancements - ✅ COMPLETE

### All Phases Complete (November 2025)
- [x] **Phase 1: Database Foundation** - September 2025
  - Deployed all schema to prod/non-prod environments
  - Generated and stored 1,196 BGE-M3 embeddings (1024 dimensions)
  - Created 2,392 translations (EN/ES)
  - Added 20 categories with i18n support
  - Deployed `search_custom_images_vector` stored procedure

- [x] **Phase 2: Query Embeddings** - November 2025
  - Cloudflare Workers AI with @cf/baai/bge-m3 (`icraft-embeddings.ts`)
  - Real-time query embedding generation
  - Graceful fallback to text search

- [x] **Phase 3: Frontend Integration** - November 2025
  - ImageProxyService with rate limiting (100 req/60s)
  - Client-side caching (IndexedDB + localStorage, 24h TTL)
  - UnifiedImageSearch component with categories

**Future Enhancement**: CDN image transformation (see `STRATEGIC_ENHANCEMENTS.md`)

## ✅ Recently Completed

### November 2025

#### Internationalization & Language Support Enhancements
- [x] **URL-Based Language Switching** - November 29
  - **Feature**: Added `?lng=es` and `?lng=en` URL parameters for direct language access
  - **Fix**: Corrected i18next initialization to allow LanguageDetector to work properly
  - **Issue**: In incognito mode, explicit `lng` setting overrode URL parameter detection
  - **Solution**: Removed hardcoded `lng` from i18next init, let LanguageDetector handle detection
  - **Detection Order**: querystring (?lng=es) → localStorage → navigator browser language
  - **File**: `frontend/src/i18n.ts`

- [x] **Multilingual TTS Support** - November 29
  - **Feature**: ElevenLabs text-to-speech now supports Spanish stories
  - **Change**: Upgraded from `eleven_monolingual_v1` to `eleven_turbo_v2_5` model
  - **Capability**: Auto-detects language from text (32 languages supported)
  - **Benefits**: ~50% faster latency, lower cost, same voice quality
  - **File**: `backend/modules/icraft-genAi.ts:2347`

#### Admin Features Implementation
- [x] **User Management Dashboard & Custom Plan Eligibility** - November 26, 2025
  - **Backend**: Admin authorization pattern with `requireAdminUser()` utility
    - Centralized auth check using Supabase Admin API
    - Database-backed role verification from `user_profiles.is_admin`
    - Consistent pattern across all admin endpoints
  - **Backend Endpoints**: User management and eligibility APIs
    - `GET /admin/users` - List users with search and pagination
    - `GET /admin/users/:userId` - Get user details
    - `GET /admin/eligibility` - List custom plan eligibility grants
    - `POST /admin/eligibility` - Grant custom plan access
    - `DELETE /admin/eligibility/:eligibilityId` - Revoke eligibility
  - **Frontend Dashboard**: Comprehensive admin interface (`AdminDashboard.tsx`)
    - Real-time search across email, name, and team
    - Stats dashboard (total users, active subscriptions, team members, admins)
    - User table with subscription status, team affiliation, credits, activity timestamps
    - Color-coded subscription badges (trial, active, canceled, past_due)
  - **Custom Plan Eligibility**: Invite-only subscription management
    - Grant/revoke access to custom plans (e.g., Custom 30)
    - Eligibility tracking with optional expiration dates
    - Admin notes for sales context
    - Search and filter grants by email, plan type, notes
  - **Documentation**: Updated FEATURES.md, backend CLAUDE.md, API reference
  - **Status**: ✅ FULLY IMPLEMENTED

#### Terms of Service System
- [x] **TOS Implementation Complete** - October 2025
  - Database: `terms_of_service` and `tos_acceptances` tables deployed
  - Backend: `tos-service.ts` module with 4 API endpoints
  - Frontend: `TosAcceptanceDialog.tsx` component with bilingual support (EN/ES)
  - Production: Version 2.0 active with 11 user acceptances
  - Team invitation flow integration complete
  - **Status**: ✅ FULLY IMPLEMENTED

#### Backend Infrastructure & Bug Fixes
- [x] **SVG Dimension Fix** - November 18
  - **Problem**: 3,519 SVG records stored incorrect 1024×1024 dimensions instead of actual viewBox dimensions
  - **Impact**: Transparent padding on canvas, incorrect aspect ratios
  - **Solution**: Automated workflow to backfill historical data + prevention enhancement
  - **Scripts**: 6 new automation scripts in `backend/scripts/`
  - **Prevention**: Enhanced `unified-image-processor.py` with automatic SVG dimension extraction
  - **Environments**: ✅ PROD (3,519 records) | ✅ NON-PROD (3,519 records)
  - **Verification**: 0 records remaining with incorrect dimensions
  - **Documentation**: `SVG_DIMENSION_FIX_SUMMARY.md`, `backend/docs-internal/operations/SVG-DIMENSION-FIX.md`
  - **Status**: ✅ COMPLETE - Future uploads automatically handled

#### Frontend SEO & Growth Optimization
- [x] **Comprehensive SEO Implementation** - November 15
  - **Features**: JSON-LD structured data, dynamic language detection, enhanced sitemaps
  - **Analytics**: Complete tracking system (`src/lib/analytics.ts` - 195 lines)
  - **Sitemap**: 712 lines added to `public/sitemap.xml`
  - **Documentation**: `docs/seo/SEO_IMPLEMENTATION_SUMMARY.md`, `docs/seo/URL_SLUG_IMPLEMENTATION.md`
  - **Impact**: Production-ready SEO for search engines and social media sharing

#### Security Hardening
- [x] **OWASP Top 10 Security Review** - November 15
  - **Review**: Comprehensive 963-line security report (`SECURITY_REVIEW_REPORT.md`)
  - **Fixes**: Removed sensitive data from debug logs (OWASP A09 compliance)
  - **Scope**: Service worker extension, axios config, authentication flows
  - **Status**: ✅ Production-ready with documented mitigations

#### Accessibility & UX Improvements
- [x] **WCAG 2.1 AA Compliance** - November 2025
  - **Features**: ADHD/neurodiversity-friendly color scheme
  - **Fonts**: Dyslexia-friendly system (Lexend, Atkinson Hyperlegible)
  - **PDF Exports**: Custom font support with legal page enhancements
  - **Components**: New `LicensesPage.tsx`, enhanced legal pages
  - **Impact**: Inclusive design for users with ADHD, autism, dyslexia

#### PWA & Performance
- [x] **iOS PWA Installation Fixes** - November 2025
  - **Fixes**: iOS Safari support, installation prompts
  - **Performance**: PageSpeed mobile optimization
  - **Service Worker**: WWW subdomain bypass for Cloudflare redirects
  - **Offline**: Fixed offline errors after PWA updates
  - **Impact**: Better mobile experience, faster load times

#### Crisp Chat Integration
- [x] **Enhanced Chat Widget** - November 2025
  - **Features**: Context-aware pre-canned questions, picker interactions
  - **State Management**: Better visibility and state coordination
  - **Features**: Reset chat, microphone permissions for voice messages
  - **Impact**: Improved customer support experience

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

**Active Tasks:** 11
**Completed Tasks:** 45 (4 new in November 2025)
**Completion Rate:** 80%

### By Category:
- **Critical Issues:** 1 pending (webhook validation)
- **Integration:** 4 pending (all Clerk-related)
- **Deployment:** 1 pending
- **Infrastructure:** ✅ All complete (Stripe, Teams, Credits)
- **Team Features:** ✅ All complete (Story/Credit Transfer, One-Team Enforcement)
- **Frontend Features:** ✅ SEO, Security, Accessibility, PWA (92%), Crisp Chat, Lint/Build Optimization
- **Image Search:** ✅ All phases complete (Nov 2025)
- **Admin Features:** ✅ User Management & Custom Plan Eligibility complete (Nov 2025); 2 pending (story approval UI, PWA app shortcuts)
- **Documentation:** ✅ Major cleanup complete (99 files archived)

## 🎯 Sprint Planning Recommendations

### Sprint 1 (This Week)
1. ✅ Fix frontend lint errors (COMPLETED - November 16, 2025)
2. Validate webhook endpoints
3. Deploy to production (includes recent lint/build optimizations)

### Sprint 2 (Next Week)
1. Implement bidirectional Clerk sync
2. Performance monitoring setup
3. Code cleanup (remove duplicate UI)

### Sprint 3 (Following Week)
1. API dependency audit
2. Documentation updates
3. Testing framework (optional - moved to medium priority)

## 📝 Notes

- **Lint issues resolved** - 0 errors, build optimizations complete (Nov 16, 2025)
- **Testing framework** - Moved to medium priority, not blocking production
- **Monitor production closely** after SDK upgrades deployment
- **Clerk optimizations** are nice-to-have but not critical (existing sync works)
- **Keep audit tables** even when removing duplicate UI components

---

*Use this file for active development tracking. Historical context available in git history.*