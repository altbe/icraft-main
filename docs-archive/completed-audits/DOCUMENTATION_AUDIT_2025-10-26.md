# Documentation Audit Report - All Repositories

**Date**: 2025-10-26
**Scope**: Main repo + Backend (unico-api) + Frontend (icraft-front-v8)
**Purpose**: Categorize, archive obsolete documentation, revise outdated content

---

## Executive Summary

### Documentation Inventory

| Repository | Root Docs | Structured Docs | Total | Archive Candidates |
|------------|-----------|-----------------|-------|-------------------|
| **Main (icraft-main)** | 58 files | 3 archived dirs | 61 | 35 files (~60%) |
| **Backend (unico-api)** | 14 files | 47 files | 61 | 8 files (~13%) |
| **Frontend (icraft-front-v8)** | 8 files | 24 files | 32 | 4 files (~13%) |
| **TOTAL** | **80 files** | **74 files** | **154 files** | **47 files (~31%)** |

### Key Findings

1. **🚨 Main Repo Over-Documentation**: 60% of root-level docs are completion reports or historical
2. **✅ Backend Well-Organized**: docs-internal/ structure working well, minimal cleanup needed
3. **✅ Frontend Well-Maintained**: ADRs current, minimal obsolete content
4. **📋 Recommendation**: Archive ~47 files, create documentation indexes, establish retention policy

---

## Main Repository (icraft-main) Analysis

### Current Directory Structure

```
icraft-main/
├── *.md (58 files in root) ⚠️ Too many root-level docs
├── docs-archive/
│   ├── credit-purchase-oct16/ (5 files)
│   ├── image-work-sep22/ (1 file)
│   └── 3 team-related archived docs
├── backend/ (submodule)
└── frontend/ (submodule)
```

### 📊 Status Categorization

#### ✅ **Keep - Current & Essential** (18 files)

These are actively maintained reference documents:

| File | Type | Reason |
|------|------|--------|
| `CLAUDE.md` | ✅ Essential | Project guidance for Claude Code |
| `README.md` | ✅ Essential | Repository overview |
| `FEATURES.md` | ✅ Current | Feature inventory |
| `TODO.md` | ✅ Active | Current task tracking |
| `SQL_AUDIT_REPORT.md` | ✅ Current | Fresh audit (2025-10-26) |
| `SUPABASE_STRIPE_INTEGRATION_REVIEW.md` | ✅ Current | Fresh review (2025-10-26) |
| `TEAM_MEMBER_REQUIREMENTS.md` | ✅ Current | Requirements doc |
| `TEAM_ONBOARDING_SCENARIOS.md` | ✅ Current | Test scenarios |
| `ONE_TEAM_PER_USER_SOLUTION.md` | ✅ Current | Implementation guide |
| `NON_PROD_DATA_MIGRATION_PLAN.md` | ✅ Current | Migration procedures |
| `STORY_CREDIT_TRANSFER_GAP_ANALYSIS.md` | ✅ Current | Gap analysis |
| `STORY_TRANSFER_IMPLEMENTATION_PLAN.md` | ✅ Current | Implementation plan |
| `STORY_TRANSFER_QUICK_START.md` | ✅ Current | Quick reference |
| `PRIORITY_1_2_COMPLETION_STATUS.md` | ✅ Current | Status tracking |
| `PLAYWRIGHT_SETUP.md` | ✅ Current | Testing setup |
| `IMAGE_SEARCH_ENHANCEMENTS.md` | ✅ Current | Recent feature work |
| `VECTOR_SEARCH_TEST_PLAN.md` | ✅ Current | Test plan |
| `TOS_IMPLEMENTATION_PLAN.md` | ✅ Current | Implementation guide |

#### ⚠️ **Review - Potentially Outdated** (5 files)

Need review to determine if still accurate:

