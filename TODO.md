# iCraftStories TODO

**Last Updated:** September 2, 2025  
**Project:** iCraftStories Monorepo (Frontend + Backend)

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
- [ ] **Validate Webhook Endpoints** - Test Stripe/Clerk webhooks
  - Verify event processing
  - Check error handling and retries
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

## ✅ Recently Completed

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

### September 2025
- [x] CLERK_WEBHOOK_ICRAFT configured in Zuplo - September 1
- [x] Clerk v5 Migration verified (v5.45.0) - September 1
- [x] Backend API Compilation verified - September 1
- [x] React Hooks Violation fixed in CanvasPreview.tsx - September 1

## 📊 Progress Overview

**Active Tasks:** 8  
**Completed Tasks:** 23  
**Completion Rate:** 74%

### By Category:
- **Critical Issues:** 3 pending
- **Integration:** 4 pending (all Clerk-related)
- **Deployment:** 1 pending
- **Infrastructure:** ✅ All complete (Stripe, Teams, Credits)

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