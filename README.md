# iCraftStories - Monorepo

Full-stack AI-powered illustrated story creation platform with team collaboration, offline-first PWA architecture, and multi-language support.

## Architecture

This repository uses Git submodules to manage two separate applications:

- **Frontend**: `frontend/` - React PWA with TypeScript, Konva canvas, IndexedDB sync
- **Backend**: `backend/` - Zuplo API Gateway (BFF architecture) with Supabase + Stripe integration

## Quick Start

```bash
# Clone with submodules
git clone --recursive https://github.com/altbe/icraft-main.git
cd icraft-main

# Or if already cloned
git submodule init
git submodule update

# Development
cd frontend && npm run dev    # Frontend on port 3000
cd backend && npm run dev     # Backend development server
```

## Submodule Management

```bash
# Update submodules to latest
git submodule update --remote

# Pull latest changes for all submodules
git submodule foreach git pull origin main

# Update to specific commit
cd frontend
git checkout <commit-hash>
cd ..
git add frontend
git commit -m "Update frontend to v1.2.3"
```

## Development Workflow

1. Work on features in individual repositories (`frontend/`, `backend/`)
2. Test integration points between services
3. Update main repository with specific submodule versions for releases
4. Tag releases in main repository for deployment coordination

## Deployment

- **Frontend**: Cloudflare Workers (via `frontend/` repository CI/CD)
- **Backend**: Zuplo GitOps (via `backend/` repository CI/CD)
- **Orchestration**: Use tags in this repository to coordinate releases

## Repository Links

- Frontend: https://github.com/altbe/icraft-front-v8
- Backend: https://github.com/altgene/unico-api