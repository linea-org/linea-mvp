# Linea

**Workflow automation platform for AI agent pipelines.** Build, deploy, and run multi-step automations with memory, scheduling, integrations, and real-time execution streaming.

## Features

- **Visual workflow builder** — drag-and-drop canvas with 20+ node types
- **AI agent nodes** — multi-provider LLM support (Anthropic, OpenAI, Groq, Google)
- **Memory system** — cross-execution fact storage with semantic search
- **Knowledge bases** — workspace document stores with vector similarity search
- **MCP tools** — attach Model Context Protocol servers to any agent node
- **Schedules & webhooks** — cron triggers and inbound HTTP hooks
- **Built-in integrations** — Slack, GitHub, Notion, Gmail
- **Human-in-the-loop** — approval gates and ask-human nodes
- **TypeScript SDK** — trigger workflows and stream events programmatically
- **RBAC** — owner / admin / editor / viewer roles per workspace

## Quick Start

### Prerequisites

- Node.js 22+, pnpm 9+
- PostgreSQL with the `pgvector` extension
- Redis

### Setup

```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp .env.example .env

# Push database schema
pnpm db:push

# Start everything
pnpm dev
```

The API runs on `http://localhost:3001` and the web app on `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env` and set at minimum:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CLERK_SECRET_KEY` | From the Clerk dashboard |
| `CLERK_PUBLISHABLE_KEY` | From the Clerk dashboard |
| `CLERK_WEBHOOK_SECRET` | From Clerk → Webhooks |
| `ENCRYPTION_KEY` | 32-byte hex string (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | At least one AI provider key is required |

## Documentation

Full documentation is at [docs.getlinea.ai](https://docs.getlinea.ai) — node reference, API reference, SDK guide, and integration guides.

## Tech Stack

Next.js 15 · NestJS 11 · PostgreSQL + pgvector · BullMQ · Clerk · Turborepo

## License

MIT
