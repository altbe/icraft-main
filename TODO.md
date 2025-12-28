# iCraftStories TODO

**Last Updated:** December 28, 2025
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
  - **Archive**: `backend/docs-archive/2025-Q4-webhook-migration/` with migration docs
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
- [x] **Crisp Chat Resilience** - ✅ COMPLETED (December 2025)
  - Deferred Crisp loading and migrated console statements to logger
  - Added retry logic for SDK load failures
  - **Commit**: 365dbce
  - **Verified**: 0 Crisp errors in Sentry (7-day check Dec 28)

- [x] **Database Init Log Noise** - ✅ COMPLETED (December 2025)
  - Reduced IndexedDB error cascade and sync noise
  - Changed IndexedDB-related logs from error to warn
  - Reduced iOS Safari IndexedDB validation log noise
  - **Commits**: a386c41, d655a9d, f902ba2
  - **Verified**: 0 IndexedDB errors in Sentry (7-day check Dec 28)

- [x] **Service Worker Update Notifications** - ✅ COMPLETED (December 2025)
  - Log severity reduced with above IndexedDB fixes
  - **Verified**: No related Sentry issues

- [x] **Sync Service Log Noise** - ✅ COMPLETED (December 2025)
  - Filtered canceled sync requests in SimplifiedSyncService
  - **Commit**: 37b7079
  - **Verified**: No related Sentry issues

- [x] **Fix Lint Errors** - ✅ COMPLETED (November 16, 2025)
  - Reduced from 596 errors to 0 errors, 254 warnings
  - Enabled ESLint caching (`--cache` flag) for faster linting
  - Enabled TypeScript incremental compilation for faster builds
  - Build optimizations: lint now runs as part of build script
  - CI/CD no longer blocked by lint errors
  - **Commits**: 008a365, 0eb7315, 12d47a8, f652078, 3157da7

### Backend (`backend/`)
- [x] **Validate Webhook Endpoints** - ✅ VALIDATED (December 28, 2025)
  - Edge Functions ACTIVE: `stripe-webhook` (v24), `clerk-webhook` (v15)
  - Recent payments processing successfully (4/5 succeeded, 1 card declined - expected)
  - 9 active subscriptions confirmed in database
  - **Validated via**: Supabase MCP + Stripe MCP

## 📍 High Priority - Next Sprint

### Clerk Integration - ✅ VALIDATED (December 28, 2025)

**Architecture Review Complete** - Current one-way sync is correct:
- Clerk is authoritative for **identity** (auth, email, name)
- Supabase is authoritative for **application data** (preferences, language, stories)
- No duplication or sync conflicts

**Validated via MCP tools:**
- All Clerk users have matching Supabase profiles (email, display_name synced correctly)
- `clerk-webhook` Edge Function (v15) handles user lifecycle events
- Preferences API (`GET/PATCH /users/preferences`) fully functional
- Clerk `public_metadata`/`unsafe_metadata` intentionally unused (Supabase is SSOT)

- [x] **Bidirectional User Metadata Sync** - ⚪ NOT NEEDED
  - **Analysis**: Clerk metadata is unused (empty `{}` for all users)
  - **Reason**: Supabase is single source of truth for preferences
  - **Current State**: One-way sync (Clerk → Supabase) is correct architecture
  - **Decision**: Removed from backlog - adds complexity without user benefit

- [x] **Preferences Sync Integration** - ✅ ALREADY WORKING
  - **Backend**: `user-preferences.ts` with `GET/PATCH /users/preferences` endpoints
  - **Frontend**: `UserPreferencesService.ts` calls API endpoints
  - **Database**: `user_profiles.preferences` JSONB column exists
  - **Decision**: Marked complete - implementation exists and works

## 🔧 Medium Priority - Technical Debt

### Code Quality
- [ ] **Setup Testing Framework** - No tests currently exist
  - Choose framework (Vitest recommended for Vite projects)
  - Add basic component and integration tests
  - Would improve production confidence but not blocking
  - **Effort:** 1-2 weeks for comprehensive test suite

- [x] **Custom Invitation UI** - ✅ VALIDATED (December 28, 2025)
  - **Finding**: UI is NOT duplicate - it wraps Clerk Organizations API
  - **Architecture**: Frontend → Backend (`clerk-team-invitations.ts`) → Clerk API
  - **Database**: `team_invitations` table NOT used for invitations (Clerk is SSOT)
  - **Benefits**: Custom styling, real-time validation, our notification system
  - **Alternative**: Could use Clerk's `<OrganizationProfile>` component (UX preference, not necessity)
  - **Decision**: No changes needed - current architecture is correct