| File | Issue | Action Needed |
|------|-------|---------------|
| `SUBSCRIPTION_PLANS_REFACTORING.md` | Check if refactoring complete | Archive if done |
| `UNIFIED_SUBSCRIPTION_REFACTORING_PROPOSAL.md` | Proposal vs implementation | Archive if implemented |
| `STRIPE_INTEGRATION_V2.md` | V2 complete? | Archive if superseded |
| `TEAM_INVITATION_REFACTORING_PLAN.md` | Check completion | Archive if done |
| `FRONTEND_SYNC_MIGRATION_ANALYSIS.md` | Check if migration complete | Archive if done |

#### 🗄️ **Archive - Completed Implementation** (35 files)

These document completed work and should be archived:

**CRISP Integration (9 files)** - Implementation complete 2025-10-25:
- `CRISP_BRANDING_AND_AI.md`
- `CRISP_CHAT_INTEGRATION_PLAN.md`
- `CRISP_ENVIRONMENT_CONFIGURATION.md`
- `CRISP_IMPLEMENTATION_COMPLETE.md` ⭐
- `CRISP_INTEGRATION_CHECKLIST.md`
- `CRISP_INTEGRATION_SUMMARY.md`
- `CRISP_NOISE_MANAGEMENT_STRATEGY.md`
- `CRISP_PRIVACY_POLICY_UPDATES.md`
- `CRISP_QUICK_START.md`
- `CRISP_SINGLE_WEBSITE_CONFIG.md`

**Team Collaboration Implementation (8 files)** - Completed Oct 2025:
- `TEAM_AUTO_CREDIT_TRANSFER_COMPLETE.md` ⭐
- `TEAM_DATA_AUDIT_2025-10-20.md`
- `TEAM_INVITATION_CHUNK_ERROR_ANALYSIS.md`
- `TEAM_MANAGEMENT_IMPROVEMENTS_2025-10-20.md`
- `TEAM_ONLY_MODEL_COMPLETE_DISCOVERY.md` ⭐
- `TEAM_ONLY_MODEL_CROSS_IMPACT_ANALYSIS.md`
- `TEAM_ONLY_MODEL_DESIGN.md`
- `TEAM_ONLY_MODEL_DISCOVERY_FINDINGS.md`
- `TEAM_STORIES_LIBRARY_INTEGRATION_PLAN.md`
- `TEAM_STORY_OWNERSHIP_FIX.md`
- `TEAM_STORY_OWNERSHIP_SUMMARY.md`

**Subscription/Plan Migration (6 files)** - Migrations complete:
- `SUBSCRIPTION_CLEANUP_COMPLETED.md` ⭐
- `FRONTEND_PLANTYPE_MIGRATION_COMPLETE.md` ⭐
- `FRONTEND_TRANSFER_COMMUNICATION_IMPLEMENTATION.md`
- `PLAN_ID_MAPPING_IMPLEMENTATION.md`
- `LEGACY_TEAM_CREDIT_MIGRATION_2025-10-20.md`

**Deployment & Environment (4 files)** - Setup complete:
- `DEPLOYMENT_COMPLETED.md` ⭐
- `DEPLOYMENT_VERIFICATION.md`
- `ENVIRONMENT_CONFIGURATION_REVIEW.md`
- `CONFIRMATION_CHECKLIST.md`

**Custom Images (4 files)** - Feature complete:
- `CUSTOM_IMAGES_PIPELINE_FLOW.md`
- `CUSTOM_IMAGES_SCHEMA_ANALYSIS.md`
- `DATABASE_TRANSFORMATION_PLAN.md`
- `BACKFILL_COMPLETED.md` ⭐

**AI/Search (2 files)** - Implementation complete:
- `AI_IMAGE_HISTORY_MVP_DESIGN.md`
- `AI_SEARCH_MIGRATION_SUMMARY.md`
- `CATEGORY_CONSOLIDATION_PLAN.md`
- `IMPLEMENTATION_SUMMARY.md`

**Misc Complete Work** (2 files):
- `CLERK_WEBHOOK_FIX_GUIDE.md`

