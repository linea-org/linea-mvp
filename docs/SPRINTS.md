# Linea — Full Sprint Roadmap

**Last updated:** 2026-06-06  
**Cadence:** 6–7 days per sprint  
**Rule:** One branch per issue. PR before moving on. No bulk commits to main.

---

## Node Executor Audit — Quick Reference

All 24 node types audited. 3 are inline in `node-executor.service.ts` (approval, note, router). 21 are separate executor files.

| Executor | Status | Key Gap |
|---|---|---|
| agent | ✅ | `budgetPct` not clamped to [0,1] — line 306 |
| http | ✅ | Header JSON parse errors silently ignored — line 84 |
| transform | ✅ | No expression timeout |
| logic / router | ✅ | Multiple defaults in router is ambiguous |
| mcp | ✅ | No retry on timeout |
| memory | ✅ | No TTL, no entry size limit |
| guardrails | ⚠️ | IP regex matches invalid octets; moderation vocab too small (7 words) |
| extract | ✅ | Firecrawl batch has no per-item error handling |
| retriever | ⚠️ | RRF weights hardcoded in service (0.7/0.3), not configurable per-node |
| code | ❌ | Intentionally disabled — requires sandboxing |
| loop | ✅ | Data-only — does NOT run child nodes (architectural gap) |
| parallel | ✅ | Dispatch logic in service; executor is thin result builder |
| wait | ✅ | No cancellation support |
| variables | ✅ | Clean |
| evaluator | ⚠️ | Silent return (score=0) on missing API key instead of throwing |
| slack | ✅ | No threads, files, blocks, or reactions |
| github | ✅ | No assignee, milestone, draft PR support |
| notion | ✅ | Filter JSON parse error silently dropped |
| gmail | ✅ | Plain text only, no HTML body, no attachments |
| filter | ✅ | JEXL error silently filters out item |
| merge | ✅ | Shallow merge only |
| datetime | ✅ | Local timezone only, no conversion |
| approval | ✅ | Via `interrupt()` in service; no deadline/timeout |
| note | ✅ | Intentional no-op |

**Framework gaps (node-executor.service.ts):**
- Approval nodes timeout = 0 (unlimited) — lines 66–67
- Variable substitution has no pre-substitution size limit (OOM risk on huge payloads)
- Node name not included in error log context
- No per-node execution tracing for debugging

---

## Sprint 1 — Reliability & UX (Days 1–7)

**Goal:** Make what exists trustworthy. Fix what breaks user confidence.

---

### Phase 1A: Chat / Run Panel — Crash & Silent Failure Fixes
**File:** `apps/web/components/workflow-builder/chat-preview-panel.tsx`

- [ ] **Null token guard** — `getTokenRef.current().catch(() => null)` can return null; `createApiClient(null)` crashes. Add early return + toast: *"Session expired, refresh the page"* before the API call (lines 920–922)
- [ ] **SSE reconnect loop cap** — outer `while(true)` has no wall-clock limit. Record `startedAt` before the loop; break and show toast after 10 minutes total (lines 786–846)
- [ ] **Silent failure on SSE + REST both fail** — `catch { break }` exits with no user feedback. Replace with toast: *"Lost connection to execution. Check the Executions page for the result."* (line 875–877)
- [ ] **HTTP status → user-friendly messages** — map 401 → auth expired, 429 → rate limit, 500 → server error in the main catch block (lines 930–938)

---

### Phase 1B: Chat / Run Panel — State Transition Fixes
**File:** `apps/web/components/workflow-builder/chat-preview-panel.tsx`

