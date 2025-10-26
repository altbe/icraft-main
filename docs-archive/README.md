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

### 2025-Q3-custom-images/ (4 files)
**Status**: ✅ Complete - Custom images pipeline deployed
**Period**: July-September 2025
**Summary**: Custom image categorization and search implementation

#### Files:
- `CUSTOM_IMAGES_PIPELINE_FLOW.md` - Image processing pipeline architecture
- `CUSTOM_IMAGES_SCHEMA_ANALYSIS.md` - Database schema analysis
- `DATABASE_TRANSFORMATION_PLAN.md` - Database transformation plan
- `BACKFILL_COMPLETED.md` - Image data backfill completion report

### 2025-Q3-search-features/ (4 files)
**Status**: ✅ Complete - AI-powered search deployed
**Period**: July-September 2025
**Summary**: Semantic image search with BGE-M3 embeddings

#### Files:
- `AI_IMAGE_HISTORY_MVP_DESIGN.md` - AI image history MVP design
- `AI_SEARCH_MIGRATION_SUMMARY.md` - Search migration summary
- `CATEGORY_CONSOLIDATION_PLAN.md` - Image category consolidation
- `IMPLEMENTATION_SUMMARY.md` - Search implementation summary

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

## Archive Statistics

**Total Archived Files**: 39
**Earliest Archive Date**: July 2025 (2025-Q3)
**Latest Archive Date**: October 2025 (2025-Q4)
**Archive Size**: ~39 documents covering 6 major feature areas

---

## Finding Archived Documentation

### Search by Feature
```bash
# CRISP integration
ls docs-archive/2025-Q4-crisp-integration/

# Team collaboration
ls docs-archive/2025-Q4-team-collaboration/

# Subscription changes
ls docs-archive/2025-Q4-subscription-migration/

# Image features
ls docs-archive/2025-Q3-custom-images/
ls docs-archive/2025-Q3-search-features/
```

### Search by Content
```bash
# Find all docs mentioning "team"
grep -r "team" docs-archive/

# Find all docs mentioning "subscription"
grep -r "subscription" docs-archive/
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

## Related Documentation

- **Active Documentation**: See main repo README.md and submodule CLAUDE.md files
- **SQL Archive**: `backend/sql/archive/` for archived SQL files
- **Backend Archive**: `backend/docs-archive/` for backend-specific archives
- **Frontend Archive**: `frontend/docs-archive/` for frontend-specific archives

---

**Archive Created**: 2025-10-26
**Last Updated**: 2025-10-26
**Maintainer**: Development team
**Review Schedule**: Annually or when restoring documents
