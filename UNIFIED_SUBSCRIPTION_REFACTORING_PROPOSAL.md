# Unified Frontend-Backend Subscription Architecture Refactoring

**Date**: 2025-01-21
**Status**: 📋 Comprehensive Proposal
**Scope**: Frontend + Backend + Database
**Goal**: Single source of truth, eliminate redundancy, minimize maintenance

## Executive Summary

### Current Problem: Triple Redundancy

```
┌──────────────────────────────────────────────────────────────────────┐
│ DATABASE (subscription_plans table)                                  │
├──────────────────────────────────────────────────────────────────────┤
│ plan_type: 'team'                    ← Source of Truth #1            │
│ display_name: 'Team Business Plan'                                   │
│ description: 'Built for teams...'                                    │
│ monthly_credits: 200                                                 │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ↓ Backend copies to memory
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND (stripe-plan-mappings.ts + types.ts)                         │
├──────────────────────────────────────────────────────────────────────┤
│ SubscriptionPlan.id: 'team'          ← Copy #1                       │
│ SubscriptionPlan.name: 'Team...'                                     │
│ Subscription.planType: 'team'                                        │
│ Subscription.planName: 'Team...'     ← Copy #2                       │
│ Subscription.monthlyCredits: 200     ← Copy #3                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ↓ API Response
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND (types.ts)                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ SubscriptionPlan.planType: 'team'                                    │
│ SubscriptionPlan.displayName: 'Team...'  ← Copy #4                   │
│ Subscription.planType: 'team'                                        │
│ Subscription.planDisplayName: 'Team...'  ← Copy #5                   │
│ Subscription.monthlyCredits: 200         ← Copy #6                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Maintenance Burden**: To change "Team Business Plan" → "Team Pro Plan":
1. Update database `subscription_plans.display_name`
2. Update backend hardcoded mappings (if any)
3. Update Stripe product metadata
4. Wait for caches to invalidate
5. Verify across all layers

---

## Architecture Analysis

### Layer 1: Database (Supabase)

**Current Schema:**
```sql
CREATE TABLE subscription_plans (
  plan_type text PRIMARY KEY,          -- 'individual', 'team', 'custom_*'
  stripe_product_id text,              -- Maps to Stripe
  monthly_credits integer NOT NULL,    -- Credit allocation
  one_time_credits integer DEFAULT 0,  -- Trial credits
  display_name text NOT NULL,          -- "Team Business Plan"
  description text,                    -- Marketing text
  is_active boolean DEFAULT true,
  requires_payment boolean DEFAULT true
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  team_id uuid,
  plan_type text REFERENCES subscription_plans(plan_type),  -- ✅ Foreign key
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  credits integer NOT NULL,
  external_subscription_id text,  -- Stripe subscription ID
  -- NO redundant fields here (good!)
);
```

**✅ Database Design is CLEAN**:
- `subscriptions` table only stores `plan_type` reference
- No denormalized `plan_name`, `monthly_credits`, etc.
- Foreign key enforces referential integrity

**Database Stored Procedures:**
```sql
-- Returns complete plan details
get_plan_details(plan_type) → PlanDetails

-- Credit allocation
get_plan_credits(plan_type) → { monthly_credits, one_time_credits }

-- List all active plans
list_active_plans() → PlanDetails[]
```

### Layer 2: Backend (Zuplo API Gateway)

**Current Issues:**

1. **Hardcoded Mappings** (stripe-plan-mappings.ts):
```typescript
// ❌ REDUNDANT - duplicates database config
const LIVE_MODE_MAPPINGS = {
  individual: 'prod_SR7syuRxrJPy2y',
  team: 'prod_SR7skD3oxkeBLS',
  custom: 'prod_SR7s9eoipQu3pN',
};
```

2. **Type Redundancy** (backend/modules/types.ts):
```typescript
// ❌ BACKEND HAS SAME REDUNDANCY AS FRONTEND
export interface SubscriptionPlan {
  id: PlanType;           // Actually planType
  name: string;           // Redundant with database display_name
  description: string;    // Redundant with database description
  monthlyCredits: number; // Redundant with database monthly_credits
  trialCredits: number;   // Redundant with database one_time_credits
  // ... more redundant fields
}

