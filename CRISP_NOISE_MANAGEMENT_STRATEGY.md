# Crisp Chat - Noise Management Strategy

**Date**: 2025-10-24
**Status**: Implementation Plan
**Context**: Show chat to all visitors, but manage support volume

---

## Challenge

**Goal**: Provide chat support to all users without overwhelming the support team.

**Problem**: Unrestricted chat access can lead to:
- High volume of simple questions
- Interruptions during user onboarding
- Support team burnout
- Reduced response quality

---

## Noise Management Strategies

### 1. Smart Widget Visibility

**Don't show widget immediately** - implement delays and triggers:

```typescript
// In CrispChatWidget.tsx
const [showWidget, setShowWidget] = React.useState(false);

React.useEffect(() => {
  // Strategy A: Delay initial display (reduce impulsive clicks)
  const timer = setTimeout(() => {
    setShowWidget(true);
  }, 10000); // Show after 10 seconds on page

  return () => clearTimeout(timer);
}, []);

// Strategy B: Show only after user scrolls 50% down page
React.useEffect(() => {
  const handleScroll = () => {
    const scrollPercentage = (window.scrollY / document.body.scrollHeight) * 100;
    if (scrollPercentage > 50 && !showWidget) {
      setShowWidget(true);
    }
  };

  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [showWidget]);

// Apply visibility
React.useEffect(() => {
  if (!isLoaded || !showWidget) return;

  CrispSDK.show();
}, [isLoaded, showWidget]);
```

