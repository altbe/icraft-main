# Subscription Plans Refactoring Plan

**Date**: 2025-01-21
**Objective**: Centralize plan configuration in database, eliminate hardcoded mappings, enforce strict validation

## Executive Summary

Replace hardcoded plan mappings in backend and database stored procedures with a single database-backed configuration table (`subscription_plans`). Implement automatic team creation on subscription upgrade with strict one-team-per-user enforcement.

## Current Problems

1. **Split Configuration**:
   - Backend: `stripe-plan-mappings.ts` (Stripe product IDs)
   - Database: `allocate_monthly_credits()` (hardcoded credit amounts)
   - Database: `process_plan_change()` (different credit amounts!)

2. **Inconsistent Data**:
   - `allocate_monthly_credits()`: team = 200 credits
   - `process_plan_change()`: team = 500 credits
   - No single source of truth

3. **Subscription Table Issues**:
   - `plan_id` field usage inconsistent:
     - Sometimes: "individual", "team", "custom"
     - Sometimes: "prod_SmQaHVQboOvbv2" (Stripe product ID)
   - `stripe_product_id` field sometimes NULL, sometimes duplicates plan_id

4. **Manual Team Creation**:
   - Teams created manually after subscription upgrade
   - Prone to human error
   - Difficult to troubleshoot

5. **No Team Membership Constraints**:
   - Users can belong to multiple teams
   - Users can own multiple teams
   - Violates business logic: one user = one team max

## Business Rules (Enforced)

### User-Team Relationship Rules
1. ✅ **One team per user**: A user can only belong to ONE team (as owner OR member, never both)
2. ✅ **One ownership**: A user can only own ONE team
3. ✅ **Exclusive membership**: Owner OR member, not both
4. ✅ **Team subscription ownership**: The team owner's subscription pays for the team
5. ✅ **Credit transfer**: ALL user credits transfer to team on upgrade

### Subscription Rules
1. ✅ **Strict plan types**: 'none', 'trial', 'individual', 'team', 'custom' (marketing only), or 'custom_*' (actual custom customers)
2. ✅ **No fallbacks**: Invalid plan_type = hard error, not silent fallback
3. ✅ **Automatic team creation**: Team plan subscription auto-creates team
4. ✅ **Stripe product linkage**: Paid plans MUST have stripe_product_id (except marketing 'custom' placeholder)

---

## Phase 1: Database Schema & Core Functions

### 1.1 New Table: `subscription_plans`

```sql
CREATE TABLE subscription_plans (
  plan_type TEXT PRIMARY KEY,
  stripe_product_id TEXT UNIQUE,
  monthly_credits INTEGER NOT NULL,
  one_time_credits INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_payment BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_plan_type CHECK (
    plan_type IN ('none', 'trial', 'individual', 'team', 'custom') OR
    plan_type ~ '^custom_[a-z0-9_]+$'  -- Pattern: custom_acme_corp, custom_school_district
  ),
  CONSTRAINT positive_credits CHECK (monthly_credits >= 0 AND one_time_credits >= 0),
  CONSTRAINT paid_plans_need_stripe_id CHECK (
    (NOT requires_payment) OR (requires_payment AND stripe_product_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_subscription_plans_stripe_product
  ON subscription_plans(stripe_product_id)
  WHERE stripe_product_id IS NOT NULL;

CREATE INDEX idx_subscription_plans_active
  ON subscription_plans(is_active)
  WHERE is_active = true;

-- Comments
COMMENT ON TABLE subscription_plans IS 'Master configuration for subscription plans and credit allocation';
COMMENT ON COLUMN subscription_plans.plan_type IS 'Internal plan identifier used in subscriptions.plan_id';
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Environment-specific Stripe product ID (test vs live)';
COMMENT ON COLUMN subscription_plans.monthly_credits IS 'Credits allocated each billing period (0 for one-time plans)';
COMMENT ON COLUMN subscription_plans.one_time_credits IS 'Credits allocated once when plan starts (e.g., trial credits)';
COMMENT ON COLUMN subscription_plans.requires_payment IS 'True for paid plans (individual, team, custom), false for none/trial';
```

### 1.2 Initial Data Population

**Non-Prod Database** (connects to Stripe Test):
```sql
INSERT INTO subscription_plans
(plan_type, stripe_product_id, monthly_credits, one_time_credits, display_name, description, requires_payment)
VALUES
  ('none', NULL, 0, 0, 'No Plan', 'Signed up but no trial activated', false),
  ('trial', NULL, 0, 30, 'Trial Period', '30 credits to try iCraftStories', false),
  ('individual', 'prod_SmQapVcLKm983A', 30, 0, 'Individual Plan', 'Personal use with 30 monthly credits', true),
  ('team', 'prod_SmQaHVQboOvbv2', 200, 0, 'Team Business Plan', 'Team collaboration with 200 monthly credits', true),
  ('custom', NULL, 0, 0, 'Custom Plan', 'Contact sales for enterprise pricing - Marketing placeholder only', false);

-- Example: Actual custom customer (add as needed per customer contract)
-- INSERT INTO subscription_plans VALUES
--   ('custom_acme_corp', 'prod_ABC123', 5000, 0, 'Acme Corp - Enterprise Plan', 'Custom SLA: 5,000 credits/month, dedicated support', true);
```

