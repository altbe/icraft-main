# Work Session Archives

This directory contains archived work session documentation from the main CLAUDE.md file, organized by quarter and completion date.

## Purpose
Archived to keep the main CLAUDE.md file focused and performant while preserving historical implementation details for reference.

## Archive Structure

### 2025 Q4 (October - December 2025)
- [`2025-11-subscription-sync-signature-fix.md`](./2025-Q4/2025-11-subscription-sync-signature-fix.md) - Fixed function signature mismatch in subscription sync cron job
- [`2025-11-uuid-text-fix.md`](./2025-Q4/2025-11-uuid-text-fix.md) - PostgreSQL UUID/TEXT type mismatch resolution
- [`2025-11-clerk-webhook-decommission.md`](./2025-Q4/2025-11-clerk-webhook-decommission.md) - Migration from Zuplo to Supabase Edge Functions
- [`2025-11-trial-credit-allocation-fix.md`](./2025-Q4/2025-11-trial-credit-allocation-fix.md) - Fixed credit allocation for trial-to-paid transitions
- [`2025-10-team-member-requirements.md`](./2025-Q4/2025-10-team-member-requirements.md) - Team collaboration implementation and story/credit transfers

### 2025 Q3 (July - September 2025)
*(No archived sessions from this period)*

### 2025 Q2 (April - June 2025)
*(No archived sessions from this period)*

### 2025 Q1 (January - March 2025)
- [`2025-01-image-search-implementation.md`](./2025-Q1/2025-01-image-search-implementation.md) - AI-powered semantic search with BGE-M3 embeddings and VLLM processing

## Key Implementation Patterns

### Completed Implementations
- **Database-First Architecture**: Business logic in PostgreSQL stored procedures
- **Team Collaboration**: One-team-per-user enforcement with automatic story/credit transfers
- **Credit System**: Consolidated ledger-based model with auto-detection
- **Webhook Architecture**: Single Supabase Edge Function endpoint
- **Image Search**: Semantic search with BGE-M3 embeddings

### Current Architecture Status
All major systems are production-ready with the exception of subscription upgrade transfers (partially implemented).

## Reference Documents
For current implementation details, see:
- Main [`CLAUDE.md`](../../CLAUDE.md) - Essential project guidance
- [`backend/CLAUDE.md`](../../backend/CLAUDE.md) - Backend-specific patterns
- [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md) - Frontend-specific patterns