# Crisp.chat Environment Configuration

**Date**: 2025-10-24
**Environments**: dev.icraftstories.com, qa.icraftstories.com, icraftstories.com

---

## Overview

iCraftStories has three deployment environments, each requiring separate Crisp.chat configuration:

| Environment | URL | Purpose | Crisp Website |
|------------|-----|---------|---------------|
| **Development** | dev.icraftstories.com | Local development, testing | Create separate (or share with QA) |
| **QA** | qa.icraftstories.com | Pre-production testing | Create separate (or share with Dev) |
| **Production** | icraftstories.com | Live production | **Must be separate** |

**Recommendation**: Create **2 Crisp websites**:
1. **iCraftStories Development** (shared for dev + qa)
2. **iCraftStories Production** (dedicated for production)

**Rationale**:
- Development and QA share lower traffic, can combine
- Production must be isolated to avoid test data pollution
- Free plan supports multiple websites

---

## Step 1: Create Crisp Websites

### Option A: Two Websites (Recommended)

#### Website 1: Development/QA
```
Name: iCraftStories Development
URL: dev.icraftstories.com (primary), qa.icraftstories.com (secondary)
Team: Development team + QA team
Settings:
  - Enable test mode badge ("TEST" overlay on widget)
  - Relaxed availability (always show widget)
  - Detailed logging enabled
```

#### Website 2: Production
```
Name: iCraftStories
URL: icraftstories.com
Team: Support team only
Settings:
  - Business hours enforcement
  - Professional auto-responders
  - Production logging only
```

### Option B: Three Websites (Isolated)

If you prefer complete isolation:

```
1. iCraftStories Dev (dev.icraftstories.com)
2. iCraftStories QA (qa.icraftstories.com)
3. iCraftStories Production (icraftstories.com)
```

**Note**: Free plan allows unlimited websites, so this is feasible.

---

## Step 2: Get Website IDs

After creating each Crisp website:

1. Log in to https://app.crisp.chat
2. Select website from dropdown
3. Go to Settings → Website Settings
4. Copy **Website ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Example Website IDs**:
```
Development/QA: 12345678-1234-1234-1234-123456789abc
Production:     abcdef12-abcd-abcd-abcd-abcdef123456
```

---

## Step 3: Configure Environment Variables

### Local Development (`.env.local`)

```bash
# Crisp Chat Integration
VITE_CRISP_WEBSITE_ID=12345678-1234-1234-1234-123456789abc  # Dev/QA Website ID
VITE_CRISP_ENABLED=true
```

### Development Environment (`dev.icraftstories.com`)

**GitHub Actions Secrets**:
```
Name: CRISP_WEBSITE_ID_DEV
Value: 12345678-1234-1234-1234-123456789abc
```

**Cloudflare Workers Environment Variables**:
```
Variable: VITE_CRISP_WEBSITE_ID
Value: 12345678-1234-1234-1234-123456789abc
Environment: Development
```

### QA Environment (`qa.icraftstories.com`)

**GitHub Actions Secrets**:
```
Name: CRISP_WEBSITE_ID_QA
Value: 12345678-1234-1234-1234-123456789abc  # Same as Dev (if shared)
# OR
Value: 87654321-4321-4321-4321-cba987654321  # Separate QA Website ID
```

**Cloudflare Workers Environment Variables**:
```
Variable: VITE_CRISP_WEBSITE_ID
Value: 12345678-1234-1234-1234-123456789abc
Environment: QA
```

### Production Environment (`icraftstories.com`)

**GitHub Actions Secrets**:
```
Name: CRISP_WEBSITE_ID_PROD
Value: abcdef12-abcd-abcd-abcd-abcdef123456  # Production Website ID
```

**Cloudflare Workers Environment Variables**:
```
Variable: VITE_CRISP_WEBSITE_ID
Value: abcdef12-abcd-abcd-abcd-abcdef123456
Environment: Production
```

---

## Step 4: Update `.env.example`

**File**: `frontend/.env.example`

Add:
```bash
# Crisp Chat Integration
VITE_CRISP_WEBSITE_ID=your-website-id-here  # Get from crisp.chat dashboard
VITE_CRISP_ENABLED=true  # Enable/disable chat widget
```

---

## Step 5: Update GitHub Actions Workflows

### Development Workflow

**File**: `frontend/.github/workflows/deploy-dev.yml`

Add environment variable:
```yaml
env:
  VITE_CRISP_WEBSITE_ID: ${{ secrets.CRISP_WEBSITE_ID_DEV }}
  VITE_CRISP_ENABLED: true
```

### QA Workflow

**File**: `frontend/.github/workflows/deploy-qa.yml`

Add environment variable:
```yaml
env:
  VITE_CRISP_WEBSITE_ID: ${{ secrets.CRISP_WEBSITE_ID_QA }}
  VITE_CRISP_ENABLED: true
```

### Production Workflow

**File**: `frontend/.github/workflows/deploy-prod.yml`