- [ ] **Remove auto-collapse** — `StepsTrace` collapses after 1.2s on completion regardless of whether user is reading it. Remove the `setTimeout` collapse; keep trace open; let user close manually (lines 303–308)
- [ ] **Persist agent streaming text** — `StepRow` only shows `streamingText` while `status === 'running'`; it disappears on completion. Store final streamed value and render it persistently in the node output section (lines 257–261)
- [ ] **Preserve trace across suspension/resume** — `traceIdRef.current = null` on suspension wipes all pre-suspension steps. Instead, keep the trace and append new steps after a `─── Resumed ───` divider (line 690)
- [ ] **"Starting execution…" placeholder** — ~1s gap between POST returning an execution ID and first SSE `node_update` feels broken. Add an immediate placeholder step in the trace as soon as execution ID is returned, before SSE connects (lines 916–930)

---

### Phase 1C: Chat / Run Panel — Output & Canvas
**Files:** `chat-preview-panel.tsx`, `apps/web/components/workflow-builder/index.tsx`, `apps/web/app/(dashboard)/pods/[podId]/executions/[id]/page.tsx`

- [ ] **Node output preview on canvas** — `_outputPreview` (72-char truncated string) is stored in node data on every `node_update` but never rendered. Show it as a muted label under completed nodes on canvas (`index.tsx` line 1303)
- [ ] **JSON syntax highlighting** — raw JSON in chat output bubble and execution detail node output is unreadable. Add `react-json-view-lite` (4KB, zero deps) for any output that parses as object/array
- [ ] **`extractReply()` error shape handling** — current priority order (`message → result → response → text → JSON.stringify`) picks the wrong field when output is `{ error: "..." }`. Check for error shape first and render as error bubble (`chat-preview-panel.tsx` lines 94–102)
- [ ] **Polling timeout banner** — execution detail page polls every 3s indefinitely. Stop after 30 minutes and show: *"This execution has been running for 30+ minutes and may be stuck."* (`executions/[id]/page.tsx` lines 744–751)
- [ ] **Tool call arg expand** — `AgentOutputView` truncates tool args at 200 chars with no expand. Add Show more / Show less toggle (`chat-preview-panel.tsx` line 154)

---

### Phase 1D: Schedule Reliability
**File:** `apps/api/src/schedules/schedules.service.ts`

- [ ] **Log schedule failures** — `fireDueSchedules` catch block is empty. Add `this.logger.error()` with schedule ID + error message (line 172–174)
- [ ] **Don't advance `nextRunAt` on failure** — currently `nextRunAt` updates even if execution creation failed. Move `nextRunAt` update inside the try block, after successful `createFromTrigger` (lines 176–180)
- [ ] **Add `lastError` column** — add `lastError: text` and `consecutiveFailures: integer` to schedules table (`packages/db/src/schema/`). Write these after each failure.
- [ ] **Failure notification** — emit workspace notification when a schedule fails 3 consecutive times (use existing `NotificationsService`)

---

### Phase 1E: Webhook Reliability
**File:** `apps/api/src/webhooks/webhooks.service.ts`, `packages/db/src/schema/`

- [ ] **Add `webhook_deliveries` table** — columns: `id, webhookId, receivedAt, status (pending/success/failed), executionId, error, attempt`
- [ ] **Return 202 immediately** — decouple webhook receipt from execution creation. Accept the webhook, write a `pending` delivery record, then queue execution creation via BullMQ
- [ ] **Mark delivery status** — update delivery record to `success` with executionId on successful queue, or `failed` with error on quota exceeded / workflow not found
- [ ] **Surface delivery history in UI** — add "Recent Deliveries" table to the webhooks detail page showing last 20 deliveries with status + timestamp

---

### Phase 1F: Loop Node — Architectural Fix
**Files:** `apps/api/src/executions/engine/executors/loop.executor.ts`, `apps/api/src/executions/engine/langgraph.service.ts`, `packages/db/src/schema/` (workflow definition type)

Current behavior: loop only transforms an array with JEXL. It does NOT run child workflow nodes — this is a fundamental user expectation gap.