export interface Subscription {
  planType: PlanType;         // ✅ Reference
  planName?: string;          // ❌ Redundant
  planDescription?: string;   // ❌ Redundant
  monthlyCredits?: number;    // ❌ Redundant
  trialCredits?: number;      // ❌ Redundant
  credits: number;            // ✅ User state
}
```

3. **New Service Layer** (subscription-plan-service.ts):
```typescript
// ✅ GOOD - Database-backed lookups
export async function getPlanDetails(planType): Promise<PlanDetails>
export async function getStripeProductId(planType): Promise<string>
export async function listActivePlans(): Promise<PlanDetails[]>
```

**Transition State:**
- Backend has BOTH old (stripe-plan-mappings.ts) and new (subscription-plan-service.ts)
- Need to complete migration to database-backed approach

### Layer 3: Frontend (React PWA)

**Current Issues** (same as backend):
```typescript
// ❌ REDUNDANT
export interface SubscriptionPlan {
  planType: PlanType;
  displayName: string;      // Should come from API
  description: string;      // Should come from API
  monthlyCredits: number;   // Should come from API
  trialCredits: number;     // Should come from API
}

export interface Subscription {
  planType: PlanType;         // ✅ Reference
  planDisplayName?: string;   // ❌ Denormalized
  monthlyCredits?: number;    // ❌ Denormalized
  trialCredits?: number;      // ❌ Denormalized
  credits: number;            // ✅ User state
}
```

---

## Proposed Clean Architecture

### Principle: Database as Single Source of Truth

```
┌──────────────────────────────────────────────────────────────────────┐
│ DATABASE (subscription_plans - Single Source of Truth)               │
├──────────────────────────────────────────────────────────────────────┤
│ plan_type: 'team'                    ← ✅ ONLY SOURCE OF TRUTH       │
│ display_name: 'Team Business Plan'   ← Managed in database/Stripe    │
│ description: 'Built for teams...'    ← Localized via Stripe metadata │
│ monthly_credits: 200                 ← Credit allocation             │
│ stripe_product_id: 'prod_...'        ← Integration mapping           │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ↓ Database-backed API
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND API (Thin layer - just transforms DB → JSON)                 │
├──────────────────────────────────────────────────────────────────────┤
│ GET /subscription-plans                                               │
│   → listActivePlans() from database                                  │
│   → Returns: SubscriptionPlan[]                                      │
│                                                                       │
│ GET /subscriptions/active                                             │
│   → SELECT * WHERE user_id = ?                                       │
│   → Returns: { planType, credits, status, ... }                      │
│   → NO planName, NO monthlyCredits (derive from plan)                │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ↓ API Response
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Derives everything from plans)                             │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Fetch plans once: GET /subscription-plans                         │
│    → Cache in memory                                                 │
│                                                                       │
│ 2. Fetch subscription: GET /subscriptions/active                     │
│    → { planType: 'team', credits: 150 }                              │
│                                                                       │
│ 3. Derive display info:                                              │
│    const plan = plans.find(p => p.planType === sub.planType)        │
│    <h3>{plan.displayName}</h3>                                       │
│    <p>{sub.credits} / {plan.monthlyCredits}</p>                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Refactoring Plan

### Phase 1: Database (Already Clean ✅)

**No changes needed** - database schema is already optimal:
- `subscriptions` table only stores `plan_type` reference
- `subscription_plans` table is source of truth
- Stored procedures provide clean API

### Phase 2: Backend Cleanup

#### Step 2.1: Remove Hardcoded Mappings

**Delete:** `stripe-plan-mappings.ts`

**Replace with:** `subscription-plan-service.ts` (already exists)

**Files to update:**
```typescript
// Before (hardcoded)
import { getStripeProductId } from './stripe-plan-mappings.js';
const productId = getStripeProductId('individual');

// After (database-backed)
import { getStripeProductId } from './subscription-plan-service.js';
const productId = await getStripeProductId('individual');
```

#### Step 2.2: Clean Backend Types

**File:** `backend/modules/types.ts`

```typescript
// ✅ CLEAN - Minimal plan interface
export interface SubscriptionPlan {
  planType: PlanType;          // Identifier
  displayName: string;         // From database/Stripe (localized)
  description: string;         // From database/Stripe (localized)
  tagline?: string;            // From Stripe metadata
  monthlyPrice?: number;       // From Stripe
  annualPrice?: number;        // From Stripe
  features: string[];          // From Stripe metadata (localized)
  marketingFeatures?: string[]; // From Stripe metadata (localized)
  monthlyCredits: number;      // From database
  trialCredits: number;        // From database (one_time_credits)
  isCustom?: boolean;          // Computed
  comingSoon?: boolean;        // From metadata
}

// ✅ CLEAN - Minimal subscription (user instance)
export interface Subscription {
  // Identity
  id: string;
  userId: string;
  teamId?: string;

  // Plan reference (ONLY link to plan)
  planType: PlanType;  // ✅ Reference only

  // Lifecycle
  status: 'active' | 'trialing' | 'canceled' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialStart?: string;
  trialEnd?: string;
  canceledAt?: string;
  billingPeriod?: string;

  // User state
  credits: number;  // ✅ Current balance - the ONLY user-specific data

  // Capability flags (computed from plan + backend logic)
  hasTeamFeatures?: boolean;
  canInviteMembers?: boolean;
  canManageTeam?: boolean;
  canTransferCredits?: boolean;

  // Integration
  stripeSubscriptionId?: string;
  metadata?: Record<string, any>;
}
```