Add environment variable:
```yaml
env:
  VITE_CRISP_WEBSITE_ID: ${{ secrets.CRISP_WEBSITE_ID_PROD }}
  VITE_CRISP_ENABLED: true
```

---

## Step 6: Crisp Dashboard Configuration

### Development/QA Website Settings

#### General Settings
```
Website Name: iCraftStories Development
Website URL: https://dev.icraftstories.com
Allowed Domains: dev.icraftstories.com, qa.icraftstories.com, localhost:3000
```

#### Appearance
```
Color: #3B82F6 (blue - indicates dev/qa)
Position: Bottom-right
Widget Text: "Dev Support - Need help?"
Show "TEST" badge: Yes (visual indicator it's not production)
```

#### Availability
```
Status: Always available (24/7)
Business Hours: Not enforced (dev/qa needs flexibility)
Auto-Responder: "This is the development support channel. Expect longer response times."
```

#### Team Members
```
- developers@icraftstories.com (Admin)
- qa@icraftstories.com (Operator)
```

#### Chatbox Settings
```
Pre-chat Form: Disabled (for faster testing)
Offline Message: Enabled
Email Forwarding: dev-support@icraftstories.com
```

---

### Production Website Settings

#### General Settings
```
Website Name: iCraftStories
Website URL: https://icraftstories.com
Allowed Domains: icraftstories.com
```

#### Appearance
```
Color: #10B981 (green - matches brand)
Position: Bottom-right
Widget Text: "Need help? Chat with us!"
Show "TEST" badge: No
```

#### Availability
```
Status: Business Hours
Business Hours:
  Monday-Friday: 9:00 AM - 6:00 PM PST
  Saturday: 10:00 AM - 2:00 PM PST
  Sunday: Closed

Auto-Responder (Offline):
  "Thanks for contacting iCraftStories support! 👋

  We're currently offline, but we'll respond within 24 hours.

  In the meantime:
  📚 Help Center: https://icraftstories.com/help
  📧 Email: support@icraftstories.com

  For urgent billing issues, email billing@icraftstories.com"
```

#### Team Members
```
- support@icraftstories.com (Admin)
- support2@icraftstories.com (Operator)
```

#### Chatbox Settings
```
Pre-chat Form: Enabled
  - Collect: Name, Email (pre-filled if authenticated)
  - Question: "How can we help you today?"

Offline Message: Enabled
Email Forwarding: support@icraftstories.com
```

---

## Step 7: Environment-Specific Widget Behavior

**File**: `frontend/src/components/CrispChatWidget.tsx`

Add environment detection:

```typescript
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';

// Different behavior per environment
const widgetConfig = {
  development: {
    delayShow: 5000,        // Show quickly for testing
    hideOnPaths: ['/auth'], // Minimal hiding
    enableProactive: false, // No proactive messages (annoying for devs)
  },
  qa: {
    delayShow: 10000,       // 10 second delay
    hideOnPaths: ['/auth', '/checkout'],
    enableProactive: true,  // Test proactive triggers
  },
  production: {
    delayShow: 15000,       // 15 second delay (reduce noise)
    hideOnPaths: ['/auth', '/story-editor/', '/checkout'],
    enableProactive: true,  // Full proactive engagement
  }
};

const config = widgetConfig[environment] || widgetConfig.development;
```

---

## Step 8: Testing Each Environment

### Development (`dev.icraftstories.com`)
```bash
# 1. Deploy to development
npm run deploy:dev

# 2. Verify environment variable
echo $VITE_CRISP_WEBSITE_ID  # Should match Dev Website ID

# 3. Open browser
https://dev.icraftstories.com

# 4. Check Crisp dashboard
# Website: iCraftStories Development
# Should see visitor from dev.icraftstories.com
```

### QA (`qa.icraftstories.com`)
```bash
# 1. Deploy to QA
npm run deploy:qa

# 2. Verify environment variable
echo $VITE_CRISP_WEBSITE_ID  # Should match QA Website ID

# 3. Open browser
https://qa.icraftstories.com

# 4. Check Crisp dashboard
# Website: iCraftStories Development (if shared) or iCraftStories QA
# Should see visitor from qa.icraftstories.com
```

### Production (`icraftstories.com`)
```bash
# 1. Deploy to production
npm run deploy:prod

# 2. Verify environment variable
echo $VITE_CRISP_WEBSITE_ID  # Should match Prod Website ID

# 3. Open browser
https://icraftstories.com

# 4. Check Crisp dashboard
# Website: iCraftStories
# Should see visitor from icraftstories.com
```

---

## Verification Checklist

### For Each Environment:

- [ ] Chat widget appears in bottom-right corner
- [ ] Widget color matches environment (blue=dev/qa, green=prod)
- [ ] "TEST" badge shows on dev/qa, hidden on production
- [ ] User can open/close chat window
- [ ] Messages sent from browser appear in Crisp dashboard
- [ ] Support team can reply from dashboard
- [ ] User receives reply in browser
- [ ] Correct Website ID in dashboard (check visitor source URL)
- [ ] User identification works (name, email populate in dashboard)

