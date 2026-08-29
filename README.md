# SellPilot

SellPilot is a multi-tenant AI commerce platform with an Express agent API, merchant dashboard, public storefront, MongoDB persistence, and BullMQ background processing.

## Quick start (recommended)

Docker is not required. The normal development workflow uses MongoDB Atlas, Groq, and local Node applications.

1. Create a MongoDB Atlas free/development deployment where available. It must support transactions; keep retryable writes enabled.
2. Copy its `mongodb+srv://...` connection string.
3. Create a Groq API key (subject to Groq's current limits).
4. Optionally create a managed Redis/Redis Cloud/Upstash-compatible Redis database for background features.
5. Run:

```bash
git clone <repository-url>
cd AI-Commerce-Agent-BD-main
npm install
npm run setup:env
```

6. Edit `apps/agent/.env`:

```dotenv
MONGODB_URI=mongodb+srv://...
AI_PROVIDER=groq
GROQ_API_KEY=...
```

7. Keep or change the locally generated `BOOTSTRAP_OWNER_EMAIL`, then run:

```bash
npm run migrate
npm run dev
```

Open the dashboard at `http://localhost:3000`, sign up or sign in, complete onboarding, and open **Test AI**. The API is at `http://localhost:4000`; the storefront is at `http://localhost:3001`.

## Core and full modes

`npm run dev` starts the Agent API, Dashboard, and Storefront in one labelled terminal. It does not require Redis. Signup, login, onboarding, dashboard data, synchronous commerce CRUD, knowledge, authenticated chat, public web chat, and Test AI remain available.

`npm run dev:full` also starts the BullMQ worker and requires Redis. Set a managed TLS URL when required:

```dotenv
REDIS_URL=rediss://username:password@host:port
```

`REDIS_URL` has priority. Legacy `REDIS_HOST`/`REDIS_PORT` settings remain supported. Redis stores queues and background-job state; MongoDB remains the persistent business database. Facebook processing, queued retries, worker processing, and courier background sync require Redis. Missing Redis never silently drops a job: queue-dependent requests return an explicit unavailable error.

## Useful commands

```bash
npm run setup:env       # create/preserve local env files and generate internal secrets
npm run migrate         # idempotent tenancy migration and local owner bootstrap
npm run migrate:text-indexes # repair legacy language-sensitive MongoDB text indexes
npm run dev             # API + dashboard + storefront
npm run dev:full        # core apps + worker; Redis required
npm run health:check    # inspect the running API safely
npm test
npm run typecheck
npm run build
```

## Optional Docker fallback

Docker Compose is retained only for developers who explicitly want local MongoDB and Redis:

```bash
npm run infra:up
npm run infra:down
```

If running Node on the host, use `localhost` in local service URLs. The Compose hostname `mongo` works only between Compose containers. The local Mongo container is a replica set because order and stock writes preserve transaction safety.

## Architecture and security

The simpler setup does not remove BullMQ, worker separation, queue retries, transaction boundaries, tenant isolation, RAG/memory, AI safeguards, idempotency, courier architecture, or platform-admin separation. OAuth, Facebook, Cloudinary, Steadfast, email, and other external providers are optional at core startup and fail only when their feature is used.

Local `.env` and `.env.*` files are ignored by Git; safe `.env.example` templates remain tracked. Never expose provider keys in browser-prefixed variables. Health output reports only configuration presence, never values.

See [docs/local-development.md](docs/local-development.md) for full environment details and practical troubleshooting.