- [ ] **Define loop children in workflow schema** — add `children: string[]` (child node IDs) to `LoopNodeData` type in the workflow definition schema
- [ ] **Wire loop as control flow in LangGraph** — in `langgraph.service.ts`, detect loop nodes and execute child nodes sequentially for each iteration (similar to how subworkflow is wired at lines 215–279)
- [ ] **Accumulate child output per iteration** — each iteration captures the last child node's output; results returned as `{ results: T[], total: number, items: T[] }`
- [ ] **Enforce maxIterations + timeout** — existing cap (default 100) must apply to child node execution cycles, not just array slicing
- [ ] **Update loop panel UI** — `apps/web/components/workflow-builder/loop-panel.tsx` — add child node connection UI if not present; make it clear the loop runs connected nodes

---

## Sprint 2 — SDK + Observability (Days 8–14)

**Goal:** Make the platform inspectable and programmable from outside.

---

### Phase 2A: SDK — Resource Management
**File:** `packages/sdk/src/`

Current SDK covers execution lifecycle only (trigger, wait, stream). Missing 80% of API surface.

- [ ] **Workflows CRUD** — add `workflows.list()`, `workflows.get()`, `workflows.create()`, `workflows.update()`, `workflows.delete()` mapping to existing API routes
- [ ] **Pods management** — add `pods.list()`, `pods.get()`, `pods.create()`
- [ ] **Secrets management** — add `secrets.list()`, `secrets.set()`, `secrets.delete()`
- [ ] **Schedules management** — add `schedules.list()`, `schedules.create()`, `schedules.delete()`
- [ ] **Webhooks management** — add `webhooks.list()`, `webhooks.create()`, `webhooks.delete()`
- [ ] **Export updated types** — `Workflow`, `Pod`, `Schedule`, `Webhook`, `Secret` TypeScript interfaces exported from SDK

---

### Phase 2B: SDK — SSE Parser + Observability Methods
**File:** `packages/sdk/src/client.ts`

- [ ] **Rewrite SSE parser** — current parser breaks on multi-line event data, `\r\n` line endings, and `:` heartbeat frames. Rewrite to handle full SSE spec (lines 127–141)
- [ ] **Add `onError` callback to `streamEvents()`** — callers currently have no way to handle disconnects or reconnect failures
- [ ] **Add `listExecutions()`** — paginated execution history per workflow
- [ ] **Add `getMetrics()`** — wrapper for metrics API (execution counts, token usage, cost)
- [ ] **Add `getAuditLogs()`** — read-only observability for external tooling
- [ ] **Write SDK tests** — integration tests for SSE reconnect with `Last-Event-ID`, and each new resource method

---

### Phase 2C: Logging Restructure
**Files:** `apps/api/src/executions/`, `packages/db/src/schema/`

- [ ] **Add `debug` log level** — extend `workflow_log_level` enum from `none|errors|info` to `none|errors|info|debug`. Update log filtering in `execution.processor.ts` (lines 122–127)
- [ ] **Cursor-based pagination** — add `?cursor=&limit=` to `GET /executions/:id/logs`. Current implementation loads all logs at once.
- [ ] **Truncate `data` field at insert** — cap `execution_logs.data` JSONB at 50KB before write; add `[truncated: X bytes]` marker. Prevents large agent outputs from bloating the table
- [ ] **Add `archived_at` column** — mark logs older than 90 days as archivable. Background cron job flags them; hard-delete on configurable retention schedule
- [ ] **Workspace-level log default** — let workspace settings override `workflow_log_level` default (currently each workflow sets its own; no workspace default exists)

---

### Phase 2D: Audit Log Completion
**File:** `apps/api/src/executions/queue/execution.processor.ts`, `apps/api/src/audit/audit.service.ts`

Currently audit logs only cover resource CRUD. Runtime events are invisible.