**Remove from Subscription:**
- ❌ `planName` / `planDisplayName`
- ❌ `planDescription`
- ❌ `monthlyCredits`
- ❌ `trialCredits`

#### Step 2.3: Update API Endpoints

**Endpoint:** `GET /subscription-plans`

```typescript
// Clean implementation
export async function getSubscriptionPlans(request: ZuploRequest) {
  const currentLang = request.headers.get('Accept-Language')?.includes('es') ? 'es' : 'en';

  // Fetch from database
  const dbPlans = await listActivePlans();

  // Enrich with Stripe data (prices, metadata)
  const enrichedPlans = await Promise.all(
    dbPlans.map(async (plan) => {
      const stripeProduct = await stripe.products.retrieve(plan.stripe_product_id);
      const prices = await stripe.prices.list({ product: plan.stripe_product_id });

      return {
        planType: normalizePlanTypeForFrontend(plan.plan_type),
        displayName: extractLocalizedText(stripeProduct.name, currentLang),
        description: extractLocalizedText(stripeProduct.description, currentLang),
        tagline: stripeProduct.metadata.tagline,
        monthlyPrice: prices.data.find(p => p.recurring?.interval === 'month')?.unit_amount / 100,
        annualPrice: prices.data.find(p => p.recurring?.interval === 'year')?.unit_amount / 100,
        features: extractLocalizedArray(stripeProduct.metadata.features, currentLang),
        monthlyCredits: plan.monthly_credits,
        trialCredits: plan.one_time_credits,
        isCustom: plan.plan_type.startsWith('custom_'),
      };
    })
  );

  return Response.json(enrichedPlans);
}
```

**Endpoint:** `GET /subscriptions/active`

```typescript
// Minimal response - no denormalized plan data
export async function getActiveSubscription(request: ZuploRequest) {
  const userId = request.headers.get('X-User-Id');

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Return ONLY subscription instance data
  return Response.json({
    id: data.id,
    userId: data.user_id,
    teamId: data.team_id,
    planType: normalizePlanTypeForFrontend(data.plan_type),  // ✅ Reference only
    status: data.status,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
    credits: data.credits,  // ✅ User state
    // ❌ NO planName, monthlyCredits, etc.
    hasTeamFeatures: data.plan_type === 'team',  // Computed
    stripeSubscriptionId: data.external_subscription_id,
  });
}
```

### Phase 3: Frontend Cleanup

#### Step 3.1: Update Types (Already Started)

**File:** `frontend/src/types.ts`

```typescript
// Same as backend - keep in sync
export interface SubscriptionPlan { /* ... */ }
export interface Subscription { /* ... */ }
```

#### Step 3.2: Update Components

**Pattern to apply everywhere:**

```typescript
// ❌ OLD: Use denormalized field
const displayName = subscription.planDisplayName;

// ✅ NEW: Derive from plans
const plans = await subscriptionService.getPlans();
const plan = plans.find(p => p.planType === subscription.planType);
const displayName = plan?.displayName || subscription.planType;
```

**Helper functions** (already exist):
```typescript
getPlanName(planType, fallback)          // Async
getPlanNameSync(plans, planType, fallback)  // Sync
resolvePlanName(displayName, planType, fallback)  // With fallback
```

---

## Translation Strategy (Unified)

### Single Source: Stripe Product Metadata

**All localized content managed in Stripe:**

```json
{
  "id": "prod_SR7skD3oxkeBLS",
  "name": "Team Business Plan",
  "description": "Built for teams, schools, and therapy practices",
  "metadata": {
    "plan_type": "team",
    "name_en": "Team Business Plan",
    "name_es": "Plan de Equipo para Negocios",
    "description_en": "Built for teams, schools, and therapy practices",
    "description_es": "Creado para equipos, escuelas y prácticas de terapia",
    "tagline_en": "Collaborate and grow together",
    "tagline_es": "Colabora y crece juntos",
    "features_en": "200 credits per month|Team collaboration|Priority support",
    "features_es": "200 créditos por mes|Colaboración en equipo|Soporte prioritario"
  }
}
```

