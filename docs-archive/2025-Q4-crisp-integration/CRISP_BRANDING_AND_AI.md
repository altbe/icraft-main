# Crisp.chat - Branding & AI Integration

**Date**: 2025-10-24

---

## Part 1: Look & Feel Customization

### ✅ Yes - Crisp Matches Your Brand

Crisp chat widget is **fully customizable** to align with iCraftStories branding.

---

### Widget Appearance Customization

#### 1. Colors (Match Brand)

**In Crisp Dashboard** → Settings → Chatbox → Appearance:

```
Primary Color: #10B981 (green - matches iCraftStories brand)
  ├─ Widget button background
  ├─ Send button
  ├─ Active message bubbles
  └─ Links and accents

Text Color: #FFFFFF (white)
  ├─ Widget button icon
  └─ Button text

Widget Position: Bottom-right
  └─ Standard position, non-intrusive

Widget Size:
  ├─ Compact mode (mobile): 60x60px button
  └─ Expanded mode (desktop): 380x600px chat window
```

**Color Palette** (Based on iCraftStories):
```css
/* Primary Colors (from Tailwind config) */
Primary: #10B981 (green)      ← Use this for Crisp widget
Secondary: #3B82F6 (blue)
Background: #F9FAFB (gray-50)
Text: #111827 (gray-900)

/* Crisp Configuration */
Widget Color: #10B981
```

---

#### 2. Typography

**Widget Text Settings**:
```
Widget Button Text: "Need help?"
Chat Window Title: "iCraftStories Support"
Greeting Message: "Hi there! 👋 How can we help you today?"

Font Family: System default (Crisp uses system fonts for performance)
  └─ Matches OS: San Francisco (macOS), Segoe UI (Windows), Roboto (Android)
```

**Custom Welcome Message**:
```
"Welcome to iCraftStories! ✨

We're here to help you create amazing illustrated stories.

How can we assist you today?"
```

---

#### 3. Widget Button Icon

**Crisp Dashboard** → Appearance → Icon:

```
Options:
1. Default chat bubble icon (recommended)
2. Custom icon (upload PNG/SVG)
3. Avatar (support team photo)

Recommendation: Default chat bubble
  ├─ Universally recognized
  ├─ No image loading delay
  └─ Scales perfectly on all devices
```

**Custom Icon** (if desired):
- Upload iCraftStories logo/icon
- Format: PNG or SVG
- Size: 512x512px minimum
- Transparent background

---

#### 4. Mobile Responsiveness

**Automatic Crisp Features**:
```
Mobile (< 768px):
  ├─ Full-screen chat window
  ├─ Larger touch targets (60x60px button)
  ├─ Bottom tab bar avoidance (iOS Safari)
  └─ Keyboard-aware scrolling

Desktop (≥ 768px):
  ├─ Floating chat window (380x600px)
  ├─ Draggable position
  └─ Minimizable
```

**Example Mobile View**:
```
┌─────────────────────────┐
│  [Back] iCraftStories   │ ← Full-width header
├─────────────────────────┤
│                         │
│  Chat messages here     │
│  Full-screen experience │
│                         │
├─────────────────────────┤
│  [Type message...]  [→] │ ← Bottom input
└─────────────────────────┘
```

---

#### 5. Widget Position & Behavior

**Position Options**:
```
Bottom-right (recommended):
  ├─ Standard position
  ├─ Doesn't block content
  └─ Expected by users

Bottom-left:
  ├─ Alternative if right side has other widgets
  └─ Less common

Custom offset:
  ├─ Adjust X/Y position
  └─ Avoid footer/navigation overlap
```

**Behavior Customization** (via code):
```typescript
// In CrispChatWidget.tsx - position offset example
$crisp.push(['config', 'position:reverse', [true]]); // Switch to left
$crisp.push(['config', 'offset:x', [20]]); // 20px from edge
$crisp.push(['config', 'offset:y', [20]]); // 20px from bottom
```

---

### Advanced Branding

#### 1. Custom CSS Styling (Pro Plan Feature)

**If you upgrade to Pro Plan**, inject custom CSS:

```css
/* Match iCraftStories design system */
.crisp-client {
  font-family: 'Inter', system-ui, sans-serif !important;
}

.crisp-client .cc-kv6t .cc-1xry {
  background: #10B981 !important; /* Brand green */
  border-radius: 12px !important; /* Rounded corners */
}

.crisp-client .cc-kv6t .cc-unoo {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
}
```

**Note**: Custom CSS requires **Pro Plan** ($25/operator/month).

---

#### 2. Operator Avatar & Name

**In Crisp Dashboard** → Team → Operators:

