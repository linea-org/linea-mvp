# Linea — Developer Guide

## Overview

Linea is a workflow automation platform. The monorepo structure:

```
linea/
├── apps/
│   ├── api/          # NestJS backend (port 3001)
│   ├── web/          # Next.js frontend (port 3000)
│   └── docs/         # Documentation site (port 3002)
├── packages/
│   ├── db/           # Drizzle ORM schema, migrations, client
│   └── ui/           # Shared React component library
├── docker-compose.yml
├── .env.example      # Root env template (copy to .env)
└── DEVELOPERS.md     # This file
```

**Key concepts:**
- **Workspace** — top-level org/team boundary (tied to a Clerk organization)
- **Pod** — logical grouping within a workspace; workflows, executions, schedules, and webhooks all live inside a pod
- **Workflow** — a directed graph of nodes executed by the LangGraph engine via BullMQ

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Docker + Docker Compose | v2 |

---

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Fill in keys — see Environment variables reference below.
# Minimum required: DATABASE_URL, REDIS_URL, CLERK_SECRET_KEY,
# CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET, ENCRYPTION_KEY,
# and at least one LLM provider key.
```

Also copy the frontend env:
```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.
```

### 3. Start infrastructure

```bash
pnpm infra:up
# Starts Postgres (5432) and Redis (6379) via Docker Compose.
```

### 4. Run database migrations

```bash
pnpm db:migrate
# Applies all pending migrations from packages/db/migrations/ to the database.
# Run this once on a fresh DB and again after pulling new migrations.
```

### 5. Start the application

```bash
pnpm dev
# Runs api + web in parallel via Turborepo.
```

Or start each service individually:

```bash
pnpm dev:api    # NestJS on :3001
pnpm dev:web    # Next.js on :3000
pnpm dev:docs   # Docs site on :3002
```

---

## Available scripts

| Script | What it does |
|--------|-------------|
| `pnpm dev` | Start API + web in parallel (excludes docs) |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint across the monorepo |
| `pnpm typecheck` | Run tsc --noEmit across all packages |
| `pnpm test` | Run all test suites |
| `pnpm format` | Run Prettier |
| `pnpm infra:up` | `docker compose up -d` (postgres + redis) |
| `pnpm infra:down` | `docker compose down` |
| `pnpm infra:logs` | `docker compose logs -f` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:generate` | Generate new migration from schema diff |
| `pnpm db:push` | Directly push schema to DB — **dev scratch only, see below** |
| `pnpm db:studio` | Open Drizzle Studio at http://localhost:4983 |

---

## Database

### Migration-based workflow (the standard approach)

Migrations live in `packages/db/migrations/`. Every schema change goes through this flow:

```bash
# 1. Edit the TypeScript schema in packages/db/src/schema/
# 2. Generate a migration file
pnpm db:generate

# 3. Review the generated SQL in packages/db/migrations/
# 4. Apply it
pnpm db:migrate
```

`pnpm db:migrate` uses `drizzle-kit migrate` which tracks applied migrations in the `drizzle.__drizzle_migrations` table. It is safe to run multiple times — already-applied migrations are skipped.

### When to use `db:push`

`db:push` bypasses the migration journal and pushes the TypeScript schema directly to the database. It is useful when:
- Rapidly iterating on a **personal scratch database** where history doesn't matter
- Prototyping a schema change before committing it to a migration

**Never use `db:push` against a shared, staging, or production database.** It can silently drop columns or data that isn't in the schema.

### Schema location

`packages/db/src/schema/` — one file per domain (e.g. `workflows.ts`, `knowledge.ts`). After editing, run `db:generate` and commit both the schema change and the generated migration in the same PR.

### Key tables

| Table | Scoped to |
|-------|-----------|
| `workspaces` | — |
| `workspace_members` | workspace |
| `pods` | workspace |
| `workflows` | pod |
| `workflow_versions` | workflow |
| `executions` | pod (also keeps `workspaceId` for quota lookups) |
| `schedules`, `webhooks` | pod |
| `knowledge_bases`, `knowledge_entries` | workspace |
| `memories` | workspace |
| `api_keys`, `secrets` | workspace |
| `oauth_connections` | workspace |
| `agent_chat_sessions` | workspace |

---

## Git workflow

### Branch naming