- [x] **Audit Clerk API Dependencies** - ✅ COMPLETED (December 28, 2025)
  - **Backend**: 12 Clerk API endpoints used across 3 modules
  - **Finding**: 1 redundant call in `getUserTeams()` (team-management.ts:126-159)
    - Makes both database query AND Clerk API call, then merges results
    - Clerk call is redundant - database is authoritative via webhook sync
    - **Recommendation**: Remove Clerk API call, use only database query
  - **Frontend**: Optimized - uses only Clerk SDK hooks (cached internally)
  - **Essential calls** (keep): lazy profile creation, session revocation, invitations
  - **Decision**: Minor optimization available, not critical

## 🎯 Future Enhancements - Backlog

### Administrative Features (Gaps from FEATURES audit)
- [ ] **Story Approval Workflow UI** - Database has `is_approved` field but no UI
  - Create moderator dashboard to view pending stories
  - Add approve/reject actions
  - Currently: Stories auto-approved on sharing
  - **Effort:** 1-2 weeks
  - **Priority:** Low (moderation)

- [x] **PWA App Shortcuts** - ✅ COMPLETED (December 28, 2025)
  - Added shortcuts array to VitePWA manifest config
  - "Create Story" shortcut → `/library?action=create` with plus.png icon
  - "My Library" shortcut → `/library` with library.png icon
  - StoryLibrary handles `?action=create` to trigger story creation
  - **Files**: `vite.config.ts`, `src/components/StoryLibrary.tsx`

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
  - **Documentation**: `backend/docs-internal/operations/SVG-DIMENSION-FIX.md`
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

**Active Tasks:** 4
**Completed Tasks:** 55 (10 new in December 2025)
**Completion Rate:** 93%

### By Category:
- **Critical Issues:** ✅ All complete (log noise fixed Dec 2025)
- **Backend Validation:** ✅ Complete (webhooks validated Dec 28, 2025)
- **Integration:** ✅ Clerk validated (Dec 28, 2025) - sync correct, invitation UI wraps Clerk API
- **Infrastructure:** ✅ All complete (Stripe, Teams, Credits)
- **Team Features:** ✅ All complete (Story/Credit Transfer, One-Team Enforcement)
- **Frontend Features:** ✅ SEO, Security, Accessibility, PWA, Crisp Chat, Lint/Build, Log Noise
- **Image Search:** ✅ All phases complete (Nov 2025)
- **Admin Features:** ✅ User Management & Custom Plan Eligibility complete (Nov 2025); 1 pending (story approval UI)
- **Documentation:** ✅ Major cleanup complete (99 files archived, obsolete refs fixed Dec 2025)

## 🎯 Next Actions

### High Priority
1. Remove deprecated `/icraft-stripe-webhook` endpoint (safe after 2026-01-28)

### Medium Priority
1. Remove redundant Clerk API call in `getUserTeams()` (optional optimization)

### Backlog
1. Testing framework setup
2. Story approval workflow UI
3. CDN image transformation

## 📝 Notes

- **Log noise issues resolved** - Crisp, IndexedDB, Sync all fixed (Dec 2025)
- **Lint issues resolved** - 0 errors, build optimizations complete (Nov 16, 2025)
- **Testing framework** - Moved to backlog, not blocking production
- **Clerk sync validated** - One-way sync (Clerk → Supabase) is correct architecture (Dec 28, 2025)
  - Bidirectional sync NOT needed - Supabase is SSOT for preferences
  - Preferences API already working via `/users/preferences` endpoints
- **Deprecated webhook** - Safe to remove after 2026-01-28 (90-day grace period)
- **Custom invitation UI validated** - NOT duplicate, wraps Clerk Organizations API (Dec 28, 2025)
  - `team_invitations` table NOT used for invitations - Clerk is SSOT
- **Clerk API audit complete** - 12 endpoints used, 1 redundant call identified (Dec 28, 2025)
  - Frontend optimized (uses Clerk SDK caching)
  - Minor optimization available in `getUserTeams()` (not critical)
- **PWA App Shortcuts** - Added "Create Story" and "My Library" quick actions (Dec 28, 2025)
  - Works on Android, Chrome, Edge - long-press app icon to see shortcuts

---

*Use this file for active development tracking. Historical context available in git history.*