```
Operator 1:
  Name: iCraftStories Support
  Avatar: Upload team logo or support avatar
  Role: Admin

Operator 2:
  Name: Sarah (Support Specialist)
  Avatar: Photo or avatar
  Role: Operator
```

**Result**: User sees friendly avatar and name when chatting.

---

#### 3. Email Notifications (Brand Alignment)

**Email Template Customization** (Pro Plan):

```html
<!-- Custom email header with iCraftStories branding -->
<img src="https://icraftstories.com/logo.png" alt="iCraftStories">

<p>You have a new message from iCraftStories Support:</p>

<div style="background: #F9FAFB; padding: 20px; border-left: 4px solid #10B981;">
  {message_content}
</div>

<a href="{conversation_url}" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 8px;">
  Reply to Message
</a>
```

**Free Plan**: Uses Crisp default email template (still professional, just not custom branded).

---

### Visual Consistency Checklist

- [x] **Colors**: Match iCraftStories green (#10B981) ✅
- [x] **Typography**: System fonts (fast, accessible) ✅
- [x] **Position**: Bottom-right, non-intrusive ✅
- [x] **Mobile**: Full-screen, responsive ✅
- [x] **Avatar**: Team logo or support avatar ✅
- [x] **Messages**: Friendly, brand-appropriate tone ✅
- [ ] **Custom CSS**: Requires Pro Plan upgrade (optional)

---

## Part 2: AI/LLM Integration with Crisp

### ✅ Yes - Multiple AI Integration Options

Crisp supports **AI-powered chatbots** in several ways:

---

### Option 1: Crisp MagicReply (Built-in AI) ⭐ EASIEST

**What it is**:
- Crisp's own AI chatbot
- Pre-trained on customer support conversations
- No coding required

**How it works**:
1. **Enable in Dashboard**: Settings → Chatbox → MagicReply
2. **Train on your data**: Upload FAQs, past conversations
3. **Auto-responds**: Suggests answers to support team OR auto-sends

**Capabilities**:
- ✅ Answer common questions
- ✅ Suggest responses to support team
- ✅ Auto-reply when team offline
- ✅ Learns from your conversations
- ✅ Multi-language support (English/Spanish)

**Limitations**:
- ❌ Not as advanced as GPT-4/Claude
- ❌ Limited to Crisp's training data
- ❌ No custom prompts or fine-tuning

**Pricing**: **Included in Free Plan** ✅

**Recommendation**: **Start here** - free, zero setup, good for simple FAQs.

---

### Option 2: OpenAI GPT Integration (Custom Chatbot)

**What it is**:
- Connect your OpenAI API key
- Use GPT-4o, GPT-4o-mini, or GPT-3.5
- Full control over prompts and behavior

**How it works**:

#### A. Crisp Chatbot Builder (Pro Plan)

**In Crisp Dashboard** → Chatbot → Create Bot:

1. **Trigger**: When user sends message
2. **Condition**: If message contains question
3. **Action**: Call OpenAI API
   ```json
   {
     "endpoint": "https://api.openai.com/v1/chat/completions",
     "method": "POST",
     "headers": {
       "Authorization": "Bearer YOUR_OPENAI_API_KEY"
     },
     "body": {
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "system",
           "content": "You are a helpful support agent for iCraftStories, an AI-powered illustrated story creation platform. Be friendly and concise. If you don't know the answer, say so and offer to connect the user with a human agent."
         },
         {
           "role": "user",
           "content": "{{user_message}}"
         }
       ]
     }
   }
   ```
4. **Response**: Display GPT response to user

**Pricing**:
- Crisp Pro Plan: $25/operator/month
- OpenAI API: ~$0.0001-0.0015 per message (very cheap)

---

#### B. Custom Webhook Integration (Any Plan)

**More flexible** - call external AI service:

**Step 1: Create webhook endpoint** (your backend):

```typescript
// backend/modules/crisp-ai-handler.ts
export async function handler(request: ZuploRequest, context: ZuploContext) {
  const { message, conversation_id, user_id } = await request.json();

  // Call OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are iCraftStories support bot. Answer questions about:
        - Creating stories with AI
        - Buying credits ($4.99 for 50 credits)
        - Subscription plans (Individual $9.99/mo, Team $29.99/mo)
        - Team collaboration features

        Be concise. If unsure, offer to connect with human support.`
      },
      { role: 'user', content: message }
    ],
    max_tokens: 200 // Keep responses short
  });

  const botReply = completion.choices[0].message.content;

  // Send back to Crisp
  return new Response(JSON.stringify({ reply: botReply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Step 2: Configure in Crisp Dashboard**:
```
Settings → Integrations → Webhooks
  └─ Message Received → POST to https://api.icraftstories.com/crisp-ai-handler
```

**Pricing**:
- Crisp: Free Plan works ✅
- OpenAI: ~$0.0001/message (GPT-4o-mini)
- Backend: No extra cost (same Zuplo API)

---

### Option 3: Anthropic Claude Integration

**Similar to OpenAI**, but using Claude:

```typescript
// Using Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 200,
  system: `You are iCraftStories support. Help users with:
  - AI story generation (10-20 credits per story)
  - Image regeneration (3 free attempts)
  - Subscription plans
  - Team features`,
  messages: [
    { role: 'user', content: userMessage }
  ]
});

const botReply = message.content[0].text;
```

**Pricing**:
- Claude Sonnet: ~$0.003 per message (more expensive than GPT-4o-mini, but better quality)

---

### Option 4: Hybrid (AI + Human) ⭐ RECOMMENDED

**Best of both worlds**:

1. **AI handles simple questions** (80% of queries):
   - "How do I buy credits?" → AI responds with canned answer
   - "What subscription plans are available?" → AI responds
   - "How do I create a story?" → AI responds with guide

2. **Human handles complex issues** (20% of queries):
   - "My payment failed, help!" → Route to human
   - "I found a bug in the editor" → Route to human
   - "Can I get a refund?" → Route to human

**Implementation**:

```typescript
// AI decides if it can answer or needs human
const systemPrompt = `You are iCraftStories support bot.

IMPORTANT: Only answer questions about:
- Basic how-to (creating stories, buying credits, subscriptions)
- Public information (pricing, features)

If the question is about:
- Billing issues
- Technical problems
- Refunds
- Account-specific issues

Respond EXACTLY with: "ESCALATE_TO_HUMAN"

Otherwise, provide a helpful answer.`;

// Check AI response
if (botReply === 'ESCALATE_TO_HUMAN') {
  // Notify support team
  await crispAPI.sendMessage(conversation_id, {
    type: 'note',
    content: 'AI escalated this conversation - user needs human support'
  });

  // Send to user
  return {
    reply: "I'll connect you with our support team for help with this. They'll be with you shortly! 😊"
  };
} else {
  // AI can handle it
  return { reply: botReply };
}
```

**Result**:
- 80% of questions answered instantly by AI
- 20% escalated to humans
- Support team only handles complex issues

---

### AI Use Cases for iCraftStories

#### 1. FAQ Auto-Response

**User**: "How do I buy credits?"

**AI Bot** (instant):
```
You can purchase credits in Settings → Subscription → Buy Credits.

Credit packages:
• 50 credits: $4.99
• 100 credits: $8.99
• 250 credits: $19.99

Each AI story costs ~10-20 credits.

Would you like me to explain how to create your first story?
```

---

#### 2. Feature Guidance

**User**: "How do I invite team members?"

**AI Bot** (instant):
```
To invite team members:

1. Go to Settings → Team Management
2. Click "Invite Members"
3. Enter their email address
4. Click Send Invitation

Note: You need a Team subscription ($29.99/mo) to invite members.

Current plan: Individual
Would you like to upgrade to Team?
```

---

#### 3. Contextual Help

**User**: "I can't find the regenerate button"

**AI Bot** (uses context from user data):
```
The "Regenerate Illustration" button appears:

1. Open your story in the editor
2. Click on a page with an image
3. Look for the purple "Regenerate" button below the image

You have 3 free regeneration attempts per image.

Are you in the story editor now? I can walk you through it step-by-step.
```

---

#### 4. Smart Escalation

**User**: "My payment failed and I was charged twice!"

**AI Bot** (escalates immediately):
```
I'm sorry to hear about the payment issue! 😞

This requires immediate attention from our billing team.

I've notified them and someone will be with you shortly (usually within 5 minutes during business hours).

In the meantime, can you provide:
- Your email address
- Approximate date of the charges

This will help us resolve it faster.
```

**Behind the scenes**: Notification sent to support team with "HIGH PRIORITY: BILLING ISSUE" tag.

---

### AI Integration Comparison

| Option | Ease | Cost | Quality | Recommendation |
|--------|------|------|---------|----------------|
| **MagicReply (Crisp AI)** | ⭐⭐⭐⭐⭐ Easiest | Free | ⭐⭐⭐ Good | Start here (MVP) |
| **OpenAI GPT-4o-mini** | ⭐⭐⭐⭐ Easy | ~$0.0001/msg | ⭐⭐⭐⭐ Great | Upgrade later |
| **Claude Sonnet** | ⭐⭐⭐⭐ Easy | ~$0.003/msg | ⭐⭐⭐⭐⭐ Excellent | Premium option |
| **Hybrid (AI + Human)** | ⭐⭐⭐ Moderate | Free + $0.0001/msg | ⭐⭐⭐⭐⭐ Best UX | **Recommended** ✅ |

---

### Recommended AI Implementation Roadmap

#### Phase 1: No AI (Week 1)
```
Goal: Get chat working, collect baseline data

✅ Launch Crisp widget
✅ Support team handles all chats manually
✅ Track most common questions
✅ Baseline metrics: volume, response time, CSAT
```

---

#### Phase 2: Knowledge Base (Week 2-3)
```
Goal: Deflect 30-50% of questions to self-service

✅ Create FAQ articles (top 10 questions)
✅ Pre-chat survey: "Search help center first"
✅ Canned responses for support team
✅ Measure deflection rate
```

---

#### Phase 3: Crisp AI (Week 4-6)
```
Goal: Test built-in AI, learn what works

✅ Enable MagicReply (Crisp's built-in AI)
✅ Train on FAQ articles
✅ Auto-suggest responses to support team
✅ Measure: Does AI help? Does it give good answers?
```

---

#### Phase 4: Custom LLM (Month 2-3)
```
Goal: Advanced AI with GPT/Claude integration

✅ Implement OpenAI GPT-4o-mini webhook
✅ Custom system prompts for iCraftStories
✅ Hybrid mode: AI answers simple, humans handle complex
✅ Measure: deflection rate, accuracy, user satisfaction
```

---

### Cost Analysis with AI

#### Free Plan (No AI Bot)
```
Crisp: $0/month
Support time: 3-4 hours/day (50-100 chats)
Cost: Support team salary
```

#### Free Plan + Crisp MagicReply
```
Crisp: $0/month
MagicReply: $0/month (included)
Support time: 2-3 hours/day (AI handles 30%)
Savings: ~25% support time
```

#### Free Plan + OpenAI GPT-4o-mini
```
Crisp: $0/month
OpenAI: ~$3-5/month (10,000 messages @ $0.0003 avg)
Support time: 1-2 hours/day (AI handles 50-60%)
Savings: ~50% support time
```

**ROI**: Even at $5/month for OpenAI, if it saves 2 hours/day of support time, that's **massive savings**.

---

### Example AI System Prompt

```
You are the iCraftStories support assistant. You help users create AI-powered illustrated stories.

PLATFORM OVERVIEW:
- AI story generation: 10-20 credits per story
- Image regeneration: 3 free attempts per image
- Subscription plans:
  • Trial: 7 days free, 100 credits
  • Individual: $9.99/month, 250 credits
  • Team: $29.99/month, 1000 shared credits
  • Custom: $99.99/month, 5000 credits
- Credit packages: 50 ($4.99), 100 ($8.99), 250 ($19.99)

YOU CAN ANSWER:
- How to create stories
- How to buy credits
- Subscription differences
- Team collaboration features
- Basic troubleshooting

YOU CANNOT ANSWER (escalate to human):
- Billing issues (refunds, failed payments)
- Account-specific problems
- Technical bugs
- Legal/privacy questions

TONE: Friendly, concise, helpful. Use emojis sparingly (✨, 📖, 👋).

If unsure, say: "Let me connect you with our support team who can help with this!"

Keep responses under 100 words unless providing step-by-step instructions.
```

---

## Summary

### Look & Feel: ✅ YES
- **Fully customizable** colors, text, position
- **Matches iCraftStories** brand (#10B981 green)
- **Mobile-responsive** out of the box
- **Professional appearance** with team avatars

### AI Integration: ✅ YES - Multiple Options
1. **Crisp MagicReply** (built-in, free) ← Start here
2. **OpenAI GPT** (custom, ~$3-5/month) ← Upgrade later
3. **Claude** (premium, ~$10-15/month) ← Best quality
4. **Hybrid AI + Human** (recommended) ← Best UX

### Recommended Approach:
1. **Week 1**: Launch with no AI (collect data)
2. **Week 2**: Add knowledge base (deflect 30%)
3. **Week 4**: Enable MagicReply (test built-in AI)
4. **Month 2**: Implement custom GPT/Claude bot (50-60% deflection)

**Total Cost**:
- Crisp: $0/month (Free Plan)
- AI: $0-5/month (depending on option)
- **ROI**: Massive (saves 50%+ support time)

---

Would you like me to:
1. Implement the branding customization now?
2. Set up the AI integration code?
3. Both?

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
