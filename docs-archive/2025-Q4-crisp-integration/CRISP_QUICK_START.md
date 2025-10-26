# Crisp.chat - Quick Start Guide

**Date**: 2025-10-24
**Setup Type**: Single website (all environments)
**Time to Complete**: 2-3 hours

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Create Crisp Account (10 minutes)

1. Go to https://crisp.chat
2. Sign up (free plan)
3. Create website:
   ```
   Name: iCraftStories
   URL: https://icraftstories.com
   ```
4. **Settings → Website Settings → Allowed Domains**:
   ```
   icraftstories.com
   qa.icraftstories.com
   dev.icraftstories.com
   localhost:3000
   ```
5. **Copy Website ID** (looks like: `abcdef12-abcd-abcd-abcd-abcdef123456`)

---

### Step 2: Add GitHub Secret (2 minutes)

1. Go to your GitHub repository
2. **Settings → Secrets → Actions**
3. Click **New repository secret**
4. Name: `CRISP_WEBSITE_ID`
5. Value: `<your-website-id-from-step-1>`
6. Click **Add secret**

**That's it! Same secret used for all environments (dev, qa, prod).**

---

### Step 3: Update `.env.example` (1 minute)

**File**: `frontend/.env.example`

Add these lines:
```bash
# Crisp Chat Integration
VITE_CRISP_WEBSITE_ID=your-website-id-here
VITE_CRISP_ENABLED=true
```

---

### Step 4: Create Local `.env.local` (1 minute)

**File**: `frontend/.env.local` (create if doesn't exist)

```bash
# Copy from .env.example and add your Website ID
VITE_CRISP_WEBSITE_ID=abcdef12-abcd-abcd-abcd-abcdef123456
VITE_CRISP_ENABLED=true
```

---

### Step 5: Implement Components (2-3 hours)

See **CRISP_CHAT_INTEGRATION_PLAN.md** for complete code.

**Files to create**:
1. `frontend/src/types/crisp.d.ts` - TypeScript definitions
2. `frontend/src/lib/crisp.ts` - SDK wrapper utilities
3. `frontend/src/hooks/useCrispChat.ts` - React hook
4. `frontend/src/components/CrispChatWidget.tsx` - Main component

**File to modify**:
5. `frontend/src/App.tsx` - Add `<CrispChatWidget />` component

---

## ✅ Verification Checklist

After setup:

- [ ] Chat widget appears on localhost:3000
- [ ] Widget appears on dev.icraftstories.com
- [ ] Widget appears on qa.icraftstories.com
- [ ] Widget appears on icraftstories.com
- [ ] Can send message from browser
- [ ] Message appears in Crisp dashboard (https://app.crisp.chat)
- [ ] Support team can reply
- [ ] User receives reply in browser

---

## 🎯 Configuration Summary

**Single Website Setup**:
```
Crisp Website: iCraftStories (one website)
  └─ Allowed Domains:
       ├─ icraftstories.com (production)
       ├─ qa.icraftstories.com (qa)
       ├─ dev.icraftstories.com (development)
       └─ localhost:3000 (local dev)

GitHub Secret: CRISP_WEBSITE_ID (one secret for all environments)

Environment Variables:
  - All environments use same Website ID
  - Behavior customized via VITE_SENTRY_ENVIRONMENT
```

---

## 📊 Environment Tracking

**How to know which environment a chat is from:**

Each chat shows in dashboard:
```
Custom Data:
┌────────────────────────────┐
│ environment: production    │  ← Shows dev/qa/prod
│ subscription_plan: team    │
│ credit_balance: 250        │
└────────────────────────────┘

Segments:
🏷️ env_production  ← Filter by environment
🏷️ team
```

**Filter production chats only**:
1. Go to Crisp dashboard → Conversations
2. Click Filters → Segments
3. Select `env_production`
4. Save as "Production Only"

---

## 🎨 Recommended Dashboard Settings

### Business Hours
```
Monday-Friday: 9am-6pm PST
Saturday: 10am-2pm PST
Sunday: Closed
```

### Auto-Responder (Offline)
```
Thanks for contacting iCraftStories support! 👋

We're currently offline, but we'll respond within 24 hours.

In the meantime:
📚 Help Center: https://icraftstories.com/help
📧 Email: support@icraftstories.com
```

### Custom Data Fields (Add These)
- `environment` (string) - Which environment (dev/qa/prod)
- `subscription_plan` (string) - User's subscription
- `subscription_status` (string) - Active/cancelled/etc
- `credit_balance` (number) - Current credits
- `team_id` (string) - Team ID if team member
- `team_name` (string) - Team name if team member
- `team_role` (string) - Owner or member

### Segments (Add These)
- `env_development` - Development environment chats
- `env_qa` - QA environment chats
- `env_production` - Production chats
- `trial_user` - Trial users (high priority)
- `team_owner` - Team owners (high priority)
- `individual` - Individual plan users
- `team` - Team plan users

---

## 💰 Cost

**Free Plan**:
- ✅ 1 website
- ✅ 2 operators
- ✅ Unlimited conversations
- ✅ All 4 domains (prod, qa, dev, localhost)
- **Cost: $0/month**

---

## 🔧 Troubleshooting

### Widget doesn't appear

**Check**:
```bash
# 1. Environment variable set?
console.log(import.meta.env.VITE_CRISP_WEBSITE_ID)
# Should output: "abcdef12-abcd-abcd-abcd-abcdef123456"

# 2. Browser console errors?
# Open DevTools → Console → Look for Crisp errors

# 3. Ad blocker?
# Disable ad blocker and refresh

# 4. Domain allowed in Crisp?
# Crisp dashboard → Settings → Allowed Domains
# Should include: icraftstories.com, qa.icraftstories.com, dev.icraftstories.com, localhost:3000
```

### Messages go to wrong dashboard

**Not possible** - only one website, so all messages go to same place.

**Filter by environment**:
- Use Crisp filters to show only production chats
- Check `environment` field in custom data

---

## 📁 Files Reference

### Complete Implementation Code
See: `CRISP_CHAT_INTEGRATION_PLAN.md` (sections 1-4)

### Noise Management Strategies
See: `CRISP_NOISE_MANAGEMENT_STRATEGY.md`

### Privacy Policy Updates
See: `CRISP_PRIVACY_POLICY_UPDATES.md`

### Detailed Configuration
See: `CRISP_SINGLE_WEBSITE_CONFIG.md`

---

## 🎯 Next Steps After Setup

### Week 1: Monitor
- [ ] Watch chat volume daily
- [ ] Track response times
- [ ] Collect baseline metrics

### Week 2: Optimize
- [ ] Create knowledge base (top 10 FAQs)
- [ ] Add canned responses
- [ ] Configure proactive triggers

### Week 3: Refine
- [ ] Implement noise management strategies
- [ ] A/B test visibility delays
- [ ] Add more KB articles based on common questions

---

## 🆘 Support

**Crisp Support**:
- Email: support@crisp.chat
- Docs: https://docs.crisp.chat
- Community: https://community.crisp.chat

**Internal Questions**:
- Technical: dev@icraftstories.com
- Legal/Privacy: legal@icraftstories.com

---

**Setup Time**: 2-3 hours
**Difficulty**: Easy ✅
**Cost**: $0/month ✅
**Maintenance**: Low ✅

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
**Status**: ✅ Ready to Implement