One branch per issue or feature. Branch off `main`:

```bash
git checkout main && git pull
git checkout -b feat/short-description   # new feature
git checkout -b fix/short-description    # bug fix
git checkout -b chore/short-description  # infra / tooling
```

### Commit style

Follow Conventional Commits. Keep scope tight and message imperative:

```
feat(knowledge): add bulk entry ingestion endpoint
fix(executions): correct SSE dedup on reconnect
chore(db): add 0003 migration for oauth_connections table
docs(webhooks): update MODULE.md with delivery history gap
```

- One logical change per commit
- No `Co-authored-by` or AI attribution lines in commits

### Pull requests

Open a PR to `main` before moving on to the next issue. Never bulk-commit multiple unrelated features directly to `main`.

**PR checklist:**
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] If a module was changed, its `MODULE.md` is updated in the same PR
- [ ] If the schema changed, a migration was generated and committed alongside the schema

---

## Module documentation

Every API module has a co-located `MODULE.md` at `apps/api/src/{module}/MODULE.md`. The master index is at `apps/api/src/MODULES.md`.

**Rule: when you change a module, update its `MODULE.md` in the same commit.**

Specifically:
- Add a `Changelog` entry for the change
- Update the `Endpoints` table if routes were added, removed, or their shape changed
- Update `Status` if the module is now WIP or newly stable
- Update `Missing / Gaps` if you closed a gap or discovered a new one

Feed a module's `MODULE.md` to an LLM as context before working on that module. Feed `MODULES.md` for a bird's-eye view of the entire API surface.

---

## Architecture

### Request lifecycle

```
HTTP request
  → ClerkAuthGuard (global)  — validates Clerk JWT or lnk_ API key; sets req.auth
  → WorkspaceGuard           — verifies :workspaceId membership; sets req.workspace
  → PodGuard                 — verifies :podId belongs to workspace; sets req.pod
  → Controller → Service → Drizzle
```

### Execution engine

```
POST /pods/:podId/executions
  → ExecutionsService.create()        enqueues job
  → BullMQ EXECUTION_QUEUE
  → ExecutionProcessor (worker)
  → LangGraphService.run()
  → NodeExecutorService.execute()     per node
  → ExecutionEventsService.publish()  Redis pub/sub
  → GET /:id/events (SSE)             streams to client
```

### RAG pipeline

```
POST /knowledge-bases/:id/entries
  → split into sentence-aware chunks
  → SHA-256 dedup check
  → insert with status='pending'
  → BullMQ rag:embed queue
  → KnowledgeEmbedProcessor
      → OpenAI text-embedding-3-small (1536-dim)
      → pgvector HNSW upsert
      → status → 'indexed'

POST /knowledge-bases/:id/search
  → parallel: pgvector HNSW cosine arm + GIN BM25 arm
  → RRF merge (vector 0.7, BM25 0.3)
  → optional: context expansion (fetch X-1, X, X+1 chunks)
  → optional: Cohere Rerank v3.5
```

### Auth

- **Browser sessions**: Clerk JWT passed as `Authorization: Bearer <token>`
- **Machine / API access**: `lnk_` prefixed API keys; checked in `ClerkAuthGuard` before Clerk SDK
- **Public-run endpoint**: Linea API keys only — no Clerk JWT accepted

### Secrets / encryption

Stored encrypted with AES-256-GCM. IV is randomized per encryption. The plaintext is **never** persisted or returned after creation. `ENCRYPTION_KEY` must be 64 hex characters (32 bytes). Generate with:

```bash
openssl rand -hex 32
```

### Webhook signature verification

Inbound webhook triggers validate an HMAC-SHA256 signature in `X-Linea-Signature: sha256=<hex>`. Timing-safe comparison (`crypto.timingSafeEqual`) is used. Requests without a valid signature return 401 before any processing.

---

## Adding things

### New API module

1. Create `apps/api/src/feature/feature.service.ts` and `feature.controller.ts`
2. Create `apps/api/src/feature/feature.module.ts`
3. Import the module in `apps/api/src/app.module.ts`
4. If workspace-scoped: add `@UseGuards(WorkspaceGuard)` and import `WorkspacesModule`
5. If pod-scoped: also add `PodGuard` and import `PodsModule`
6. Create `apps/api/src/feature/MODULE.md` using the template below
7. Add the module to `apps/api/src/MODULES.md`