**Legend**: ⭐ = Explicitly marked "COMPLETE" or "COMPLETED" in filename

---

## Backend Repository (unico-api) Analysis

### Current Directory Structure

```
backend/
├── *.md (14 files in root)
├── docs-internal/
│   ├── decisions/ (6 ADRs)
│   ├── integrations/ (20 files)
│   ├── operations/ (6 files)
│   ├── patterns/ (3 files)
│   ├── migrations/ (1 file)
│   └── misc (11 files)
├── sql/
│   ├── README.md (just created)
│   └── archive/ (8 files)
└── supabase/migrations/ (236 migrations)
```

### 📊 Status Categorization

#### ✅ **Keep - Current & Essential** (Root: 6 files, docs-internal: 45 files)

**Root Level** (Keep):
| File | Type | Reason |
|------|------|--------|
| `CLAUDE.md` | ✅ Essential | Backend guidance |
| `README.md` | ✅ Essential | Repository overview |
| `CREDIT_SYSTEM_CONSOLIDATED.md` | ✅ Current | Pure ledger architecture (2025-10-25) |
| `TARGET-STATE-ARCHITECTURE.md` | ✅ Current | Architecture reference |
| `MANUAL_INSTALL.md` | ✅ Current | Setup guide |
| `SUBSCRIPTION_PLANS_TABLE_REFERENCE.md` | ✅ Current | Reference doc |

