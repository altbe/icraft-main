# Crisp.chat - Single Website Configuration

**Date**: 2025-10-24
**Setup**: One Crisp website for all environments (dev, qa, production)

---

## Simplified Architecture

**One Crisp Website**:
```
Website Name: iCraftStories
Allowed Domains:
  - icraftstories.com (production)
  - qa.icraftstories.com (qa)
  - dev.icraftstories.com (development)
  - localhost:3000 (local development)
```

**Benefits**:
- ✅ **Simpler management**: One dashboard for all environments
- ✅ **Unified chat history**: All conversations in one place
- ✅ **Easier for support team**: No switching between websites
- ✅ **Free plan sufficient**: One website, 2 operators
- ✅ **Single Website ID**: Same configuration everywhere

**Considerations**:
- ⚠️ Test chats from dev/qa mix with production chats
- ⚠️ Can't have different settings per environment
- ✅ **Solution**: Use custom data fields to identify environment

---

## Step 1: Create Single Crisp Website

### Crisp Dashboard Setup

1. **Go to**: https://app.crisp.chat
2. **Create Website**:
   ```
   Name: iCraftStories
   URL: https://icraftstories.com
   ```

3. **Settings → Website Settings**:
   ```
   Allowed Domains:
     icraftstories.com
     qa.icraftstories.com
     dev.icraftstories.com
     localhost:3000
   ```

4. **Get Website ID**:
   - Settings → Website Settings → Website ID
   - Example: `abcdef12-abcd-abcd-abcd-abcdef123456`

---

## Step 2: Configure Environment Variables

### Same Website ID Everywhere

**Local Development** (`.env.local`):
```bash
VITE_CRISP_WEBSITE_ID=abcdef12-abcd-abcd-abcd-abcdef123456
VITE_CRISP_ENABLED=true
```

**GitHub Actions Secrets**:
```
Name: CRISP_WEBSITE_ID
Value: abcdef12-abcd-abcd-abcd-abcdef123456
```

*Note: Only ONE secret needed (same ID for all environments)*

**Cloudflare Workers Environment Variables**:

All environments use the same Website ID:

```
Variable: VITE_CRISP_WEBSITE_ID
Value: abcdef12-abcd-abcd-abcd-abcdef123456

Environments: Development, QA, Production (all use same value)
```

---

## Step 3: Environment Identification

### Track Environment in User Data

**Update `useCrispChat.ts`** to send environment info:

```typescript
// In loadUserContext() function
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';

// Send environment as custom data
CrispSDK.setUserData('environment', environment);
CrispSDK.addUserSegment(`env_${environment}`); // Segment for filtering
```

**Result in Crisp Dashboard**:
```
User: Jane Doe
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Custom Data:
┌────────────────────────────┐
│ environment: production    │  ← Shows which environment
│ subscription_plan: team    │
│ credit_balance: 250        │
└────────────────────────────┘

Segments:
🏷️ env_production  ← Can filter by environment
🏷️ team
```

---

## Step 4: Update `.env.example`

**File**: `frontend/.env.example`

```bash
# Crisp Chat Integration
VITE_CRISP_WEBSITE_ID=abcdef12-abcd-abcd-abcd-abcdef123456  # Same for all environments
VITE_CRISP_ENABLED=true
```

---

## Step 5: Update GitHub Actions Workflows

**All workflows use the same secret:**

### Development Workflow (`deploy-dev.yml`)
```yaml
env:
  VITE_CRISP_WEBSITE_ID: ${{ secrets.CRISP_WEBSITE_ID }}  # Same secret
  VITE_CRISP_ENABLED: true
```

### QA Workflow (`deploy-qa.yml`)
```yaml
env:
  VITE_CRISP_WEBSITE_ID: ${{ secrets.CRISP_WEBSITE_ID }}  # Same secret
  VITE_CRISP_ENABLED: true
```

### Production Workflow (`deploy-prod.yml`)
```yaml
env:
  VITE_CRISP_WEBSITE_ID: ${{ secrets.CRISP_WEBSITE_ID }}  # Same secret
  VITE_CRISP_ENABLED: true
```

---

## Step 6: Crisp Dashboard Configuration

### General Settings
```
Website Name: iCraftStories
Website URL: https://icraftstories.com
Allowed Domains:
  - icraftstories.com
  - qa.icraftstories.com
  - dev.icraftstories.com
  - localhost:3000
```