### New schema table

1. Add the Drizzle table definition in `packages/db/src/schema/`
2. Export it from `packages/db/src/schema/index.ts`
3. Run `pnpm db:generate` and review the generated SQL
4. Commit the schema file and the migration together

### New workflow node type

1. Add the node definition to `apps/api/src/executions/engine/node-executor.service.ts`
2. Add it to the node type enum in `packages/db/src/schema/workflows.ts` (then generate a migration)
3. Handle it in `LangGraphService.buildGraph()`

### New built-in tool

1. Add the tool definition to `apps/api/src/executions/engine/tools/definitions.ts`
2. Add the execution case in `apps/api/src/executions/engine/tools/tool-executor.ts`

---

## MODULE.md template

Use this when creating a new module's documentation:

```markdown
# {Module Name}

> One-sentence description of what this module owns.

## Base Path
`/v1/{prefix}`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET    | /    | viewer+ | List all … Returns `[{ id, name }]`. |
| POST   | /    | editor+ | Create a … Body: `{ name, config? }`. Returns created resource. |

_Role key: public · viewer+ · editor+ · admin+ · owner_

## Key Types

- `CreateXDto` — `{ field: type }`

## Business Logic

- Non-obvious invariants only

## Dependencies

- `WorkspacesModule` — workspace guard

## Missing / Gaps

- Gaps, absent endpoints, or known design limitations

## Changelog

### YYYY-MM-DD — Title
- What changed and why

## Status

Stable.
```

---

## Environment variables reference

The root `.env.example` is the canonical list. Copy it to `.env` in the repo root; `packages/db/drizzle.config.ts` and `apps/api` both load from there.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (must have pgvector installed) |
| `REDIS_URL` | Redis connection string (used by BullMQ and SSE pub/sub) |
| `CLERK_SECRET_KEY` | Clerk backend secret — from Clerk dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret — from Clerk dashboard → Webhooks |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes) for AES-256-GCM secret encryption. Generate: `openssl rand -hex 32` |
| At least one of: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_API_KEY` | LLM provider key — required for any agent node to run |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_AGENT_MODEL` | `claude-sonnet-4-6` | Default model when a node doesn't specify one |
| `SUPERVISOR_MODEL` | `claude-haiku-4-5` | Model for execution supervisor (retry/abort decisions) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `PORT` | `3001` | API port |
| `NODE_ENV` | `development` | `development` or `production` |
| `XAI_API_KEY` | — | xAI (Grok) provider key |
| `POLAR_ACCESS_TOKEN` | — | Polar.sh billing — leave unset to disable billing features |
| `POLAR_WEBHOOK_SECRET` | — | Polar.sh webhook signing secret |
| `POLAR_PRICE_ID_PRO` | — | Polar product price ID for the Pro plan |
| `POLAR_PRICE_ID_TEAM` | — | Polar product price ID for the Team plan |
| `FRONTEND_URL` | `http://localhost:3000` | Used in Polar checkout success URL |
| `R2_ACCOUNT_ID` | — | Cloudflare R2 account — leave unset to disable file uploads |
| `R2_ACCESS_KEY_ID` | — | R2 access key |
| `R2_SECRET_ACCESS_KEY` | — | R2 secret key |
| `R2_BUCKET` | `linea-uploads` | R2 bucket name |
| `R2_PUBLIC_URL` | — | Public URL for serving uploaded files |

### Web (`apps/web/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Base URL of the API (default: `http://localhost:3001`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk backend secret (used in SSR) |
| `NEXT_PUBLIC_BILLING_ENABLED` | Set `true` to show billing UI (default: `false`) |

### Docs (`apps/docs/.env.local`)

| Variable | Description |
|----------|-------------|
| `DOCS_PASSWORD` | HTTP Basic Auth password — all `/docs/*` routes return 401 without it |

---

## Clerk setup

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Enable Organizations in the Clerk dashboard
3. Add a webhook endpoint pointing to `<your-api-url>/webhooks/clerk` with events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET` in `.env`

---

## Code quality

```bash
pnpm typecheck   # must pass before opening a PR
pnpm lint        # must pass before opening a PR
pnpm test        # run all test suites
pnpm build       # verify production build
```
