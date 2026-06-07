# Linea

**AI workflow orchestration platform.** Build, deploy, and run multi-node AI pipelines — combining LLM agents, tool calls, knowledge retrieval, human-in-the-loop approvals, and integrations — without writing infrastructure code.

---

## What it does

Linea gives teams a visual workflow builder and a reliable execution engine. Compose nodes on a canvas, run them via the UI or SDK, and stream results in real time.

**Nodes (24 types)**

| Category | Nodes |
|----------|-------|
| AI | Agent, Evaluator, Guardrails |
| Data | Transform, Extract, Logic, Loop, Router |
| Memory | Memory read/write, Retriever (hybrid vector + BM25) |
| Integrations | Slack, GitHub, Notion, Gmail, HTTP, Code |
| Control | Approval, Ask Human, Subworkflow, Note |
| Infrastructure | MCP tool call, Schedule trigger, Webhook trigger |

**Platform**

- **Visual builder** — drag-and-drop canvas with live execution trace
- **Multi-provider AI** — Anthropic, OpenAI, Groq, Google, Ollama (local)
- **Knowledge bases** — pgvector + BM25 hybrid search with RRF fusion
- **Memory** — cross-execution semantic storage per thread/session
- **Schedules & webhooks** — cron triggers and inbound HTTP hooks
- **TypeScript SDK** — trigger, stream, and manage workflows programmatically
- **RBAC** — owner / admin / editor / viewer roles per workspace
- **Audit logs** — workspace-level event trail

---

## Quick start

**Prerequisites:** Node.js 20+, pnpm 9+, Docker

```bash
# 1. Install
pnpm install

# 2. Start Postgres (pgvector) + Redis
pnpm infra:up

# 3. Configure environment
cp .env.example .env
# Fill in CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET,
# ENCRYPTION_KEY, and at least one LLM provider key (ANTHROPIC_API_KEY etc.)

# 4. Push database schema
pnpm db:push

# 5. Start
pnpm dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |

**Minimum required env vars**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (must have pgvector) |
| `REDIS_URL` | Redis connection string |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | Clerk dashboard → Webhooks → Signing Secret |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` — 64 hex chars |
| `ANTHROPIC_API_KEY` | At least one LLM provider key required |

Full env var reference: [`DEVELOPERS.md`](DEVELOPERS.md#environment-variables-reference)

---

## SDK

```ts
import { LineaClient } from '@linea/sdk'

const client = new LineaClient({ apiKey: 'lnk_...' })

// Trigger and stream
const { executionId } = await client.trigger(workspaceId, podId, workflowId, {
  input: { message: 'Summarise last week\'s PRs' }
})

for await (const event of client.streamEvents(workspaceId, podId, executionId)) {
  console.log(event.type, event.data)
}
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React Flow, shadcn/ui |
| Backend | NestJS 11, LangGraph.js, BullMQ |
| Database | PostgreSQL 16 + pgvector, Drizzle ORM |
| Queue | BullMQ + Redis |
| Auth | Clerk (JWT + `lnk_` API keys) |
| Monorepo | pnpm + Turborepo |

---

## Contributing

See [DEVELOPERS.md](DEVELOPERS.md) for setup, architecture, and the full dev workflow.

Issues are tracked in [Linear](https://linear.app/linea-labs/team/LIN/active) — please don't open GitHub issues.

---

## Documentation

[docs.getlinea.ai](https://docs.getlinea.ai) — node reference, API reference, SDK guide, integration guides.

---

## License

Proprietary. All rights reserved. This software is not open source.