### Appearance
```
Color: #10B981 (green - brand color)
Position: Bottom-right
Widget Text: "Need help? Chat with us!"
```

### Availability
```
Business Hours:
  Monday-Friday: 9:00 AM - 6:00 PM PST
  Saturday: 10:00 AM - 2:00 PM PST
  Sunday: Closed

Auto-Responder (Offline):
  "Thanks for contacting iCraftStories support! 👋

  We're currently offline, but we'll respond within 24 hours.

  In the meantime:
  📚 Help Center: https://icraftstories.com/help
  📧 Email: support@icraftstories.com"
```

### Team Members
```
- support@icraftstories.com (Admin)
- support2@icraftstories.com (Operator)
```

### Custom Data Fields
```
- environment (string)          ← NEW: Identify dev/qa/prod
- subscription_plan (string)
- subscription_status (string)
- credit_balance (number)
- team_id (string)
- team_name (string)
- team_role (string)
```

### Segments
```
- env_development    ← NEW: Filter dev environment chats
- env_qa            ← NEW: Filter QA environment chats
- env_production    ← NEW: Filter production chats
- individual        (existing)
- team             (existing)
- trial            (existing)
```

---

## Step 7: Filter by Environment in Dashboard

### How to View Only Production Chats

**In Crisp Dashboard**:
1. Go to Conversations
2. Click **Filters**
3. Select **Segments** → `env_production`
4. Save filter as "Production Only"

**Result**: Only see chats from icraftstories.com

### How to Identify Environment in Chat

**When viewing a conversation**:
1. Look at **Custom Data** section
2. Check `environment` field
3. Values: `development`, `qa`, or `production`

**Visual Cues**:
- URL in browser bar shows which domain user is on
- Segments show `env_production`, `env_qa`, or `env_development`

---

## Step 8: Environment-Specific Widget Behavior

**Still customize behavior per environment** (even with single website):

**File**: `frontend/src/components/CrispChatWidget.tsx`

```typescript
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';

// Different behavior per environment
const widgetConfig = {
  development: {
    delayShow: 5000,         // Show quickly for testing
    hideOnPaths: ['/auth'],  // Minimal hiding
    enableProactive: false,  // No proactive (annoying for devs)
  },
  qa: {
    delayShow: 10000,        // 10 second delay
    hideOnPaths: ['/auth', '/checkout'],
    enableProactive: true,   // Test proactive triggers
  },
  production: {
    delayShow: 15000,        // 15 second delay (reduce noise)
    hideOnPaths: ['/auth', '/story-editor/', '/checkout'],
    enableProactive: true,   // Full proactive engagement
  }
};

const config = widgetConfig[environment] || widgetConfig.development;
```

**Result**: Same Crisp website, but different behavior based on environment variable.

---

## Implementation Checklist

### One-Time Setup
- [ ] Create Crisp website "iCraftStories"
- [ ] Add all domains (production, qa, dev, localhost)
- [ ] Get Website ID from dashboard
- [ ] Add `CRISP_WEBSITE_ID` to GitHub secrets (one secret)
- [ ] Add to Cloudflare Workers environment variables (same value for all)

### Code Changes
- [ ] Update `.env.example` with Website ID
- [ ] Update GitHub Actions workflows (all use same secret)
- [ ] Add environment tracking to `useCrispChat.ts`:
  ```typescript
  CrispSDK.setUserData('environment', environment);
  CrispSDK.addUserSegment(`env_${environment}`);
  ```

### Crisp Dashboard
- [ ] Configure allowed domains (all 4)
- [ ] Add custom data field: `environment`
- [ ] Create segments: `env_development`, `env_qa`, `env_production`
- [ ] Configure business hours
- [ ] Add canned responses

### Testing
- [ ] Test on localhost (environment: `development`)
- [ ] Test on dev.icraftstories.com (environment: `development`)
- [ ] Test on qa.icraftstories.com (environment: `qa`)
- [ ] Test on icraftstories.com (environment: `production`)
- [ ] Verify environment shows in Crisp dashboard for each test

---

## Filtering & Organization

### Saved Filters in Crisp Dashboard

Create these filters for easy access:

**Filter 1: Production Only**
```
Name: Production Chats
Filters: Segment = env_production
```

**Filter 2: Dev/QA Only**
```
Name: Dev/QA Chats
Filters: Segment = env_development OR env_qa
```

