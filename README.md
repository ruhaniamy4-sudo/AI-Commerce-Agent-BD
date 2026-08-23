# Edutechs AI Commerce Platform

Archive-first monorepo containing:

- `apps/agent`: Express, MongoDB, BullMQ, OpenAI/LangGraph, RAG, Facebook, commerce, and meetings.
- `apps/dashboard`: Next.js administration dashboard.
- `apps/storefront`: Next.js storefront. Product browsing is connected; checkout is intentionally disabled until a real checkout API contract is completed.
- `packages/shared`: TypeScript contracts shared by the applications.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker with Compose

## Setup

1. Copy each `.env.example` to its local environment filename. Never commit the resulting files.
2. Replace placeholder secrets. The dashboard requires `NEXTAUTH_SECRET`, `DASHBOARD_ADMIN_EMAIL`, and `DASHBOARD_ADMIN_PASSWORD`.
3. Install and start infrastructure:

```bash
npm ci
npm run infra:up
```

MongoDB runs as a single-node replica set because order and stock writes use transactions. Redis is used by the existing BullMQ worker.

## Run locally

Use separate terminals:

```bash
npm run dev:agent
npm run worker
npm run dev:dashboard
npm run dev:storefront
```

Default endpoints:

- Agent API: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- Dashboard: `http://localhost:3000`
- Storefront: `http://localhost:3001` when port 3000 is occupied

Redis uses `REDIS_HOST` and `REDIS_PORT`. Browser origins are configured with comma-separated `CORS_ORIGINS`.

## Verification

```bash
npm run typecheck
npm test -w apps/agent
npm run build
npm run smoke:baseline
```

The smoke test requires the agent, MongoDB replica set, and Redis infrastructure to be running. It creates isolated test records, verifies order retrieval, and checks that successful and failed orders handle stock correctly.

## Known deferred gaps

- Storefront checkout is visibly disabled; it no longer simulates order success.
- Dashboard pages for unanswered questions, error management, availability/hosts, and meeting mutations reference APIs that are not yet implemented in the Archive backend.
- Tenant/SaaS architecture, additional channels, and courier integrations are intentionally outside Milestone 1.
