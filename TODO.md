# iCraftStories Pragmatic TODO

## Immediate Actions Needed

- [ ] Update **CLERK_WEBHOOK_ICRAFT** variable in ZUPLO environment variables settings

### Frontend (`icraft-front-v8/`)
- [ ] **Setup Testing Framework** - No tests currently exist, blocking CI/CD confidence
- [ ] **Fix Type Errors** - Run `npm run lint` and resolve any remaining TypeScript issues
- [ ] **Verify Clerk v5 Migration** - Test authentication flows after SDK upgrade

### Backend (`unico-api/`)
- [ ] **Validate Webhook Endpoints** - Ensure Stripe/Clerk webhooks working after SDK updates
- [ ] **Test API Compilation** - Run `npm run test` to verify all endpoints functional

## Next Sprint

- [ ] **Production Deployment** - Deploy recent SDK upgrades to production
- [ ] **Performance Monitoring** - Check for any regressions from SDK updates

## Completed ✅
- [x] SDK upgrades (Clerk, Stripe, Supabase) - January 28, 2025

---

*Focus: Only actionable items that directly impact development or production*