**Filter 3: Trial Users (Production)**
```
Name: Production Trials
Filters: Segment = env_production AND trial_user
```

### Organization Tips

1. **Color Code Messages** (manual tags):
   - 🔴 Production issues (high priority)
   - 🟡 QA testing feedback
   - 🟢 Dev environment questions

2. **Use Internal Notes**:
   - "This is from dev environment - test message"
   - "QA testing feature X"
   - "Production user - high priority"

3. **Archive Dev/QA Chats**:
   - Periodically archive test conversations
   - Keep dashboard clean for production support

---

## Advantages of Single Website

### For Support Team
- ✅ **One dashboard to monitor** (no switching)
- ✅ **Unified chat history** (see all past conversations)
- ✅ **Simpler onboarding** (only one system to learn)
- ✅ **Easier to find conversations** (single search)

### For Development
- ✅ **Simpler configuration** (one Website ID everywhere)
- ✅ **Faster deployment** (no environment-specific setup)
- ✅ **Easier testing** (test with real production settings)
- ✅ **No data isolation issues** (all environments consistent)

### For Business
- ✅ **Free plan sufficient** (one website = $0/month)
- ✅ **Less complexity** (fewer moving parts)
- ✅ **Faster time to market** (quicker to set up)

---

## Best Practices

### Mark Test Chats Clearly

**In Development/QA**:
When testing, start chat with:
```
"[TEST] Testing image regeneration feature"
```

Support team knows to ignore/archive these.

### Use Tags Liberally

**In Crisp Dashboard**, tag conversations:
- `dev-test` - Development testing
- `qa-test` - QA testing
- `production` - Real production issue
- `billing` - Billing question
- `technical` - Technical support

### Archive Old Test Chats

**Monthly task**:
1. Filter by `env_development` OR `env_qa`
2. Select all conversations older than 30 days
3. Archive them
4. Keeps dashboard clean

---

## Troubleshooting

### Can't Tell Which Environment Chat is From

**Check**:
1. Custom Data → `environment` field
2. Segments → Look for `env_production`, etc.
3. User's URL → Shows domain in visitor info

**If Missing**:
- Check `useCrispChat.ts` sends environment data
- Verify environment variable is set correctly

### All Environments Show Same Settings

**This is expected** - single website = single settings.

**Workaround**:
- Use code to customize behavior per environment
- Example: Different delay times, hide rules
- Crisp dashboard settings apply to all

### Test Chats Cluttering Dashboard

**Solution 1**: Use filters to hide dev/qa
- Create "Production Only" filter
- Set as default view

**Solution 2**: Archive test chats regularly
- Weekly: Archive all dev/qa conversations
- Keeps focus on production support

---

## Summary

### Configuration Matrix (Simplified)

| Environment | URL | Crisp Website | Website ID | Behavior |
|------------|-----|---------------|------------|----------|
| **Local** | localhost:3000 | iCraftStories | `abcdef...456` | 5s delay, minimal hiding |
| **Dev** | dev.icraftstories.com | iCraftStories | `abcdef...456` | 5s delay, minimal hiding |
| **QA** | qa.icraftstories.com | iCraftStories | `abcdef...456` | 10s delay, proactive enabled |
| **Prod** | icraftstories.com | iCraftStories | `abcdef...456` | 15s delay, full noise management |

**Key Insight**: Same Website ID everywhere, different behavior via environment variable.

---

## Cost Analysis

**Single Website**:
```
Website: iCraftStories
  - 2 operators
  - Unlimited conversations
  - All environments (dev, qa, prod)
  - Cost: $0/month ✅
```

**Total Cost**: **$0/month**

---

## Next Steps

1. [ ] **Create ONE Crisp website** (iCraftStories)
2. [ ] **Add all 4 domains** to allowed list
3. [ ] **Get Website ID** from dashboard
4. [ ] **Add ONE GitHub secret** (CRISP_WEBSITE_ID)
5. [ ] **Update code** to send environment data
6. [ ] **Create segments** in Crisp (env_development, env_qa, env_production)
7. [ ] **Test on all environments**
8. [ ] **Create saved filters** in dashboard
9. [ ] **Train support team** on filtering by environment

---

**Estimated Setup Time**: 2-3 hours (vs 4-6 hours for multiple websites)

**Maintenance**: Minimal (one website to manage)

**Complexity**: Low ✅

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
**Status**: ✅ Ready for Implementation (Simplified)