**docs-internal/** (All current, well-organized):
- ✅ `/decisions` - 6 ADRs (architecture decision records)
- ✅ `/integrations` - 20 integration guides
- ✅ `/operations` - 6 operational guides
- ✅ `/patterns` - 3 pattern docs
- ✅ `/migrations` - 1 migration guide
- ✅ Root docs - 9 design/reference docs

#### 🗄️ **Archive - Completed/Historical** (8 files)

**Root Level Archive Candidates**:

| File | Reason | Date Completed |
|------|--------|----------------|
| `CREDIT_ALLOCATION_MIGRATION.md` | Migration complete | Oct 2025 |
| `CREDIT_TRANSACTIONS_SCHEMA_UPDATE.md` | Schema updated | Oct 2025 |
| `FUNCTION_AUDIT_AND_DISPOSITION.md` | Audit complete | Oct 2025 |
| `TEAM_CREDIT_FIX_SUMMARY.md` | Fix complete | Oct 2025 |
| `SUBSCRIPTION_PLAN_NAME_FIX.md` | Fix complete | Oct 2025 |
| `SECURITY_AUDIT_FRONTEND_REVIEW.md` | Audit complete | Historical |
| `SECURITY_AUDIT_STRIPE_SUPABASE.md` | Audit complete | Historical |
| `deploy_duplicate_prevention.md` | Feature complete | Historical |

**Note**: `docs-internal/` is well-maintained, no archives needed there.

---

## Frontend Repository (icraft-front-v8) Analysis

### Current Directory Structure

```
frontend/
├── *.md (8 files in root)
├── docs/
│   ├── adr/ (12 ADRs + README)
│   ├── deployment/ (3 files)
│   ├── development/ (4 files)
│   └── misc (3 files)
└── src/ (source code)
```

### 📊 Status Categorization

#### ✅ **Keep - Current & Essential** (Root: 4 files, docs/: 20 files)

**Root Level** (Keep):
| File | Type | Reason |
|------|------|--------|
| `CLAUDE.md` | ✅ Essential | Frontend guidance |
| `README.md` | ✅ Essential | Repository overview |
| `MULTI_DEVICE_SYNC_VERIFICATION.md` | ✅ Current | Sync architecture (2025-01) |
| `test-duplication-flow.md` | ✅ Current | Test documentation |

**docs/** (All current):
- ✅ `/adr` - 12 current ADRs
- ✅ `/deployment` - 3 deployment guides
- ✅ `/development` - 4 development guides
- ✅ Root docs - 3 misc guides

#### 🗄️ **Archive - Completed/Historical** (4 files)

**Root Level Archive Candidates**:

| File | Reason | Date Completed |
|------|--------|----------------|
| `DEVICE_ID_PERSISTENCE_ANALYSIS.md` | Analysis complete | 2025-01 |
| `SUBSCRIPTION_DISPLAYNAME_MIGRATION.md` | Migration complete | Oct 2025 |
| `SUBSCRIPTION_REFACTORING_PROPOSAL.md` | Proposal implemented | Oct 2025 |
| `SYNC_ALIGNMENT_REVIEW.md` | Review complete | 2025-01 |
| `SYNC_RACE_CONDITIONS_ANALYSIS.md` | Fixed Oct 2025 |

---

## Archiving Strategy

### Proposed Archive Structure

```
docs-archive/
├── README.md (Index of all archived docs)
├── 2025-Q4-crisp-integration/ (10 files)
├── 2025-Q4-team-collaboration/ (11 files)
├── 2025-Q4-subscription-migration/ (6 files)
├── 2025-Q3-custom-images/ (4 files)
├── 2025-Q3-image-search/ (3 files)
├── completed-features/ (misc completed work)
├── backend/
│   ├── migrations-complete/ (8 files)
│   └── README.md
└── frontend/
    ├── analyses-complete/ (5 files)
    └── README.md
```

### Archive Retention Policy

**Archive (Keep in Git History)**:
- ✅ Completed implementation docs
- ✅ Historical audits and analyses
- ✅ Migration completion reports
- ✅ Feature design docs after implementation

**Delete (Not Archive)**:
- ❌ Duplicate documents
- ❌ Incorrect/abandoned plans
- ❌ Empty placeholder files

**Keep Active**:
- ✅ Current architecture docs (CLAUDE.md, ADRs, TARGET-STATE)
- ✅ Active requirements and plans
- ✅ Reference guides (API docs, patterns, guides)
- ✅ Fresh audits (<30 days old)

---

## Recommended Actions

### Priority 1 - Main Repository Cleanup (2 hours)

1. **Archive Completed Work** (35 files):
   ```bash
   mkdir -p docs-archive/2025-Q4-{crisp,team,subscription}
   mkdir -p docs-archive/2025-Q3-{images,search}
   mkdir -p docs-archive/completed-features

   # Move files to appropriate archive dirs
   # (Detailed commands in execution section)
   ```

2. **Create Main README.md**:
   - Index of current documentation
   - Link to docs-archive for historical docs
   - Documentation contribution guidelines

3. **Review 5 Potentially Outdated Files**:
   - Check completion status
   - Archive or update as needed

### Priority 2 - Backend Cleanup (30 minutes)

1. **Archive Completed Work** (8 files):
   ```bash
   cd backend
   mkdir -p docs-archive/migrations-complete
   mkdir -p docs-archive/audits-complete

   # Move completed migration/fix docs
   ```

2. **Verify docs-internal Organization**:
   - Confirm all files still relevant
   - Update indexes if needed

### Priority 3 - Frontend Cleanup (30 minutes)

1. **Archive Completed Analyses** (5 files):
   ```bash
   cd frontend
   mkdir -p docs-archive/analyses-complete

   # Move completed analysis docs
   ```

2. **Verify ADR Currency**:
   - Confirm all ADRs still reflect current architecture
   - Update any outdated ADRs

### Priority 4 - Create Documentation Indexes (1 hour)

1. **Main Repo**: `DOCUMENTATION_INDEX.md`
2. **Backend**: Update `docs-internal/README.md`
3. **Frontend**: Update `docs/README.md`

Each index should include:
- **Current Docs**: By category with descriptions
- **Archive Location**: Links to archived docs
- **Contribution Guidelines**: When/how to add docs
- **Retention Policy**: What gets archived when

---

## Documentation Standards (Going Forward)

### File Naming Convention

✅ **Good**:
- `FEATURE_NAME_IMPLEMENTATION_PLAN.md` (active)
- `FEATURE_NAME_COMPLETE.md` (ready to archive)
- `ADR-NNN-descriptive-name.md` (ADRs)

❌ **Avoid**:
- `notes.md` (too vague)
- `temp-analysis.md` (temporary files should be deleted)
- `FINAL_v3_UPDATED.md` (version in filename)

### When to Archive

Archive a document when:
- ✅ **Explicitly marked complete** (filename ends in `_COMPLETE.md`)
- ✅ **Feature implemented** (30 days after deployment)
- ✅ **Analysis acted upon** (decisions made, changes implemented)
- ✅ **Migration complete** (verified in production)
- ✅ **Superseded by newer doc** (consolidation)

Keep a document when:
- ✅ **Active reference** (regularly consulted)
- ✅ **Living document** (updated regularly)
- ✅ **Current requirements** (specifications, ADRs)
- ✅ **Fresh content** (<30 days old)

### Documentation Lifecycle

```
1. PLAN → Active docs in root or docs/
2. IMPLEMENTATION → Keep active, update as needed
3. COMPLETE → Mark with _COMPLETE suffix
4. +30 DAYS → Move to docs-archive/
5. +1 YEAR → Review for permanent deletion
```

---

## Execution Plan

### Step 1: Main Repository (Priority 1)

**Create Archive Structure**:
```bash
cd /home/g/_zdev/icraft-main
mkdir -p docs-archive/2025-Q4-crisp-integration
mkdir -p docs-archive/2025-Q4-team-collaboration
mkdir -p docs-archive/2025-Q4-subscription-migration
mkdir -p docs-archive/2025-Q3-custom-images
mkdir -p docs-archive/2025-Q3-search-features
mkdir -p docs-archive/completed-features
```

**Move CRISP Files** (10 files):
```bash
mv CRISP_*.md docs-archive/2025-Q4-crisp-integration/
```

**Move Team Collaboration Files** (11 files):
```bash
mv TEAM_AUTO_CREDIT_TRANSFER_COMPLETE.md docs-archive/2025-Q4-team-collaboration/
mv TEAM_DATA_AUDIT_2025-10-20.md docs-archive/2025-Q4-team-collaboration/
mv TEAM_INVITATION_CHUNK_ERROR_ANALYSIS.md docs-archive/2025-Q4-team-collaboration/
mv TEAM_MANAGEMENT_IMPROVEMENTS_2025-10-20.md docs-archive/2025-Q4-team-collaboration/
mv TEAM_ONLY_MODEL_*.md docs-archive/2025-Q4-team-collaboration/
mv TEAM_STORIES_LIBRARY_INTEGRATION_PLAN.md docs-archive/2025-Q4-team-collaboration/
mv TEAM_STORY_OWNERSHIP_*.md docs-archive/2025-Q4-team-collaboration/
```

**Move Subscription Migration Files** (6 files):
```bash
mv *SUBSCRIPTION*COMPLETE*.md docs-archive/2025-Q4-subscription-migration/
mv FRONTEND_PLANTYPE_MIGRATION_COMPLETE.md docs-archive/2025-Q4-subscription-migration/
mv FRONTEND_TRANSFER_COMMUNICATION_IMPLEMENTATION.md docs-archive/2025-Q4-subscription-migration/
mv PLAN_ID_MAPPING_IMPLEMENTATION.md docs-archive/2025-Q4-subscription-migration/
mv LEGACY_TEAM_CREDIT_MIGRATION_2025-10-20.md docs-archive/2025-Q4-subscription-migration/
```

**Move Custom Images Files** (4 files):
```bash
mv CUSTOM_IMAGES_*.md docs-archive/2025-Q3-custom-images/
mv DATABASE_TRANSFORMATION_PLAN.md docs-archive/2025-Q3-custom-images/
mv BACKFILL_COMPLETED.md docs-archive/2025-Q3-custom-images/
```

**Move Search/AI Files** (4 files):
```bash
mv AI_IMAGE_HISTORY_MVP_DESIGN.md docs-archive/2025-Q3-search-features/
mv AI_SEARCH_MIGRATION_SUMMARY.md docs-archive/2025-Q3-search-features/
mv CATEGORY_CONSOLIDATION_PLAN.md docs-archive/2025-Q3-search-features/
mv IMPLEMENTATION_SUMMARY.md docs-archive/2025-Q3-search-features/
```

**Move Misc Completed Work**:
```bash
mv CLERK_WEBHOOK_FIX_GUIDE.md docs-archive/completed-features/
mv DEPLOYMENT_*.md docs-archive/completed-features/
mv ENVIRONMENT_CONFIGURATION_REVIEW.md docs-archive/completed-features/
mv CONFIRMATION_CHECKLIST.md docs-archive/completed-features/
```

### Step 2: Backend Repository (Priority 2)

```bash
cd /home/g/_zdev/icraft-main/backend
mkdir -p docs-archive/migrations-complete
mkdir -p docs-archive/audits-complete

# Move completed migration docs
mv CREDIT_ALLOCATION_MIGRATION.md docs-archive/migrations-complete/
mv CREDIT_TRANSACTIONS_SCHEMA_UPDATE.md docs-archive/migrations-complete/
mv FUNCTION_AUDIT_AND_DISPOSITION.md docs-archive/migrations-complete/
mv TEAM_CREDIT_FIX_SUMMARY.md docs-archive/migrations-complete/
mv SUBSCRIPTION_PLAN_NAME_FIX.md docs-archive/migrations-complete/

# Move completed audits
mv SECURITY_AUDIT_*.md docs-archive/audits-complete/
mv deploy_duplicate_prevention.md docs-archive/completed-features/
```

### Step 3: Frontend Repository (Priority 3)

```bash
cd /home/g/_zdev/icraft-main/frontend
mkdir -p docs-archive/analyses-complete

# Move completed analyses
mv DEVICE_ID_PERSISTENCE_ANALYSIS.md docs-archive/analyses-complete/
mv SUBSCRIPTION_DISPLAYNAME_MIGRATION.md docs-archive/analyses-complete/
mv SUBSCRIPTION_REFACTORING_PROPOSAL.md docs-archive/analyses-complete/
mv SYNC_ALIGNMENT_REVIEW.md docs-archive/analyses-complete/
mv SYNC_RACE_CONDITIONS_ANALYSIS.md docs-archive/analyses-complete/
```

### Step 4: Create Archive Indexes

Create `docs-archive/README.md` in each repository with:
- List of archived documents by category
- Date archived
- Reason for archiving
- Link to relevant current documentation

---

## Summary

**Total Files to Archive**: 47 files
- Main: 35 files (60% of root docs)
- Backend: 8 files (57% of root docs, 0% of docs-internal)
- Frontend: 4 files (50% of root docs, 0% of docs/)

**Documentation Quality Score**:
- Main: 5/10 (too many root-level docs, needs cleanup)
- Backend: 9/10 (well-organized, minimal cleanup)
- Frontend: 9/10 (well-organized, minimal cleanup)

**After Cleanup**:
- Main: 23 current docs in root (down from 58)
- Backend: 6 current docs in root (down from 14)
- Frontend: 4 current docs in root (unchanged)
- All repos: Clear archive structure with indexes

**Estimated Effort**:
- Priority 1 (Main): 2 hours
- Priority 2 (Backend): 30 minutes
- Priority 3 (Frontend): 30 minutes
- Priority 4 (Indexes): 1 hour
- **Total**: 4 hours

---

**Next Steps**: Execute archiving plan, create indexes, establish documentation retention policy

**Report Generated**: 2025-10-26
**Next Review**: Quarterly (2026-01) or after major feature releases
