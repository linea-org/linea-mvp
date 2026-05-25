# Executions Module

> Manages the full lifecycle of workflow executions — queuing, running, streaming live events, handling approvals, and replaying from a checkpoint.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/executions`

Also exposes a node test endpoint:  
`/v1/workspaces/:workspaceId/pods/:podId/nodes/test`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Trigger a new execution (rate-limited: 60/min) |
| GET | `/` | viewer+ | List executions with filters (status, workflowId, pagination) |
| GET | `/:id` | viewer+ | Get a single execution with output and error |
| GET | `/:id/logs` | viewer+ | Get structured execution logs |
| SSE | `/:id/events` | viewer+ | Stream live execution events (skips throttle); supports `Last-Event-Id` reconnect |
| PATCH | `/:id/respond` | editor+ | Respond to a suspended execution (human-in-the-loop input) |
| PATCH | `/:id/approve` | editor+ | Approve a suspended execution (alias for respond) |
| POST | `/:id/replay` | editor+ | Re-run an execution, optionally from a specific node |
| DELETE | `/:id` | editor+ | Cancel a running execution |
| POST | `/nodes/test` | editor+ | Execute a single node in isolation (dev/debug tool) |

## Key Types

- `CreateExecutionDto` — `{ workflowId, input?, triggeredBy? }`
- `ListExecutionsDto` — `{ status?, workflowId?, cursor?, limit? }`
- `ApproveExecutionDto` — `{ approved: boolean, input? }`
- `ReplayExecutionDto` — `{ fromNodeId?: string }`
- `ExecutionStatus` — `queued | running | suspended | completed | failed | cancelled`

## Business Logic

- **BullMQ queue**: `POST /` enqueues the execution; `ExecutionProcessor` picks it up and runs it via `LangGraphService`
- **SSE event stream**: subscribes to `ExecutionEventsService` (Redis pub/sub) and streams typed events (`node_started`, `node_completed`, `execution_complete`, etc.)
- **Replay buffer dedup**: SSE stream subscribes to live events *before* fetching Redis replay, then deduplicates by `streamId` to prevent gaps or duplicates on reconnect
- **Terminal fast-path**: if execution is already `completed` or `failed` at subscribe time, the final event is returned immediately as a one-shot observable
- **SSE timeout**: live stream auto-closes after 10 minutes (`takeUntil(timer(10 * 60 * 1000))`)
- **Suspend/resume**: execution engine parks state in LangGraph checkpoint when a node suspends; `PATCH /:id/respond` resumes from that checkpoint
- **Checkpoint cleanup**: daily BullMQ job (`CheckpointCleanupProcessor`) purges stale LangGraph checkpoints

## Dependencies

- `WorkspacesModule` — workspace guard
- `PodsModule` — pod guard
- `NotificationsModule` — pushes notifications on completion/failure
- `QuotasModule` — enforces per-workspace execution quotas
- `BullMQ execution queue` — async job processing
- `Redis` — execution event pub/sub + LangGraph checkpoint storage

## Changelog

### 2026-05-25 — RAG retriever hybrid search
- `NodeExecutorService` retriever node now runs parallel vector + BM25 arms with RRF merge
- Supports `expandContext` (neighbor chunks) and `enableRerank` (Cohere) from KB settings

## Status

Stable.
