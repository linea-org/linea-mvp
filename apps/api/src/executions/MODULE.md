# Executions Module

> Manages the full lifecycle of workflow executions — queuing, running, streaming live events, handling approvals, and replaying from a checkpoint.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/executions`

Also exposes a node test endpoint:  
`/v1/workspaces/:workspaceId/pods/:podId/nodes/test`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Trigger a new execution (rate-limited: 60/min). Body: `{ workflowId, input?, triggeredBy? }`. Returns created execution with `status: queued`. |
| GET | `/` | viewer+ | List executions. Query: `{ status?, workflowId?, cursor?, limit? }`. Returns paginated array with status and timing. |
| GET | `/:id` | viewer+ | Get a single execution. Returns execution with `output`, `error`, and node trace. |
| GET | `/:id/logs` | viewer+ | Get structured execution logs. Returns array of `{ level, nodeId, message, timestamp }`. |
| SSE | `/:id/events` | viewer+ | Stream live execution events via SSE. Supports `Last-Event-Id` reconnect; replays buffered events on reconnect. Auto-closes after 10 min. |
| PATCH | `/:id/respond` | editor+ | Resume a suspended execution. Body: `{ approved: boolean, input? }`. Returns updated execution. |
| PATCH | `/:id/approve` | editor+ | Alias for `/respond`. Body: `{ approved: boolean, input? }`. Returns updated execution. |
| POST | `/:id/replay` | editor+ | Re-run from scratch or a specific node. Body: `{ fromNodeId? }`. Returns new execution with `status: queued`. |
| DELETE | `/:id` | editor+ | Cancel a running execution. Sets `status: cancelled`. Returns 204. |
| POST | `/nodes/test` | editor+ | Execute a single node in isolation for debugging. Body: `{ nodeType, config, input? }`. Returns node output or error. |

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

### 2026-05-28 — SSE wire format clarification
- **NestJS serialises the full `MessageEvent` object as the SSE `data:` field**, not just `MessageEvent.data`. Wire format: `data: {"data":{...event...},"id":"streamId"}`. Clients must unwrap `parsed.data` to get the actual event payload. Fixed in the workflow builder's chat preview panel and canvas SSE client.

### 2026-05-25 — RAG retriever hybrid search
- `NodeExecutorService` retriever node now runs parallel vector + BM25 arms with RRF merge
- Supports `expandContext` (neighbor chunks) and `enableRerank` (Cohere) from KB settings

## Missing / Gaps

- **Execution timeout config**: no per-workflow or per-execution max-duration setting; only the 10-min SSE stream limit acts as a soft ceiling
- **Bulk cancel**: no way to cancel all running executions for a workflow at once (e.g. before undeploying)
- **Structured output schema validation**: node output shapes aren't validated against a declared schema — failures surface only at the next node's input
- **Replay diff**: replay creates a new execution but there's no diff view showing what changed vs the original run

## Status

Stable.
