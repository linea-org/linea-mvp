# API Modules Index

Global prefix: `/v1` (except `/health`, `/webhooks/clerk`, `/docs`).  
All routes require Clerk bearer auth unless marked **public**.

| Module | Base Path | Description |
|--------|-----------|-------------|
| [agent-chat](agent-chat/MODULE.md) | `/v1/workspaces/:wId/agent` | Streaming AI agent chat sessions |
| [api-keys](api-keys/MODULE.md) | `/v1/workspaces/:wId/api-keys` | Linea API key management (create, revoke, rotate) |
| [audit](audit/MODULE.md) | `/v1/workspaces/:wId/audit-logs` | Immutable audit log of workspace actions |
| [auth](auth/MODULE.md) | `/v1/webhooks/clerk` | Clerk webhook handler — syncs users on sign-up/update |
| [billing](billing/MODULE.md) | `/v1/workspaces/:wId/billing` | Subscription and payment management |
| [comments](comments/MODULE.md) | `/v1/workspaces/:wId/pods/:pId/workflows/:wfId/comments` | Threaded comments on workflows |
| [executions](executions/MODULE.md) | `/v1/workspaces/:wId/pods/:pId/executions` | Workflow execution lifecycle, SSE streaming, approvals |
| [health](health/MODULE.md) | `/health` | Liveness and readiness probes (public) |
| [knowledge](knowledge/MODULE.md) | `/v1/workspaces/:wId/knowledge-bases` | RAG knowledge bases — ingestion, hybrid search, per-KB settings |
| [mcp](mcp/MODULE.md) | `/v1/workspaces/:wId/mcp-servers` | Model Context Protocol server registry |
| [memory](memory/MODULE.md) | `/v1/workspaces/:wId/memories` | Agent memory — extraction, vector search, profiles |
| [metrics](metrics/MODULE.md) | `/v1/workspaces/:wId/metrics` | Execution metrics and performance analytics |
| [models](models/MODULE.md) | `/v1/models` | Available AI model registry |
| [notifications](notifications/MODULE.md) | `/v1/workspaces/:wId/notifications` | In-app user notifications |
| [oauth](oauth/MODULE.md) | `/v1/workspaces/:wId/oauth` | OAuth provider connections (Google, etc.) |
| [pods](pods/MODULE.md) | `/v1/workspaces/:wId/pods` | Execution environment (pod) management |
| [public-run](public-run/MODULE.md) | `/v1/run` | Unauthenticated workflow execution (public APIs) |
| [quotas](quotas/MODULE.md) | — | Internal quota enforcement (no HTTP routes) |
| [schedules](schedules/MODULE.md) | `/v1/workspaces/:wId/pods/:pId/schedules` | Cron-based workflow scheduling |
| [secrets](secrets/MODULE.md) | `/v1/workspaces/:wId/secrets` | Encrypted workspace secrets (API keys, tokens) |
| [uploads](uploads/MODULE.md) | `/v1/workspaces/:wId/uploads` | Presigned URL file upload |
| [users](users/MODULE.md) | `/v1/users` | User profile management |
| [webhooks](webhooks/MODULE.md) | `/v1/workspaces/:wId/pods/:pId/webhooks` | Inbound webhook triggers for workflows |
| [workflows](workflows/MODULE.md) | `/v1/workspaces/:wId/pods/:pId/workflows` | Workflow CRUD, versions, templates, AI generation, evals |
| [workspaces](workspaces/MODULE.md) | `/v1/workspaces` | Workspace CRUD, members, invites, settings |

_Load an individual `MODULE.md` for full endpoint details, changelog, and status._