**Recommendation**: Combine strategies:
- First-time visitors: 30-second delay + scroll trigger
- Returning visitors: Show immediately (they know what they're looking for)
- Mobile: Always show (harder to find help menu)

---

### 2. Page-Based Visibility Rules

**Hide widget on specific pages** where users are focused or don't need help:

```typescript
// In CrispChatWidget.tsx
const HIDE_ON_PATHS = [
  '/auth/sign-in',           // Authentication flows (minimize distractions)
  '/auth/sign-up',
  '/story-editor/',          // Creative focus mode
  '/checkout',               // Don't interrupt purchase flow
  '/payment-success',        // Success pages
];

const AUTO_HIDE_ON_PATHS = [
  '/library',                // Auto-hide (user can open if needed)
  '/community',
  '/settings',
];

React.useEffect(() => {
  if (!isLoaded) return;

  const currentPath = window.location.pathname;

  // Completely hide widget
  if (HIDE_ON_PATHS.some(path => currentPath.startsWith(path))) {
    CrispSDK.hide();
    return;
  }

  // Auto-hide but keep accessible (widget button still clickable)
  if (AUTO_HIDE_ON_PATHS.some(path => currentPath.startsWith(path))) {
    CrispSDK.close(); // Close chat window but keep widget button
    return;
  }

  // Show on all other pages
  CrispSDK.show();
}, [location.pathname, isLoaded]);
```

---

### 3. Knowledge Base First Approach

**Deflect common questions to self-service** before showing live chat:

#### A. Crisp Knowledge Base Integration
Create FAQ articles in Crisp dashboard:
- "How do I buy credits?"
- "How do I create a story?"
- "How do I invite team members?"
- "What subscription plans are available?"
- "How do I change my subscription?"

#### B. Custom Pre-Chat Survey
Configure in Crisp dashboard → Settings → Chatbox → Pre-chat form:

```
Before chatting, try searching our help center:
[Search box]

Common topics:
- 💳 Buying credits
- 📖 Creating stories
- 👥 Team management
- 🔧 Account settings
- 💰 Billing questions

Still need help? [Start Chat]
```

#### C. Automated Bot Responses
Configure chatbot in Crisp (Pro plan feature, but can use triggers on Free plan):

**User**: "How do I buy credits?"
**Bot**: "You can purchase credits in Settings → Subscription. Here's a quick guide: [link]"
**Bot**: "Did this answer your question? [Yes] [No, connect me to support]"

---

### 4. Business Hours & Availability

**Show availability status** to set expectations:

```typescript
// Configure in Crisp dashboard
Business Hours:
- Monday-Friday: 9am-5pm PST
- Saturday-Sunday: Closed

Auto-Responder (outside business hours):
"Thanks for contacting iCraftStories support! 👋

We're currently offline, but we'll respond to your message within 24 hours.

In the meantime, check out our help center: [link]

For urgent issues, email us at support@icraftstories.com"
```

**Visual Indicator**:
- Green dot: "We're online - average response time: 2 minutes"
- Red dot: "We're offline - we'll respond within 24 hours"

---

### 5. Proactive Triggers (Smart, Not Spammy)

**Trigger messages based on user behavior**, not random:

#### Trigger 1: First Story Created
```typescript
// When user creates their first story
CrispSDK.sendEvent('first_story_created');

// Crisp dashboard trigger:
// IF event = 'first_story_created' AND visit_count = 1
// THEN show message after 60 seconds:
"Congrats on your first story! 🎉 Need help with the editor? I'm here if you need me!"
```

#### Trigger 2: Stuck on Subscription Page
```typescript
// If user views /subscription page for > 2 minutes
CrispSDK.sendEvent('subscription_page_hesitation', {
  timeOnPage: 120 // seconds
});

// Crisp trigger:
"Looking at subscription plans? Let me know if you have any questions about features or pricing!"
```

#### Trigger 3: Empty State (No Stories)
```typescript
// After 5 minutes on app with 0 stories
CrispSDK.sendEvent('empty_state_hesitation');

// Crisp trigger:
"I see you haven't created a story yet. Would you like a quick walkthrough?"
```

**Rules for Proactive Messages**:
- ✅ Contextual (based on user behavior, not random)
- ✅ Delayed (60+ seconds, not instant)
- ✅ Closeable (user can dismiss without penalty)
- ✅ Limited (max 1 proactive message per session)
- ❌ Never interrupt active work (story editing, checkout)

---

### 6. User Segmentation & Targeting

**Prioritize support for high-value users**:

#### Segment 1: Trial Users (High Priority)
```typescript
// In useCrispChat.ts
if (subscriptionData?.planId === 'trial') {
  CrispSDK.addUserSegment('trial_user');
  CrispSDK.setUserData('priority', 'high'); // Support team sees this
}
```

**Crisp Dashboard**: Configure to show "High Priority" badge for trial users.

**Benefit**: Support team focuses on converting trial users to paid.

#### Segment 2: Team Owners (High Priority)
```typescript
if (teamData?.role === 'owner') {
  CrispSDK.addUserSegment('team_owner');
  CrispSDK.setUserData('priority', 'high');
}
```

**Benefit**: Team owners represent multiple users, higher LTV.

#### Segment 3: Free Users (Standard Priority)
```typescript
if (!subscriptionData || subscriptionData.planId === 'free') {
  CrispSDK.addUserSegment('free_user');
  CrispSDK.setUserData('priority', 'standard');
}
```

**Crisp Configuration**:
- Trial/Team users: Instant notifications
- Free users: 5-minute notification delay (batch responses)

---

### 7. Canned Responses for Efficiency

**Pre-written responses** to common questions (save time):

#### Setup in Crisp Dashboard

**Shortcuts** (type `/shortcut` to insert):

```
/credits
"You can purchase credits in Settings → Subscription → Buy Credits.
Credit packages:
• 50 credits: $4.99
• 100 credits: $8.99
• 250 credits: $19.99
Each AI-generated story costs ~10-20 credits."

/invite
"To invite team members:
1. Go to Settings → Team Management
2. Click 'Invite Members'
3. Enter their email address
4. They'll receive an invitation link
Note: You need a Team subscription to invite members."

/subscription
"Our subscription plans:
• Trial: 7 days free, 100 credits
• Individual: $9.99/month, 250 credits/month
• Team: $29.99/month, 1000 shared credits
• Custom: $99.99/month, 5000 credits + priority support
You can upgrade/downgrade anytime in Settings → Subscription."

/billing
"For billing questions:
• View invoices: Settings → Subscription → Billing History
• Update payment method: Settings → Subscription → Payment Method
• Cancel subscription: Settings → Subscription → Cancel Plan
If you need help, I can assist you further!"
```

**Time Savings**: 2-3 minutes per response → 30 seconds with canned responses.

---

### 8. Offline Message Management

**Queue messages when support is offline**:

#### Email Forwarding
Configure in Crisp: Settings → Email → Forward to `support@icraftstories.com`

**Auto-Responder**:
```
"Thanks for your message! We're currently offline.

Your message has been sent to our support team via email.
We'll respond within 24 hours.

For immediate help:
📚 Help Center: https://icraftstories.com/help
📧 Email: support@icraftstories.com
```

#### Daily Digest
Support team receives:
- Morning digest: All overnight messages
- End-of-day digest: Unanswered messages

**Benefit**: No messages slip through the cracks.

---

### 9. Analytics & Continuous Improvement

**Track metrics** to identify noise sources:

#### Key Metrics (Crisp Dashboard)
- **Most common questions** → Add to knowledge base
- **Average messages per conversation** → Too high = noise
- **First response time** → Track degradation
- **User satisfaction (CSAT)** → Monitor for quality drop

#### Monthly Review
- Identify top 10 questions
- Create knowledge base articles for each
- Update chatbot to deflect these questions
- Measure reduction in chat volume

**Goal**: Reduce chat volume by 30-50% over 3 months via self-service.

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [x] Basic widget integration
- [x] User identification
- [x] Business hours configuration
- [x] Offline auto-responder

### Phase 2: Noise Reduction (Week 2)
- [ ] Implement smart visibility (delayed show)
- [ ] Configure page-based hiding rules
- [ ] Set up canned responses
- [ ] Create knowledge base (top 10 FAQs)

### Phase 3: Proactive Support (Week 3)
- [ ] Implement user segmentation (trial, team, free)
- [ ] Configure proactive triggers
- [ ] Set up priority routing
- [ ] Add custom events tracking

### Phase 4: Optimization (Ongoing)
- [ ] Monitor metrics monthly
- [ ] Update knowledge base with new common questions
- [ ] Refine proactive triggers based on data
- [ ] A/B test visibility strategies

---

## Recommended Configuration for iCraftStories

### Widget Visibility Strategy
```typescript
// Recommended settings for CrispChatWidget
<CrispChatWidget
  enabled={true}
  autoIdentify={true}
  fetchContext={true}

  // Noise management settings
  delayShow={15000}              // Show after 15 seconds
  hideOnPaths={[                 // Hide on these pages
    '/auth/',
    '/story-editor/',
    '/checkout'
  ]}
  autoHideOnPaths={[             // Auto-hide but keep accessible
    '/library',
    '/community'
  ]}

  // Proactive triggers
  enableProactive={true}
  maxProactivePerSession={1}

  // User segmentation
  prioritySegments={['trial_user', 'team_owner']}
/>
```

### Business Hours
```
Monday-Friday: 9am-6pm PST
Saturday: 10am-2pm PST
Sunday: Closed
```

### Expected Volume (Estimates)
**Before Optimization**:
- 50-100 chats/day
- 3-5 messages per chat
- ~300 messages/day

**After Optimization** (3 months):
- 20-40 chats/day (60% reduction via knowledge base)
- 2-3 messages per chat (canned responses)
- ~80 messages/day (73% reduction)

### Support Team Capacity
**Free Plan** (2 operators):
- Can handle ~40 chats/day comfortably
- Average 5 minutes per chat
- ~3-4 hours of support time/day

**Recommendation**: Start with Free Plan, monitor volume, upgrade if needed.

---

## Success Metrics

### Month 1 (Baseline)
- Chat volume: Track daily
- Response time: < 5 minutes average
- CSAT: > 80%
- Knowledge base: 0 articles

### Month 2 (Optimization)
- Chat volume: -20% (via knowledge base)
- Response time: < 3 minutes average
- CSAT: > 85%
- Knowledge base: 10 articles

### Month 3 (Mature)
- Chat volume: -40% (via knowledge base + bot)
- Response time: < 2 minutes average
- CSAT: > 90%
- Knowledge base: 20 articles
- Bot deflection rate: 30%

---

## Next Steps

1. [ ] Implement basic widget (Phase 1)
2. [ ] Monitor volume for 1 week (baseline)
3. [ ] Implement noise management (Phase 2)
4. [ ] Create top 10 FAQ knowledge base articles
5. [ ] Configure canned responses
6. [ ] Monitor metrics and iterate

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
**Status**: Ready for Implementation