- [ ] **Log execution started** — write audit entry `execution.started` with workflowId, triggeredBy, input hash (not raw input) after `createFromTrigger` succeeds
- [ ] **Log execution completed** — write `execution.completed` with duration, tokenUsage, nodeCount on processor success path
- [ ] **Log execution failed** — write `execution.failed` with error summary (first 500 chars) on processor failure path
- [ ] **Log execution suspended + resumed** — write `execution.suspended` and `execution.resumed` from the LangGraph interrupt handler
- [ ] **Log API key usage** — write `api_key.used` with keyId and endpoint in `ClerkAuthGuard` when `lnk_` key is used
- [ ] **Increase audit log limit** — current hardcoded 500-row limit in query; add proper pagination (`?cursor=&limit=`)

---

### Phase 2E: MCP Health Checks + Tool Caching
**File:** `apps/api/src/mcp/mcp.service.ts`

- [ ] **Background health check job** — BullMQ repeatable job every 5 minutes: ping each workspace's MCP servers, update `status` field (`connected`/`error`/`unknown`) and `lastCheckedAt`
- [ ] **Error message storage** — add `lastError: text` column to `mcp_servers` table; write error message when ping fails
- [ ] **Tool discovery caching** — on first MCP tool call per server, fetch tool list and cache in Redis (TTL 5 min). Subsequent calls use cache. Currently re-fetches every execution.
- [ ] **Health status in UI** — show green/red/grey dot + "Last checked X min ago" on MCP servers page and connections page

---

## Sprint 3 — Memory, Evals, Usage (Days 15–21)

**Goal:** Make the platform measurable and production-trustworthy.

---

### Phase 3A: Memory Hardening
**Files:** `apps/api/src/memory/memory.service.ts`, `apps/api/src/memory/embedding.service.ts`

- [ ] **Kill the zero-vector fallback** — `EmbeddingService` silently returns zero-vectors when embedding API fails. Zero-vectors corrupt cosine similarity (everything appears similar). Replace with hard throw + `logger.error()`. Callers must handle the error.
- [ ] **Paginate `loadForExecution()`** — currently loads all memory entries for a session into agent context. Add `limit` (default 20 most-recent) + `offset`. Prevents token budget blowout on long sessions.
- [ ] **Memory entry size limit** — cap individual memory `content` field at 10KB before write. Log a warning if truncation occurs.
- [ ] **Session isolation integration test** — write a test: insert memory in workspace A under threadId X; confirm workspace B cannot retrieve it with the same threadId
- [ ] **TTL support** — add optional `expiresAt: timestamp` column to `memories` table. Background job deletes expired entries daily.

---

### Phase 3B: Evaluator Node Fixes
**File:** `apps/api/src/executions/engine/executors/evaluator.executor.ts`

- [ ] **Throw on missing API key** — current behavior: silently returns `score=0, passed=false`. Replace lines 36–44 with a hard throw: *"Evaluator node requires ANTHROPIC_API_KEY. Configure in workspace model keys."*
- [ ] **Support multiple criteria** — currently single `criteria` string. Add `criteriaList: { name, weight, description }[]` to nodeData; score each criterion separately; return weighted aggregate
- [ ] **Add criteria examples** — add optional `examples: { input, idealOutput }[]` to nodeData; inject as few-shot examples into the evaluation prompt
- [ ] **Expose reasoning in output** — return `{ score, passed, reasoning, criteriaScores }` where `criteriaScores` breaks down per-criterion scores

---

### Phase 3C: Evals Framework
**Files:** `apps/api/src/evals/` (new module), `packages/db/src/schema/`

- [ ] **New DB tables** — create `eval_datasets (id, workflowId, name, workspaceId)`, `eval_cases (id, datasetId, input JSONB, expectedOutput JSONB, assertions JSONB)`, `eval_runs (id, datasetId, workflowId, status, results JSONB, createdAt)`
- [ ] **Dataset CRUD API** — `POST /datasets`, `GET /datasets`, `GET /datasets/:id`, `DELETE /datasets/:id`
- [ ] **Cases API** — `POST /datasets/:id/cases` (bulk insert), `GET /datasets/:id/cases`, `DELETE /datasets/:id/cases/:caseId`
- [ ] **Run API** — `POST /datasets/:id/run` → queues BullMQ job per case; returns runId. `GET /datasets/:id/runs` → run history with pass rates
- [ ] **Regression detection** — compare run results against previous run; flag cases that changed from `passed → failed` as regressions
- [ ] **Eval UI** — dataset manager page: upload cases as CSV/JSON, trigger runs, view run history with diff view vs previous run