**Prod Database** (connects to Stripe Live):
```sql
INSERT INTO subscription_plans
(plan_type, stripe_product_id, monthly_credits, one_time_credits, display_name, description, requires_payment)
VALUES
  ('none', NULL, 0, 0, 'No Plan', 'Signed up but no trial activated', false),
  ('trial', NULL, 0, 30, 'Trial Period', '30 credits to try iCraftStories', false),
  ('individual', 'prod_SR7syuRxrJPy2y', 30, 0, 'Individual Plan', 'Personal use with 30 monthly credits', true),
  ('team', 'prod_SR7skD3oxkeBLS', 200, 0, 'Team Business Plan', 'Team collaboration with 200 monthly credits', true),
  ('custom', NULL, 0, 0, 'Custom Plan', 'Contact sales for enterprise pricing - Marketing placeholder only', false);

-- Example: Actual custom customer (add as needed per customer contract)
-- INSERT INTO subscription_plans VALUES
--   ('custom_school_district', 'prod_XYZ789', 3000, 0, 'School District - Custom Plan', 'Custom SLA: 3,000 credits/month, training included', true);
```

### 1.3 Creating Custom Customer Plans

When a new custom customer contract is signed:

**Step 1: Create Stripe product** (via Stripe Dashboard or MCP):
```javascript
// Example: Acme Corp custom plan
{
  name: "Acme Corp - Enterprise Plan",
  description: "Custom enterprise plan for Acme Corporation",
  metadata: {
    plan_type: "custom_acme_corp",
    monthly_credits: "5000",
    contract_id: "CONTRACT-2025-001",
    support_tier: "enterprise"
  }
}
// Returns: prod_ABC123
```

**Step 2: Add plan to database**:
```sql
INSERT INTO subscription_plans
(plan_type, stripe_product_id, monthly_credits, one_time_credits, display_name, description, requires_payment)
VALUES
  ('custom_acme_corp', 'prod_ABC123', 5000, 0,
   'Acme Corp - Enterprise Plan',
   'Custom SLA: 5,000 credits/month, dedicated support, priority features',
   true);
```

**Step 3: Verify configuration**:
```sql
-- Verify plan added correctly
SELECT * FROM get_plan_details('custom_acme_corp');

-- Verify Stripe metadata sync (optional)
SELECT * FROM sync_plan_details_from_stripe() WHERE plan_type = 'custom_acme_corp';
```

**Step 4: Create subscription** (via Stripe webhook or API):
- Subscription webhook automatically uses `custom_acme_corp` configuration
- Credit allocation happens automatically via `allocate_monthly_credits()`
- No code changes needed!

**Naming Convention**: Use `custom_<identifier>` where identifier is:
- Company name: `custom_acme_corp`, `custom_microsoft`
- Organization type: `custom_school_district_sf`, `custom_hospital_boston`
- Contract ID: `custom_contract_2025_001`
- Use lowercase, underscores only, no special characters

---

## Phase 2: Team Membership Constraints

### 2.1 One-Team-Per-User Enforcement

**Add unique constraint to team_members:**
```sql
-- Ensure user can only be in ONE team (as owner or member)
ALTER TABLE team_members
  ADD CONSTRAINT one_team_per_user UNIQUE (user_id);

-- Ensure user can only own ONE team
CREATE UNIQUE INDEX idx_teams_one_owner_per_user
  ON teams(owner_id)
  WHERE owner_id IS NOT NULL;
```

**Add validation function:**
```sql
CREATE OR REPLACE FUNCTION validate_user_team_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is already in another team
  IF EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = NEW.user_id
      AND team_id != NEW.team_id
  ) THEN
    RAISE EXCEPTION 'User % is already a member of another team. Users can only belong to one team.', NEW.user_id;
  END IF;

  -- Check if user already owns a team
  IF NEW.role = 'owner' AND EXISTS (
    SELECT 1 FROM teams
    WHERE owner_id = NEW.user_id
      AND id != NEW.team_id
  ) THEN
    RAISE EXCEPTION 'User % already owns another team. Users can only own one team.', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_one_team_per_user
  BEFORE INSERT OR UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_team_membership();
```

---

## Phase 3: Plan Lookup Stored Procedures

### 3.1 Core Plan Functions

