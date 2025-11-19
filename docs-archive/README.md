# Documentation Archive

**Purpose**: Archive of completed project documentation (features, migrations, implementations)

**Archive Policy**: Documentation is moved here after:
- Feature/project completion (30+ days stable)
- Migration successfully deployed to production
- Implementation verified and stabilized
- Active reference period ended

**Retention**: Archived docs are kept indefinitely for historical reference but are not actively maintained.

---

## Archive Structure

### 2025-Q4-credit-system-cleanup/ (8 files) **NEW**
**Status**: ✅ Complete - Production deployed 2025-10-30
**Period**: October 2025
**Archive Date**: 2025-11-19
**Summary**: Credit system cleanup including bug fixes, legacy deprecation, and database cleanup

#### Files:
- `CREDIT_ENDPOINTS_FULLY_CONSOLIDATED.md` - Endpoint consolidation report
- `CREDIT_HISTORY_CONSOLIDATION.md` - History consolidation details
- `CREDIT_SYSTEM_CLEANUP_COMPLETE.md` - Final completion report
- `CREDIT_SYSTEM_CLEANUP_PLAN.md` - Original cleanup plan
- `CREDIT_SYSTEM_CLEANUP_PROGRESS.md` - Progress tracking
- `CREDIT_SYSTEM_CLEANUP_SESSION_SUMMARY.md` - Session summary
- `CREDIT_SYSTEM_CONSOLIDATION_PLAN.md` - Consolidation strategy
- `EXECUTIVE_SUMMARY.md` - High-level summary for stakeholders

---

### 2025-Q4-stripe-automation/ (10 files) **UPDATED**
**Status**: ✅ Complete - Phases 1-3 deployed November 2025
**Period**: November 2025
**Archive Date**: 2025-11-19
**Summary**: Stripe webhook automation, dispute handling, Custom 30 plan, and architecture proposals

