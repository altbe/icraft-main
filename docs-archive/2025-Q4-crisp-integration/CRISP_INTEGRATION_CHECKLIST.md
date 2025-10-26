# Crisp.chat Integration - Quick Start Checklist

**Date**: 2025-10-24
**Full Plan**: See `CRISP_CHAT_INTEGRATION_PLAN.md`

---

## Pre-Implementation Checklist

### Business Decisions
- [ ] Review and approve integration plan
- [ ] Determine scope: all visitors or authenticated users only?
- [ ] Identify support team members (max 2 for free plan)
- [ ] Decide on business hours for live support
- [ ] Choose offline message forwarding email

### Legal/Compliance
- [ ] Review Privacy Policy (add Crisp mention)
- [ ] Update Cookie Policy (Crisp uses cookies)
- [ ] Verify GDPR/CCPA compliance requirements
- [ ] Determine if cookie consent banner update needed

### Technical
- [ ] Create Crisp account at https://crisp.chat
- [ ] Get Website ID from dashboard
- [ ] Decide: separate Crisp websites for dev/qa/prod or shared?

---

## Implementation Checklist (Day 1-3)

### Day 1: Basic Integration

#### Setup (1-2 hours)
- [ ] Create Crisp account (free plan)
- [ ] Get Website ID from Crisp dashboard
- [ ] Add environment variables:
  ```bash
  # .env.example
  VITE_CRISP_WEBSITE_ID=your-website-id
  VITE_CRISP_ENABLED=true
  ```
- [ ] Add to GitHub Actions secrets:
  - `CRISP_WEBSITE_ID_DEV`
  - `CRISP_WEBSITE_ID_QA`
  - `CRISP_WEBSITE_ID_PROD`

#### Code Implementation (3-4 hours)
- [ ] Create `frontend/src/types/crisp.d.ts`
- [ ] Create `frontend/src/lib/crisp.ts`
- [ ] Create `frontend/src/hooks/useCrispChat.ts`
- [ ] Create `frontend/src/components/CrispChatWidget.tsx`
- [ ] Add `<CrispChatWidget />` to `App.tsx`
- [ ] Test on localhost:
  - [ ] Widget appears
  - [ ] Can send/receive messages
  - [ ] No console errors

### Day 2: User Context & Locale

#### User Identification (2-3 hours)
- [ ] Implement user email/name/avatar from Clerk
- [ ] Fetch subscription info from API
- [ ] Fetch credit balance from API
- [ ] Fetch team info from API
- [ ] Test in Crisp dashboard - verify data appears
- [ ] Add error handling (graceful degradation)

#### Multi-Language Support (2-3 hours)
- [ ] Implement locale detection (i18n)
- [ ] Configure Spanish in Crisp dashboard
- [ ] Test language switching
- [ ] Add canned responses in both languages

### Day 3: Testing & Deployment

#### Testing (3-4 hours)
- [ ] Unit tests for CrispChatWidget
- [ ] Playwright E2E test (widget loads)
- [ ] Test on mobile (iOS Safari, Chrome Android)
- [ ] Test offline behavior (messages queue)
- [ ] Test user identification
- [ ] Test locale switching

#### QA Deployment (2-3 hours)
- [ ] Deploy to QA environment
- [ ] Test with QA test accounts
- [ ] Stakeholder review
- [ ] Support team training
- [ ] Address feedback

#### Production Deployment (2-3 hours)
- [ ] Create production Crisp website (recommended)
- [ ] Configure production settings
- [ ] Update Privacy Policy
- [ ] Deploy to production
- [ ] Monitor for 24-48 hours
- [ ] Support team onboarding

---

## Configuration Checklist

### Crisp Dashboard Settings
- [ ] **Website Settings**:
  - [ ] Website name: iCraftStories
  - [ ] Website URL: https://icraftstories.com
  - [ ] Widget color: (match brand)
  - [ ] Widget position: Bottom-right

- [ ] **Availability**:
  - [ ] Business hours configured
  - [ ] Auto-responder enabled
  - [ ] Offline message forwarding set up

- [ ] **Custom Data Fields**:
  - [ ] `subscription_plan` (string)
  - [ ] `subscription_status` (string)
  - [ ] `credit_balance` (number)
  - [ ] `team_id` (string)
  - [ ] `team_name` (string)
  - [ ] `team_role` (string)

- [ ] **Segments**:
  - [ ] `individual`
  - [ ] `team`
  - [ ] `trial`
  - [ ] `team_owner`
  - [ ] `team_member`

- [ ] **Canned Responses**:
  - [ ] "How to buy credits?" (EN + ES)
  - [ ] "How to invite team members?" (EN + ES)
  - [ ] "How to create a story?" (EN + ES)
  - [ ] "Subscription billing question" (EN + ES)

---

## Testing Checklist