---

### Phase 3D: Usage Tracking + Quota Visibility
**Files:** `apps/api/src/executions/queue/execution.processor.ts`, `apps/api/src/quotas/`

- [ ] **Write to `resource_usage` table** — currently this table is never written to. After each execution completion write: `executionId, workspaceId, durationMs, inputTokens, outputTokens, nodeCount, queueWaitMs`
- [ ] **`GET /workspaces/:id/quotas` endpoint** — returns `{ executions: { used, limit, resetAt }, tokens: { used, limit }, percentage }`. Currently no user-facing quota visibility.
- [ ] **Quota progress widget** — add to dashboard home page: current usage vs limit with progress bar and reset date
- [ ] **Cost-per-execution estimate** — compute estimated cost from token counts × model rate in `execution.processor.ts`; store in `executions.estimatedCostUsd` column; surface in metrics API and execution detail page

---

## Sprint 4 — Architecture + Security (Days 22–28)

**Goal:** Do the things that are painful to retrofit. Legal compliance and scalability foundations.

---

### Phase 4A: GDPR — Data Export
**Files:** new `apps/api/src/gdpr/` module

- [ ] **`GET /workspaces/:id/export` endpoint** — async: queues a BullMQ job, returns jobId
- [ ] **Export job** — collects: workflow definitions, execution history (input/output), memory entries, knowledge base entries, audit logs, secret names (not values), member list. Packages as ZIP.
- [ ] **Delivery** — on completion: store ZIP in signed S3/storage URL with 24h expiry; email download link to requesting user via existing email service
- [ ] **`gdpr_requests` table** — track: `id, workspaceId, userId, type (export/delete), status, createdAt, completedAt, downloadUrl`

---

### Phase 4B: GDPR — Data Deletion + Retention
**Files:** `apps/api/src/users/`, `apps/api/src/workspaces/`

- [ ] **`DELETE /users/me` endpoint** — hard delete: Clerk user, all workspace memberships, personal data. If user is sole owner of a workspace, block deletion until ownership transferred or workspace deleted.
- [ ] **`DELETE /workspaces/:id` hard delete** — current soft-delete only. Add hard-delete path that cascades: members, workflows, executions, logs, memories, knowledge entries, schedules, webhooks, secrets.
- [ ] **Retention policy setting** — add `logRetentionDays: integer` (default 90) to workspace settings. Background daily cron: delete `execution_logs` older than retention policy.
- [ ] **Consent management stub** — add `gdprConsentAt: timestamp` to users table. Prompt on first login if null (modal). Store on accept. Required before processing data.

---

### Phase 4C: Architecture — Queue Isolation
**Files:** `apps/api/src/executions/executions.service.ts`, `apps/api/src/executions/queue/execution.processor.ts`

Current: single `EXECUTION_QUEUE` shared across all workspaces. One slow/heavy workspace starves others.

- [ ] **Per-workspace queue names** — queue executions to `exec:${workspaceId}` instead of shared `EXECUTION_QUEUE`
- [ ] **Dynamic worker pool** — spin up a BullMQ worker per active workspace queue on demand; tear down after 5 min idle. Cap total workers at `CPU_CORES × 2`.
- [ ] **Shared queue fallback** — workspaces with <5 executions/day continue to use shared queue (avoid queue proliferation). Threshold configurable via env.
- [ ] **Queue stats in metrics API** — expose queue depth, average wait time, active worker count per workspace in `GET /workspaces/:id/metrics`

