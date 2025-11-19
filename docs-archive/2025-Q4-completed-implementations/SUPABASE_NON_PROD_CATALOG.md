# Supabase Non-Production Database Catalog

**Project**: icraft non-prod
**Project ID**: `jjpbogjufnqzsgiiaqwn`
**Region**: us-east-2
**Host**: db.jjpbogjufnqzsgiiaqwn.supabase.co
**Generated**: 2025-10-27
**Last Updated**: 2025-10-28 (Credit system consolidation completed)

---

## Table of Contents

1. [Overview](#overview)
2. [Tables by Category](#tables-by-category)
3. [Stored Procedures and Functions](#stored-procedures-and-functions)

---

## Overview

This document catalogs all tables and stored procedures in the iCraftStories non-production Supabase database. The database follows a **database-first architecture** with business logic implemented in PostgreSQL stored procedures.

### Key Statistics

- **Total Tables**: 38 (3 tables dropped 2025-10-27)
- **Total Functions/Procedures**: ~152 (17 functions removed during 2025-10-27/28 credit consolidation)
- **Primary Schema**: public

**Credit System Status**: ✅ Consolidated (17 functions → 8 functions, Pure Ledger Model)

---

## Tables by Category

### Core User Management

#### `user_profiles`
**Rows**: 5 | **RLS**: Enabled

Primary user profile table storing Clerk user information.

**Key Columns**:
- `id` (text, PK) - Clerk user ID
- `email` (text, unique) - User email address
- `display_name` (text) - User display name
- `avatar_url` (text) - User avatar URL
- `subscription_status` (text) - Subscription status (default: 'free')
- `stripe_customer_id` (text) - Stripe customer ID
- `language` (varchar) - User language preference (en, es, es-419)
- `is_admin` (boolean) - Admin flag
- `is_active` (boolean) - Active status (default: true)
- `preferences` (jsonb) - User preferences
- `created_at`, `updated_at`, `last_login_at` (timestamptz)

**Foreign Key Constraints**: Referenced by 14 tables (subscriptions, stories, credit_transactions, activities, team_members, teams, etc.)

---

### Subscription Management

#### `subscriptions`
**Rows**: 0 | **RLS**: Disabled

User subscriptions with Stripe integration.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (text, FK → user_profiles.id)
- `plan_type` (text, FK → subscription_plans.plan_type) - Internal plan identifier
- `status` (text) - Subscription status
- `current_period_start`, `current_period_end` (timestamptz)
- `cancel_at_period_end` (boolean, default: false)
- `payment_provider` (text)
- `external_subscription_id` (text, unique) - Stripe subscription ID
- `stripe_product_id` (text) - Stripe product ID
- `metadata` (jsonb)
- `plan_id` (text, generated) - DEPRECATED alias for plan_type

**Comment**: Team creation is now manual via API endpoint, not automatic on plan upgrade.

#### `subscription_plans`
**Rows**: 0 | **RLS**: Disabled

Master configuration for subscription plans and credit allocation.

**Key Columns**:
- `plan_type` (text, PK) - Fixed types (none, trial, individual, team, custom) or custom_* pattern
- `stripe_product_id` (text, unique) - Test mode Stripe product ID
- `monthly_credits` (integer) - Credits allocated each billing period
- `one_time_credits` (integer) - Credits allocated once when plan starts
- `display_name` (text)
- `description` (text)
- `is_active` (boolean, default: true)
- `requires_payment` (boolean, default: false)
- `metadata` (jsonb)

**Check Constraints**:
- `plan_type` must be 'none', 'trial', 'individual', 'team', 'custom', or match '^custom_[a-z0-9_]+$'

#### `subscription_events`
**Rows**: 0 | **RLS**: Disabled

Audit trail for subscription state changes.

**Key Columns**:
- `id` (uuid, PK)
- `subscription_id` (uuid, FK → subscriptions.id)
- `external_subscription_id` (text)
- `event_type` (text)
- `previous_state` (jsonb)
- `new_state` (jsonb)
- `source` (text, default: 'webhook') - Values: webhook, api, sync, reconciliation
- `webhook_event_id` (uuid, FK → webhook_events.id)
- `triggered_by` (text)
- `created_at` (timestamptz)

#### `subscription_status_audit`
**Rows**: 0 | **RLS**: Disabled

Audit table tracking all subscription status changes and billing-related modifications.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (text, FK → user_profiles.id)
- `email` (text)
- `old_status`, `new_status` (text)
- `change_reason` (text)
- `stripe_subscription_id`, `stripe_customer_id` (text)
- `changed_by` (text) - 'system', 'user', 'admin'
- `admin_user_id` (text)
- `change_timestamp` (timestamptz)
- `metadata` (jsonb)
- `idempotency_key` (text)

---

### Credit System

#### `credit_transactions`
**Rows**: 307 | **RLS**: Disabled

Pure ledger model for all credit operations (INSERT-only).

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (text, FK → user_profiles.id, NOT NULL)
- `team_id` (text, FK → teams.id)
- `amount` (integer) - Positive for credits, negative for debits
- `transaction_type` (text) - allocation, usage, purchase, transfer, etc.
- `description` (text)
- `entity_type` (text) - story, image, audio, etc.
- `entity_id` (text)
- `created_by` (text, FK → user_profiles.id)
- `metadata` (jsonb)

**Note**: Balances are computed from transactions, not cached. Use `get_user_credit_balance(p_user_id)` for balance queries.

**Transaction Types**: The ledger tracks all credit operations via `transaction_type`:
- `purchase` - One-time credit purchases (12 transactions, 950 credits)
- `transfer_from_user`, `transfer_to_team` - Credit transfers (11 transactions)
- `subscription_credit` - Monthly subscription allocations
- `trial_credit` - Trial credit grants
- `usage` - Credit consumption
- `reward` - Reward credits for user actions
- `allocation` - Manual credit allocations

---

### Story Management

#### `stories`
**Rows**: 333 | **RLS**: Enabled

Personal and team-owned stories.

**Key Columns**:
- `id` (uuid, PK)
- `title` (text)
- `user_id` (text, FK → user_profiles.id)
- `team_id` (text, FK → teams.id, nullable) - Team ownership
- `pages` (jsonb[], default: '{}') - Story pages
- `tags` (text[])
- `cover_canvas_editor_id` (uuid)
- `cover_canvas_state` (jsonb)
- `cover_coaching_content` (jsonb)
- `ai_generator_history` (jsonb[], default: '{}')
- `is_ai_generated` (boolean, default: false)
- `original_community_story_id` (uuid) - References community story if copied
- `created_at`, `updated_at` (timestamptz)
- `last_modified_by` (text)

#### `community_stories`
**Rows**: 112 | **RLS**: Enabled

Public stories shared by users.

**Key Columns**:
- `id` (uuid, PK)
- `title` (text)
- `original_user_id` (text, FK → user_profiles.id)
- `original_story_id` (uuid)
- `pages` (jsonb[], default: '{}')
- `tags` (text[])
- `cover_canvas_state` (jsonb)
- `cover_coaching_content` (jsonb)
- `ai_generator_history` (jsonb[], default: '{}')
- `shared_at` (timestamptz)
- `is_featured` (boolean, default: false)
- `is_approved` (boolean, default: true)
- `likes_count`, `views_count` (integer, default: 0)

#### `gen_ai_details`
**Rows**: 0 | **RLS**: Enabled

AI generation parameters and responses for stories.

**Key Columns**:
- `id` (uuid) - Story ID
- `story_params` (jsonb)
- `story_response` (jsonb)
- `image_provider` (text, default: 'FLUX') - FLUX, SD3, DALL-E, STABILITY
- `image_prompts` (jsonb, default: '[]') - Shared params, cover details, page details
- `created_at`, `updated_at` (timestamptz)

**Comment**: Story ID, parameters and response for AI-generated stories.

#### `story_transfers`
**Rows**: 4 | **RLS**: Disabled

Audit trail for story ownership transfers between users and teams.

**Key Columns**:
- `id` (uuid, PK)
- `transfer_type` (text) - 'user_to_team', 'team_to_user', 'team_to_team'
- `description` (text)
- `from_user_id`, `to_user_id` (text)
- `from_team_id`, `to_team_id` (text)
- `story_ids` (uuid[])
- `story_count` (integer, default: 0)
- `created_by` (text)
- `metadata` (jsonb)

**Comment**: Mirrors credit_transactions pattern for immutable audit trail.

---

### Team Management

#### `teams`
**Rows**: 0 | **RLS**: Disabled

Team entities for collaborative story creation.

**Key Columns**:
- `id` (text, PK, default: uuid_generate_v4())
- `name` (text)
- `description` (text)
- `owner_id` (text, FK → user_profiles.id)
- `avatar_url` (text)
- `subscription_id` (uuid)
- `subscription_status` (text, default: 'none')
- `clerk_org_id` (text) - Clerk organization ID for syncing memberships
- `created_at`, `updated_at` (timestamptz)

#### `team_members`
**Rows**: 0 | **RLS**: Disabled

Team membership with role-based permissions.

**Key Columns**:
- `id` (text, PK, default: uuid_generate_v4())
- `team_id` (text, FK → teams.id)
- `user_id` (text, FK → user_profiles.id)
- `role` (text, default: 'member') - 'owner' or 'member'
- `email` (text) - Email for invitation tracking
- `joined_at` (timestamptz)
- `can_use_credits` (boolean, default: true)
- `can_manage_credits` (boolean, default: false)

**Check Constraints**:
- `role` must be 'owner' or 'member'

---

### Activity Logging

#### `activities`
**Rows**: 47 | **RLS**: Disabled

User and team activity audit trail.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (text, FK → user_profiles.id)
- `team_id` (text)
- `action_type` (text) - story_create, story_edit, story_delete, etc.
- `entity_type` (text) - story, team, subscription, etc.
- `entity_id` (uuid)
- `metadata` (jsonb, default: '{}')
- `created_at`, `updated_at` (timestamptz)
- `last_modified_by` (text, FK → user_profiles.id)

---

### Webhook Management

#### `webhook_events`
**Rows**: 10 | **RLS**: Disabled

Webhook event processing tracker.

**Key Columns**:
- `id` (uuid, PK)
- `event_id` (text, unique) - External event ID (e.g., Stripe evt_*)
- `event_type` (text)
- `provider` (text, default: 'stripe')
- `raw_payload` (jsonb)
- `status` (text, default: 'pending') - pending, processing, succeeded, failed, dead_letter
- `processed_at` (timestamptz)
- `processing_attempts` (integer, default: 0)
- `last_attempt_at` (timestamptz)
- `error_message` (text)
- `created_at`, `updated_at` (timestamptz)

#### `webhook_idempotency`
**Rows**: 1 | **RLS**: Disabled

Idempotency tracking for webhook operations.

**Key Columns**:
- `id` (uuid, PK)
- `idempotency_key` (text, unique)
- `webhook_event_id` (uuid, FK → webhook_events.id)
- `operation_type` (text)
- `operation_result` (jsonb)
- `created_at` (timestamptz)
- `expires_at` (timestamptz, default: now() + 24 hours)

---

### Reconciliation and Monitoring

#### `reconciliation_jobs`
**Rows**: 0 | **RLS**: Disabled

Background reconciliation job tracker.

**Key Columns**:
- `id` (uuid, PK)
- `job_type` (text) - subscription_sync, credit_balance_check, webhook_backfill
- `status` (text, default: 'pending') - pending, running, completed, failed
- `started_at`, `completed_at` (timestamptz)
- `records_processed`, `errors_found`, `discrepancies_fixed` (integer, default: 0)
- `error_details` (jsonb)
- `metadata` (jsonb, default: '{}')

#### `consistency_violations`
**Rows**: 0 | **RLS**: Disabled

Tracks data consistency issues between local DB and Stripe.

**Key Columns**:
- `id` (uuid, PK)
- `violation_type` (text)
- `entity_type` (text)
- `entity_id` (text)
- `local_state`, `stripe_state` (jsonb)
- `discrepancy_details` (jsonb)
- `severity` (text, default: 'medium') - low, medium, high, critical
- `resolved_at` (timestamptz)
- `resolved_by`, `resolution_method` (text)

#### `system_logs`
**Rows**: 51 | **RLS**: Disabled

General system logging.

**Key Columns**:
- `id` (uuid, PK)
- `log_type` (text)
- `log_message` (text)
- `metadata` (jsonb)
- `created_at` (timestamptz)

#### `system_alerts`
**Rows**: 4 | **RLS**: Disabled

System health alerts.

**Key Columns**:
- `id` (uuid, PK)
- `alert_type` (text)
- `severity` (text) - low, medium, high, critical
- `message` (text)
- `metadata` (jsonb)
- `resolved_at` (timestamptz)
- `created_at` (timestamptz)

---

### Custom Images (Image Library)

#### `custom_images`
**Rows**: 0 | **RLS**: Disabled

Custom image assets for story creation.

**Key Columns**:
- `id` (uuid, PK)
- `r2_key` (text, unique) - Cloudflare R2 key
- `url` (text, unique) - Public URL
- `thumbnail_url` (text)
- `width`, `height` (integer)
- `file_size_bytes` (integer)
- `is_active` (boolean, default: true)
- `is_safe` (boolean, default: true)
- `category_id` (text, FK → categories.id)
- `created_at`, `updated_at` (timestamptz)

#### `custom_images_translations`
**Rows**: 0 | **RLS**: Disabled

Multilingual translations for custom images.

**Key Columns**:
- `id` (uuid, PK)
- `image_id` (uuid, FK → custom_images.id)
- `language_code` (text) - 'en' or 'es'
- `title` (text)
- `description` (text)
- `tags` (text[])
- `search_vector` (tsvector) - Full-text search index
- `created_at`, `updated_at` (timestamptz)

#### `categories`
**Rows**: 0 | **RLS**: Disabled

Image categories for organization.

**Key Columns**:
- `id` (text, PK)
- `icon` (text)
- `sort_order` (integer)
- `is_active` (boolean, default: true)
- `created_at`, `updated_at` (timestamptz)

#### `categories_translations`
**Rows**: 0 | **RLS**: Disabled

Multilingual translations for categories.

**Key Columns**:
- `category_id` (text, PK, FK → categories.id)
- `language_code` (text, PK) - 'en' or 'es'
- `name` (text)
- `description` (text)
- `created_at`, `updated_at` (timestamptz)

---

### Terms of Service

#### `terms_of_service`
**Rows**: 0 | **RLS**: Disabled

Stores all versions of Terms of Service in markdown format with bilingual support.

**Key Columns**:
- `id` (uuid, PK)
- `version` (varchar, unique)
- `effective_date` (timestamptz)
- `content_en_md` (text) - English markdown content
- `content_es_md` (text) - Spanish markdown content
- `content_en_checksum` (varchar)
- `content_es_checksum` (varchar)
- `is_active` (boolean, default: true)
- `summary_en`, `summary_es` (varchar)
- `created_by` (varchar)
- `notes` (text)
- `created_at`, `updated_at` (timestamptz)

#### `tos_acceptances`
**Rows**: 2 | **RLS**: Disabled

Immutable audit log of all ToS acceptances for legal compliance.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (varchar)
- `tos_id` (uuid, FK → terms_of_service.id)
- `tos_version` (varchar)
- `accepted_at` (timestamptz)
- `acceptance_method` (varchar) - signup, upgrade, prompt, etc.
- `language` (varchar, default: 'en')
- `ip_address` (inet)
- `user_agent` (text)
- `device_id` (varchar)
- `content_en_checksum`, `content_es_checksum` (varchar)
- `content_snapshot_en_md`, `content_snapshot_es_md` (text)

---

### Sync and Device Management

#### `sync_metadata`
**Rows**: 530 | **RLS**: Disabled

Device sync status tracking for PWA offline-first architecture.

**Key Columns**:
- `user_id` (text, PK, FK → user_profiles.id)
- `device_id` (text, PK)
- `last_sync_timestamp` (timestamptz)
- `sync_status` (text, default: 'pending')
- `metadata` (jsonb, default: '{}')

#### `sync_deleted_log`
**Rows**: 1 | **RLS**: Enabled

Log of deleted stories by user for sync conflict resolution.

**Key Columns**:
- `story_id` (uuid, PK)
- `user_id` (text, PK)
- `device_id` (text)
- `created_at` (timestamptz)

---

### Migration and Audit Tables

#### `migration_legacy_users`
**Rows**: 0 | **RLS**: Disabled

Migration mapping between old UUID and new Clerk IDs.

**Key Columns**:
- `old_uuid_id` (uuid, unique)
- `new_clerk_id` (text, unique)
- `email` (text)
- `migrated_at` (timestamptz)

#### `user_clerk_id_audit`
**Rows**: 2 | **RLS**: Disabled

Audit table tracking all Clerk ID changes and user data migrations. Used for compliance and debugging account recreation scenarios.

**Key Columns**:
- `id` (uuid, PK)
- `email` (text)
- `old_clerk_id`, `new_clerk_id` (text)
- `migration_reason` (text)
- `migration_timestamp` (timestamptz)
- `data_migrated` (jsonb, default: '{}')
- `created_by` (text, default: 'system')
- `admin_user_id` (text)
- `operation_type` (text)
- `changes_made` (jsonb, default: '{}')
- `idempotency_key` (text)

---

### Archive Tables

#### `_archived_team_invitations`
**Rows**: 0 | **RLS**: Disabled

Archived team invitations (replaced by Clerk-first invitation system).

#### `community_stories_old`
**Rows**: 0 | **RLS**: Disabled

Old community stories schema (replaced by `community_stories`).

#### `stories_original`
**Rows**: 0 | **RLS**: Enabled

Duplicate of stories table (marked for cleanup).

#### `migration_snapshot_20251024`
**Rows**: 143 | **RLS**: Disabled

Snapshot of story data before migration on 2025-10-24.

#### `credit_balance_archive_20251025`
**Rows**: 253 | **RLS**: Disabled

Archived credit balance data from 2025-10-25 consolidation.

#### `function_definitions_archive_20251025`
**Rows**: 9 | **RLS**: Disabled

Archived function definitions from 2025-10-25.

#### `credit_purchases_archive_20251027`
**Rows**: 0 | **RLS**: Disabled

Archived before dropping `credit_purchases` table. All purchase data moved to `credit_transactions` ledger as `transaction_type='purchase'`.

#### `credit_transfers_archive_20251027`
**Rows**: 0 | **RLS**: Disabled

Archived before dropping `credit_transfers` table. All transfer data moved to `credit_transactions` ledger as `transaction_type='transfer_*'`.

#### `team_credit_allocations_archive_20251027`
**Rows**: 0 | **RLS**: Disabled

Archived before dropping `team_credit_allocations` table. All allocation data tracked in `credit_transactions` ledger.

---

## Stored Procedures and Functions

### Credit Management (8 functions) ✅ Consolidated 2025-10-28

**Architecture:** Pure Ledger Model with Database-First Team Attribution

#### Core Functions (2)
- **`allocate_credits(p_user_id, p_amount, p_source, p_description, p_metadata)`** → jsonb
  **Universal credit allocation function.** Replaces all legacy allocation functions (allocate_subscription_credits, allocate_trial_credits, allocate_monthly_credits, add_reward_credits, etc.). Auto-detects team membership and inserts transactions in both credit_transactions and activities tables. Supports sources: 'trial_signup', 'subscription_renewal', 'payment', 'admin_adjustment', 'refund', 'transfer'. Uses translation-friendly descriptions.

- **`use_credits_for_operation(p_user_id, p_operation_type, p_quantity, p_metadata)`** → jsonb
  **Universal credit usage function.** Auto-detects team membership, calculates cost from operation type and quantity, validates sufficient balance, and creates audit trail in both tables. Supports: 'story_generation', 'image_generation', 'community_copy', 'community_share' (reward). Replaces use_credits() with operation-specific logic.

#### Balance Query (1)
- **`get_user_credit_balance(p_user_id)`** → integer
  Returns credit balance with automatic team detection. If user is team member, returns team shared balance. Otherwise, returns personal balance. **Database-First Team Attribution pattern.** ONLY balance function - legacy alternatives dropped.

#### Helper Functions (2)
- **`get_user_team_id(p_user_id)`** → text
  Database-first team membership lookup. Returns team_id if user is active team member, NULL if individual. Used internally by all credit functions for auto-detection.

- **`calculate_operation_credits(p_operation_type, p_quantity)`** → jsonb
  Calculate credit cost for operation type and quantity. Centralized pricing logic.

#### Credit Transfer (1)
- **`transfer_all_user_credits_to_team(p_user_id, p_team_id, p_description)`** → jsonb
  Transfer ALL user credits to team (used during team onboarding). One-way transfer only - no partial transfers or team→user transfers.

#### Credit History (2)
- **`get_user_credit_history(p_user_id, p_limit, p_offset, p_types)`** → jsonb
  Get paginated credit transaction history for user (includes both personal and team transactions).

- **`get_team_credit_history(p_team_id, p_limit, p_offset, p_types)`** → jsonb
  Get paginated credit transaction history for team (all team transactions).

**Removed Functions (15):** All deprecated team-specific and legacy allocation functions dropped in consolidation. See migration 20251028000000_cleanup_deprecated_credit_functions.sql for complete list.

---

### Subscription Management (28 functions)

#### Subscription Queries
- **`get_active_subscription(p_user_id text)`** → TABLE
  Get active or trialing subscription for user. Returns personal subscription if available, otherwise returns team subscription if user is team member with access to team credits.

- **`get_user_subscription_details(p_user_id)`** → TABLE
  Get detailed subscription information including plan, price, and billing interval.

- **`get_user_subscription_details_debug(p_user_id)`** → TABLE
  Debug version with additional diagnostic info.

- **`has_active_subscription(p_user_id)`** → boolean
  Check if user has active subscription.

- **`is_trial_eligible(p_user_id)`** → jsonb
  Check if user is eligible for trial. Returns false if user has ANY subscription history.

#### Subscription Creation & Updates
- **`verify_and_create_subscription(...)`** → jsonb
  Idempotently creates/updates subscription from Stripe checkout. Properly updates plan_id on upgrades (ON CONFLICT).

- **`verify_and_upgrade_subscription(...)`** → jsonb
  Idempotently upgrades subscription from Stripe checkout completion.

- **`upgrade_subscription(p_user_id, p_new_plan_id, p_new_stripe_product_id, p_new_billing_period)`** → jsonb
  Upgrade user subscription to new plan. Updates existing subscription in-place to prevent duplicates.

- **`process_subscription_state_change(...)`** → jsonb
  Process subscription state changes with audit trail.

- **`process_subscription_webhook(event_data, idempotency_key, webhook_event_id)`** → jsonb
  Processes Stripe subscription webhooks with automatic upgrade detection and story/credit transfer.

- **`detect_and_handle_subscription_upgrade(...)`** → jsonb
  Detects subscription upgrades to team/custom plans and automatically transfers stories/credits to team.

#### Subscription Lifecycle
- **`pause_subscription(p_subscription_id, p_reason, p_source)`** → jsonb
  Pause subscription with reason tracking.

- **`resume_subscription(p_user_id)`** → jsonb
  Resume paused subscription.

- **`cancel_subscription_with_audit(...)`** → jsonb
  Cancel subscription with full audit trail.

#### Subscription Sync & Reconciliation
- **`sync_subscription_from_stripe(p_external_subscription_id)`** → jsonb
  Sync subscription state from Stripe.

- **`sync_expired_subscriptions()`** → jsonb
  Sync all expired subscriptions.

- **`scheduled_subscription_sync()`** → void
  Scheduled function that runs hourly to sync expired subscriptions.

- **`reconcile_subscriptions()`** → jsonb
  Reconcile subscription discrepancies with Stripe.

#### Plan Management
- **`get_plan_details(p_plan_type)`** → subscription_plans
  Get plan configuration details.

- **`get_plan_credits(p_plan_type)`** → json
  Get credit allocation for plan type.

- **`get_plan_type_from_stripe_product(p_stripe_product_id)`** → text
  Map Stripe product ID to internal plan type.

- **`get_stripe_product_id(p_plan_type)`** → text
  Map internal plan type to Stripe product ID.

- **`list_active_plans()`** → TABLE
  List all active subscription plans.

- **`validate_plan_type(p_plan_type)`** → boolean
  Validate plan type exists and is valid.

#### Monitoring
- **`daily_subscription_summary()`** → void
  Daily summary job that reports on subscription health. Creates alerts if issues detected.

- **`check_missed_webhooks(hours_back)`** → jsonb
  Check for missed webhook events in time window.

- **`list_subscription_cron_jobs()`** → TABLE
  List all scheduled cron jobs related to subscriptions.

#### Trial Management
- **`mark_trial_used(p_user_id, p_stripe_customer_id)`** → jsonb
  Generate metadata to mark that customer has used their trial.

---

### Team Management (18 functions)

#### Team Creation & Configuration
- **`create_team_with_owner_and_transfer_all(p_team_name, p_team_description, p_owner_user_id, p_clerk_org_id)`** → jsonb
  Creates team with owner and automatically transfers ALL owner credits to team.

- **`update_team_clerk_org_id(p_team_id, p_clerk_org_id)`** → void
  Safely update team with clerk_org_id after manual Clerk organization creation.

#### Team Membership
- **`is_team_member(p_user_id, p_team_id)`** → boolean
  Check if user is member of team.

- **`get_user_team_id(p_user_id)`** → uuid
  Returns team_id for user if they are team member, NULL otherwise. **Single source of truth for team membership lookup.**

- **`check_user_team_membership_by_email(p_email)`** → TABLE
  Check if user with given email is already member of any team. Returns team details if found.

- **`check_team_eligible_subscription(p_user_id)`** → TABLE
  Check if user has active team-eligible subscription (team or custom_*).

- **`get_user_teams_with_details(p_user_id)`** → TABLE
  Returns all teams for user with members, credits, and metadata. Fixed to handle webhook race conditions.

- **`onboard_team_member(p_user_id, p_team_id)`** → jsonb
  **Called by Clerk webhooks** to onboard new team members: transfers all credits, transfers all stories, cancels individual subscriptions.

#### Team Permissions
- **`can_use_team_credits(p_team_id, p_user_id)`** → boolean
  Check if user can use team credits.

- **`can_manage_team_credits(p_team_id, p_user_id)`** → boolean
  Check if user can manage team credits.

- **`manage_team_credits(p_operation, p_team_id, p_user_id, p_credits, p_story_id, p_from_user_id, p_to_user_id)`** → jsonb
  Unified team credit management function.

#### Team Activities
- **`get_team_activities(p_team_id, p_limit, p_offset)`** → TABLE
  Returns paginated activities for team with user details.

#### Team Downgrade
- **`handle_team_downgrade(p_team_id, p_old_plan, p_new_plan)`** → jsonb
  Handle team plan downgrades.

#### Team Story Management
- **`create_team_story(p_title, p_user_id, p_team_id, p_tags, p_content)`** → text
  Create story directly owned by team.

- **`remove_story_from_team(p_story_id, p_user_id)`** → jsonb
  Remove team ownership from story.

#### Story Transfers
- **`transfer_all_user_stories_to_team(p_user_id, p_team_id, p_description)`** → jsonb
  Transfers ALL personal user stories to team automatically. Returns stories_transferred: 0 if user has no personal stories.

---

### Story Management (15 functions)

#### Story Creation
- **`create_story(...)`** → jsonb
  Team-aware story creation with auto-assignment logic. Auto-assigns team_id if user belongs to exactly 1 team.

#### Story Queries
- **`get_user_stories_paginated(p_user_id, p_page, p_limit, p_search_term, p_tags_filter)`** → json
  Retrieve paginated user stories with search and filtering.

- **`get_user_and_team_stories_paginated(p_user_id, p_page, p_limit, p_search_term, p_tags_filter)`** → json
  Returns both personal stories AND team stories. **Replaces get_user_stories_paginated for team-aware library display.**

- **`get_paginated_stories(user_ids, page, per_page, tags)`** → jsonb
  Get paginated stories for multiple users.

- **`get_tags_for_users(user_ids)`** → jsonb
  Get distinct tags for user stories.

#### Story Permissions
- **`can_access_story(p_story_id, p_user_id)`** → boolean
  Check if user can access story.

- **`can_user_modify_story(p_user_id, p_story_id)`** → boolean
  Checks if user can modify story (either owner or team member for team stories).

#### Story Operations
- **`duplicate_story(p_story_id, p_user_id, p_new_title)`** → jsonb
  Team-aware story duplication. Preserves team ownership when duplicating team stories as team member.

- **`update_cover_canvas_state(p_story_id, p_cover_canvas_state, p_device_id)`** → stories
  Update cover canvas state.

- **`update_page_canvas_state(p_story_id, p_page_index, p_canvas_state, p_device_id)`** → stories
  Update page canvas state.

#### Community Stories
- **`get_community_story_by_id(story_id, isauthenticated)`** → jsonb
  Get community story details.

- **`get_paginated_community_stories(page_param, per_page, tags_filter, title_filter, isauthenticated)`** → jsonb
  Get paginated community stories with filters.

- **`get_community_story_tags()`** → jsonb
  Returns distinct tags from all community stories. Updated to use unnest() for text[] type.

- **`share_story_to_community_transactional(p_story_data, p_user_id, p_team_id, p_community_story_id)`** → jsonb
  Share story to community with transaction safety.

- **`copy_community_story_transactional(p_user_id, p_community_story_id, p_device_id)`** → jsonb
  Copies community story to personal/team library with automatic team attribution. Database determines team membership via get_user_team_id().

---

### Custom Images (6 functions)

#### Image Search
- **`search_custom_images_i18n(p_query, p_language, p_category_id, p_page, p_per_page, p_order_by)`** → TABLE
  Text-based search with internationalization support.

- **`search_custom_images_vector(p_query, p_language, p_category_id, p_page, p_per_page, p_order_by, p_use_vector, p_query_embedding, p_vector_threshold)`** → TABLE
  Vector-based semantic search with BGE-M3 embeddings (1024-dim).

#### Categories
- **`get_categories_i18n(p_language)`** → TABLE
  Get categories with translations and image counts.

- **`get_category_samples_i18n(p_language, p_limit)`** → TABLE
  Get sample images for each category.

- **`get_featured_images_i18n(p_language, p_limit)`** → TABLE
  Get featured images by category.

#### Embeddings
- **`update_embeddings_batch(updates jsonb)`** → TABLE
  Batch update image embeddings for vector search.

---

### User Management (9 functions)

#### User Creation & Updates
- **`handle_user_creation_with_migration(p_user_id, p_email, p_display_name, p_avatar_url, ...)`** → json
  Handle new user creation with legacy user migration support.

- **`admin_create_or_update_user(...)`** → jsonb
  Admin function to create or update user profiles.

- **`admin_deactivate_user(p_user_id, p_admin_user_id, p_reason)`** → json
  Admin-initiated user deactivation with audit trail.

#### Subscription Status Updates
- **`update_user_subscription_status(...)`** → json
  Update user subscription status with full audit trail.

- **`update_stripe_customer_id(...)`** → json
  Updates Stripe customer ID with overwrite protection and audit trail.

- **`get_subscription_status_history(p_user_id, p_email, p_limit)`** → TABLE
  Returns subscription status change history for audit.

#### Admin Operations
- **`get_admin_operation_history(p_admin_user_id, p_limit)`** → TABLE
  Query history of admin operations on user profiles.

#### Crisp Integration
- **`get_crisp_user_context(p_user_id)`** → jsonb
  Fetches comprehensive user context for Crisp chat integration. Reuses get_active_subscription() and get_user_credit_balance().

#### Current User
- **`get_current_user_id()`** → text
  Get current user ID from session context.

---

### Stripe Integration (14 functions)

#### Customer Management
- **`get_or_create_stripe_customer(p_user_id, p_email, p_name)`** → text
  Get existing or create new Stripe customer.

- **`find_stripe_customer_by_email(customer_email)`** → TABLE
  Find Stripe customer by email.

- **`get_stripe_customer(customer_id)`** → TABLE
  Get Stripe customer details via Supabase wrapper.

#### Product & Pricing
- **`get_stripe_product(product_id)`** → TABLE
  Get Stripe product details.

- **`get_stripe_product_by_name(product_name)`** → TABLE
  Find Stripe product by name.

- **`get_stripe_product_metadata(p_product_id)`** → TABLE
  Fetches Stripe product metadata. Used as fallback when direct API calls fail.

- **`get_stripe_products_and_prices()`** → TABLE
  Get all Stripe products with associated prices.

- **`get_stripe_price(price_id)`** → TABLE
  Get Stripe price details.

- **`get_stripe_price_for_product(p_product_id, p_price_type)`** → TABLE
  Get price for specific product.

- **`get_stripe_prices_for_product(product_id, billing_interval)`** → TABLE
  Get all prices for product filtered by billing interval.

#### Subscription Management
- **`get_stripe_subscription(subscription_id)`** → TABLE
  Get Stripe subscription details.

- **`verify_subscription_ownership(p_subscription_id, p_user_id)`** → TABLE
  Verify user owns subscription.

#### Payment Processing
- **`verify_and_allocate_payment(p_session_id, p_user_id, p_credits_to_allocate, p_amount_paid, p_payment_intent_id)`** → jsonb
  Verify payment and allocate credits.

- **`process_credit_purchase_webhook(event_data, idempotency_key, webhook_event_id)`** → jsonb
  Process credit purchase from Stripe webhook.

---

### Terms of Service (5 functions)

- **`get_current_tos()`** → TABLE
  Returns currently active Terms of Service.

- **`user_needs_tos_acceptance(p_user_id)`** → boolean
  Checks if user needs to accept current ToS version.

- **`get_user_tos_status(p_user_id)`** → TABLE
  Returns detailed ToS acceptance status for user.

- **`record_tos_acceptance(...)`** → uuid
  Records user acceptance of ToS with full audit trail.

- **`update_tos_updated_at()`** → trigger
  Trigger to update updated_at timestamp.

---

### Reconciliation & Consistency (3 functions)

- **`reconcile_credit_balances()`** → TABLE
  Reconcile credit balance discrepancies.

- **`validate_credit_balance_consistency()`** → jsonb
  Validate credit balance consistency across system.

- **`fix_story_ownership_from_audit(...)`** → TABLE
  Fixes orphaned story ownership using audit trail from activities table.

---

### Database Triggers (11 functions)

These functions are used as trigger handlers:

- **`assign_team_to_new_story()`** → trigger
  OPTIONAL: Auto-assigns team_id to new stories if user belongs to exactly one team.

- **`ensure_user_profile_exists()`** → trigger
  Ensures user profile exists before certain operations.

- **`update_story_attribution()`** → trigger
  Automatically tracks story attribution and logs team story modifications.

- **`update_timestamp()`** → trigger
  Updates updated_at timestamp on row modification.

- **`update_updated_at_column()`** → trigger
  Generic trigger to update updated_at column.

- **`update_subscription_timestamps()`** → trigger
  Updates subscription timestamps.

- **`update_subscriptions_updated_at()`** → trigger
  Updates subscriptions updated_at field.

- **`validate_subscription_plan_id()`** → trigger
  Validates subscription.plan_type exists and is active before insert/update.

- **`validate_team_ownership()`** → trigger
  Validates that user is not already team owner/member before creating/owning team.

- **`validate_user_team_membership()`** → trigger
  Validates that user is not already team owner/member before joining another team.

- **`update_custom_images_search_vector()`** → trigger
  Updates tsvector for full-text search on custom images.

- **`create_team_credits()`** → trigger
  Creates initial credit allocation for new teams.

- **`handle_team_story_credits()`** → trigger
  Handles credit deductions for team story operations.

- **`handle_team_downgrade()`** → trigger
  Handles team plan downgrades.

---

### PostgreSQL Extensions (pg_trgm - Trigram Functions)

These functions are part of the `pg_trgm` extension for fuzzy text matching:

- `similarity(text, text)` → real
- `similarity_dist(text, text)` → real
- `similarity_op(text, text)` → boolean
- `word_similarity(text, text)` → real
- `word_similarity_op(text, text)` → boolean
- `strict_word_similarity(text, text)` → real
- `strict_word_similarity_op(text, text)` → boolean
- `show_trgm(text)` → text[]
- `set_limit(real)` → real
- `show_limit()` → real
- Plus internal GIN index functions for trigram indexing

---

### Utility Functions (3 functions)

- **`generate_title_from_filename(filename text)`** → text
  Generate human-readable title from filename.

- **`increment(x integer)`** → integer
  Simple increment function (test/demo).

---

## Key Architectural Patterns

### 1. Database-First Business Logic
Core business logic is implemented in PostgreSQL stored procedures, not API endpoints. This ensures:
- Transactional integrity
- Consistent credit calculations
- Single source of truth for complex operations

### 2. Pure Ledger Credit System
All credit operations use INSERT-only transactions:
- **Single table**: `credit_transactions` (307 rows in non-prod)
- **No cached balances** - balances computed on-demand from ledger
- **Single balance function**: `get_user_credit_balance()` - auto-detects team membership
- **Legacy cleanup (2025-10-27)**: Dropped 3 redundant tables and 2 broken functions
- Semantic functions for each operation type (purchase, transfer, allocation, usage, reward)

### 3. Team Attribution
Database automatically determines team membership:
- `get_user_team_id()` is single source of truth
- All credit/story functions use this for team detection
- No explicit team_id passing required from API

### 4. Webhook Idempotency
Robust webhook processing with:
- `webhook_events` table for tracking
- `webhook_idempotency` for deduplication
- 24-hour expiration on idempotency keys
- Retry logic with dead letter queue

### 5. Audit Trail
Comprehensive audit logging:
- `subscription_status_audit` for billing changes
- `user_clerk_id_audit` for identity changes
- `story_transfers` for ownership changes
- `activities` for user actions
- `subscription_events` for state transitions

### 6. Reconciliation
Background jobs for data consistency:
- `scheduled_subscription_sync()` runs hourly
- `daily_subscription_summary()` reports health
- `reconcile_subscriptions()` fixes discrepancies
- `consistency_violations` table tracks issues

---

## Notable Design Decisions

### One Team Per User Constraint
- Enforced at database level (migration 002)
- Validated at API level before invitation
- Stored procedure `check_user_team_membership_by_email()` for pre-flight checks

### Clerk-First Team Invitations
- Team invitations managed by Clerk
- Webhook `organizationMembership.created` triggers `onboard_team_member()`
- Automatic story/credit transfer on team join

### Subscription Upgrade Detection
- `detect_and_handle_subscription_upgrade()` called from webhook processor
- Automatically transfers assets when user upgrades to team plan
- Prevents data loss during plan changes

### Team Story Ownership
- Stories have nullable `team_id` field
- Team members can modify team stories
- Personal stories have NULL team_id
- `transfer_all_user_stories_to_team()` moves all personal stories to team

---

## Migration Snapshots

The database includes several snapshot tables for rollback capability:
- `migration_snapshot_20251024` - 143 rows (story ownership migration)
- `credit_balance_archive_20251025` - 253 rows (credit consolidation)
- `function_definitions_archive_20251025` - 9 rows (function refactoring)

These provide historical data for auditing and rollback scenarios.

---

## Function Overloads

Several functions have multiple signatures (overloads):
- `allocate_monthly_credits()` - 3 versions
- `copy_community_story_transactional()` - 2 versions
- `process_plan_change()` - 3 versions
- `verify_and_upgrade_subscription()` - 2 versions
- `admin_create_or_update_user()` - 2 versions
- `pause_subscription()` - 2 versions

This provides flexibility for different calling contexts while maintaining API compatibility.

---

## Performance Considerations

### Indexes
- Full-text search indexes on `custom_images_translations.search_vector`
- Trigram indexes for fuzzy text matching
- Vector indexes for semantic image search (pgvector extension)
- Foreign key indexes for join performance

### Scheduled Jobs
- Hourly: `scheduled_subscription_sync()`
- Daily: `daily_subscription_summary()`
- Configured via `pg_cron` extension

---

## Recent Changes

### Credit System Consolidation (2025-10-27 to 2025-10-28)

**Phase 1: Schema Cleanup (2025-10-27)**
Removed legacy tables and broken functions:

**Tables Dropped (3):**
- `credit_purchases` (0 rows) - Migrated to `credit_transactions` with `transaction_type='purchase'`
- `credit_transfers` (0 rows) - Migrated to `credit_transactions` with `transaction_type='transfer_*'`
- `team_credit_allocations` (0 rows) - Tracked in `credit_transactions` ledger

**Functions Dropped (2):**
- `get_credit_balance(text)` - Called non-existent `get_team_credit_balance()`, broken at runtime
- `get_team_credits_balance_internal(text)` - Referenced non-existent `teams.credit_balance` column

**Phase 2: Function Consolidation (2025-10-28)**
Created 2 universal functions and removed 15 deprecated functions:

**Functions Created (2):**
- `allocate_credits()` - Universal allocation (replaces allocate_subscription_credits, allocate_trial_credits, allocate_monthly_credits, add_reward_credits, and all team-specific allocation functions)
- `use_credits_for_operation()` - Universal usage with activity logging (updated from previous version, removed p_team_id parameter)

**Functions Dropped (15):**
- `add_team_credits()`, `allocate_monthly_credits_team()`, `allocate_team_credits()`, `allocate_team_monthly_credits()`, `allocate_trial_credits_team()`
- `can_manage_team_credits()`, `can_use_team_credits()`, `manage_team_credits()`, `transfer_credits_to_team()`, `update_team_credit_balance()`
- `handle_team_story_credits()` (trigger), `create_team_credits()` (trigger), `allocate_monthly_credits()` (empty overload)
- `reconcile_credit_balances()`, `validate_credit_balance_consistency()`

**Final Result:**
- ✅ **17 functions → 8 functions** (56% reduction)
- ✅ **Pure Ledger Model** - All balances computed from `credit_transactions` table
- ✅ **Database-First Team Attribution** - `get_user_team_id()` determines team context automatically
- ✅ **Semantic Operations** - `allocate_credits()` for all allocations, `use_credits_for_operation()` for all usage
- ✅ **Activity Logging** - Both functions write to `activities` table for audit trail
- ✅ **Translation-Friendly** - Descriptions use i18n keys (e.g., "operations.story_generation")
- ✅ Schema: **38 tables, ~152 functions** (was 41 tables, 169 functions)
- ✅ Applied to both **non-prod** and **production** environments

---

## Documentation Links

- **Complete Requirements**: `TEAM_MEMBER_REQUIREMENTS.md`
- **Credit System**: `backend/CREDIT_SYSTEM_CONSOLIDATED.md`
- **Architecture**: `backend/TARGET-STATE-ARCHITECTURE.md`
- **Migrations**: `backend/sql/` directory

---

*End of Catalog*
