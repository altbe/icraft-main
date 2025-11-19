# Strategic Enhancements

**Purpose**: Future enhancements and optimizations that would improve performance, user experience, or capabilities but are not required for core functionality.

**Last Updated**: November 2025

---

## Quick Wins

### PWA App Shortcuts
**Priority**: Low | **Effort**: 30 minutes | **Impact**: UX

Add shortcuts to PWA manifest for quick actions from device home screen.

**Current State**: Manifest missing `shortcuts` array (92% PWA feature complete)

**Implementation**:
```typescript
// Add to vite.config.ts manifest
shortcuts: [
  {
    name: "Create Story",
    short_name: "Create",
    url: "/?action=create",
    icons: [{ src: "pwa-192x192.png", sizes: "192x192" }]
  },
  {
    name: "My Library",
    short_name: "Library",
    url: "/?action=library",
    icons: [{ src: "pwa-192x192.png", sizes: "192x192" }]
  }
]
```

**Benefits**:
- 3-tap to 1-tap for common actions
- Professional PWA appearance
- Android and iOS support

---

## Performance Optimizations

### CDN Image Transformation
**Priority**: Medium | **Effort**: 1-2 days | **Impact**: Performance

Deploy a Cloudflare Worker for on-the-fly image transformation to reduce bandwidth and improve load times.

**Current State**: Images served at full resolution from R2 via Cloudflare CDN (`img.icraftstories.com`)

**Enhancement**: Add image resizing/optimization layer

| Route | Transformation | Output |
|-------|---------------|--------|
| `/thumb/{id}` | 300×300, cover fit | webp, quality 80 |
| `/preview/{id}` | 800×800, inside fit | webp, quality 85 |
| `/full/{id}` | Original dimensions | webp, quality 90 |

**Benefits**:
- ~30% bandwidth reduction (WebP format)
- Faster page loads (smaller thumbnails)
- 1-year CDN cache with immutable headers
- Reduced R2 egress costs

**Implementation Reference**: See `docs-archive/2025-Q3-search-features/IMAGE_SEARCH_ENHANCEMENTS.md` Phase 6 for worker code.

---

### Query Embedding Caching
**Priority**: Low | **Effort**: 2-3 hours | **Impact**: Cost/Performance

Cache frequently-used search query embeddings to reduce Cloudflare Workers AI API calls.

**Current State**: Every search generates a new 1024-dimensional BGE-M3 embedding

**Enhancement**: Cache popular queries in KV store with 24-hour TTL

**Benefits**:
- Reduced API costs for repeated searches
- Faster response times for common queries
- Lower latency for popular search terms

---

## Feature Enhancements

### Story Approval Workflow
**Priority**: Low | **Effort**: 1-2 weeks | **Impact**: Moderation

Implement moderator dashboard for reviewing community story submissions.

**Current State**: Database has `is_approved` field, but stories are auto-approved on sharing

**Enhancement**: Build approval workflow UI
- Moderator dashboard showing pending stories
- Approve/reject actions with optional feedback
- Bulk approval for trusted users
- Notification to authors on approval/rejection

**Benefits**:
- Quality control for community library
- Prevent inappropriate content
- Curated community experience

---

### Advanced Search Filters
**Priority**: Low | **Effort**: 3-5 days | **Impact**: UX

Add advanced filtering options to image search beyond categories.

**Potential Filters**:
- Color palette (dominant colors)
- Aspect ratio (portrait/landscape/square)
- Style (illustration/photo/vector)
- Mood/tone classification

---

### Batch Image Operations
**Priority**: Low | **Effort**: 1 week | **Impact**: UX

Allow users to select and operate on multiple images at once.

**Capabilities**:
- Multi-select in search results
- Batch add to story
- Bulk download
- Collection management

---

## Infrastructure Improvements

### Real-Time Collaboration
**Priority**: Medium | **Effort**: 2-3 weeks | **Impact**: Feature

Enable multiple team members to edit a story simultaneously.

**Requirements**:
- WebSocket or Supabase Realtime integration
- Operational transformation or CRDT for conflict resolution
- Presence indicators showing who's editing
- Cursor/selection sharing

---

### Analytics Dashboard
**Priority**: Low | **Effort**: 1-2 weeks | **Impact**: Insights

Build a user-facing analytics dashboard for content creators.

**Metrics**:
- Story creation trends
- Credit usage patterns
- Team collaboration activity
- Popular categories/tags

---

## Database & Monitoring

### Subscription Cache Layer
**Priority**: Medium | **Effort**: 1-2 days | **Impact**: Performance/Cost

Add intelligent caching for Stripe FDW queries to reduce API calls and improve response times.

**Current State**: Every subscription query hits Stripe FDW directly

**Enhancement**:
- `subscription_cache` table with 15-minute TTL
- Automatic cache invalidation on webhook events
- Target 90% cache hit rate

**Benefits**:
- Reduced Stripe API calls
- Faster subscription lookups (<50ms cached vs ~200ms FDW)
- Lower operational costs

---

### Credit Expiration System
**Priority**: Low | **Effort**: 1 day | **Impact**: Business Logic

Automatic expiration of unused credits based on billing cycle.

**Current State**: Credits never expire

**Enhancement**:
- Add `expires_at` column to `credit_transactions`
- pg_cron job to expire old credits daily
- Configurable expiration (60 days monthly, 395 days annual)

**Benefits**:
- Encourage credit usage
- Cleaner accounting
- Standard SaaS practice

---

### System Health Monitoring Views
**Priority**: Medium | **Effort**: 4-6 hours | **Impact**: Operations

Database views for monitoring system health and business metrics.

**Current State**: No centralized monitoring views

**Enhancement**: Create PostgreSQL views:
- `subscription_metrics` - Active/trial/canceled counts by plan
- `credit_metrics` - Daily transaction volumes by type
- `system_health` - Cache hit rates, webhook success rates

**Benefits**:
- Quick operational insights
- Alerting foundation
- Business intelligence

---

### Alerting Rules
**Priority**: Low | **Effort**: 1 day | **Impact**: Operations

Proactive monitoring alerts for critical business events.

**Alerts to Implement**:
- Low credit balance (< 100 credits) affecting >10 users
- Webhook processing failures (> 5/hour)
- Cache hit rate below 80%
- Stuck trial subscriptions (past period end)

**Integration**: Datadog, NewRelic, or Grafana

---

## Completed Enhancements

### Semantic Image Search (November 2025)
- ✅ BGE-M3 embeddings for 1,196 custom images
- ✅ Real-time query embedding via Cloudflare Workers AI
- ✅ Vector similarity search with pgvector
- ✅ Multilingual support (100+ languages)
- ✅ Category-based filtering with i18n
- ✅ Frontend caching (IndexedDB + localStorage)

---

## How to Use This Document

1. **Adding Enhancements**: Document the current state, proposed enhancement, and expected benefits
2. **Prioritizing**: Update priority based on user feedback and business needs
3. **Completing**: Move to "Completed Enhancements" section with date and summary
4. **Archiving**: For detailed implementation plans, create separate docs and reference here

---

*This document tracks strategic improvements. For active development tasks, see `TODO.md`. For completed features, see `docs-archive/`.*