**Extraction Logic** (backend):
```typescript
function extractLocalizedText(text: string, lang: string) {
  // Method 1: Pipe-separated format
  if (text.includes(' | ')) {
    const [en, es] = text.split(' | ');
    return lang === 'es' ? es.trim() : en.trim();
  }
  return text;
}

function getLocalizedFromMetadata(metadata: any, field: string, lang: string, fallback?: string) {
  const localizedKey = `${field}_${lang}`;
  return metadata[localizedKey] || metadata[field] || fallback || '';
}
```

**Flow:**
1. Frontend requests plans with `Accept-Language: es` header
2. Backend queries Stripe products
3. Backend extracts localized fields based on language
4. Frontend receives pre-localized data

---

## Migration Timeline

### Week 1: Backend Foundation
- [ ] Verify subscription-plan-service.ts is fully functional
- [ ] Update all backend code to use subscription-plan-service.ts
- [ ] Deprecate stripe-plan-mappings.ts
- [ ] Update backend types.ts (remove redundant Subscription fields)
- [ ] Update API endpoints to return minimal subscription data

### Week 2: Frontend Alignment
- [ ] Update frontend types.ts (match backend)
- [ ] Add deprecation warnings to redundant fields
- [ ] Update components to use plan lookups
- [ ] Test localization flow (en/es)

### Week 3: Integration Testing
- [ ] Test full flow: database → backend → frontend
- [ ] Verify caching works correctly
- [ ] Test language switching
- [ ] Performance testing (ensure plan lookups don't slow UI)

### Week 4: Cleanup & Deployment
- [ ] Remove deprecated fields from both frontend and backend
- [ ] Remove stripe-plan-mappings.ts completely
- [ ] Update documentation
- [ ] Deploy to QA → Production

---

## Benefits

### 1. Single Source of Truth
- **Database** (`subscription_plans` table) is the ONLY place to update plan metadata
- Stripe products provide localized marketing content
- No manual synchronization needed

### 2. Automatic Consistency
- Database foreign key prevents orphaned subscriptions
- Plan changes automatically propagate to all users
- Caching ensures performance while maintaining consistency

### 3. Reduced Maintenance Burden
**Before:**
1. Update database
2. Update backend mappings
3. Update Stripe
4. Update frontend types
5. Clear caches
6. Verify everywhere

**After:**
1. Update database OR Stripe metadata
2. Clear cache (automatic after 5 minutes)
3. Done ✅

### 4. Smaller Payloads
- Subscription API response: ~350 bytes (30% smaller)
- Only send `planType`, derive everything else client-side
- Reduced bandwidth usage

### 5. Better Localization
- All translations managed in Stripe
- Automatic language detection from headers
- Consistent across all platforms

### 6. Type Safety
- TypeScript prevents accessing non-existent fields
- Clear separation: `planType` = reference, `displayName` = UI
- Cannot misuse fields

---

## Risk Mitigation

### Backward Compatibility
- Keep deprecated fields during transition (with warnings)
- Gradual rollout: backend → frontend → remove deprecations
- Database schema already clean (no changes needed)

### Performance
- Plans cached for 5 minutes (backend)
- Plans cached in memory (frontend)
- Lookups are O(1) with Map/find
- Negligible performance impact

### Rollback Plan
If issues arise:
1. Backend can temporarily send denormalized fields again
2. Frontend can use deprecated fields if still present
3. Database unchanged (safe)

---

## Success Metrics

✅ **Code Reduction**: Remove ~200 lines of redundant code
✅ **Maintenance**: Single place to update plan metadata
✅ **Consistency**: Guaranteed - derived from same source
✅ **Performance**: Maintained via caching
✅ **Localization**: Seamless via Stripe metadata
✅ **Type Safety**: Enforced by TypeScript
✅ **API Efficiency**: 30% smaller subscription responses

---

## Next Steps

1. **Review & Approval**
   - [ ] Backend team review
   - [ ] Frontend team review
   - [ ] Database/DevOps review

2. **Create Detailed Tasks**
   - [ ] Backend refactoring tasks
   - [ ] Frontend refactoring tasks
   - [ ] Testing tasks
   - [ ] Documentation tasks

3. **Timeline Agreement**
   - [ ] Align on 4-week timeline
   - [ ] Identify blockers
   - [ ] Assign owners

4. **Begin Implementation**
   - [ ] Start with backend (Week 1)
   - [ ] Minimal risk, maximum impact
   - [ ] Coordinate with frontend team

---

**Recommendation**: Proceed with phased implementation starting with backend Week 1 tasks. This is a low-risk, high-value refactoring that will significantly reduce maintenance burden.
