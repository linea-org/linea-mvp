# Linea — Developer Guide

## Overview

Linea is a workflow automation platform. The monorepo structure:

```
linea/
├── apps/
│   ├── api/          # NestJS backend (port 3001)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   ├── db/           # Drizzle ORM schema + client
│   └── ui/           # Shared React component library
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

## Quick start (local)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment files

**`apps/api/.env`**
```env
DATABASE_URL=postgresql://linea:linea@localhost:5432/linea
REDIS_URL=redis://localhost:6379

# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Encryption key for stored secrets (32-char hex)
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# Optional
PORT=3001
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start infrastructure

```bash
pnpm dev:infra
# starts Postgres (5432) and Redis (6379) in Docker
```

### 4. Push the database schema

```bash
pnpm db:push
# runs drizzle-kit push against DATABASE_URL (no migration files — schema is pushed directly)
```

### 5. Start the application

```bash
pnpm dev
# runs api + web via Turborepo in parallel
```

Or start each service individually:

```bash
pnpm dev:api   # NestJS on :3001
pnpm dev:web   # Next.js on :3000
```

---

## Docker (full stack)

To run everything in containers:

```bash
docker compose up --watch
# starts postgres, redis, api, web with hot-reload
```

```bash
docker compose down        # stop and remove containers
docker compose logs -f     # follow all logs
```

---

## Database

```bash
pnpm db:push      # push schema changes (destructive — dev only)
pnpm db:generate  # generate migration files from schema diff
pnpm db:studio    # open Drizzle Studio at http://localhost:4983
```

Schema lives in `packages/db/src/schema/`. Key tables:

| Table | Scoped to |
|-------|-----------|
| `workspaces` | — |
| `workspace_members` | workspace |
| `pods` | workspace |
| `workflows` | pod |
| `executions` | pod (also keeps workspaceId for quota lookups) |
| `schedules` | pod |
| `webhooks` | pod |
| `api_keys`, `secrets` | workspace |

---

## Code quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## Architecture

### API request lifecycle

```
HTTP request
  → ClerkAuthGuard (global)  — validates JWT or lnk_ API key, sets req.auth
  → WorkspaceGuard           — verifies :workspaceId membership, sets req.workspace
  → PodGuard                 — verifies :podId belongs to workspace, sets req.pod
  → Controller → Service → Drizzle
```

### Execution engine

```
POST /pods/:podId/executions
  → ExecutionsService.create()
  → BullMQ queue (EXECUTION_QUEUE)
  → ExecutionProcessor (worker)
  → LangGraphService.run()
  → NodeExecutorService.execute() per node
  → results written to executions table
```

### Auth

- **Browser sessions**: Clerk JWT, passed as `Authorization: Bearer <token>`
- **Machine/API access**: `lnk_` prefixed API keys checked in `ClerkAuthGuard` before Clerk SDK

### Secrets / credentials

Stored encrypted with AES-256-GCM. The plaintext is never persisted. Use `ENCRYPTION_KEY` (64 hex chars = 32 bytes) in the API env.

### Webhook verification

Incoming webhooks are verified with HMAC-SHA256. The signature is passed in the `x-linea-signature` header as `sha256=<hex>`. Timing-safe comparison is used.

---

## Environment variables reference

### API (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret |
| `CLERK_WEBHOOK_SECRET` | Yes | Clerk webhook signing secret |
| `ENCRYPTION_KEY` | Yes | 64-char hex key for secret encryption |
| `PORT` | No | API port (default: 3001) |

### Web (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk public key |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret (SSR) |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL of the API |

### Docs (`apps/docs/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DOCS_PASSWORD` | Yes | HTTP Basic Auth password for all `/docs/*` routes. Without it, all docs routes return 401. |
| `GITHUB_OWNER` | No | GitHub org for the roadmap page (default: `linea-xyz`) |
| `GITHUB_REPO` | No | GitHub repo for the roadmap page (default: `linea`) |

---

## Common tasks

### Add a new workflow node type

1. Add the node definition to `apps/api/src/executions/engine/node-executor.service.ts`
2. Add it to the node type enum in `packages/db/src/schema/workflows.ts`
3. Handle it in `LangGraphService.buildGraph()`

### Add a new built-in tool

1. Add the tool definition to `apps/api/src/executions/engine/tools/definitions.ts`
2. Add the execution case in `apps/api/src/executions/engine/tools/tool-executor.ts`

### Add a new API endpoint

1. Create `apps/api/src/feature/feature.service.ts` and `feature.controller.ts`
2. Create `apps/api/src/feature/feature.module.ts`
3. Import the module in `apps/api/src/app.module.ts`
4. If pod-scoped: add `@UseGuards(WorkspaceGuard, PodGuard)` and import `PodsModule`

---

## Clerk setup

1. Create a Clerk application at clerk.com
2. Enable Organizations in the Clerk dashboard
3. Add a webhook endpoint pointing to `<your-api-url>/auth/webhooks/clerk` with events:
   - `organization.created`
   - `organizationMembership.created`
   - `organizationMembership.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`