---

### Phase 4D: Architecture — Caching + Memory Pagination
**Files:** `apps/api/src/executions/engine/models/registry.ts`, `apps/api/src/secrets/secrets.service.ts`

- [ ] **Cache model registry in Redis** — model registry is re-read on every execution. Cache result (TTL 5 min). Invalidate on workspace model key change.
- [ ] **Cache decrypted secrets** — secrets decrypted on every request. Cache per-workspace in Redis (TTL 60s, invalidate on secret update). Prevents repeated AES-GCM operations.
- [ ] **Paginate all hardcoded list limits** — audit every `db.query` with hardcoded `limit: 500` and replace with cursor-based pagination + default `limit: 50`
- [ ] **Pre-substitution variable size limit** — variable substitution in `node-executor.service.ts` (lines 214–217) has no size check. Add 100KB cap on total substituted variable payload before dispatch to prevent OOM.

---

### Phase 4E: Node Executor — Critical Fixes
**Files:** individual executor files

- [ ] **`agent.executor.ts` line 306** — clamp `budgetPct` to `[0, 1]`: `Math.min(1, Math.max(0, nodeData.contextBudgetPct ?? 0.8))`
- [ ] **`evaluator.executor.ts` line 36** — throw instead of silent return on missing API key (covered in Sprint 3B but wiring happens here)
- [ ] **`guardrails.executor.ts` line 37** — fix IP address regex to validate octets (0–255 range). Current pattern matches `999.999.999.999`.
- [ ] **`guardrails.executor.ts` line 51** — expand moderation vocabulary beyond 7 hardcoded words OR integrate OpenAI Moderation API as optional upgrade when `OPENAI_API_KEY` is available
- [ ] **`http.executor.ts` line 84** — log warning (don't throw) when header JSON parse fails; include partial header string in warning
- [ ] **`notion.executor.ts` line 108** — throw or log on invalid filter JSON instead of silent skip
- [ ] **`retriever.executor.ts`** — expose RRF weights (`vectorWeight`, `bm25Weight`) and rerank model as configurable `nodeData` fields; pass through to `KnowledgeService.hybridSearch()`
- [ ] **`approval` node timeout** — add `deadlineHours: number` to approval nodeData; approval interrupt auto-rejects after deadline and continues workflow with `{ approved: false, timedOut: true }`
- [ ] **Framework: node name in error context** — include `nodeName` in all error log messages from `node-executor.service.ts` (currently only `nodeId` logged)
- [ ] **Framework: per-node execution trace log** — add debug-level log entry at node start and end with: nodeId, nodeName, inputVariables keys, durationMs. Gated behind `workflow_log_level === 'debug'`

---

## Sprint 5 — Growth Features (Days 29–35)

**Goal:** Expand what users can build. Ship net-new capabilities on a reliable foundation.

---

### Phase 5A: Code Node — E2B Sandbox
**File:** `apps/api/src/executions/engine/executors/code.executor.ts`

- [ ] **Add E2B SDK dependency** — `pnpm add @e2b/code-interpreter` in `apps/api`
- [ ] **Implement `code.executor.ts`** — replace the current placeholder throw with: create E2B sandbox, run code with `nodeData.code` + `nodeData.language` (js/python), capture stdout/stderr, destroy sandbox, return output
- [ ] **Timeout enforcement** — 30s max (configurable via `nodeData.timeoutMs`, hard cap at 120s)
- [ ] **Variable injection** — serialize `state.variables` as a JSON string available to the code as `process.env.LINEA_VARIABLES` (Node) or `os.environ['LINEA_VARIABLES']` (Python)
- [ ] **Cost tracking** — write sandbox runtime seconds to `resource_usage` after each code node execution
- [ ] **Re-enable code node in builder** — remove the `disabled` flag from `code-panel.tsx` once executor is live

---

### Phase 5B: Stripe Integration
**File:** `apps/api/src/billing/`

- [ ] **Add Stripe SDK** — `pnpm add stripe` in `apps/api`
- [ ] **Stripe Checkout flow** — `POST /billing/stripe/checkout` → create Stripe Checkout session for selected plan; return `checkoutUrl`
- [ ] **Stripe webhook handler** — `POST /billing/stripe/webhook` (Public, raw body) — handle: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] **Sync subscription to workspace** — on webhook: update `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd` in workspaces table (same fields as Polar.sh)
- [ ] **Gateway toggle in billing page** — add Stripe as payment option alongside Polar.sh on the billing settings page
- [ ] **Env vars** — document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_ENTERPRISE` in `.env.example`

---

### Phase 5C: Linea Agent — Expanded Tool Set
**File:** `apps/api/src/agent-chat/tools/`

Current 10 tools cover read + run. Missing editing, knowledge, and debug capabilities.

- [ ] **`edit_workflow` tool** — accepts node updates as JSON patch; calls workflow update API; returns updated definition
- [ ] **`add_knowledge` tool** — adds entry to a specified knowledge base; returns entryId
- [ ] **`search_knowledge` tool** — queries knowledge base with natural language; returns top results
- [ ] **`create_schedule` tool** — creates a cron schedule for a workflow
- [ ] **`delete_schedule` tool** — removes a schedule by ID
- [ ] **`debug_execution` tool** — fetches execution detail + node logs for a given executionId; summarizes what failed and why
- [ ] **`call_mcp_tool` tool** — already exists but extend to support auth token lookup from workspace secrets
- [ ] **Builder mode vs Run mode system prompt** — add `mode: 'builder' | 'run'` param to agent session creation. Builder mode: system prompt focuses on workflow management. Run mode: system prompt focuses on triggering workflows and answering from KB.

---

### Phase 5D: Integration Node Expansions
**Files:** individual executor files + node panels

These are not blockers but add significant value to the integration nodes.

**Slack:**
- [ ] **Thread replies** — add `thread_ts` param to `send_message`; support replying to a message thread
- [ ] **Rich blocks** — support Slack Block Kit JSON as `blocks` param instead of plain text

**Gmail:**
- [ ] **HTML body** — add `bodyHtml` field; send `multipart/alternative` email with both plain text and HTML parts
- [ ] **Reply-to-thread** — add `threadId` param; Gmail API supports threading via `references` and `in-reply-to` headers

**GitHub:**
- [ ] **Assignees + labels on create_issue** — already handles labels as string; add `assignees: string[]`
- [ ] **Draft PR** — add `draft: boolean` to `create_pr` action

**Notion:**
- [ ] **Surface filter JSON parse error** — throw with message instead of silent skip (line 108)
- [ ] **Typed properties on create_page** — allow `properties: Record<string, { type, value }>` for setting rich_text, number, select, date fields correctly

---

## Backlog — No Sprint Assigned

| Item | Reason |
|------|--------|
| New UI revamp | Foundation must be stable first |
| CopilotKit / ag-UI | Needs product decision: replace or layer on existing chat |
| Daytona | No code started; no scoping done; blocks Code node if chosen over E2B |
| Razorpay | Lower priority than Stripe; India-specific |
| Multi-region / data residency | Post-GDPR compliance |
| CASL migration | Custom RBAC works for current feature set; revisit when resource-level ACLs are needed |
| LM Studio | Ollama endpoint works as-is; UI for local model config is the gap |
| Guardrails ML upgrade | Integrate Perspective API or OpenAI Moderation once basic regex ship |
| Approval node deadline | Partially covered in Sprint 4E; full deadline UI in builder is separate |

---

## PR Checklist (every PR)

- [ ] One branch per issue
- [ ] PR opened before moving to next issue
- [ ] Tests added or updated
- [ ] Lint + type-check passes
- [ ] No Claude co-authorship lines in commits