### Functional Testing
- [ ] Widget loads on localhost
- [ ] Widget loads on QA
- [ ] Widget loads on production
- [ ] User can open/close widget
- [ ] User can send message
- [ ] Support team receives message
- [ ] Support team can reply
- [ ] User receives reply notification

### User Identification
- [ ] User email appears in dashboard
- [ ] User name appears in dashboard
- [ ] User avatar appears in dashboard
- [ ] Subscription plan shows in custom data
- [ ] Credit balance shows in custom data
- [ ] Team info shows in custom data (if applicable)

### Locale Testing
- [ ] Widget displays in English (default)
- [ ] Widget displays in Spanish (when language switched)
- [ ] Automated messages appear in correct language
- [ ] Support agent sees user's language preference

### Mobile Testing
- [ ] Widget responsive on iPhone (Safari)
- [ ] Widget responsive on Android (Chrome)
- [ ] Widget accessible (tap targets > 44px)
- [ ] No layout shifts when widget loads

### Edge Cases
- [ ] Widget works when user signs out (resets)
- [ ] Widget works when user switches accounts
- [ ] Widget works offline (messages queue)
- [ ] Widget handles API errors gracefully (no crash)
- [ ] Widget doesn't block if Crisp CDN down

---

## Post-Launch Monitoring (Week 1)

### Metrics to Track
- [ ] **Performance**:
  - [ ] Page load time increase < 100ms
  - [ ] No JavaScript errors in Sentry
  - [ ] Widget load time < 2 seconds

- [ ] **Usage**:
  - [ ] Number of conversations per day
  - [ ] Average response time
  - [ ] User satisfaction (CSAT)

- [ ] **Technical**:
  - [ ] Mobile vs desktop usage
  - [ ] Browser compatibility issues
  - [ ] Error rate in Sentry

### Support Team Feedback
- [ ] Support team comfortable with dashboard?
- [ ] User context helpful for troubleshooting?
- [ ] Any missing data fields?
- [ ] Canned responses useful?
- [ ] Need additional training?

---

## Common Issues & Solutions

### Widget Doesn't Appear
- [ ] Check `VITE_CRISP_WEBSITE_ID` is set
- [ ] Check browser console for errors
- [ ] Check ad blocker not blocking Crisp
- [ ] Check CSP headers allow `client.crisp.chat`

### User Not Identified
- [ ] Check user is authenticated
- [ ] Check API calls succeed (subscription, credits, team)
- [ ] Check Crisp dashboard → User profile
- [ ] Check browser console for errors

### Messages Not Received
- [ ] Check support team is logged into dashboard
- [ ] Check email notifications enabled
- [ ] Check business hours configured correctly
- [ ] Check offline message forwarding

### Performance Issues
- [ ] Check Crisp script loaded asynchronously
- [ ] Check lazy loading working
- [ ] Check no double-initialization
- [ ] Check service worker not caching Crisp script

---

## Files to Create

### Frontend Files
```
frontend/src/
├── types/
│   └── crisp.d.ts                    # TypeScript definitions
├── lib/
│   └── crisp.ts                      # Crisp SDK wrapper
├── hooks/
│   └── useCrispChat.ts               # Custom React hook
└── components/
    └── CrispChatWidget.tsx           # Main component
```

### Documentation
```
CRISP_CHAT_INTEGRATION_PLAN.md        # Full integration plan
CRISP_INTEGRATION_CHECKLIST.md        # This checklist
```

### Tests
```
frontend/tests/
├── components/
│   └── CrispChatWidget.test.tsx      # Unit tests
└── e2e/
    └── crisp-chat.spec.ts            # E2E tests
```

---

## Rollback Plan

If issues arise, quick rollback options:

### Option 1: Disable via Environment Variable (Recommended)
```bash
VITE_CRISP_ENABLED=false
```
Redeploy → widget disappears

### Option 2: Comment Out Component
```tsx
// In App.tsx
{/* <CrispChatWidget ... /> */}
```

### Option 3: Revert Git Commit
```bash
git revert <commit-hash>
git push origin main
```

---

## Success Criteria

### MVP (Must-Have)
- [x] Chat widget loads
- [x] Users can send messages
- [x] Support team receives messages
- [x] Mobile-responsive
- [x] No performance degradation
- [x] No console errors

### Phase 2 (Should-Have)
- [x] User identification works
- [x] Context data visible in dashboard
- [x] Multi-language support
- [x] Offline message queuing

### Phase 3 (Nice-to-Have)
- [ ] Knowledge base integrated
- [ ] Proactive messaging
- [ ] Automated chatbot
- [ ] Custom events tracking

---

## Next Actions

1. [ ] Review this checklist with team
2. [ ] Approve integration plan
3. [ ] Create Crisp account
4. [ ] Schedule implementation (2-3 days)
5. [ ] Assign to frontend developer

---

**Estimated Timeline**: 2-3 days
**Estimated Cost**: $0/month (Free plan)
**Risk Level**: Low (easy rollback, no database changes)
**Impact**: High (better support, reduced ticket volume)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
