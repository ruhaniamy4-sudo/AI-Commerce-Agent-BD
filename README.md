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
2. Replace placeholder secrets. `AUTH_JWT_SECRET` must contain at least 32 characters and bootstrap passwords must contain at least 12 characters.
3. Install and start infrastructure:

```bash
npm ci
npm run infra:up
npm run migrate:tenancy
```

The idempotent tenancy migration creates the default business, Owner user, membership, storefront channel, optional Facebook channel, backfills legacy records, removes global unique indexes, and creates tenant indexes. Run it before starting the applications and after restoring a pre-tenancy database.

MongoDB runs as a single-node replica set because order and stock writes use transactions. Redis is used by the existing BullMQ worker.

## Authentication and tenancy

- Dashboard credentials are validated by `POST /auth/login`; plaintext credentials are not stored in dashboard configuration.
- Access tokens are bound to one active `BusinessMember` and are revalidated on each request.
- Roles are `Owner`, `Admin`, and `Staff`. Owner manages members and the business; Owner/Admin manage catalog, knowledge, channels, and administrative mutations; Staff has authenticated read and operational access.
- Authenticated tenant APIs derive `businessId` from the access token. Client-supplied tenant identifiers are ignored or rejected.
- Public storefront catalog reads use `/public/:channelId`; the channel resolves the tenant without exposing authenticated administration APIs.
- Facebook page IDs resolve through `BusinessChannel`, and queued jobs carry their resolved `businessId`.

Tenant administration endpoints are available under `/auth/business`, `/auth/members`, and `/auth/channels`.

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

The smoke test requires the agent, MongoDB replica set, Redis infrastructure, and bootstrap owner environment variables. It authenticates first, creates isolated tenant records, verifies order retrieval, and checks that successful and failed orders handle stock correctly.

## Known deferred gaps

- Storefront checkout is visibly disabled; it no longer simulates order success.
- Dashboard pages for unanswered questions, error management, availability/hosts, and meeting mutations reference APIs that are not yet implemented in the Archive backend.
- Additional channel types and courier integrations remain deferred.
