# iCraftStories

AI-powered illustrated story creation platform for educators, therapists, and parents. Create personalized social skills stories with team collaboration, offline-first PWA architecture, and multi-language support.

## What is iCraftStories?

iCraftStories helps users create personalized illustrated stories for children, focusing on:
- **Social Skills Training** - Stories that teach sharing, emotions, transitions
- **Therapeutic Storytelling** - Custom narratives for specific situations
- **Educational Content** - Engaging visual stories for learning

### Key Capabilities

- **AI Story Generation** - GPT-4o-mini text with consistent character design
- **AI Illustrations** - Stability AI SD3.5-large-turbo with feedback-based regeneration
- **Semantic Image Search** - BGE-M3 embeddings for 100+ language search (pgvector)
- **Team Collaboration** - Shared credit pools, automatic story/credit transfer
- **Offline-First PWA** - Full editing without internet (92% PWA feature complete)
- **Multi-Language** - English and Spanish interface and content

## Architecture

Monorepo with Git submodules:

| Component | Technology | Deployment |
|-----------|------------|------------|
| **Frontend** | React 18, TypeScript, Vite, Konva.js | Cloudflare Workers |
| **Backend** | Zuplo API Gateway, Supabase, Stripe | Zuplo GitOps |
| **Database** | PostgreSQL (Supabase) with pgvector | Supabase Cloud |
| **Storage** | Cloudflare R2 + CDN | img.icraftstories.com |

## Quick Start

```bash
# Clone with submodules
git clone --recursive https://github.com/altbe/icraft-main.git
cd icraft-main

# Setup and run
npm run setup    # Initialize submodules and install dependencies
npm run dev      # Start both frontend (port 3000) and backend
```

## Development Commands

```bash
# Daily development
npm run dev              # Start both services
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only

# Build & test
npm run build            # Build both projects
npm run test             # Run all tests
npm run lint             # Lint both projects

# Submodule management
npm run setup            # Initialize submodules
npm run update           # Update submodules to latest
npm run repo:status      # View repo and submodule status
```

## Deployment

### Frontend (Tag-based)
```bash
cd frontend
npm run tag:create       # Interactive tag creation (qa/prod)
npm run tag:status       # Check deployment status
```

### Backend (Branch-based GitOps)
```bash
cd backend
npm run promote:qa       # develop → preview (QA)
npm run release:production  # preview → main (Production)
```

## Subscription Plans

| Plan | Credits | Team Size | Use Case |
|------|---------|-----------|----------|
| **Trial** | 15 one-time | 1 | New user exploration |
| **Individual** | 100/month | 1 | Personal use |
| **Team** | 500/month | 5 | Small teams |
| **Custom 30** | 2,000/month | 30 | Organizations |

## Documentation

| Document | Purpose |
|----------|---------|
| [`CLAUDE.md`](./CLAUDE.md) | Development guidance for Claude Code |
| [`FEATURES.md`](./FEATURES.md) | Complete feature catalog with implementation details |
| [`TODO.md`](./TODO.md) | Active development tasks |
| [`STRATEGIC_ENHANCEMENTS.md`](./STRATEGIC_ENHANCEMENTS.md) | Future optimizations and enhancements |
| [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) | Frontend-specific guidance |
| [`backend/CLAUDE.md`](./backend/CLAUDE.md) | Backend-specific guidance |

## Repository Links

- **Main**: https://github.com/altbe/icraft-main
- **Frontend**: https://github.com/altbe/icraft-front-v8
- **Backend**: https://github.com/altgene/unico-api

---

*See [`FEATURES.md`](./FEATURES.md) for complete feature documentation.*
