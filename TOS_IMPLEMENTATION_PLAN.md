# Terms of Service Implementation Plan
**Complete User Onboarding, Team Participation & ToS Management System**

**Date**: 2025-01-18
**Status**: Planning Phase

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Backend Implementation](#3-backend-implementation)
4. [Frontend Implementation](#4-frontend-implementation)
5. [User Flows](#5-user-flows)
6. [ToS Maintenance](#6-tos-maintenance)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment Plan](#8-deployment-plan)
9. [Monitoring & Auditing](#9-monitoring--auditing)
10. [Success Criteria](#10-success-criteria)

---

## 1. System Overview

### 1.1 Goals
- ✅ Maintain auditable Terms of Service with bilingual support (EN/ES)
- ✅ Ensure all users accept ToS before using the platform
- ✅ Block team invitation acceptance without ToS acceptance
- ✅ Support optional credit transfer during team invitation acceptance
- ✅ Provide complete audit trail for legal compliance

### 1.2 Key Components
```
┌─────────────────────────────────────────────────────────────────┐
│                      User Journey Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  New User Signup       Existing User          Team Invitation  │
│       │                     │                       │           │
│       ↓                     ↓                       ↓           │
│  Clerk Sign-Up         Check ToS Status      Not Authenticated?│
│       │                     │                       │           │
│       ↓                     │                       ↓           │
│  ToS Acceptance        New Version?          Redirect to        │
│  (Required)                 │                Clerk Sign-Up      │
│       │                     ↓                       │           │
│       ↓                Show ToS Dialog              ↓           │
│  Create Profile             │                  ToS Acceptance   │
│       │                     ↓                       │           │
│       ↓                Accept & Update             ↓           │
│  Grant Access               │                 Accept Invitation │
│                             ↓                       │           │
│                        Grant Access                 ↓           │
│                                              Transfer Credits?  │
│                                                     │           │
│                                                     ↓           │
│                                              Join Team          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack
- **Database**: Supabase (PostgreSQL) with stored procedures
- **Backend**: Zuplo API Gateway (Node.js/TypeScript)
- **Frontend**: React + TypeScript + Vite + `react-markdown`
- **Auth**: Clerk with JWT validation
- **Storage**: Database for ToS (markdown format), not filesystem

---

## 2. Database Schema

### 2.1 Core Tables

#### `terms_of_service`
```sql
CREATE TABLE terms_of_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL UNIQUE,        -- '1.0', '1.1', '2.0'
  effective_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,  -- Only one can be TRUE

  -- Bilingual markdown content
  content_en_md TEXT NOT NULL,
  content_es_md TEXT NOT NULL,
  checksum_en TEXT NOT NULL,                  -- SHA-256
  checksum_es TEXT NOT NULL,                  -- SHA-256

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT only_one_current EXCLUDE USING gist (
    is_current WITH =
  ) WHERE (is_current = TRUE)
);
```

#### `tos_acceptances`
```sql
CREATE TABLE tos_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id),
  tos_id UUID NOT NULL REFERENCES terms_of_service(id),
  version_number TEXT NOT NULL,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'es')),
  checksum_accepted TEXT NOT NULL,            -- Proof of what they saw

  -- Audit trail
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  acceptance_method TEXT NOT NULL,            -- 'signup', 'explicit_prompt', 'invitation_acceptance'
  metadata JSONB DEFAULT '{}'::jsonb
);
```

#### `user_profiles` (additions)
```sql
ALTER TABLE user_profiles
ADD COLUMN current_tos_id UUID REFERENCES terms_of_service(id),
ADD COLUMN tos_accepted_at TIMESTAMPTZ,
ADD COLUMN tos_language_code TEXT DEFAULT 'en';
```

### 2.2 Stored Procedures

- `get_current_tos()` - Returns current published ToS with both languages
- `record_tos_acceptance(...)` - Records user acceptance with full audit trail
- `user_needs_tos_acceptance(p_user_id)` - Returns TRUE if user needs to accept current ToS
- `get_user_tos_status(p_user_id)` - Returns detailed ToS status with version info

### 2.3 Migration File
**File**: `/backend/sql/create-tos-system.sql`

Contains:
- Table definitions with indexes
- Stored procedures
- Initial data with PLACEHOLDER content (to be replaced with actual ToS markdown)

---

## 3. Backend Implementation

### 3.1 API Endpoints

#### **GET /tos/current?language=en**
Returns current ToS content in specified language.

**Response**:
```typescript
{
  id: string;
  versionNumber: string;
  effectiveDate: string;
  contentMarkdown: string;  // Language-specific
  checksum: string;         // Language-specific
}
```

#### **POST /users/tos/accept**
Record user's ToS acceptance.

**Request**:
```typescript
{
  tosId: string;
  languageCode: 'en' | 'es';
  acceptanceMethod: 'signup' | 'explicit_prompt' | 'invitation_acceptance';
  metadata?: { invitationToken?: string };
}
```

**Response**:
```typescript
{
  success: boolean;
  acceptanceId: string;
  tosId: string;
  versionNumber: string;
  languageCode: string;
  acceptedAt: string;
}
```

#### **GET /users/tos/status**
Check if user needs ToS acceptance.

**Response**:
```typescript
{
  requiresAcceptance: boolean;
  currentTosId: string | null;
  currentVersion: string | null;
  userTosId: string | null;
  userVersion: string | null;
  userAcceptedAt: string | null;
  userLanguage: string;
}
```

#### **POST /teams/invitations/{token}/accept** (UPDATED)
Accept team invitation with optional credit transfer.

**Request**:
```typescript
{
  transferCredits?: {
    amount: number;
    description?: string;
  }
}
```

**New Validation**:
- ✅ User must have accepted current ToS (throws 400 if not)
- ✅ User email must match invitation email
- ✅ Invitation must be pending and not expired
- ✅ Credit transfer is optional and non-fatal

**Response**:
```typescript
{
  success: boolean;
  team: {
    id: string;
    name: string;
    role: string;
    joinedAt: string;
  };
  credit_transfer?: {
    success: boolean;
    userBalance?: number;
    teamBalance?: number;
    transactionId?: string;
    error?: string;
  };
}
```

### 3.2 Backend Modules

#### **New Module**: `/backend/modules/tos-service.ts`
```typescript
class TosService {
  async getCurrentTos(languageCode: 'en' | 'es'): Promise<TosContent>;
  async acceptTos(userId: string, tosId: string, languageCode: string, metadata: any): Promise<AcceptanceResult>;
  async getUserTosStatus(userId: string): Promise<TosStatus>;
  async requireTosAcceptance(userId: string): Promise<void>; // Throws if not accepted
}

// Exports route handlers
export async function getCurrentTos(request: ZuploRequest, context: ZuploContext);
export async function acceptTos(request: ZuploRequest, context: ZuploContext);
export async function getTosStatus(request: ZuploRequest, context: ZuploContext);
```

#### **Updated Module**: `/backend/modules/icraft-teams.ts`
**Changes to `acceptTeamInvitation()`**:
```typescript
export async function acceptTeamInvitation(request: ZuploRequest, context: ZuploContext) {
  // 1. Get token from URL
  const token = extractTokenFromUrl(request);

  // 2. Authenticate user
  const { userId } = await requireUserWithProfile(request, context);

  // 3. ✨ NEW: VALIDATE ToS ACCEPTANCE
  const tosService = new TosService(context);
  await tosService.requireTosAcceptance(userId); // Throws 400 if not accepted

  // 4. Parse optional credit transfer from body
  const { transferCredits } = await parseRequestBody(request);

  // 5. Validate invitation and add user to team
  // ... existing logic ...

  // 6. ✨ NEW: Optional credit transfer (non-fatal)
  let creditTransferResult = null;
  if (transferCredits) {
    try {
      const stripeService = new StripeService(context);
      creditTransferResult = await stripeService.transferCreditsToTeam(...);
    } catch (error) {
      // Log but don't fail - user already joined team
      creditTransferResult = { success: false, error: error.message };
    }
  }

  // 7. Return result
  return { success: true, team: {...}, credit_transfer: creditTransferResult };
}
```

### 3.3 Validation Schemas

**File**: `/backend/modules/validation-schemas.ts`

```typescript
// Reusable credit transfer schema (already exists)
export const TransferCreditsSchema = z.object({
  amount: z.number().int().min(1).max(10000),
  description: z.string().max(200).trim().optional()
});

// Invitation acceptance with optional credit transfer
export const AcceptTeamInvitationSchema = z.object({
  transferCredits: TransferCreditsSchema.optional()
});

// ToS acceptance
export const AcceptTosSchema = z.object({
  tosId: z.string().uuid(),
  languageCode: z.enum(['en', 'es']),
  acceptanceMethod: z.enum(['signup', 'explicit_prompt', 'invitation_acceptance']),
  metadata: z.record(z.unknown()).optional()
});
```

### 3.4 Zuplo Routes

**File**: `/backend/config/routes.oas.json`

Add/update routes:
- `GET /tos/current` - Public, no auth
- `POST /users/tos/accept` - Requires auth
- `GET /users/tos/status` - Requires auth
- `POST /teams/invitations/{token}/accept` - Requires auth (update existing)

---

## 4. Frontend Implementation

### 4.1 New Components

#### **TosAcceptanceDialog.tsx**
Modal dialog for displaying and accepting ToS.

**Features**:
- Fetches current ToS from API
- Renders markdown with `react-markdown`
- Scrollable content area with Tailwind styling
- Checkbox: "I have read and agree"
- Accept button (disabled until checked)
- Loading states and error handling
- Supports both EN/ES languages

#### **TosAcceptPage.tsx**
Standalone page for ToS acceptance after sign-up.

**Route**: `/tos/accept?redirect=/dashboard`

**Flow**:
1. Load current ToS
2. Show TosAcceptanceDialog
3. User accepts
4. Redirect to specified URL

#### **TeamInvitationAcceptancePage.tsx**
Handle team invitation with ToS check and credit transfer.

**Route**: `/teams/invitations/:token/accept`

**Flow**:
1. Check authentication → Redirect to sign-up if needed
2. Check ToS status → Show dialog if needed
3. Show invitation details + credit transfer form
4. Accept invitation with optional credits
5. Display success with transfer result

### 4.2 Services

#### **New Service**: `TosService.ts`
```typescript
class TosService {
  async getCurrentTos(language: 'en' | 'es'): Promise<TosContent>;
  async acceptTos(tosId: string, language: string, method: string, metadata?: any): Promise<AcceptanceResult>;
  async getTosStatus(): Promise<TosStatus>;
}
```

#### **Updated Service**: `TeamService.ts`
```typescript
class TeamService {
  // New method
  async acceptInvitation(
    token: string,
    transferCredits?: { amount: number; description?: string }
  ): Promise<InvitationAcceptanceResult>;
}
```

### 4.3 Type Definitions

**File**: `/frontend/src/types.ts`

```typescript
export interface TosContent {
  id: string;
  versionNumber: string;
  effectiveDate: string;
  contentMarkdown: string;
  checksum: string;
}

export interface TosStatus {
  requiresAcceptance: boolean;
  currentTosId: string | null;
  currentVersion: string | null;
  userTosId: string | null;
  userVersion: string | null;
  userAcceptedAt: string | null;
  userLanguage: string;
}

export interface InvitationAcceptanceResult {
  success: boolean;
  team: {
    id: string;
    name: string;
    description?: string;
    role: string;
    joinedAt: string;
  };
  credit_transfer?: {
    success: boolean;
    userBalance?: number;
    teamBalance?: number;
    transactionId?: string;
    error?: string;
  };
}
```

### 4.4 App-Level ToS Check

**File**: `App.tsx`

```typescript
export function App() {
  const { isSignedIn, userId } = useAuth();
  const [needsToS, setNeedsToS] = useState(false);

  useEffect(() => {
    if (isSignedIn && userId) {
      checkTosStatus();
    }
  }, [isSignedIn, userId]);

  const checkTosStatus = async () => {
    const status = await tosService.getTosStatus();
    setNeedsToS(status.requiresAcceptance);
  };

  return (
    <>
      {/* Blocking ToS dialog for existing users with new version */}
      <TosAcceptanceDialog
        isOpen={needsToS}
        onAccept={() => setNeedsToS(false)}
        acceptanceMethod="explicit_prompt"
      />

      <RouterProvider router={router} />
    </>
  );
}
```

---

## 5. User Flows

### 5.1 New User Signup with ToS

```
1. User clicks "Sign Up" → Clerk SignUp component
2. User completes form → Clerk creates account
3. Clerk redirects to /tos/accept?redirect=/dashboard
4. Frontend shows TosAcceptanceDialog (blocking)
5. User reads, checks "I agree", clicks "Accept"
6. POST /users/tos/accept with method='signup'
7. Redirect to /dashboard
8. User can now use platform
```

### 5.2 Existing User - New ToS Version

```
1. User signs in → Clerk authenticates
2. App.tsx checks ToS status → requiresAcceptance=true
3. Show TosAcceptanceDialog (blocking modal)
4. User accepts → POST /users/tos/accept with method='explicit_prompt'
5. Dialog closes, user continues
```

### 5.3 Team Invitation - Unauthenticated User

```
1. User clicks email link: /teams/invitations/{token}/accept
2. Frontend detects NOT authenticated
3. Redirect to: /sign-up?redirect_url=/teams/invitations/{token}/accept
4. User signs up → Clerk creates account
5. Redirect to /tos/accept?redirect=/teams/invitations/{token}/accept
6. User accepts ToS
7. Redirect to /teams/invitations/{token}/accept
8. Show invitation + credit transfer form
9. User accepts (optional credits)
10. POST /teams/invitations/{token}/accept with transferCredits
11. Backend validates ToS, adds to team, transfers credits (non-fatal)
12. Show success with credit transfer result
```

**Sequence Diagram**:
```
User          Frontend      Clerk       Backend      Database
 |               |            |            |            |
 |─Click link──>|            |            |            |
 |<─Redirect────|            |            |            |
 |    to sign-up             |            |            |
 |               |            |            |            |
 |<────Sign-up form──────────>|           |            |
 |─Submit────────────────────>|           |            |
 |               |            |─Create────────────────>|
 |               |            |<──────────OK───────────|
 |<─Redirect to ToS──────────|            |            |
 |               |            |            |            |
 |─Load ToS──────────────────────────────>|            |
 |<────ToS markdown──────────────────────|            |
 |─Accept ToS────────────────────────────>|            |
 |               |            |            |─Record────>|
 |<─Redirect to invitation───|            |            |
 |               |            |            |            |
 |─Accept invitation (+ credits)─────────>|            |
 |               |            |            |─Check ToS─>|
 |               |            |            |─Add team──>|
 |               |            |            |─Transfer──>|
 |<────Success + transfer result─────────|            |
```

### 5.4 Team Invitation - Authenticated (No ToS)

```
1. User clicks link (signed in)
2. Check ToS → requiresAcceptance=true
3. Show TosAcceptanceDialog (blocking)
4. Accept ToS
5. Show invitation + credit transfer
6. Accept invitation
7. Success
```

### 5.5 Team Invitation - Authenticated (Has ToS)

```
1. User clicks link (signed in, has ToS)
2. Check ToS → requiresAcceptance=false
3. Show invitation immediately
4. Accept with optional credits
5. Success with transfer result
```

---

## 6. ToS Maintenance

### 6.1 Adding New ToS Version

**Process**:
1. Prepare markdown content (EN + ES) in separate files
2. Calculate checksums:
   ```bash
   echo -n "markdown content" | sha256sum
   ```
3. Run SQL to insert new version:
   ```sql
   BEGIN;

   -- Mark old version as not current
   UPDATE terms_of_service SET is_current = FALSE WHERE is_current = TRUE;

   -- Insert new version
   INSERT INTO terms_of_service (
     version_number, effective_date, is_current,
     content_en_md, content_es_md,
     checksum_en, checksum_es
   ) VALUES (
     '1.1',
     '2025-06-01',
     TRUE,
     '# New English ToS...',
     '# Nuevos Términos...',
     'abc123...',  -- SHA-256 of English
     'def456...'   -- SHA-256 of Spanish
   );

   COMMIT;
   ```
4. All users prompted on next login
5. New users see new version immediately

### 6.2 Audit Queries

**Who accepted what version?**
```sql
SELECT
  u.id, u.email,
  a.version_number,
  a.language_code,
  a.accepted_at,
  a.acceptance_method
FROM tos_acceptances a
JOIN user_profiles u ON u.id = a.user_id
ORDER BY a.accepted_at DESC;
```

**Users needing new ToS:**
```sql
SELECT u.id, u.email
FROM user_profiles u
CROSS JOIN (SELECT id FROM terms_of_service WHERE is_current = TRUE) new_tos
WHERE u.current_tos_id IS NULL OR u.current_tos_id != new_tos.id;
```

**Verify content integrity:**
```sql
SELECT
  a.id,
  a.checksum_accepted = (
    CASE
      WHEN a.language_code = 'en' THEN t.checksum_en
      WHEN a.language_code = 'es' THEN t.checksum_es
    END
  ) AS is_valid
FROM tos_acceptances a
JOIN terms_of_service t ON t.id = a.tos_id;
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Backend**: `/backend/tests/tos-service.test.ts`
- Get current ToS returns correct version/language
- Accept ToS records correctly with checksum
- User needs acceptance logic
- Invalid inputs fail correctly

**Frontend**: `/frontend/src/components/__tests__/TosAcceptanceDialog.test.tsx`
- Dialog loads ToS
- Accept button behavior
- Error handling

### 7.2 Integration Tests

**Backend**: `/backend/tests/team-invitation-flow.test.ts`
- Accept without ToS → 400 error
- Accept with ToS → Success
- Accept with credit transfer → Success + transfer result
- Accept with insufficient credits → Success (join) + transfer failure

### 7.3 E2E Tests (Manual)

1. **New User Signup**: Sign up → Accept ToS → Access dashboard
2. **Team Invitation (New)**: Click link → Sign up → Accept ToS → Transfer credits → Join team
3. **Existing User (New ToS)**: Sign in → ToS dialog → Accept → Continue

---

## 8. Deployment Plan

### 8.1 Phase 1: Database Setup (Week 1)

1. Create SQL migration file
2. Test on development database
3. Run on QA database
4. Convert HTML ToS to markdown
5. Replace PLACEHOLDER content
6. Verify checksums

**Rollback**:
```sql
DROP TABLE IF EXISTS tos_acceptances CASCADE;
DROP TABLE IF EXISTS terms_of_service CASCADE;
DROP FUNCTION IF EXISTS public.get_current_tos() CASCADE;
DROP FUNCTION IF EXISTS public.record_tos_acceptance(...) CASCADE;
-- ... etc
```

### 8.2 Phase 2: Backend (Week 1-2)

1. Create `tos-service.ts`
2. Update `icraft-teams.ts`
3. Add validation schemas
4. Update Zuplo routes
5. Write tests
6. Deploy to dev → QA

### 8.3 Phase 3: Frontend (Week 2)

1. Install `react-markdown`
2. Create TosService
3. Create components
4. Update App.tsx
5. Add translations
6. Test locally
7. Deploy to QA

### 8.4 Phase 4: Production (Week 3)

**Pre-deployment**:
- All tests passing
- Code review complete
- ToS content finalized
- Rollback plan ready

**Deployment**:
1. Run database migration
2. Deploy backend
3. Deploy frontend
4. Monitor logs and metrics

---

## 9. Monitoring & Auditing

### 9.1 Database Monitoring

**Daily Queries**:
```sql
-- Users needing ToS
SELECT COUNT(*)
FROM user_profiles u
CROSS JOIN (SELECT id FROM terms_of_service WHERE is_current = TRUE) t
WHERE u.current_tos_id IS NULL OR u.current_tos_id != t.id;

-- Recent acceptances
SELECT DATE(accepted_at), COUNT(*)
FROM tos_acceptances
WHERE accepted_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(accepted_at);
```

### 9.2 Integrity Checks

**Weekly**:
```sql
-- Verify checksums
SELECT id, version_number
FROM terms_of_service
WHERE checksum_en != encode(sha256(content_en_md::bytea), 'hex')
   OR checksum_es != encode(sha256(content_es_md::bytea), 'hex');
-- Should return 0 rows
```

### 9.3 Alerts

Set up alerts for:
- ToS acceptance failures (> 5%)
- Users stuck without ToS > 24 hours
- Checksum mismatches
- Invitation failures

---

## 10. Success Criteria

### Technical
- ✅ 100% new users accept ToS
- ✅ Existing users prompted for new versions
- ✅ Team invitations blocked without ToS
- ✅ Complete audit trail
- ✅ Checksums validate correctly

### Business
- ✅ Legal compliance
- ✅ Auditable for regulations
- ✅ Bilingual support

### User Experience
- ✅ ToS acceptance < 2 minutes
- ✅ Smooth invitation flow
- ✅ Reliable credit transfers
- ✅ Clear error messages

---

**End of Implementation Plan**
