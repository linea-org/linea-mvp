# Contributing to Linea

See **[DEVELOPERS.md](DEVELOPERS.md)** for the full guide — setup, architecture, git workflow, and Linear issue tracking.

## Quick links

- [Linear board](https://linear.app/linea-labs/team/LIN/active) — all issues live here, not GitHub
- [Dev setup](#) → `DEVELOPERS.md` → Quick start
- [Git workflow](#) → `DEVELOPERS.md` → Git workflow (branch naming, commit style, PR convention)

---

<!-- The content below is kept for GitHub's CONTRIBUTING.md auto-display. Full guide is in DEVELOPERS.md. -->

## Prerequisites

- **Node.js** 20+
- **pnpm** 9 — `npm install -g pnpm@9`
- **Docker** (for Postgres + Redis)
- A [Clerk](https://clerk.com) account (free tier works)

---

## First-time setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/linea.git
cd linea
pnpm install
```

### 2. Start infrastructure

```bash
pnpm infra:up
```

This starts Postgres 16 (with pgvector) on port `5432` and Redis 7 on port `6379` via Docker Compose. Data persists in a named volume across restarts.

### 3. Configure environment variables

Copy the example files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

**`apps/api/.env`** — fill in the required values:

| Variable | Where to get it |
|----------|----------------|
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | Clerk dashboard → Webhooks → your endpoint → Signing Secret |
| `ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — must be exactly 64 hex chars |
| `ANTHROPIC_API_KEY` | Optional — needed to run agent nodes with Claude |

`DATABASE_URL` and `REDIS_URL` point at the Docker containers by default — no changes needed locally.

**`apps/web/.env.local`** — fill in Clerk keys:

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |

### 4. Push the database schema

```bash
pnpm db:push
```

This runs `drizzle-kit push` against your local Postgres, creating all tables. Re-run this any time you change a schema file in `packages/db/src/schema/`.

### 5. Start the dev servers

```bash
pnpm dev
```

Starts both apps in parallel via Turborepo:

| App | URL |
|-----|-----|
| API (NestJS) | http://localhost:3001 |
| Web (Next.js) | http://localhost:3000 |
| API health check | http://localhost:3001/health |

---

## Project structure

```
linea/
├── apps/
│   ├── api/          # NestJS backend
│   │   └── src/
│   │       ├── auth/           # Clerk JWT guard + webhook sync
│   │       ├── executions/     # Workflow execution engine (LangGraph)
│   │       ├── workflows/      # Workflow CRUD
│   │       ├── workspaces/     # Multi-tenant workspace management
│   │       └── users/          # User management
│   └── web/          # Next.js frontend
└── packages/
    ├── db/           # Drizzle schema, client, migrations
    ├── ui/           # Shared React component library (shadcn)
    └── types/        # Shared TypeScript types
```

---

## Common commands

```bash
# Development
pnpm dev                  # start API + web
pnpm build                # production build of all apps

# Database
pnpm db:push              # sync schema changes to local DB (no migration file)
pnpm db:generate          # generate a migration SQL file from schema diff
pnpm db:studio            # open Drizzle Studio at http://localhost:4983
pnpm infra:up             # start Docker services
pnpm infra:down           # stop Docker services
pnpm infra:reset          # wipe volumes and restart fresh

# Code quality
pnpm typecheck            # tsc --noEmit across all packages
pnpm lint                 # eslint across all packages
pnpm format               # prettier across all packages
```

---

## Making schema changes

1. Edit the relevant file in `packages/db/src/schema/`
2. Run `pnpm db:push` to apply the change to your local DB
3. When your PR is ready for review, run `pnpm db:generate` to produce a migration file and commit it alongside the schema change

> **Never** use `db:push` against a staging or production database — use `db:migrate` with the generated migration file instead.

---

## Adding a new API endpoint

1. Find the relevant module in `apps/api/src/` (or create a new one)
2. Add the route to the controller, service method, and DTO
3. All routes under `/workspaces/:workspaceId/` are automatically protected by `WorkspaceGuard` — always pass `workspaceId` through to service queries
4. Run `pnpm typecheck` to verify before committing

## Adding a new node type

1. Add the executor in `apps/api/src/executions/engine/executors/`
2. Register it in the `dispatch()` switch in `node-executor.service.ts`
3. Add a timeout entry in `DEFAULT_TIMEOUTS` if the node makes external calls

---

## Environment variables reference

### `apps/api`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | |
| `PORT` | No | `3001` | API port |
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis for BullMQ |
| `CLERK_SECRET_KEY` | Yes | — | Server-side Clerk key |
| `CLERK_PUBLISHABLE_KEY` | Yes | — | Public Clerk key |
| `CLERK_WEBHOOK_SECRET` | Yes | — | Clerk webhook signing secret |
| `ENCRYPTION_KEY` | Yes | — | 64 hex chars (32 bytes) for AES-256-GCM |
| `ANTHROPIC_API_KEY` | No | — | Global fallback if workspace has no key |
| `OPENAI_API_KEY` | No | — | Global fallback |
| `GROQ_API_KEY` | No | — | Global fallback |
| `GOOGLE_API_KEY` | No | — | Global fallback |
| `DEFAULT_AGENT_MODEL` | No | `claude-sonnet-4-6` | |
| `SUPERVISOR_MODEL` | No | `claude-haiku-4-5` | |

### `apps/web`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | URL of the API (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Public Clerk key |
| `CLERK_SECRET_KEY` | Yes | Server-side Clerk key |

---

## Pull request guidelines

- Keep PRs focused — one concern per PR
- Run `pnpm typecheck` and `pnpm lint` before opening
- Schema changes must include a generated migration file (`pnpm db:generate`)
- Do not commit `.env` or `.env.local` files — they are gitignored by design
