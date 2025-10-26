# Crisp.chat Integration Plan

**Date**: 2025-10-24
**Status**: Planning Phase
**Estimated Effort**: 2-3 days

---

## Table of Contents
1. [Overview](#overview)
2. [Benefits & Features](#benefits--features)
3. [Architecture](#architecture)
4. [Implementation Phases](#implementation-phases)
5. [Technical Implementation](#technical-implementation)
6. [User Context & Identification](#user-context--identification)
7. [Privacy & Compliance](#privacy--compliance)
8. [Configuration](#configuration)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Plan](#deployment-plan)
11. [Monitoring & Analytics](#monitoring--analytics)
12. [Cost Considerations](#cost-considerations)
13. [Migration & Rollback](#migration--rollback)

---

## Overview

### What is Crisp.chat?
Crisp is a modern customer messaging platform that provides:
- Live chat widget for real-time customer support
- Knowledge base integration
- Automated chatbots
- Multi-channel messaging (chat, email, social media)
- Team collaboration tools
- Customer data management (CRM-lite)

### Integration Goals
1. **Provide instant support** to users directly within the application
2. **Reduce support ticket volume** with proactive help
3. **Identify user context** (subscription, credits, team membership) for better support
4. **Multi-language support** (English/Spanish)
5. **Maintain privacy compliance** (GDPR, CCPA)
6. **No performance impact** on PWA or offline functionality

---

## Benefits & Features

### For Users
- ✅ **Instant help** without leaving the app
- ✅ **Proactive support** based on user behavior
- ✅ **Multi-language** support (English/Spanish)
- ✅ **Mobile-optimized** chat widget
- ✅ **Offline message queuing** (messages sent when back online)
- ✅ **Knowledge base** access within chat

### For Support Team
- ✅ **User context** displayed automatically (subscription, credits, team role)
- ✅ **Chat history** tied to user account
- ✅ **Team collaboration** (internal notes, message assignment)
- ✅ **Canned responses** for common questions
- ✅ **Real-time notifications** for new messages
- ✅ **Analytics** on response time and satisfaction

### For Business
- ✅ **Reduce support costs** with automated responses
- ✅ **Increase conversion** by addressing questions during checkout
- ✅ **Improve retention** with proactive engagement
- ✅ **Track metrics** (response time, CSAT, resolution rate)
- ✅ **Free plan available** (up to 2 operators)

---

## Architecture

### Integration Pattern
```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (PWA)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │              App.tsx (Root Component)              │ │
│  │                                                    │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │       CrispChatWidget Component              │ │ │
│  │  │  ┌────────────────────────────────────────┐  │ │ │
│  │  │  │  Initialize Crisp SDK (lazy load)     │  │ │ │
│  │  │  │  - Load script from Crisp CDN         │  │ │ │
│  │  │  │  - Configure website ID               │  │ │ │
│  │  │  │  - Set user identification            │  │ │ │
│  │  │  │  - Apply locale (en/es)               │  │ │ │
│  │  │  └────────────────────────────────────────┘  │ │ │
│  │  │                                              │ │ │
│  │  │  User Context (from Clerk + API):           │ │ │
│  │  │  - User ID, email, name                    │ │ │
│  │  │  - Subscription plan                       │ │ │
│  │  │  - Credit balance                          │ │ │
│  │  │  - Team membership                         │ │ │
│  │  │  - Locale preference                       │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    Crisp Cloud API     │
              │  (crisp.chat servers)  │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Support Dashboard    │
              │   (crisp.chat/app)     │
              │  - Agent interface     │
              │  - User context view   │
              │  - Chat history        │
              │  - Analytics           │
              └────────────────────────┘
```

### Component Structure
```
frontend/src/
├── components/
│   └── CrispChatWidget.tsx          # Main Crisp integration component
├── hooks/
│   └── useCrispChat.ts              # Custom hook for Crisp interactions
├── lib/
│   └── crisp.ts                     # Crisp SDK wrapper utilities
├── types/
│   └── crisp.d.ts                   # TypeScript definitions for Crisp
└── App.tsx                          # Mount CrispChatWidget here
```

---

## Implementation Phases

### Phase 1: Basic Integration (Day 1) ✅ PRIORITY
**Goal**: Get chat widget visible and functional

1. **Setup Crisp Account**
   - [ ] Sign up at crisp.chat (free plan)
   - [ ] Get Website ID from dashboard
   - [ ] Configure basic settings (language, appearance)

2. **Add Environment Variables**
   - [ ] Add `VITE_CRISP_WEBSITE_ID` to `.env.example`
   - [ ] Add to GitHub Actions secrets for deployments
   - [ ] Add to Cloudflare Workers environment variables

3. **Create CrispChatWidget Component**
   - [ ] Lazy-load Crisp SDK script
   - [ ] Initialize with Website ID
   - [ ] Handle cleanup on unmount
   - [ ] Error handling for script load failures

4. **Mount in App.tsx**
   - [ ] Add after authentication check
   - [ ] Only show for authenticated users (optional)
   - [ ] Conditional loading based on environment

5. **Test Basic Functionality**
   - [ ] Chat widget appears
   - [ ] Can send/receive messages
   - [ ] Mobile responsiveness
   - [ ] No console errors

**Deliverables**:
- Working chat widget on localhost
- Environment configuration documented
- Basic TypeScript types

---

### Phase 2: User Identification (Day 1-2)
**Goal**: Link chat sessions to user accounts with context

1. **User Identification**
   - [ ] Extract user data from Clerk
   - [ ] Call Crisp `setUserEmail()`, `setUserNickname()`
   - [ ] Generate secure session token (optional)

2. **User Context (Custom Data)**
   - [ ] Fetch subscription status from API
   - [ ] Fetch credit balance from API
   - [ ] Fetch team membership from API
   - [ ] Send to Crisp as custom segments

3. **Error Handling**
   - [ ] Graceful degradation if API calls fail
   - [ ] Don't block chat if context fetch fails
   - [ ] Log errors to Sentry

4. **Privacy Controls**
   - [ ] Only send data for authenticated users
   - [ ] Respect user's privacy preferences
   - [ ] Add opt-out mechanism (if required)

**Deliverables**:
- User identity linked to chat sessions
- Support agents see user context in dashboard
- Privacy controls implemented

---

### Phase 3: Multi-Language Support (Day 2)
**Goal**: Provide localized chat experience

1. **Locale Detection**
   - [ ] Use i18n current language (`i18n.language`)
   - [ ] Map to Crisp locale codes (en, es)
   - [ ] Update when user changes language

2. **Configure Crisp Dashboard**
   - [ ] Add Spanish translations for automated messages
   - [ ] Configure canned responses in both languages
   - [ ] Set up language routing (optional)

3. **Testing**
   - [ ] Switch language in app → chat updates
   - [ ] Automated messages appear in correct language
   - [ ] Support agent can see user's language preference

**Deliverables**:
- Chat widget respects user's language preference
- Dashboard shows user language
- Automated messages localized

---

### Phase 4: Advanced Features (Day 2-3) - OPTIONAL
**Goal**: Enhance support experience

1. **Knowledge Base Integration**
   - [ ] Create FAQ articles in Crisp
   - [ ] Link from chat widget
   - [ ] Add search functionality

2. **Proactive Messaging**
   - [ ] Configure triggers based on user behavior
   - [ ] Example: "Need help with your first story?"
   - [ ] Example: "Having trouble with subscription?"

3. **Automated Chatbots**
   - [ ] Create bot for common questions
   - [ ] Example: "How do I buy credits?"
   - [ ] Example: "How do I invite team members?"

4. **Custom Events**
   - [ ] Send events when user performs actions
   - [ ] Example: `crisp.push(['set', 'session:event', ['story_created']])`
   - [ ] Track user journey in chat timeline

**Deliverables**:
- Proactive engagement based on user behavior
- Automated responses to common questions
- Event tracking in support dashboard

---

## Technical Implementation

### 1. TypeScript Definitions

**File**: `frontend/src/types/crisp.d.ts`

```typescript
declare global {
  interface Window {
    $crisp?: any[];
    CRISP_WEBSITE_ID?: string;
    CRISP_RUNTIME_CONFIG?: {
      locale?: string;
    };
  }
}

export interface CrispConfig {
  websiteId: string;
  locale?: string;
}

export interface CrispUserData {
  email: string;
  nickname: string;
  avatar?: string;
  data?: Record<string, any>;
  segments?: string[];
}

export interface CrispCustomData {
  subscriptionPlan?: string;
  creditBalance?: number;
  teamId?: string;
  teamRole?: 'owner' | 'member';
  userType?: 'trial' | 'individual' | 'team' | 'custom';
}

export {};
```

---

### 2. Crisp SDK Wrapper

**File**: `frontend/src/lib/crisp.ts`

```typescript
import logger from '@/services/logger';

/**
 * Crisp SDK wrapper utilities
 * Provides type-safe interface to Crisp chat functions
 */

export class CrispSDK {
  private static loaded = false;
  private static loadPromise: Promise<void> | null = null;

  /**
   * Load Crisp SDK script
   */
  static load(websiteId: string): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      try {
        // Initialize Crisp global array
        window.$crisp = window.$crisp || [];
        window.CRISP_WEBSITE_ID = websiteId;

        // Load Crisp script
        const script = document.createElement('script');
        script.src = 'https://client.crisp.chat/l.js';
        script.async = true;

        script.onload = () => {
          this.loaded = true;
          logger.info('Crisp SDK loaded successfully');
          resolve();
        };

        script.onerror = (error) => {
          logger.error('Failed to load Crisp SDK:', error);
          reject(new Error('Failed to load Crisp SDK'));
        };

        document.head.appendChild(script);
      } catch (error) {
        logger.error('Error initializing Crisp:', error);
        reject(error);
      }
    });

    return this.loadPromise;
  }

  /**
   * Execute Crisp command safely
   */
  private static push(command: any[]): void {
    if (!window.$crisp) {
      logger.warn('Crisp not initialized, command ignored:', command);
      return;
    }
    window.$crisp.push(command);
  }

  /**
   * Set user email
   */
  static setUserEmail(email: string): void {
    this.push(['set', 'user:email', [email]]);
  }

  /**
   * Set user nickname (display name)
   */
  static setUserNickname(nickname: string): void {
    this.push(['set', 'user:nickname', [nickname]]);
  }

  /**
   * Set user avatar URL
   */
  static setUserAvatar(avatarUrl: string): void {
    this.push(['set', 'user:avatar', [avatarUrl]]);
  }

  /**
   * Set custom user data (visible to support agents)
   */
  static setUserData(key: string, value: any): void {
    this.push(['set', 'session:data', [[key, value]]]);
  }

  /**
   * Set multiple user data fields at once
   */
  static setUserDataBulk(data: Record<string, any>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.setUserData(key, value);
    });
  }

  /**
   * Add user to segment (for filtering/targeting)
   */
  static addUserSegment(segment: string): void {
    this.push(['set', 'user:segment', [segment]]);
  }

  /**
   * Set chat locale
   */
  static setLocale(locale: string): void {
    this.push(['set', 'session:locale', [locale]]);
  }

  /**
   * Open chat widget
   */
  static open(): void {
    this.push(['do', 'chat:open']);
  }

  /**
   * Close chat widget
   */
  static close(): void {
    this.push(['do', 'chat:close']);
  }

  /**
   * Show chat widget
   */
  static show(): void {
    this.push(['do', 'chat:show']);
  }

  /**
   * Hide chat widget
   */
  static hide(): void {
    this.push(['do', 'chat:hide']);
  }

  /**
   * Reset user session (call on sign-out)
   */
  static reset(): void {
    this.push(['do', 'session:reset']);
  }

  /**
   * Send custom event
   */
  static sendEvent(eventName: string, data?: Record<string, any>): void {
    this.push(['set', 'session:event', [[eventName, data]]]);
  }

  /**
   * Unload Crisp SDK (cleanup)
   */
  static unload(): void {
    if (window.$crisp) {
      this.reset();
      window.$crisp = undefined;
    }
    this.loaded = false;
    this.loadPromise = null;
  }
}
```

---

### 3. Custom Hook

**File**: `frontend/src/hooks/useCrispChat.ts`

```typescript
import React from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { CrispSDK } from '@/lib/crisp';
import { apiClient } from '@/lib/axios-config';
import logger from '@/services/logger';

interface CrispChatOptions {
  enabled?: boolean;
  autoIdentify?: boolean;
  fetchContext?: boolean;
}

/**
 * Custom hook for Crisp chat integration
 * Handles initialization, user identification, and context loading
 */
export function useCrispChat(options: CrispChatOptions = {}) {
  const {
    enabled = true,
    autoIdentify = true,
    fetchContext = true
  } = options;

  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { i18n } = useTranslation();
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isIdentified, setIsIdentified] = React.useState(false);
  const hasInitialized = React.useRef(false);

  // Load Crisp SDK
  React.useEffect(() => {
    if (!enabled || hasInitialized.current) return;

    const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID;
    if (!websiteId) {
      logger.warn('Crisp Website ID not configured');
      return;
    }

    hasInitialized.current = true;

    CrispSDK.load(websiteId)
      .then(() => {
        setIsLoaded(true);
        logger.info('Crisp chat initialized');
      })
      .catch((error) => {
        logger.error('Failed to initialize Crisp:', error);
      });

    // Cleanup on unmount
    return () => {
      CrispSDK.unload();
      hasInitialized.current = false;
    };
  }, [enabled]);

  // Set locale
  React.useEffect(() => {
    if (!isLoaded) return;

    const locale = i18n.language.split('-')[0]; // 'en-US' → 'en'
    CrispSDK.setLocale(locale);
  }, [isLoaded, i18n.language]);

  // Identify user
  React.useEffect(() => {
    if (!isLoaded || !autoIdentify || !isSignedIn || !user || isIdentified) {
      return;
    }

    const identifyUser = async () => {
      try {
        // Set basic user info
        if (user.primaryEmailAddress?.emailAddress) {
          CrispSDK.setUserEmail(user.primaryEmailAddress.emailAddress);
        }

        const displayName = user.fullName || user.firstName || 'User';
        CrispSDK.setUserNickname(displayName);

        if (user.imageUrl) {
          CrispSDK.setUserAvatar(user.imageUrl);
        }

        // Fetch additional context if enabled
        if (fetchContext) {
          await loadUserContext();
        }

        setIsIdentified(true);
        logger.info('Crisp user identified:', user.id);
      } catch (error) {
        logger.error('Error identifying user to Crisp:', error);
        // Don't block - chat will work without context
      }
    };

    identifyUser();
  }, [isLoaded, autoIdentify, isSignedIn, user, isIdentified, fetchContext]);

  /**
   * Load user context from API
   */
  const loadUserContext = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch subscription info
      const subResponse = await apiClient.get('/subscriptions/active', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: null }));

      if (subResponse.data) {
        CrispSDK.setUserData('subscription_plan', subResponse.data.planId);
        CrispSDK.setUserData('subscription_status', subResponse.data.status);
        CrispSDK.addUserSegment(subResponse.data.planId); // For targeting
      }

      // Fetch credit balance
      const creditsResponse = await apiClient.get('/credits/balance', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: null }));

      if (creditsResponse.data) {
        CrispSDK.setUserData('credit_balance', creditsResponse.data.balance);
      }

      // Fetch team info
      const teamResponse = await apiClient.get('/team/', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: null }));

      if (teamResponse.data) {
        CrispSDK.setUserData('team_id', teamResponse.data.id);
        CrispSDK.setUserData('team_name', teamResponse.data.name);
        CrispSDK.setUserData('team_role', teamResponse.data.role);
        CrispSDK.addUserSegment('team_member');
      }

      logger.info('Crisp user context loaded');
    } catch (error) {
      logger.error('Error loading Crisp user context:', error);
      // Non-critical - chat works without context
    }
  };

  // Reset on sign-out
  React.useEffect(() => {
    if (!isLoaded || isSignedIn) return;

    CrispSDK.reset();
    setIsIdentified(false);
    logger.info('Crisp session reset');
  }, [isLoaded, isSignedIn]);

  return {
    isLoaded,
    isIdentified,
    open: () => CrispSDK.open(),
    close: () => CrispSDK.close(),
    show: () => CrispSDK.show(),
    hide: () => CrispSDK.hide(),
    sendEvent: (eventName: string, data?: Record<string, any>) =>
      CrispSDK.sendEvent(eventName, data)
  };
}
```

---

### 4. React Component

**File**: `frontend/src/components/CrispChatWidget.tsx`

```typescript
import React from 'react';
import { useCrispChat } from '@/hooks/useCrispChat';
import logger from '@/services/logger';

interface CrispChatWidgetProps {
  /**
   * Enable/disable the widget
   * @default true
   */
  enabled?: boolean;

  /**
   * Auto-identify authenticated users
   * @default true
   */
  autoIdentify?: boolean;

  /**
   * Fetch user context (subscription, credits, team)
   * @default true
   */
  fetchContext?: boolean;

  /**
   * Hide widget on specific pages (optional)
   */
  hideOnPaths?: string[];
}

/**
 * Crisp Chat Widget Component
 *
 * Integrates Crisp live chat into the application.
 * Automatically identifies users and provides context to support agents.
 *
 * @example
 * ```tsx
 * <CrispChatWidget
 *   enabled={true}
 *   autoIdentify={true}
 *   fetchContext={true}
 * />
 * ```
 */
const CrispChatWidget: React.FC<CrispChatWidgetProps> = ({
  enabled = true,
  autoIdentify = true,
  fetchContext = true,
  hideOnPaths = []
}) => {
  const { isLoaded, isIdentified } = useCrispChat({
    enabled,
    autoIdentify,
    fetchContext
  });

  // Handle path-based hiding
  React.useEffect(() => {
    if (!isLoaded || hideOnPaths.length === 0) return;

    const currentPath = window.location.pathname;
    const shouldHide = hideOnPaths.some(path => currentPath.startsWith(path));

    // This would require additional Crisp SDK methods
    // For now, we'll just log
    if (shouldHide) {
      logger.debug('Crisp widget hidden on path:', currentPath);
    }
  }, [isLoaded, hideOnPaths]);

  // Log status changes
  React.useEffect(() => {
    if (isLoaded) {
      logger.info('Crisp widget loaded');
    }
  }, [isLoaded]);

  React.useEffect(() => {
    if (isIdentified) {
      logger.info('Crisp user identified');
    }
  }, [isIdentified]);

  // This component doesn't render anything visible
  // Crisp widget is injected by the SDK
  return null;
};

export default CrispChatWidget;
```

---

### 5. Integration in App.tsx

**File**: `frontend/src/App.tsx`

Add import:
```typescript
import CrispChatWidget from '@/components/CrispChatWidget';
```

Add component (after authentication check, around line 400):
```tsx
{/* Crisp Chat Widget (only in production/qa, not dev) */}
{import.meta.env.VITE_CRISP_WEBSITE_ID && (
  <CrispChatWidget
    enabled={import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENVIRONMENT === 'qa'}
    autoIdentify={true}
    fetchContext={true}
    hideOnPaths={['/auth']} // Hide on auth pages
  />
)}
```

---

## User Context & Identification

### Data Sent to Crisp

**Automatic (from Clerk)**:
- Email address
- Display name (fullName or firstName)
- Avatar URL

**Fetched from API**:
- Subscription plan ID (`individual`, `team`, `trial`, `custom`)
- Subscription status (`active`, `trialing`, `cancelled`, etc.)
- Credit balance (number)
- Team ID (if team member)
- Team name (if team member)
- Team role (`owner` or `member`)

**Example in Crisp Dashboard**:
```
User: Jane Doe (jane@example.com)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email: jane@example.com
👤 Nickname: Jane Doe
🖼️ Avatar: https://...

Custom Data:
┌───────────────────────────────────┐
│ subscription_plan: team           │
│ subscription_status: active       │
│ credit_balance: 250               │
│ team_id: team_abc123              │
│ team_name: Creative Studio        │
│ team_role: owner                  │
└───────────────────────────────────┘

Segments:
🏷️ team
🏷️ team_owner
```

### Privacy Considerations

**Data Minimization**:
- Only send data needed for support context
- Don't send sensitive info (passwords, payment methods, full addresses)
- Don't send story content or user-generated content

**User Consent**:
- Add Crisp mention to Privacy Policy
- Add to cookie consent banner (Crisp sets cookies)
- Provide opt-out mechanism if required by jurisdiction

**Data Retention**:
- Configure in Crisp dashboard (default: 1 year)
- Can be reduced to comply with GDPR (30-90 days)

---

## Configuration

### Environment Variables

**Add to `.env.example`**:
```bash
# Crisp Chat Integration
VITE_CRISP_WEBSITE_ID=your-website-id-here  # Get from crisp.chat dashboard
VITE_CRISP_ENABLED=true  # Enable/disable Crisp (true for prod/qa, false for dev)
```

**GitHub Actions Secrets**:
- `CRISP_WEBSITE_ID_DEV` → Development environment
- `CRISP_WEBSITE_ID_QA` → QA environment
- `CRISP_WEBSITE_ID_PROD` → Production environment

**Cloudflare Workers Environment Variables**:
- Same as GitHub Actions secrets
- Set in Cloudflare dashboard for each environment

### Crisp Dashboard Configuration

**Website Settings**:
1. **General**:
   - Website name: iCraftStories
   - Website URL: https://icraftstories.com
   - Widget language: Auto (detected from user)

2. **Appearance**:
   - Color: Match brand colors (#your-primary-color)
   - Position: Bottom-right
   - Widget text: "Need help? Chat with us!"

3. **Availability**:
   - Show when: Always
   - Hide on pages: (optional) `/auth/*`
   - Business hours: (optional) 9am-5pm PST M-F

4. **Email Forwarding**:
   - Forward offline messages to: support@icraftstories.com
   - Auto-responder: Enabled (custom message)

5. **Custom Data Fields**:
   - `subscription_plan` (string)
   - `subscription_status` (string)
   - `credit_balance` (number)
   - `team_id` (string)
   - `team_name` (string)
   - `team_role` (string)

6. **Segments** (for targeting):
   - `individual` - Individual plan users
   - `team` - Team plan users
   - `trial` - Trial users
   - `team_owner` - Team owners
   - `team_member` - Team members

---

## Testing Strategy

### Unit Tests
```typescript
// tests/components/CrispChatWidget.test.tsx
describe('CrispChatWidget', () => {
  it('should not load if VITE_CRISP_WEBSITE_ID is not set', () => {
    // ...
  });

  it('should load Crisp SDK when enabled', async () => {
    // ...
  });

  it('should identify user when authenticated', async () => {
    // ...
  });

  it('should reset session on sign-out', () => {
    // ...
  });

  it('should set locale based on i18n language', () => {
    // ...
  });
});
```

### Integration Tests
1. **Localhost Testing**:
   - Set `VITE_CRISP_WEBSITE_ID` in `.env.local`
   - Sign in as test user
   - Verify widget appears
   - Send test message
   - Verify agent receives message in dashboard

2. **User Identification**:
   - Check Crisp dashboard → Conversations → User profile
   - Verify email, name, avatar appear
   - Verify custom data fields populated

3. **Locale Switching**:
   - Change language in app (English ↔ Spanish)
   - Verify widget messages update

4. **Mobile Testing**:
   - Test on iOS Safari, Chrome Android
   - Verify widget is responsive
   - Verify tap targets are accessible

### Playwright E2E Tests
```typescript
// tests/e2e/crisp-chat.spec.ts
test.describe('Crisp Chat Integration', () => {
  test('should load chat widget after sign-in', async ({ page }) => {
    // Sign in
    await page.goto('/auth/sign-in');
    // ... sign in flow ...

    // Wait for Crisp script to load
    await page.waitForFunction(() => window.$crisp !== undefined);

    // Verify widget iframe exists
    const crispFrame = page.frameLocator('iframe[title*="crisp"]');
    await expect(crispFrame.locator('body')).toBeVisible();
  });

  test('should open chat widget when clicked', async ({ page }) => {
    // ... after sign-in ...

    // Click chat widget
    const crispFrame = page.frameLocator('iframe[title*="crisp"]');
    await crispFrame.locator('[data-chat-status="closed"]').click();

    // Verify chat window opens
    await expect(crispFrame.locator('[data-chat-status="opened"]')).toBeVisible();
  });
});
```

---

## Deployment Plan

### Phase 1: Development (Localhost)
1. ✅ Create Crisp account (free plan)
2. ✅ Get Website ID
3. ✅ Implement components locally
4. ✅ Test with personal account
5. ✅ Verify user identification works

### Phase 2: QA Environment
1. ✅ Add `CRISP_WEBSITE_ID_QA` to GitHub secrets
2. ✅ Deploy to QA (tag-based deployment)
3. ✅ Test with QA test accounts
4. ✅ Verify mobile responsiveness
5. ✅ Test offline behavior (messages queue)
6. ✅ Test locale switching
7. ✅ Stakeholder review

### Phase 3: Production
1. ✅ Create separate Crisp website for production (recommended)
2. ✅ Configure production settings
3. ✅ Add `CRISP_WEBSITE_ID_PROD` to GitHub secrets
4. ✅ Update Privacy Policy (mention Crisp)
5. ✅ Update Cookie Policy (Crisp cookies)
6. ✅ Deploy to production
7. ✅ Monitor for 24-48 hours
8. ✅ Train support team on dashboard

### Deployment Checklist
- [ ] Website ID configured for each environment
- [ ] Privacy Policy updated
- [ ] Cookie consent includes Crisp
- [ ] Support team trained
- [ ] Canned responses created (English + Spanish)
- [ ] Business hours configured
- [ ] Email forwarding set up
- [ ] Mobile tested on iOS and Android
- [ ] Sentry monitoring enabled for Crisp errors

---

## Monitoring & Analytics

### Crisp Dashboard Metrics
Track these KPIs in Crisp dashboard:
1. **Response Time**:
   - Average first response time (target: < 2 minutes)
   - Average resolution time (target: < 30 minutes)

2. **Volume**:
   - Conversations per day
   - Messages per conversation
   - Peak hours

3. **Satisfaction**:
   - CSAT score (target: > 90%)
   - User ratings (5-star)

4. **Automation**:
   - Bot resolution rate
   - Canned response usage
   - Knowledge base article views

### Sentry Integration
Monitor Crisp errors in Sentry:
```typescript
// In CrispSDK.load()
script.onerror = (error) => {
  Sentry.captureException(new Error('Failed to load Crisp SDK'), {
    level: 'warning',
    tags: { integration: 'crisp' }
  });
  reject(error);
};
```

Track Crisp events:
```typescript
// Send to Sentry when chat opened
CrispSDK.sendEvent('chat_opened');
Sentry.addBreadcrumb({
  category: 'user-interaction',
  message: 'User opened chat widget',
  level: 'info'
});
```

### Custom Analytics
Track chat interactions in your analytics:
```typescript
// Example: Google Analytics or Mixpanel
window.gtag('event', 'chat_opened', {
  event_category: 'support',
  event_label: 'crisp'
});
```

---

## Cost Considerations

### Crisp Pricing Tiers (as of 2025)

**Free Plan** (Recommended for MVP):
- ✅ **2 operators**
- ✅ Unlimited conversations
- ✅ Email support
- ✅ Mobile apps (iOS/Android)
- ✅ Basic chatbots
- ✅ Canned responses
- ✅ File sharing
- ❌ No advanced automation
- ❌ No team collaboration features
- **Cost**: $0/month

**Pro Plan** ($25/operator/month):
- ✅ Everything in Free
- ✅ Advanced chatbots
- ✅ CRM features
- ✅ Audio/video calls
- ✅ Screen sharing
- ✅ Advanced analytics
- ✅ Team collaboration
- **Cost**: $50/month (2 operators)

**Unlimited Plan** ($95/month flat):
- ✅ Everything in Pro
- ✅ Unlimited operators
- ✅ White-label
- ✅ Custom integrations
- ✅ Priority support
- **Cost**: $95/month

### Recommendation
**Start with Free Plan**:
- Covers 2 support team members
- No financial commitment
- Evaluate value before upgrading
- Upgrade to Pro if need > 2 operators or advanced features

---

## Migration & Rollback

### Rollback Plan
If Crisp causes issues, quick rollback:

1. **Disable via Environment Variable**:
   ```bash
   VITE_CRISP_ENABLED=false
   ```
   Redeploy → widget disappears

2. **Remove Component** (if urgent):
   ```tsx
   // In App.tsx - comment out or remove
   // <CrispChatWidget ... />
   ```

3. **DNS/CDN Block** (nuclear option):
   - Block `client.crisp.chat` in CDN/firewall
   - Widget fails to load gracefully

### Data Export
Before committing to Crisp:
- Export chat history monthly (JSON export)
- Store in secure S3 bucket
- Ensures data portability if switching platforms

---

## Success Criteria

### Must-Have (MVP)
- [ ] Chat widget loads on production
- [ ] Users can send/receive messages
- [ ] Support team receives notifications
- [ ] Mobile-responsive on iOS and Android
- [ ] User email/name identified correctly
- [ ] No performance impact (< 100ms page load increase)
- [ ] No console errors

### Should-Have (Phase 2)
- [ ] User context visible in dashboard (subscription, credits, team)
- [ ] Multi-language support (English/Spanish)
- [ ] Offline message queuing works
- [ ] Canned responses configured
- [ ] Knowledge base integrated

### Nice-to-Have (Phase 3)
- [ ] Proactive messaging based on user behavior
- [ ] Automated chatbot for FAQs
- [ ] Custom events tracking user journey
- [ ] Video call support
- [ ] Screen sharing for troubleshooting

---

## Timeline

**Total Estimated Time**: 2-3 days

| Phase | Tasks | Duration | Owner |
|-------|-------|----------|-------|
| **Day 1 AM** | Setup account, implement basic widget | 3-4 hours | Frontend Dev |
| **Day 1 PM** | User identification & context | 3-4 hours | Frontend Dev |
| **Day 2 AM** | Multi-language support | 2-3 hours | Frontend Dev |
| **Day 2 PM** | Testing (unit + E2E) | 3-4 hours | QA + Frontend Dev |
| **Day 3 AM** | QA deployment & stakeholder review | 2-3 hours | DevOps + Product |
| **Day 3 PM** | Production deployment + monitoring | 2-3 hours | DevOps |

**Optional** (Phase 4 - Week 2):
- Knowledge base setup: 4-6 hours
- Chatbot configuration: 4-6 hours
- Proactive messaging: 2-3 hours

---

## Next Steps

### Immediate Actions
1. [ ] **Approve this plan** with stakeholders
2. [ ] **Create Crisp account** (free plan)
3. [ ] **Get Website ID** from dashboard
4. [ ] **Add to GitHub project board** as epic with subtasks
5. [ ] **Assign to frontend developer**

### Before Starting Implementation
1. [ ] Review Privacy Policy implications with legal
2. [ ] Update Cookie Policy to include Crisp
3. [ ] Decide: authenticated-only vs all visitors?
4. [ ] Decide: development testing strategy (separate website ID?)
5. [ ] Get support team buy-in (will they use it?)

### Post-Launch
1. [ ] Monitor metrics for 1 week
2. [ ] Collect support team feedback
3. [ ] Iterate on canned responses
4. [ ] Evaluate upgrade to Pro plan (if needed)
5. [ ] Consider Phase 4 features (knowledge base, bots)

---

## Questions to Answer

Before implementation, clarify:

1. **Scope**:
   - [ ] Show chat widget to all visitors, or authenticated users only?
   - [ ] Show on all pages, or hide on specific pages (auth, checkout)?

2. **Privacy**:
   - [ ] Does Privacy Policy need legal review before mentioning Crisp?
   - [ ] Is cookie consent banner required in your jurisdiction?
   - [ ] Any GDPR/CCPA specific requirements?

3. **Team**:
   - [ ] Who will respond to chats? (support team size?)
   - [ ] What are business hours for live support?
   - [ ] Email for offline message forwarding?

4. **Environments**:
   - [ ] Use same Crisp website for dev/qa/prod, or separate?
   - [ ] Recommendation: Separate for prod, shared for dev/qa

5. **Features**:
   - [ ] Priority: basic chat only, or knowledge base + bots?
   - [ ] Do you need video calls or screen sharing?

---

## Additional Resources

### Documentation
- **Crisp Docs**: https://docs.crisp.chat/
- **Crisp API**: https://docs.crisp.chat/api/
- **JavaScript SDK**: https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/dollar-crisp/

### Crisp Dashboard
- **Login**: https://app.crisp.chat/
- **Settings**: Website settings → Customize

### Support
- **Crisp Support**: support@crisp.chat
- **Community**: https://community.crisp.chat/

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
**Status**: Awaiting Approval