#### Files:
- `STRIPE_EVENT_AUTOMATION_COMPREHENSIVE_PLAN.md` - Full automation plan
- `STRIPE_EVENT_AUTOMATION_IMPLEMENTATION_COMPLETE.md` - Implementation report
- `STRIPE_INTEGRATION_DEPLOYMENT.md` - Deployment procedures
- `STRIPE_INTEGRATION_IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `STRIPE_DISPUTE_CHARGEBACK_ANALYSIS.md` - Dispute analysis
- `STRIPE_DISPUTE_IMPLEMENTATION_COMPLETE.md` - Dispute handling
- `CUSTOM_30_CONFIGURATION_SUMMARY.md` - Custom 30 configuration
- `CUSTOM_30_MCP_EXECUTION_PLAN.md` - MCP execution plan
- `CUSTOM_30_PLAN_IMPLEMENTATION.md` - Implementation details
- `STRIPE_INTEGRATION_V2.md` - Clean-slate architecture proposal (NOT implemented - valuable enhancements moved to STRATEGIC_ENHANCEMENTS.md)

---

### 2025-Q4-completed-implementations/ (23 files) **UPDATED**
**Status**: ✅ Complete - Various Q4 2025 implementations
**Period**: October-November 2025
**Archive Date**: 2025-11-19
**Summary**: Bug fixes, feature implementations, migration plans, and system reviews

#### Files:
- Trial/Subscription: `TRIAL_TO_ACTIVE_CREDIT_FIX_*.md`, `SUBSCRIPTION_REDESIGN_PROPOSAL.md`
- Audits: `AUDIT_TRAIL_IMPLEMENTATION_COMPLETE.md`, `ROUTES_AUDIT_FINDINGS.md`, `WEBHOOK_VALIDATION_REPORT.md`
- Bug Fixes: `FRONTEND_*.md`, `OFFLINE_STATUS_FIX.md`, `TEAM_*.md`
- Implementations: `CLERK_TICKET_STRATEGY_IMPLEMENTATION.md`, `PHASE_*.md`
- Reference: `LOCAL_VLLM_SETUP_SUMMARY.md`, `COMMUNITY_STORIES_*.md`
- `SUPABASE_STRIPE_INTEGRATION_REVIEW.md` - Point-in-time database review (October 2025)
- `TOS_IMPLEMENTATION_PLAN.md` - Terms of Service system (✅ FULLY IMPLEMENTED - v2.0 deployed October 2025)

---

### 2025-Q4-story-credit-transfer/ (8 files)
**Status**: ✅ Complete - Story and credit transfer fully implemented
**Period**: October 2025
**Archive Date**: 2025-10-26
**Summary**: Complete implementation of automatic story and credit transfer on team join/upgrade

#### Files:
- `STORY_TRANSFER_IMPLEMENTATION_PLAN.md` - Complete implementation guide (1058 lines)
- `STORY_TRANSFER_QUICK_START.md` - Quick start guide for implementation (239 lines)
- `PRIORITY_1_2_COMPLETION_STATUS.md` - Priority 1 & 2 completion report (267 lines)
- `ONE_TEAM_PER_USER_SOLUTION.md` - One-team-per-user enforcement solution (362 lines)
- `STORY_CREDIT_TRANSFER_GAP_ANALYSIS.md` - Gap analysis for transfer implementation (361 lines)
- `TEAM_ONBOARDING_SCENARIOS.md` - Three onboarding scenarios documentation (386 lines)
- `TEAM_INVITATION_REFACTORING_PLAN.md` - Team invitation refactoring plan (966 lines)
- `NON_PROD_DATA_MIGRATION_PLAN.md` - Non-prod data migration executed 2025-10-24 (594 lines)

**Key Achievements**:
- Automatic transfer of ALL stories and credits on team join
- Database stored procedure `onboard_team_member()` deployed
- Story transfer audit table `story_transfers` created
- Non-prod migration successfully executed (4 users, 143 stories, 1 subscription)
- Information consolidated into `TEAM_MEMBER_REQUIREMENTS.md`

---

### subscription-refactoring-proposals/ (3 files) **NEW**
**Status**: ⚠️ Superseded - Proposals replaced by STRIPE_INTEGRATION_V2.md
**Period**: October 2025
**Archive Date**: 2025-10-26
**Summary**: Subscription architecture refactoring proposals superseded by clean-slate design

#### Files:
- `SUBSCRIPTION_PLANS_REFACTORING.md` - Plan refactoring proposal (1377 lines)
- `UNIFIED_SUBSCRIPTION_REFACTORING_PROPOSAL.md` - Unified architecture proposal (594 lines)
- `FRONTEND_SYNC_MIGRATION_ANALYSIS.md` - Sync migration analysis (469 lines)

**Why Archived**:
- All proposals superseded by `STRIPE_INTEGRATION_V2.md` (clean-slate design)
- Historical value for understanding decision evolution
- Current architecture documented in STRIPE_INTEGRATION_V2.md

---

### 2025-Q3-search-features/ (6 files) **UPDATED**
**Status**: ✅ Complete - AI-powered search deployed
**Period**: July-September 2025
**Archive Date**: 2025-11-19
**Summary**: Semantic image search with BGE-M3 embeddings

#### Files:
- `IMAGE_SEARCH_ENHANCEMENTS.md` - Complete implementation plan (1,700 lines) **ADDED 2025-11-19**
- `AI_IMAGE_HISTORY_MVP_DESIGN.md` - AI image history MVP design
- `AI_SEARCH_MIGRATION_SUMMARY.md` - Search migration summary
- `CATEGORY_CONSOLIDATION_PLAN.md` - Image category consolidation
- `IMPLEMENTATION_SUMMARY.md` - Search implementation summary
- `VECTOR_SEARCH_TEST_PLAN.md` - Vector search test plan (151 lines)

**Key Achievements**:
- BGE-M3 embeddings for 1,196 custom images (1024 dimensions)
- Real-time query embedding via Cloudflare Workers AI
- pgvector similarity search with IVFFlat indexes
- Multilingual support (100+ languages)
- Frontend caching (IndexedDB + localStorage)
- CDN delivery via img.icraftstories.com
- Phase 6 (CDN image transformation) documented in `STRATEGIC_ENHANCEMENTS.md`

---

### 2025-Q4-crisp-integration/ (10 files)
**Status**: ✅ Complete - CRISP chat integration deployed and stable
**Period**: October 2025
**Summary**: Complete CRISP chat widget integration with branding, privacy updates, and environment configuration

#### Files:
- `CRISP_BRANDING_AND_AI.md` - CRISP branding customization and AI assistant configuration
- `CRISP_CHAT_INTEGRATION_PLAN.md` - Initial integration planning document
- `CRISP_ENVIRONMENT_CONFIGURATION.md` - Environment-specific CRISP configuration
- `CRISP_IMPLEMENTATION_COMPLETE.md` - Implementation completion report
- `CRISP_INTEGRATION_CHECKLIST.md` - Step-by-step integration checklist
- `CRISP_INTEGRATION_SUMMARY.md` - Project summary and outcomes
- `CRISP_NOISE_MANAGEMENT_STRATEGY.md` - Strategy for managing CRISP notifications
- `CRISP_PRIVACY_POLICY_UPDATES.md` - Privacy policy changes for CRISP
- `CRISP_QUICK_START.md` - Quick start guide for CRISP integration
- `CRISP_SINGLE_WEBSITE_CONFIG.md` - Single website configuration approach

---

### 2025-Q4-team-collaboration/ (11 files)
**Status**: ✅ Complete - Team collaboration features deployed
**Period**: October 2025
**Summary**: Team-based story ownership, credit pooling, and automatic transfer on team join

#### Files:
- `TEAM_AUTO_CREDIT_TRANSFER_COMPLETE.md` - Automatic credit transfer implementation
- `TEAM_DATA_AUDIT_2025-10-20.md` - Team data integrity audit
- `TEAM_INVITATION_CHUNK_ERROR_ANALYSIS.md` - Team invitation error analysis
- `TEAM_MANAGEMENT_IMPROVEMENTS_2025-10-20.md` - Team management UI/UX improvements
- `TEAM_ONLY_MODEL_COMPLETE_DISCOVERY.md` - Discovery of team-only subscription model
- `TEAM_ONLY_MODEL_CROSS_IMPACT_ANALYSIS.md` - Cross-feature impact analysis
- `TEAM_ONLY_MODEL_DESIGN.md` - Team-only model architectural design
- `TEAM_ONLY_MODEL_DISCOVERY_FINDINGS.md` - Initial discovery findings
- `TEAM_STORIES_LIBRARY_INTEGRATION_PLAN.md` - Team stories library integration plan
- `TEAM_STORY_OWNERSHIP_FIX.md` - Story ownership bug fixes
- `TEAM_STORY_OWNERSHIP_SUMMARY.md` - Story ownership implementation summary

---

### 2025-Q4-subscription-migration/ (5 files)
**Status**: ✅ Complete - Subscription plan refactoring deployed
**Period**: October 2025
**Summary**: Migration from old plan types to new individual/team/custom model

#### Files:
- `SUBSCRIPTION_CLEANUP_COMPLETED.md` - Subscription code cleanup completion report
- `FRONTEND_PLANTYPE_MIGRATION_COMPLETE.md` - Frontend plan type migration
- `FRONTEND_TRANSFER_COMMUNICATION_IMPLEMENTATION.md` - Transfer communication UI
- `PLAN_ID_MAPPING_IMPLEMENTATION.md` - Plan ID mapping implementation
- `LEGACY_TEAM_CREDIT_MIGRATION_2025-10-20.md` - Legacy team credit migration

---

### 2025-Q3-custom-images/ (4 files)
**Status**: ✅ Complete - Custom images pipeline deployed
**Period**: July-September 2025
**Summary**: Custom image categorization and search implementation

#### Files:
- `CUSTOM_IMAGES_PIPELINE_FLOW.md` - Image processing pipeline architecture
- `CUSTOM_IMAGES_SCHEMA_ANALYSIS.md` - Database schema analysis
- `DATABASE_TRANSFORMATION_PLAN.md` - Database transformation plan
- `BACKFILL_COMPLETED.md` - Image data backfill completion report

---

### completed-features/ (5 files)
**Status**: ✅ Complete - Miscellaneous completed work
**Period**: 2025
**Summary**: Various completed features, fixes, and deployments

#### Files:
- `CLERK_WEBHOOK_FIX_GUIDE.md` - Clerk webhook fixes and improvements
- `CONFIRMATION_CHECKLIST.md` - Feature completion confirmation checklist
- `DEPLOYMENT_COMPLETED.md` - Deployment completion reports
- `DEPLOYMENT_VERIFICATION.md` - Deployment verification procedures
- `ENVIRONMENT_CONFIGURATION_REVIEW.md` - Environment configuration audit

---

### completed-audits/ (4 files) **UPDATED**
**Status**: ✅ Complete - All audit and analysis tasks executed
**Period**: October 2025
**Archive Date**: 2025-10-26
**Summary**: Repository analysis and planning documents that served specific time-bound purposes

#### Files:
- `DOCUMENTATION_AUDIT_2025-10-26.md` - Comprehensive audit of 154 files across all repos (537 lines)
- `TOP_LEVEL_DOCS_REVIEW.md` - Analysis of 24 top-level markdown files (281 lines)
- `SQL_AUDIT_REPORT.md` - Audit of backend/sql/ directory (699 lines)
- `REMAINING_DOCS_ANALYSIS.md` - Post-archiving analysis of 13 remaining docs (~500 lines)

**Key Achievements**:
- Audited 154 documentation files across 3 repositories
- Audited 34 SQL functions across 11 files (83% obsolete)
- Identified 66 total files for archiving
- Executed all archiving recommendations across all repos
- Created quarterly archive structure (2025-Q3, 2025-Q4)
- Reduced root directory by 58% (24 → 10 files)
- All meta-analysis documents archived

---

## Archive Statistics

**Total Archive Directories**: 12
**Total Archived Files**: 102 files
**Archive Period**: July 2025 - November 2025
**Latest Archive Date**: 2025-11-19

### Files by Category

| Category | Files | Status |
|----------|-------|--------|
| Credit System Cleanup | 8 | ✅ Complete |
| Stripe Automation | 10 | ✅ Complete |
| Completed Implementations | 23 | ✅ Complete |
| Story/Credit Transfer | 8 | ✅ Complete |
| Subscription Refactoring | 3 | ⚠️ Superseded |
| Search Features | 6 | ✅ Complete |
| CRISP Integration | 10 | ✅ Complete |
| Team Collaboration | 11 | ✅ Complete |
| Team Invitations | 4 | ✅ Complete |
| Subscription Migration | 5 | ✅ Complete |
| Custom Images | 4 | ✅ Complete |
| Misc Completed | 5 | ✅ Complete |
| Completed Audits | 4 | ✅ Complete |
| **TOTAL** | **102** | |

---

## Recent Archiving Activity

### November 2025 Consolidation (2025-11-19)
- **Added**: 2025-Q4-credit-system-cleanup/ (8 files)
- **Added**: 2025-Q4-stripe-automation/ (9 files)
- **Added**: 2025-Q4-completed-implementations/ (21 files)
- **Files Archived**: 38 total
- **Impact**: Reduced root directory from 47 to 9 markdown files (81% reduction)
- **Result**: Clean root directory with only active documentation

---

### October 2025 Archiving (2025-10-26)

#### Fourth Archiving Pass - Final Cleanup
- **Added**: 2 analysis documents to completed-audits/ (SQL_AUDIT_REPORT.md, REMAINING_DOCS_ANALYSIS.md)
- **Files**: Repository meta-analysis documents (~1,200 lines)
- **Impact**: Reduced root directory from 12 to 10 markdown files (58% total reduction)
- **Result**: Only product/architecture documentation remains in root

### Third Archiving Pass
- **Added**: completed-audits/ directory (2 files, 818 lines)
- **Files**: DOCUMENTATION_AUDIT_2025-10-26.md, TOP_LEVEL_DOCS_REVIEW.md
- **Impact**: Reduced root directory from 13 to 12 markdown files
- **Documentation**: Created REMAINING_DOCS_ANALYSIS.md for post-archiving review

### Second Archiving Pass
- **Added**: 2025-Q4-story-credit-transfer/ (8 files, 4,233 lines)
- **Added**: subscription-refactoring-proposals/ (3 files, 2,440 lines)
- **Updated**: 2025-Q3-search-features/ (+1 file: VECTOR_SEARCH_TEST_PLAN.md)
- **Impact**: Reduced root directory from 24 to 13 markdown files (46% reduction)
- **Documentation**: Created TOP_LEVEL_DOCS_REVIEW.md for analysis

### First Archiving Pass (2025-10-26)
- Created archive structure with 6 directories
- Archived 39 completed documentation files
- Created comprehensive archive READMEs

---

## Finding Archived Documentation

### Search by Feature
```bash
# Story/Credit Transfer
ls docs-archive/2025-Q4-story-credit-transfer/