```sql
-- Get plan details by plan_type (STRICT - no fallback)
CREATE OR REPLACE FUNCTION get_plan_details(p_plan_type TEXT)
RETURNS TABLE(
  plan_type TEXT,
  stripe_product_id TEXT,
  monthly_credits INTEGER,
  one_time_credits INTEGER,
  display_name TEXT,
  description TEXT,
  requires_payment BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.plan_type,
    sp.stripe_product_id,
    sp.monthly_credits,
    sp.one_time_credits,
    sp.display_name,
    sp.description,
    sp.requires_payment
  FROM subscription_plans sp
  WHERE sp.plan_type = p_plan_type
    AND sp.is_active = true;

  -- If no rows returned, function returns empty result
  -- Caller MUST check if plan exists
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_plan_details IS 'Get subscription plan configuration. Returns empty if plan not found - caller must handle error.';

-- Reverse lookup: Stripe product ID → plan_type
CREATE OR REPLACE FUNCTION get_plan_type_from_stripe_product(p_stripe_product_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_plan_type TEXT;
BEGIN
  SELECT plan_type INTO v_plan_type
  FROM subscription_plans
  WHERE stripe_product_id = p_stripe_product_id
    AND is_active = true;

  RETURN v_plan_type; -- Returns NULL if not found
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get all active plans
CREATE OR REPLACE FUNCTION get_all_active_plans()
RETURNS TABLE(
  plan_type TEXT,
  stripe_product_id TEXT,
  monthly_credits INTEGER,
  one_time_credits INTEGER,
  display_name TEXT,
  description TEXT,
  requires_payment BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.plan_type,
    sp.stripe_product_id,
    sp.monthly_credits,
    sp.one_time_credits,
    sp.display_name,
    sp.description,
    sp.requires_payment
  FROM subscription_plans sp
  WHERE sp.is_active = true
  ORDER BY
    CASE sp.plan_type
      WHEN 'none' THEN 1
      WHEN 'trial' THEN 2
      WHEN 'individual' THEN 3
      WHEN 'team' THEN 4
      WHEN 'custom' THEN 5
      ELSE 99
    END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### 3.2 Stripe Metadata Validation

```sql
CREATE OR REPLACE FUNCTION sync_plan_details_from_stripe()
RETURNS TABLE(
  plan_type TEXT,
  status TEXT,
  local_credits INTEGER,
  stripe_credits INTEGER,
  message TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH stripe_metadata AS (
    SELECT
      sp.plan_type,
      sp.monthly_credits as local_monthly_credits,
      sp.stripe_product_id,
      st.name as stripe_name,
      (st.metadata->>'monthly_credits')::INTEGER as stripe_monthly_credits,
      (st.metadata->>'plan_type')::TEXT as stripe_plan_type
    FROM subscription_plans sp
    LEFT JOIN stripe.products st ON st.id = sp.stripe_product_id
    WHERE sp.stripe_product_id IS NOT NULL
      AND sp.plan_type != 'custom'  -- Skip marketing placeholder (has no Stripe product)
  )
  SELECT
    sm.plan_type,
    CASE
      WHEN sm.stripe_product_id IS NULL THEN 'ERROR'
      WHEN sm.stripe_monthly_credits IS NULL THEN 'WARNING'
      WHEN sm.local_monthly_credits != sm.stripe_monthly_credits THEN 'MISMATCH'
      WHEN sm.stripe_plan_type != sm.plan_type THEN 'TYPE_MISMATCH'
      ELSE 'OK'
    END as status,
    sm.local_monthly_credits,
    sm.stripe_monthly_credits,
    CASE
      WHEN sm.stripe_product_id IS NULL THEN 'Stripe product not found'
      WHEN sm.stripe_monthly_credits IS NULL THEN 'Stripe product missing monthly_credits metadata'
      WHEN sm.local_monthly_credits != sm.stripe_monthly_credits THEN
        format('Credits mismatch: local=%s, stripe=%s', sm.local_monthly_credits, sm.stripe_monthly_credits)
      WHEN sm.stripe_plan_type != sm.plan_type THEN
        format('Plan type mismatch: local=%s, stripe=%s', sm.plan_type, sm.stripe_plan_type)
      ELSE 'Configuration matches Stripe metadata'
    END as message
  FROM stripe_metadata sm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_plan_details_from_stripe IS 'Validates local plan configuration against Stripe product metadata. Skips marketing "custom" placeholder. Run after Stripe product changes.';
```

---

## Phase 4: Updated Credit Allocation Functions

### 4.1 Update `allocate_monthly_credits()` - STRICT MODE

```sql
CREATE OR REPLACE FUNCTION allocate_monthly_credits(
  p_user_id TEXT,
  p_plan_id TEXT,
  p_subscription_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_monthly_credits INTEGER;
  v_current_period_start TIMESTAMP;
  v_current_period_end TIMESTAMP;
  v_existing_allocation INTEGER;
  v_current_balance INTEGER;
  v_transaction_id TEXT;
BEGIN
  -- Get subscription period dates
  SELECT current_period_start, current_period_end
  INTO v_current_period_start, v_current_period_end
  FROM subscriptions
  WHERE external_subscription_id = p_subscription_id
    AND user_id = p_user_id;

  IF v_current_period_start IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'subscription_not_found',
      'message', 'Could not find subscription for monthly credit allocation',
      'user_id', p_user_id,
      'subscription_id', p_subscription_id
    );
  END IF;

  -- Check if monthly credits have already been allocated for this billing period
  SELECT COUNT(*) INTO v_existing_allocation
  FROM credit_transactions
  WHERE entity_id = p_subscription_id
    AND transaction_type = 'subscription_credit'
    AND created_at >= v_current_period_start
    AND created_at <= v_current_period_end;

  IF v_existing_allocation > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Monthly credits already allocated for this billing period',
      'credits_allocated', 0,
      'duplicate_prevention', true,
      'period_start', v_current_period_start,
      'period_end', v_current_period_end
    );
  END IF;

  -- ✅ STRICT: Lookup monthly credits from subscription_plans (NO FALLBACK)
  SELECT monthly_credits INTO v_monthly_credits
  FROM subscription_plans
  WHERE plan_type = p_plan_id
    AND is_active = true;

  IF v_monthly_credits IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_plan_type',
      'message', format('Plan type "%s" not found in subscription_plans. Valid plans: none, trial, individual, team, custom', p_plan_id),
      'plan_id', p_plan_id,
      'valid_plans', (SELECT array_agg(plan_type) FROM subscription_plans WHERE is_active = true)
    );
  END IF;

  -- Get current user balance
  SELECT COALESCE(credit_balance, 0) INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  -- Generate transaction ID
  v_transaction_id := gen_random_uuid()::text;

  -- Insert credit transaction record
  INSERT INTO credit_transactions (
    id,
    user_id,
    amount,
    transaction_type,
    description,
    entity_type,
    entity_id,
    created_by,
    created_at
  ) VALUES (
    v_transaction_id,
    p_user_id,
    v_monthly_credits,
    'subscription_credit',
    format('Monthly credits allocated for %s plan', p_plan_id),
    'subscription',
    p_subscription_id,
    p_user_id,
    NOW()
  );

  -- Update user balance
  UPDATE user_profiles
  SET
    credit_balance = credit_balance + v_monthly_credits,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Monthly credits allocated successfully',
    'credits_allocated', v_monthly_credits,
    'new_balance', v_current_balance + v_monthly_credits,
    'transaction_id', v_transaction_id,
    'plan_id', p_plan_id,
    'period_start', v_current_period_start,
    'period_end', v_current_period_end
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'allocation_failed',
      'message', SQLERRM,
      'detail', 'Unexpected error during credit allocation'
    );