### Environment Isolation Test:

1. Send message on **dev.icraftstories.com**
2. Check Crisp dashboard → Select **iCraftStories Development**
3. Message should appear ✅

4. Send message on **icraftstories.com**
5. Check Crisp dashboard → Select **iCraftStories** (production)
6. Message should appear in **separate website** ✅

**Result**: Messages don't mix between environments.

---

## Troubleshooting

### Widget Doesn't Appear

**Check**:
1. Environment variable set? `console.log(import.meta.env.VITE_CRISP_WEBSITE_ID)`
2. Website ID correct? (copy from Crisp dashboard)
3. Domain allowed in Crisp settings?
4. Browser console errors?
5. Ad blocker blocking Crisp?

**Fix**:
```typescript
// Add debug logging to CrispChatWidget.tsx
console.log('Crisp config:', {
  websiteId: import.meta.env.VITE_CRISP_WEBSITE_ID,
  enabled: import.meta.env.VITE_CRISP_ENABLED,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT
});
```

### Messages Go to Wrong Environment

**Check**:
1. Which Website ID is loaded? `window.CRISP_WEBSITE_ID`
2. Matches expected environment?
3. Cloudflare Workers environment variables set correctly?

**Fix**:
- Verify GitHub Actions secrets match environment
- Check Cloudflare Workers dashboard → Settings → Environment Variables
- Redeploy with correct Website ID

### "Development" Badge Shows on Production

**Check**:
1. Crisp dashboard → Settings → Chatbox → Advanced
2. "Show TEST badge" should be OFF for production

**Fix**:
- Production website: Disable "Show TEST badge"
- Dev/QA website: Enable "Show TEST badge"

---

## Security Considerations

### Protect Website IDs

**Do**:
- ✅ Store in GitHub Secrets (not in code)
- ✅ Use environment variables
- ✅ Different Website IDs per environment
- ✅ Restrict team access in Crisp dashboard

**Don't**:
- ❌ Commit Website IDs to git
- ❌ Share Website IDs publicly
- ❌ Use same Website ID across all environments
- ❌ Give everyone admin access in Crisp

### Domain Restrictions

**In Crisp Dashboard** → Settings → Website Settings → Allowed Domains:

**Development/QA**:
```
dev.icraftstories.com
qa.icraftstories.com
localhost:3000
```

**Production**:
```
icraftstories.com
```

**Result**: Widget only works on approved domains.

---

## Cost Analysis Per Environment

### Free Plan (2 Operators Per Website)

**Development/QA Website** (shared):
- 2 operators (dev team)
- Unlimited conversations
- Cost: **$0/month**

**Production Website** (dedicated):
- 2 operators (support team)
- Unlimited conversations
- Cost: **$0/month**

**Total Cost**: **$0/month**

### Pro Plan (if needed later)

**Development/QA**: Not needed (low traffic)

**Production**: $25/operator/month
- 2 operators: **$50/month**
- 5 operators: **$125/month**

**Recommendation**: Start with Free Plan, upgrade production only if needed.

---

## Migration Plan (if consolidating environments later)

### Scenario: Combine Dev/QA into one website

**Current**: 3 separate Crisp websites
**Target**: 2 Crisp websites (Dev+QA shared, Prod separate)

**Steps**:
1. Export chat history from Dev website (CSV export)
2. Export chat history from QA website (CSV export)
3. Delete Dev and QA websites in Crisp
4. Create new "iCraftStories Development" website
5. Update GitHub secrets (both Dev and QA use new Website ID)
6. Redeploy dev and qa environments
7. Verify both domains work with shared website

**Data Loss**: Previous chat history (export first!)

---

## Summary

### Configuration Matrix

| Environment | URL | Crisp Website | Website ID | Badge | Business Hours |
|------------|-----|---------------|------------|-------|----------------|
| **Local Dev** | localhost:3000 | Dev/QA | `12345...abc` | TEST | Always On |
| **Dev** | dev.icraftstories.com | Dev/QA | `12345...abc` | TEST | Always On |
| **QA** | qa.icraftstories.com | Dev/QA | `12345...abc` | TEST | Always On |
| **Prod** | icraftstories.com | Production | `abcdef...456` | None | 9am-6pm PST |

### Next Steps

1. [ ] Create 2 Crisp websites (Dev/QA + Production)
2. [ ] Get Website IDs from dashboard
3. [ ] Add GitHub Actions secrets
4. [ ] Add Cloudflare Workers environment variables
5. [ ] Update GitHub Actions workflows
6. [ ] Configure Crisp dashboard settings
7. [ ] Deploy to each environment
8. [ ] Test widget on each environment
9. [ ] Verify messages don't mix between environments

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
**Status**: Ready for Implementation