# Subscription architecture
ls docs-archive/subscription-refactoring-proposals/

# Team collaboration
ls docs-archive/2025-Q4-team-collaboration/

# Search features
ls docs-archive/2025-Q3-search-features/

# CRISP integration
ls docs-archive/2025-Q4-crisp-integration/
```

### Search by Content
```bash
# Find all docs mentioning "team"
grep -r "team" docs-archive/

# Find all docs mentioning "subscription"
grep -r "subscription" docs-archive/

# Find all docs mentioning "story transfer"
grep -r "story transfer" docs-archive/
```

---

## Restoration Process

If archived documentation becomes relevant again:

1. **Review**: Read the archived document to understand context
2. **Update**: Update any outdated information
3. **Move Back**: Move to main documentation area
4. **Link**: Update documentation index to include restored doc

**Never modify archived files in place** - copy them out first, then update.

---

## Current Active Documentation

After archiving, these files remain in the root directory:

### Core Documentation (4)
- `CLAUDE.md` - Claude Code development guidance
- `README.md` - Project overview
- `FEATURES.md` - Feature catalog
- `TODO.md` - Task tracking

### Strategic Planning (1)
- `STRATEGIC_ENHANCEMENTS.md` - Future performance optimizations and feature enhancements

### Setup Guides (1)
- `PLAYWRIGHT_SETUP.md` - Playwright testing setup

**Total Active Files**: 6

---

## Related Archives

- **Backend SQL Archive**: `backend/sql/archive/` - Archived SQL function definitions
- **Backend Docs Archive**: `backend/docs-archive/` - Backend-specific documentation
- **Backend MLX Archive**: `backend/mlx-archive/` - MLX experimentation files
- **Frontend Archive**: `frontend/docs-archive/` - Frontend-specific documentation

---

**Archive Created**: 2025-10-26
**Last Updated**: 2025-11-19
**Maintainer**: Development team
**Review Schedule**: Quarterly or after major feature releases