END;
$$;

COMMENT ON FUNCTION allocate_monthly_credits IS 'Allocates monthly credits based on subscription_plans configuration. Returns error if plan_type invalid - NO FALLBACK.';
```

### 4.2 Update `process_plan_change()` - STRICT MODE

```sql
CREATE OR REPLACE FUNCTION process_plan_change(
  p_subscription_id UUID,
  p_old_plan_id TEXT,
  p_new_plan_id TEXT,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_source TEXT DEFAULT 'webhook'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_plan_credits INTEGER;
  v_new_plan_credits INTEGER;
  v_days_remaining INTEGER;
  v_total_period_days INTEGER;
  v_prorate_factor DECIMAL;
  v_credits_to_add INTEGER;
  v_user_id UUID;
  v_external_subscription_id TEXT;
  v_transaction_id UUID;
BEGIN
  -- Get subscription details
  SELECT user_id, external_subscription_id
  INTO v_user_id, v_external_subscription_id
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'subscription_not_found',
      'message', 'Subscription not found',
      'subscription_id', p_subscription_id
    );
  END IF;

  -- ✅ STRICT: Lookup credits from subscription_plans (NO FALLBACK)
  SELECT monthly_credits INTO v_old_plan_credits
  FROM subscription_plans
  WHERE plan_type = p_old_plan_id AND is_active = true;

  SELECT monthly_credits INTO v_new_plan_credits
  FROM subscription_plans
  WHERE plan_type = p_new_plan_id AND is_active = true;

  IF v_old_plan_credits IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_old_plan_type',
      'message', format('Old plan type "%s" not found in subscription_plans', p_old_plan_id),
      'plan_id', p_old_plan_id
    );
  END IF;

  IF v_new_plan_credits IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_new_plan_type',
      'message', format('New plan type "%s" not found in subscription_plans', p_new_plan_id),
      'plan_id', p_new_plan_id
    );
  END IF;

  -- Calculate proration for remaining period
  v_days_remaining := EXTRACT(DAY FROM (p_period_end - NOW()));
  v_total_period_days := EXTRACT(DAY FROM (p_period_end - p_period_start));

  -- Ensure we don't divide by zero
  IF v_total_period_days > 0 THEN
    v_prorate_factor := v_days_remaining::DECIMAL / v_total_period_days::DECIMAL;
  ELSE
    v_prorate_factor := 0;
  END IF;

  -- Calculate prorated credit difference
  -- For upgrades: add prorated difference immediately
  -- For downgrades: no credit removal (customer keeps extra credits until next renewal)
  IF v_new_plan_credits > v_old_plan_credits THEN
    v_credits_to_add := FLOOR((v_new_plan_credits - v_old_plan_credits) * v_prorate_factor);

    IF v_credits_to_add > 0 THEN
      -- Add credit transaction
      INSERT INTO credit_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        entity_type,
        entity_id,
        created_by,
        created_at
      ) VALUES (
        v_user_id,
        v_credits_to_add,
        'plan_upgrade',
        format('Plan upgrade credit adjustment: %s to %s (prorated for %s days)',
               p_old_plan_id, p_new_plan_id, v_days_remaining),
        'subscription',
        v_external_subscription_id,
        v_user_id,
        NOW()
      ) RETURNING id INTO v_transaction_id;

      -- Update user balance
      UPDATE user_profiles
      SET
        credit_balance = credit_balance + v_credits_to_add,
        updated_at = NOW()
      WHERE id = v_user_id;
    END IF;
  ELSE
    -- Downgrade: no immediate credit adjustment
    v_credits_to_add := 0;
  END IF;

  -- Update subscription plan
  UPDATE subscriptions
  SET
    plan_id = p_new_plan_id,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_plan_change', NOW(),
      'previous_plan', p_old_plan_id,
      'plan_change_source', p_source
    )
  WHERE id = p_subscription_id;

  -- Log plan change event
  INSERT INTO subscription_events (
    subscription_id,
    external_subscription_id,
    event_type,
    previous_state,
    new_state,
    source,
    triggered_by
  ) VALUES (
    p_subscription_id,
    v_external_subscription_id,
    'plan_change',
    jsonb_build_object(
      'plan_id', p_old_plan_id,
      'monthly_credits', v_old_plan_credits
    ),
    jsonb_build_object(
      'plan_id', p_new_plan_id,
      'monthly_credits', v_new_plan_credits,
      'credits_added', v_credits_to_add,
      'proration_factor', v_prorate_factor
    ),
    p_source,
    'system'
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_plan', p_old_plan_id,
    'new_plan', p_new_plan_id,
    'credits_added', v_credits_to_add,
    'proration_factor', v_prorate_factor,
    'days_remaining', v_days_remaining,
    'transaction_id', v_transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'plan_change_failed',
      'message', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION process_plan_change IS 'Process subscription plan changes with prorated credit adjustments. Validates plan_type against subscription_plans - NO FALLBACK.';
```

---

## Phase 5: Automatic Team Creation

### 5.1 Team Creation on Subscription Upgrade

```sql
CREATE OR REPLACE FUNCTION auto_create_team_on_upgrade()
RETURNS TRIGGER AS $$
DECLARE
  v_team_id TEXT;
  v_plan_details RECORD;
  v_user_credits INTEGER;
  v_team_credits INTEGER;
BEGIN
  -- Only trigger when plan changes TO 'team'
  IF NEW.plan_id = 'team' AND (OLD.plan_id IS NULL OR OLD.plan_id != 'team') THEN

    -- Check if user already has a team (as owner or member)
    IF EXISTS (
      SELECT 1 FROM teams WHERE owner_id = NEW.user_id
      UNION
      SELECT 1 FROM team_members WHERE user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'User % already has a team. Cannot create team for team subscription.', NEW.user_id;
    END IF;

    -- Get plan details
    SELECT * INTO v_plan_details
    FROM subscription_plans
    WHERE plan_type = 'team' AND is_active = true;

    IF v_plan_details IS NULL THEN
      RAISE EXCEPTION 'Team plan configuration not found in subscription_plans';
    END IF;

    -- Get user's current credit balance
    SELECT COALESCE(credit_balance, 0) INTO v_user_credits
    FROM user_profiles
    WHERE id = NEW.user_id;

    -- Generate team ID
    v_team_id := 'team_' || substr(md5(random()::text), 1, 16);

    -- Create team
    INSERT INTO teams (
      id,
      name,
      description,
      owner_id,
      subscription_id,
      subscription_status,
      credit_balance,
      created_at,
      updated_at
    ) VALUES (
      v_team_id,
      format('%s''s Team', COALESCE((SELECT username FROM user_profiles WHERE id = NEW.user_id), 'User')),
      'Team created automatically on subscription upgrade',
      NEW.user_id,
      NEW.id,
      NEW.status,
      0, -- Will be updated after credit transfers
      NOW(),
      NOW()
    );

    -- Add owner to team_members
    INSERT INTO team_members (
      team_id,
      user_id,
      role,
      joined_at
    ) VALUES (
      v_team_id,
      NEW.user_id,
      'owner',
      NOW()
    );

    -- Transfer ALL user credits to team
    IF v_user_credits > 0 THEN
      -- Deduct from user
      UPDATE user_profiles
      SET credit_balance = 0, updated_at = NOW()
      WHERE id = NEW.user_id;

      -- Add to team
      UPDATE teams
      SET credit_balance = v_user_credits, updated_at = NOW()
      WHERE id = v_team_id;

      -- Record transaction
      INSERT INTO credit_transactions (
        team_id,
        amount,
        transaction_type,
        description,
        entity_type,
        entity_id,
        created_by,
        created_at
      ) VALUES (
        v_team_id,
        v_user_credits,
        'team_transfer',
        format('Credits transferred from user %s on team creation', NEW.user_id),
        'team',
        v_team_id,
        NEW.user_id,
        NOW()
      );
    END IF;

    -- Allocate team monthly credits
    UPDATE teams
    SET credit_balance = credit_balance + v_plan_details.monthly_credits
    WHERE id = v_team_id;

    INSERT INTO credit_transactions (
      team_id,
      amount,
      transaction_type,
      description,
      entity_type,
      entity_id,
      created_by,
      created_at
    ) VALUES (
      v_team_id,
      v_plan_details.monthly_credits,
      'subscription_credit',
      format('Team plan activation: %s monthly credits', v_plan_details.monthly_credits),
      'subscription',
      NEW.id::TEXT,
      NEW.user_id,
      NOW()
    );

    RAISE NOTICE 'Team % auto-created for user %. Transferred % user credits + allocated % team credits = % total',
      v_team_id, NEW.user_id, v_user_credits, v_plan_details.monthly_credits, v_user_credits + v_plan_details.monthly_credits;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_team_on_subscription_upgrade
  AFTER INSERT OR UPDATE OF plan_id ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_team_on_upgrade();

COMMENT ON FUNCTION auto_create_team_on_upgrade IS 'Automatically creates team when subscription upgrades to team plan. Transfers ALL user credits to team.';
```

### 5.2 Prevent Manual Team Creation for Team Subscribers

```sql
CREATE OR REPLACE FUNCTION prevent_duplicate_team_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user has active team subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = NEW.owner_id
      AND plan_id = 'team'
      AND status IN ('active', 'trialing')
  ) THEN
    -- Check if team already exists for this subscription
    IF NOT EXISTS (
      SELECT 1 FROM teams
      WHERE owner_id = NEW.owner_id
    ) THEN
      -- This should never happen - team should auto-create
      RAISE WARNING 'Team subscription exists but no team found for user %. This indicates automatic team creation failed.', NEW.owner_id;
    ELSE
      RAISE EXCEPTION 'User % already has a team. Cannot create additional teams.', NEW.owner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_one_team_per_owner
  BEFORE INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_team_creation();
```

---

## Phase 6: Backend Changes

### 6.1 New Backend Module: `subscription-plan-service.ts`

**Replace** `stripe-plan-mappings.ts` with:

```typescript
/**
 * Subscription Plan Service - Database-backed plan configuration
 * Replaces hardcoded stripe-plan-mappings.ts
 */

import { createClient } from '@supabase/supabase-js';
import { environment } from '@zuplo/runtime';
import { ZuploContext } from '@zuplo/runtime';

export interface PlanDetails {
  plan_type: 'none' | 'trial' | 'individual' | 'team' | 'custom';
  stripe_product_id: string | null;
  monthly_credits: number;
  one_time_credits: number;
  display_name: string;
  description: string | null;
  requires_payment: boolean;
}

class SubscriptionPlanService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Get plan details by plan_type
   * @throws Error if plan not found (strict validation)
   */
  async getPlanDetails(planType: string): Promise<PlanDetails> {
    const { data, error } = await this.supabase.rpc('get_plan_details', {
      p_plan_type: planType
    });

    if (error) {
      throw new Error(`Failed to fetch plan details: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(
        `Invalid plan type: ${planType}. Valid plans: none, trial, individual, team, custom`
      );
    }

    return data[0];
  }

  /**
   * Reverse lookup: Get plan_type from Stripe product ID
   * @returns plan_type or null if not found
   */
  async getPlanTypeFromStripeProduct(stripeProductId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('get_plan_type_from_stripe_product', {
      p_stripe_product_id: stripeProductId
    });

    if (error) {
      throw new Error(`Failed to lookup plan type: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all active plans
   */
  async getAllActivePlans(): Promise<PlanDetails[]> {
    const { data, error } = await this.supabase.rpc('get_all_active_plans');

    if (error) {
      throw new Error(`Failed to fetch active plans: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Validate Stripe metadata matches local configuration
   */
  async validateStripeMetadata(context?: ZuploContext): Promise<any> {
    const { data, error } = await this.supabase.rpc('sync_plan_details_from_stripe');

    if (error) {
      throw new Error(`Failed to validate Stripe metadata: ${error.message}`);
    }

    // Log any mismatches
    const issues = data?.filter((row: any) => row.status !== 'OK');
    if (issues && issues.length > 0 && context) {
      context.log.warn('Stripe metadata validation issues', { issues });
    }

    return data;
  }
}

// Singleton instance
export const subscriptionPlanService = new SubscriptionPlanService();

// Backwards compatibility exports (now async)
export async function getStripeProductId(internalPlanId: string): Promise<string> {
  const plan = await subscriptionPlanService.getPlanDetails(internalPlanId);

  if (!plan.stripe_product_id) {
    throw new Error(`Plan ${internalPlanId} does not require Stripe subscription (no product ID)`);
  }

  return plan.stripe_product_id;
}

export async function getInternalPlanId(stripeProductId: string): Promise<string | null> {
  return await subscriptionPlanService.getPlanTypeFromStripeProduct(stripeProductId);
}

export function isValidPlanId(planId: string): boolean {
  // Fixed plan types
  if (['none', 'trial', 'individual', 'team', 'custom'].includes(planId)) {
    return true;
  }

  // Custom customer pattern: custom_<identifier>
  return /^custom_[a-z0-9_]+$/.test(planId);
}
```

### 6.2 Files to Update

**A. `backend/modules/stripe-service.ts`**

Key changes:
```typescript
// OLD:
import { getStripeProductId, getInternalPlanId } from './stripe-plan-mappings';
const productId = getStripeProductId('team'); // Synchronous

// NEW:
import { getStripeProductId, getInternalPlanId } from './subscription-plan-service';
const productId = await getStripeProductId('team'); // Now async
```

Functions to update:
- `mapStripePlanIdToAbstractId()` → call database
- `enrichSubscriptionWithPlanDetails()` → use `get_plan_details()`
- `upgradeSubscription()` → validate plan_type with database
- `createCheckoutSession()` → validate plan_type with database

**B. `backend/modules/team-management.ts`**

Line 351 already correct (uses `plan_id = 'team'`), no changes needed.

**C. `backend/modules/stripe-checkout-completion.ts`**

Already passes `internalPlanId` and `stripeProductId` separately - no changes needed.

### 6.3 Deprecation Timeline

1. **Week 1**: Deploy database changes, keep `stripe-plan-mappings.ts`
2. **Week 2**: Deploy new `subscription-plan-service.ts` alongside old file
3. **Week 3**: Verify all backend calls use new service
4. **Week 4**: Delete `stripe-plan-mappings.ts`

---

## Phase 7: Data Migration & Cleanup

### 7.1 Fix Existing Subscription Data

**Step 1: Find broken subscriptions**
```sql
-- Subscriptions with Stripe product IDs in plan_id field (excluding valid custom_* patterns)
SELECT id, user_id, plan_id, stripe_product_id, status
FROM subscriptions
WHERE plan_id NOT IN ('none', 'trial', 'individual', 'team', 'custom')
  AND plan_id !~ '^custom_[a-z0-9_]+$'  -- Exclude valid custom_* patterns
  AND plan_id IS NOT NULL
ORDER BY created_at DESC;
```

**Step 2: Fix them automatically**
```sql
-- Update subscriptions to use internal plan_type
UPDATE subscriptions s
SET
  plan_id = sp.plan_type,
  stripe_product_id = COALESCE(s.stripe_product_id, s.plan_id),
  updated_at = NOW()
FROM subscription_plans sp
WHERE s.stripe_product_id = sp.stripe_product_id
  AND s.plan_id != sp.plan_type;

-- Handle case where plan_id contains Stripe ID but stripe_product_id is NULL
UPDATE subscriptions s
SET
  stripe_product_id = s.plan_id,
  plan_id = sp.plan_type,
  updated_at = NOW()
FROM subscription_plans sp
WHERE s.plan_id = sp.stripe_product_id
  AND s.stripe_product_id IS NULL;
```

### 7.2 Add Constraints to Subscription Table

```sql
-- Ensure plan_id only contains internal plan types or custom_* pattern
ALTER TABLE subscriptions
  ADD CONSTRAINT valid_plan_id
  CHECK (
    plan_id IN ('none', 'trial', 'individual', 'team', 'custom') OR
    plan_id ~ '^custom_[a-z0-9_]+$'
  );

-- Ensure stripe_product_id is populated for paid plans (excluding marketing 'custom' placeholder)
ALTER TABLE subscriptions
  ADD CONSTRAINT paid_plans_have_stripe_id
  CHECK (
    (plan_id IN ('none', 'trial', 'custom')) OR
    (plan_id IN ('individual', 'team') AND stripe_product_id IS NOT NULL) OR
    (plan_id ~ '^custom_[a-z0-9_]+$' AND stripe_product_id IS NOT NULL)
  );
```

### 7.3 Clean Up Orphaned Teams

```sql
-- Find users with team subscriptions but no teams
SELECT
  s.user_id,
  up.email,
  s.plan_id,
  s.status,
  s.external_subscription_id
FROM subscriptions s
JOIN user_profiles up ON up.id = s.user_id
WHERE s.plan_id = 'team'
  AND s.status IN ('active', 'trialing')
  AND NOT EXISTS (SELECT 1 FROM teams WHERE owner_id = s.user_id);

-- These will be automatically fixed by the trigger on next subscription update
-- OR manually fix by updating subscription.updated_at to trigger team creation
```

---

## Phase 8: Testing & Verification

**Note**: Stripe metadata is already configured correctly. Individual and Team plans have proper `plan_type` and `monthly_credits` metadata. Marketing 'custom' placeholder intentionally has no Stripe product.

### 8.1 Database Tests

```sql
-- 1. Verify plan configuration loaded
SELECT * FROM subscription_plans ORDER BY plan_type;

-- 2. Check Stripe metadata alignment
SELECT * FROM sync_plan_details_from_stripe();
-- Expected: All rows show status = 'OK'

-- 3. Verify one-team-per-user constraint
-- Try to insert duplicate team membership (should fail)
INSERT INTO team_members (team_id, user_id, role)
VALUES ('test_team', 'user_123', 'member');
-- ERROR: duplicate key value violates unique constraint "one_team_per_user"

-- 4. Test plan lookup
SELECT * FROM get_plan_details('team');
-- Expected: Returns team plan with 200 monthly_credits

-- 5. Test reverse lookup
SELECT get_plan_type_from_stripe_product('prod_SmQaHVQboOvbv2');
-- Expected: 'team'

-- 6. Test automatic team creation
-- Simulate subscription upgrade to team plan
UPDATE subscriptions
SET plan_id = 'team', updated_at = NOW()
WHERE user_id = '<test_user_id>';
-- Expected: Team auto-created, credits transferred
```

### 8.2 Backend API Tests

```typescript
import { subscriptionPlanService } from './modules/subscription-plan-service';

// 1. Get plan details
const teamPlan = await subscriptionPlanService.getPlanDetails('team');
assert(teamPlan.monthly_credits === 200);

// 2. Reverse lookup
const planType = await subscriptionPlanService.getPlanTypeFromStripeProduct('prod_SmQaHVQboOvbv2');
assert(planType === 'team');

// 3. Invalid plan should throw
try {
  await subscriptionPlanService.getPlanDetails('invalid_plan');
  assert.fail('Should have thrown error');
} catch (error) {
  assert(error.message.includes('Invalid plan type'));
}

// 4. Validate Stripe metadata
const validation = await subscriptionPlanService.validateStripeMetadata();
const hasIssues = validation.some(row => row.status !== 'OK');
assert(!hasIssues, 'Stripe metadata validation failed');
```

### 8.3 Custom Plan Tests

```sql
-- 1. Verify custom marketing placeholder
SELECT * FROM subscription_plans WHERE plan_type = 'custom';
-- Expected: stripe_product_id = NULL, requires_payment = false

-- 2. Create test custom customer plan
INSERT INTO subscription_plans VALUES
  ('custom_test_corp', 'prod_TEST123', 5000, 0, 'Test Corp Custom', 'Test custom plan', true);

-- 3. Verify pattern validation accepts it
SELECT * FROM get_plan_details('custom_test_corp');
-- Expected: Returns plan with 5000 monthly_credits

-- 4. Test constraint allows custom_* pattern
UPDATE subscriptions
SET plan_id = 'custom_test_corp'
WHERE user_id = '<test_user>';
-- Expected: Success (no constraint violation)

-- 5. Cleanup
DELETE FROM subscription_plans WHERE plan_type = 'custom_test_corp';
```

---

## Phase 9: Deployment Checklist

### Non-Prod Deployment

- [ ] **Database Migration**:
  - [ ] Create `subscription_plans` table with pattern-based constraint
  - [ ] Populate with test data (including marketing 'custom' placeholder)
  - [ ] Add one-team-per-user constraints
  - [ ] Deploy plan lookup functions
  - [ ] Deploy updated `allocate_monthly_credits()`
  - [ ] Deploy updated `process_plan_change()`
  - [ ] Deploy automatic team creation trigger

- [ ] **Verification** (Stripe metadata already configured):
  - [ ] Verify: `SELECT * FROM sync_plan_details_from_stripe();`
  - [ ] Expected: Individual and Team show status='OK', no 'custom' row (skipped)

- [ ] **Data Cleanup**:
  - [ ] Fix existing subscription.plan_id values
  - [ ] Add subscription table constraints
  - [ ] Identify orphaned teams

- [ ] **Backend Deployment**:
  - [ ] Deploy `subscription-plan-service.ts`
  - [ ] Update `stripe-service.ts` to use async functions
  - [ ] Keep `stripe-plan-mappings.ts` as fallback

- [ ] **Testing**:
  - [ ] Test credit allocation with team plan
  - [ ] Test Individual → Team upgrade (verify auto team creation)
  - [ ] Test duplicate team creation (should fail)
  - [ ] Test invalid plan_type (should error, not fallback)
  - [ ] Test custom_* pattern acceptance (create test custom plan)

### Prod Deployment

- [ ] **Database Migration** (same as non-prod):
  - [ ] Create `subscription_plans` table with pattern-based constraint
  - [ ] Populate with LIVE data (including marketing 'custom' placeholder)
  - [ ] Add constraints and triggers
  - [ ] Deploy updated functions

- [ ] **Verification** (Stripe metadata already configured):
  - [ ] Verify: `SELECT * FROM sync_plan_details_from_stripe();`
  - [ ] Expected: Individual and Team show status='OK'

- [ ] **Data Cleanup**:
  - [ ] Fix subscription data
  - [ ] Add constraints

- [ ] **Backend Deployment**:
  - [ ] Deploy new service
  - [ ] Monitor Sentry for errors

- [ ] **Monitoring**:
  - [ ] Watch credit allocations for 24 hours
  - [ ] Verify team auto-creation working
  - [ ] Check for constraint violations

### Post-Deployment (2 weeks later)

- [ ] Remove `stripe-plan-mappings.ts`
- [ ] Add plan configuration to admin dashboards
- [ ] Document plan change procedure
- [ ] Document custom customer onboarding process

---

## Benefits

1. ✅ **Single Source of Truth**: Database is authoritative
2. ✅ **Strict Validation**: Invalid plans error immediately, no silent fallbacks
3. ✅ **Automatic Team Creation**: No manual intervention, fewer bugs
4. ✅ **One Team Per User**: Database enforces business rule
5. ✅ **No Code Deployments**: Change credits via SQL, not code
6. ✅ **Environment Consistency**: Same schema everywhere
7. ✅ **Stripe Validation**: Built-in metadata sync checking (auto-skips marketing 'custom')
8. ✅ **Extensible**: JSONB metadata for future features
9. ✅ **Reliable**: Works even if Stripe is down (for lookups)
10. ✅ **Debuggable**: All logic in stored procedures, easy to trace
11. ✅ **Custom Customer Support**: Add custom plans without code changes via `custom_*` pattern

---

## Migration Timeline

**Week 1**: Database migration (non-prod → prod)
**Week 2**: Backend deployment + testing
**Week 3**: Data cleanup + constraint enforcement
**Week 4**: Remove deprecated code

---

## Rollback Plan

If critical issues arise:

1. **Database**: Drop constraints, disable triggers
2. **Backend**: Revert to `stripe-plan-mappings.ts`
3. **Subscriptions**: Old data format still works (forwards compatible)
4. **Teams**: Manual creation still possible via API

No data loss - all changes are additive except constraints.

---

## Open Questions for User

1. ✅ **Trial activation**: Auto on signup or manual? → **Auto-activate**
2. ✅ **'none' state**: Keep or skip? → **Keep 'none' for signed-up-but-no-trial users**
3. ✅ **Downgrade credits**: Remove or keep? → **Keep (no removal)**
4. ✅ **Plan archival**: How to handle discontinued plans? → **Add when needed**

---

## Files to Create

### Database Migrations
- `backend/scripts/migrations/001_create_subscription_plans.sql`
- `backend/scripts/migrations/002_add_team_constraints.sql`
- `backend/scripts/migrations/003_update_credit_functions.sql`
- `backend/scripts/migrations/004_add_team_auto_creation.sql`
- `backend/scripts/migrations/999_cleanup_subscription_data.sql`

### Backend Code
- `backend/modules/subscription-plan-service.ts` (NEW)
- `backend/modules/stripe-service.ts` (UPDATE)
- `backend/modules/team-management.ts` (VERIFY, minimal changes)

### Scripts
- `backend/scripts/validate-plan-configuration.sh` (verify Stripe metadata)
- `backend/scripts/fix-subscription-data.sql` (one-time cleanup)
- `backend/scripts/create-custom-customer-plan.sh` (template for custom customer onboarding)

---

**End of Plan**
