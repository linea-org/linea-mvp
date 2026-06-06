# Linea — Issue Tracker

Each entry is a self-contained GitHub issue. One branch per issue. One PR per issue.

**Label key:** `sprint-N` · `fe` / `be` / `fs` · `bug` / `improvement` / `feature` / `security`

---

## Sprint 1 — Reliability & UX

---

### ISSUE-001: Null token crash on workflow execution start

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1A — Chat Panel Crashes

**Problem**
When a user's Clerk session token expires mid-session, `getTokenRef.current()` rejects and the `.catch(() => null)` fallback returns `null`. This `null` is passed directly to `createApiClient(null)`, which then makes an authenticated API call with no token. The API returns a 401, but the error surface is a confusing uncaught exception rather than a user-readable message.

**What to do**
After the token refresh attempt at line 920–922 in `chat-preview-panel.tsx`, add a null-check before creating the API client. If the token is null or empty, show a toast ("Session expired. Refresh the page to continue.") and return early without making the API call.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (lines 920–922)

**Acceptance criteria**
- [ ] Expire a Clerk session manually (clear cookies), attempt to run a workflow → toast appears, no crash
- [ ] Valid session → no change in behavior
- [ ] No uncaught exceptions in console on token failure

---

### ISSUE-002: SSE reconnect loop runs indefinitely on stuck executions

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1A — Chat Panel Crashes

**Problem**
The SSE streaming loop in `startSSE()` is a `while(true)` with exponential backoff (up to 30s per attempt, max 5 retries per open). However, the outer loop has no total wall-clock cap — if an execution is stuck in `running` state, the client will attempt to reconnect indefinitely, draining battery and polluting server logs. There is no user-visible indication that reconnection is happening.

**What to do**
Record `const startedAt = Date.now()` before the `while(true)` loop at line 786. At the top of each loop iteration, check `if (Date.now() - startedAt > 10 * 60 * 1000)` and break with a toast: "Lost track of this execution. Check the Executions page for the latest status."

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (lines 786–846)

**Acceptance criteria**
- [ ] Simulate a stuck execution (mock SSE endpoint that never sends a terminal event) → toast appears after 10 minutes, loop exits
- [ ] Normal executions complete before 10 minutes → no change in behavior

---

### ISSUE-003: Silent hang when both SSE and REST fallback fail

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1A — Chat Panel Crashes

**Problem**
After 5 SSE reconnect attempts fail, the code falls through to a REST polling fallback. If that REST call also throws (network down, server error), the `catch { break; }` block silently exits. The user sees the execution in a "running" state with no output and no indication of what happened.

**What to do**
Replace the empty `catch { break; }` at line 875–877 with a catch block that shows a toast: "Lost connection to this execution. Check the Executions page for the result." and sets the run state to stopped so the UI reflects a terminal state.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (lines 875–877)

**Acceptance criteria**
- [ ] Kill the network after execution starts → toast appears after reconnect attempts exhaust
- [ ] UI shows execution as ended, input re-enabled, no spinner stuck

---

### ISSUE-004: API error messages show raw codes instead of human text

**Labels:** `sprint-1` `fe` `improvement`
**Phase:** 1A — Chat Panel Crashes

**Problem**
The catch block in `send()` (lines 930–938) shows `error.message` directly to the user. This can be a raw HTTP error like "Request failed with status 429" or a stack trace fragment. Users have no actionable information from this.

**What to do**
In the catch block, check the HTTP status code and map to friendly messages:
- 401 → "Your session expired. Refresh the page."
- 429 → "You've hit the rate limit. Wait a moment and try again."
- 402 → "Execution limit reached. Upgrade your plan."
- 500 / 502 / 503 → "Server error. Try again in a moment."
- Network error (no status) → "Connection failed. Check your internet."

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (lines 930–938)

**Acceptance criteria**
- [ ] Each HTTP status code shows the correct friendly message
- [ ] Unknown errors fall back to the raw message as before

---

### ISSUE-005: Execution trace auto-collapses while user is reading it

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1B — State Transitions

**Problem**
`StepsTrace` sets a 1.2-second timeout to collapse itself when the execution reaches a terminal state (lines 303–308). If the user is actively reading node outputs when the execution finishes, the trace collapses and they lose their place. There is no way to re-expand it without clicking again, and the expanded state resets.

**What to do**
Remove the `setTimeout` collapse entirely from `StepsTrace`. Keep the trace open after execution. Add a manual close button ("✕ Close trace") that the user can click. Optionally allow re-opening the trace by clicking the execution step in the chat.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (`StepsTrace` component, lines 303–308)

**Acceptance criteria**
- [ ] Run a workflow → trace stays open after completion
- [ ] Close button dismisses the trace
- [ ] Trace can be dismissed and is not auto-dismissed

---

### ISSUE-006: Agent streaming text disappears when node completes

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1B — State Transitions

**Problem**
`StepRow` renders `streamingText` (the token-by-token agent output) only when `status === 'running'` (lines 257–261). The moment the node transitions to `completed`, `streamingText` is cleared from the render and the user loses all the text they were watching stream in. The final structured output appears but it may be in a different format and the intermediate reasoning is lost.

**What to do**
When a node transitions from `running` to `completed`, capture the current `streamingText` into a local `finalStreamedText` ref or state. Render `finalStreamedText` persistently in the node's output section alongside the structured output, under a "Streamed output" label. Clear it only if the user explicitly collapses the node.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (`StepRow` component, lines 257–261)

**Acceptance criteria**
- [ ] Run an agent node → streaming text visible during execution
- [ ] After execution completes → streaming text still visible in the node's output section
- [ ] Node collapse/expand preserves the streamed text

---

### ISSUE-007: Execution trace resets when workflow resumes after suspension

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1B — State Transitions

**Problem**
When a workflow reaches a suspension point (approval node or ask_human), `handleSSEEvent` sets `traceIdRef.current = null` (line 690). When the user approves and execution resumes, a new trace message is created and appended to the chat. The pre-suspension steps (which may include several nodes) are now in a separate, older message and appear disconnected. Users can't see the full execution history in one view.

**What to do**
Do not reset `traceIdRef.current` on suspension. Instead, update the existing trace message to include a visual separator row after the suspended node:
```
✅ fetch-data  (340ms)
⏸  approval    Suspended — awaiting approval
─── Resumed ───
✅ process     (120ms)
```
New steps after resumption append to the same trace message.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (`handleSSEEvent`, line 690)

**Acceptance criteria**
- [ ] Run a workflow with an approval node → approve → pre-suspension and post-resumption steps in one continuous trace
- [ ] Visual divider "─── Resumed ───" appears between the two sections
- [ ] Multiple suspensions append multiple dividers without resetting

---

### ISSUE-008: No feedback between clicking Send and first node starting

**Labels:** `sprint-1` `fe` `improvement`
**Phase:** 1B — State Transitions

**Problem**
After a user clicks Send, the POST to create the execution happens (takes ~200–500ms) and then the SSE connection is opened. The first `node_update` event may take another ~500ms. During this window, only a "typing bubble" is shown with no indication that execution is starting. Users often click Send again thinking it didn't register.

**What to do**
As soon as the execution ID is returned from `POST /executions` (before `startSSE()` is called), inject an immediate placeholder step into the trace: `"⏳ Starting execution…"` with a spinner. Replace it with the real first `node_update` event when it arrives. If no node event arrives within 5 seconds, replace the placeholder with `"Waiting in queue…"`.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (`send()` function, lines 916–930)

**Acceptance criteria**
- [ ] Click Send → placeholder appears immediately (< 100ms after POST returns)
- [ ] First node event arrives → placeholder replaced by real node row
- [ ] Slow queue → placeholder updates to "Waiting in queue…" after 5s

---

### ISSUE-009: Node output preview not shown on canvas after execution

**Labels:** `sprint-1` `fe` `improvement`
**Phase:** 1C — Output & Canvas

**Problem**
Every `node_update` SSE event stores a `_outputPreview` (72-char truncated string) in the node's data in the React Flow state (line 1303 in `index.tsx`). However, no component in the workflow builder canvas reads or renders this field. After an execution, users see coloured status badges on nodes but cannot see what any node produced without navigating away to the execution detail page.

**What to do**
In the node component that renders on the canvas, read `data._outputPreview` when `data.status === 'completed'`. Render it as a small muted single-line label below the node name. Truncate to fit within the node card width. On hover, show a tooltip with the same text (no expand — keep it lightweight).

**Files**
- `apps/web/components/workflow-builder/index.tsx` (line 1303)
- Node card component (whichever renders `data.status` badges)

**Acceptance criteria**
- [ ] Run a workflow → completed nodes show a 1-line preview of their output on the canvas
- [ ] Hovering a completed node shows the preview in a tooltip
- [ ] Failed nodes show no preview (only error badge)
- [ ] Preview disappears when starting a new run

---

### ISSUE-010: JSON output rendered as unreadable raw text

**Labels:** `sprint-1` `fe` `improvement`
**Phase:** 1C — Output & Canvas

**Problem**
Both the chat panel output bubble and the execution detail page node output section render JSON objects as raw unstyled text inside a `<pre>` block. For complex nested objects (common in agent and HTTP node outputs), this is nearly unreadable without copy-pasting into a formatter elsewhere.

**What to do**
Install `react-json-view-lite` (4KB gzipped, zero runtime dependencies). In both locations, attempt `JSON.parse()` on the output. If it succeeds and the result is an object or array, render it with `react-json-view-lite` with collapsed-by-default depth of 2. If it's a primitive or parse fails, fall back to the existing `<pre>` text rendering.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (output bubble)
- `apps/web/app/(dashboard)/pods/[podId]/executions/[id]/page.tsx` (node output section)

**Acceptance criteria**
- [ ] Agent node with JSON output → shows collapsible tree, not raw text
- [ ] Plain text output → unchanged, still shown as text
- [ ] Nested objects collapse to depth 2 by default, expandable on click

---

### ISSUE-011: extractReply() picks wrong field when output contains an error

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1C — Output & Canvas

**Problem**
`extractReply()` (lines 94–102 in `chat-preview-panel.tsx`) tries fields in the order `message → result → response → text → JSON.stringify`. When a workflow returns `{ error: "Something went wrong" }`, none of the priority fields match, so it falls through to `JSON.stringify` and shows `{"error":"Something went wrong"}` in a chat bubble — styled as a successful response rather than an error.

**What to do**
Before the existing field-priority chain, check if the output is an object with only an `error` string key (or has `success: false` + `error`). If so, render the output as an error bubble (red styling) with `output.error` as the message text, not as a regular assistant response.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (lines 94–102)

**Acceptance criteria**
- [ ] Workflow returns `{ error: "quota exceeded" }` → error bubble shown in red with "quota exceeded"
- [ ] Workflow returns `{ message: "done" }` → normal message bubble, unchanged
- [ ] Workflow returns a plain string → unchanged

---

### ISSUE-012: Execution detail page polls indefinitely on stuck executions

**Labels:** `sprint-1` `fe` `bug`
**Phase:** 1C — Output & Canvas

**Problem**
The execution detail page polls `GET /executions/:id` every 3 seconds while status is `running` or `queued` (lines 744–751). There is no upper bound on polling duration. If an execution gets stuck in `running` state (dead worker, hung LangGraph node), the page polls forever, generating unnecessary server load and giving the user no signal that something is wrong.

**What to do**
Record the poll start time. After 30 minutes of polling with no terminal status, stop the interval and show a banner at the top of the page: "This execution has been running for 30+ minutes and may be stuck. You can check logs or contact support." Keep a "Refresh" button to manually re-poll if needed.

**Files**
- `apps/web/app/(dashboard)/pods/[podId]/executions/[id]/page.tsx` (lines 744–751)

**Acceptance criteria**
- [ ] Execution stuck in `running` → banner appears after 30 minutes
- [ ] Polling stops after banner appears (no further network requests)
- [ ] Refresh button manually polls once and updates the UI

---

### ISSUE-013: Tool call arguments truncated with no way to expand

**Labels:** `sprint-1` `fe` `improvement`
**Phase:** 1C — Output & Canvas

**Problem**
`AgentOutputView` truncates tool call argument strings at 200 characters (line 154) with no visual indicator that content was cut off and no way to see the full argument. For tool calls with large inputs (e.g., long prompts passed to a sub-agent tool, large JSON bodies), the truncation hides important debugging information.

**What to do**
If the argument string exceeds 200 characters, show the first 200 characters followed by a "Show more" link. Clicking it expands to the full argument inline. Clicking "Show less" collapses it back. No modal or separate view needed.

**Files**
- `apps/web/components/workflow-builder/chat-preview-panel.tsx` (`AgentOutputView`, line 154)

**Acceptance criteria**
- [ ] Short args (< 200 chars) → displayed as before, no change
- [ ] Long args → truncated with "Show more" link
- [ ] Clicking "Show more" → full content visible
- [ ] Clicking "Show less" → collapses back

---

### ISSUE-014: Schedule failures silently swallowed with no logging

**Labels:** `sprint-1` `be` `bug`
**Phase:** 1D — Schedule Reliability

**Problem**
`fireDueSchedules()` in `schedules.service.ts` wraps each `createFromTrigger` call in a try-catch whose catch block is empty (lines 172–174). When a schedule fails to fire (quota exceeded, workflow deleted, database error), the failure is completely invisible — no log entry, no metric, no user notification. The schedule silently progresses to the next run time as if nothing happened.

**What to do**
In the catch block, call `this.logger.error()` with the schedule ID, workflow ID, and the error message/stack. This ensures failures appear in server logs and any connected log aggregation. Do not rethrow — other schedules in the batch should still fire.

**Files**
- `apps/api/src/schedules/schedules.service.ts` (lines 172–174)

**Acceptance criteria**
- [ ] Force a schedule failure (point it at a deleted workflow) → error appears in server logs with schedule ID
- [ ] Other schedules in the same batch still fire
- [ ] No change in behavior for successful schedules

---

### ISSUE-015: Schedule advances nextRunAt even when execution creation fails

**Labels:** `sprint-1` `be` `bug`
**Phase:** 1D — Schedule Reliability

**Problem**
In `fireDueSchedules()`, `lastRunAt` and `nextRunAt` are updated (lines 176–180) regardless of whether `createFromTrigger` succeeded or threw. This means a schedule that fails to fire will still skip to the next cron interval — the missed execution is permanently lost with no retry.

**What to do**
Move the `nextRunAt` update inside the `try` block, after the `createFromTrigger` call succeeds. On failure, do not update `nextRunAt`. Optionally: on failure, set `nextRunAt` to `now + 1 minute` for an immediate retry, then resume normal cadence on the next success.

**Files**
- `apps/api/src/schedules/schedules.service.ts` (lines 172–180)

**Acceptance criteria**
- [ ] Schedule fails to fire → `nextRunAt` unchanged, will retry at original next interval
- [ ] Schedule fires successfully → `nextRunAt` advances normally
- [ ] Database reflects correct state in both cases

---

### ISSUE-016: Add lastError and consecutiveFailures tracking to schedules

**Labels:** `sprint-1` `be` `improvement`
**Phase:** 1D — Schedule Reliability

**Problem**
There is no way for users or operators to know why a schedule stopped working or how many times it has failed consecutively. The `schedules` table has no error tracking columns.

**What to do**
Add two columns to the `schedules` table: `lastError: text` (nullable) and `consecutiveFailures: integer` (default 0). On each failure in `fireDueSchedules()`, write the error message to `lastError` and increment `consecutiveFailures`. On success, reset both to null/0. Expose `lastError` and `consecutiveFailures` in the schedule detail API response.

**Files**
- `packages/db/src/schema/` (schedules table definition)
- `apps/api/src/schedules/schedules.service.ts`
- `apps/api/src/schedules/schedules.controller.ts` (include in response)

**Acceptance criteria**
- [ ] Schedule fails 3 times → `consecutiveFailures === 3`, `lastError` contains the most recent error
- [ ] Schedule succeeds → `consecutiveFailures` resets to 0, `lastError` is null
- [ ] Schedule detail API returns `lastError` and `consecutiveFailures`

---

### ISSUE-017: Notify workspace when schedule fails repeatedly

**Labels:** `sprint-1` `be` `improvement`
**Phase:** 1D — Schedule Reliability

**Problem**
Even with error logging, users won't see schedule failures unless they check server logs. A schedule that has been silently failing for days (due to a quota issue or workflow misconfiguration) goes unnoticed until a user manually checks the schedules page.

**What to do**
After writing `consecutiveFailures` (from ISSUE-016), check if `consecutiveFailures === 3`. If so, call `NotificationsService.emit()` with a workspace-level notification: "Schedule '{name}' has failed 3 times in a row. Last error: {lastError}. Check the Schedules page." Do not re-notify on the 4th, 5th failure etc. — only on the 3rd.

**Files**
- `apps/api/src/schedules/schedules.service.ts`
- Uses existing `NotificationsService`

**Acceptance criteria**
- [ ] Schedule fails 3 times consecutively → one notification emitted
- [ ] Schedule fails 4th time → no additional notification
- [ ] Schedule succeeds after failures → `consecutiveFailures` resets; next failure cycle starts fresh notifications from 3

---

### ISSUE-018: Add webhook_deliveries table for delivery tracking

**Labels:** `sprint-1` `be` `feature`
**Phase:** 1E — Webhook Reliability

**Problem**
When a webhook is received, there is no record of the delivery attempt. If the execution creation fails (quota exceeded, workflow not found, BullMQ error), the caller receives an HTTP 500 with no information and the delivery is lost. There is no way to audit webhook delivery history or debug failed deliveries.

**What to do**
Create a `webhook_deliveries` table with columns: `id (uuid), webhookId (uuid FK), receivedAt (timestamp), status (enum: pending/success/failed), executionId (uuid nullable), error (text nullable), attempt (integer default 1), requestBody (jsonb nullable)`.

Write a `pending` record immediately on receipt before any processing.

**Files**
- `packages/db/src/schema/` (new table)
- `apps/api/src/webhooks/webhooks.service.ts`

**Acceptance criteria**
- [ ] Webhook received → delivery record created with status `pending`
- [ ] Schema migration runs without errors
- [ ] `webhookId` foreign key references the webhooks table correctly

---

### ISSUE-019: Decouple webhook receipt from execution creation (202 Accepted)

**Labels:** `sprint-1` `be` `improvement`
**Phase:** 1E — Webhook Reliability

**Problem**
The webhook handler currently calls `executionsService.createFromTrigger()` synchronously inline. If this call is slow or fails, the webhook caller waits and may retry, leading to duplicate deliveries. HTTP best practice for webhooks is to acknowledge receipt immediately (202) and process asynchronously.

**What to do**
Refactor `webhooks.service.ts` trigger method to: (1) validate signature and timestamp as before, (2) write a `pending` delivery record, (3) enqueue a BullMQ job (`WEBHOOK_PROCESS_QUEUE`) with the delivery ID, (4) return `{ received: true }` with HTTP 202. A separate BullMQ processor picks up the job, calls `createFromTrigger`, and updates the delivery record status.

**Files**
- `apps/api/src/webhooks/webhooks.service.ts`
- `apps/api/src/webhooks/webhooks.processor.ts` (new)
- `apps/api/src/webhooks/webhooks.module.ts`

**Acceptance criteria**
- [ ] POST to webhook endpoint returns 202 in < 50ms
- [ ] Execution is created asynchronously within 1–2 seconds
- [ ] Delivery record updated to `success` with `executionId` after processing
- [ ] Delivery record updated to `failed` with `error` if processing fails

---

### ISSUE-020: Surface webhook delivery history in the UI

**Labels:** `sprint-1` `fe` `feature`
**Phase:** 1E — Webhook Reliability

**Problem**
Users have no visibility into whether their webhooks are being delivered and processed correctly. The webhooks page shows configuration but no delivery history.

**What to do**
On the webhook detail page (`apps/web/app/(dashboard)/pods/[podId]/webhooks/`), add a "Recent Deliveries" section below the configuration. Show the last 20 delivery attempts in a table: timestamp, status badge (success/failed/pending), execution ID (linked to execution detail), and error message on hover for failed deliveries.

**Files**
- `apps/web/app/(dashboard)/pods/[podId]/webhooks/` (detail page)
- `apps/api/src/webhooks/webhooks.controller.ts` (`GET /webhooks/:id/deliveries` endpoint)

**Acceptance criteria**
- [ ] Webhook detail page shows delivery history table
- [ ] Successful deliveries show execution ID as a link
- [ ] Failed deliveries show error message on hover/expand
- [ ] Table shows most recent 20, with timestamp sorted descending

---

### ISSUE-021: Loop node does not execute child nodes — schema update

**Labels:** `sprint-1` `be` `bug`
**Phase:** 1F — Loop Node Fix

**Problem**
The loop node currently only iterates an array and applies an optional JEXL transform. It does not execute any child workflow nodes. Users building workflows expect a loop to run a sequence of nodes for each item in an array — this is the fundamental use case. The current behavior produces transformed array data but no nested execution.

**What to do**
Add a `children: string[]` field to `LoopNodeData` in the workflow definition TypeScript type. This field stores the ordered list of child node IDs that should execute for each iteration. Update the Zod/validation schema if one exists. This is the schema prerequisite for ISSUE-022.

**Files**
- `packages/db/src/schema/` or wherever `LoopNodeData` is typed
- Workflow definition validation schema

**Acceptance criteria**
- [ ] `LoopNodeData` type includes `children?: string[]`
- [ ] Existing loop nodes without `children` remain valid (field is optional, backward compatible)
- [ ] TypeScript compiles without errors

---

### ISSUE-022: Wire loop node as control flow in LangGraph

**Labels:** `sprint-1` `be` `bug`
**Phase:** 1F — Loop Node Fix

**Problem**
Following ISSUE-021, the `langgraph.service.ts` must be updated to detect loop nodes with children and execute those child nodes sequentially for each iteration, rather than running the dumb data-transform `loop.executor.ts`.

**What to do**
In `langgraph.service.ts`, when building the execution graph: detect nodes of type `loop` that have a non-empty `children` array. For each iteration of the loop array, execute the child nodes in sequence using the same `createNodeFn` execution path used by normal and subworkflow nodes. Accumulate results per iteration. Apply `maxIterations` cap to the number of child-node-execution cycles.

**Files**
- `apps/api/src/executions/engine/langgraph.service.ts` (lines 215–279 — model after subworkflow pattern)

**Acceptance criteria**
- [ ] Loop node with `children: ['node-a', 'node-b']` over array `[1,2,3]` → nodes A and B execute 3 times
- [ ] `results` output contains the final output of node B for each iteration
- [ ] `maxIterations: 5` with a 10-item array → only first 5 iterations execute
- [ ] Error in a child node during iteration 2 → propagates up and stops the loop

---

### ISSUE-023: Loop node accumulates and returns per-iteration results

**Labels:** `sprint-1` `be` `improvement`
**Phase:** 1F — Loop Node Fix

**Problem**
After wiring child node execution (ISSUE-022), the loop must capture and structure the results correctly so downstream nodes can use them.

**What to do**
After all iterations complete, return `{ results: T[], total: number, items: T[] }` where `results` is the array of last-child-node outputs per iteration, `total` is the count, and `items` is the original input array (unchanged). Set this as `lastOutput` in the workflow state. Downstream nodes can iterate `lastOutput.results`.

**Files**
- `apps/api/src/executions/engine/langgraph.service.ts`
- `apps/api/src/executions/engine/executors/loop.executor.ts` (may be simplified or removed)

**Acceptance criteria**
- [ ] Loop over `[a, b, c]` with a transform node → `lastOutput.results = [transformedA, transformedB, transformedC]`
- [ ] `lastOutput.total === 3`
- [ ] `lastOutput.items === [a, b, c]` (original array preserved)

---

### ISSUE-024: Enforce maxIterations and timeout on loop child execution

**Labels:** `sprint-1` `be` `improvement`
**Phase:** 1F — Loop Node Fix

**Problem**
The existing `maxIterations` cap (default 100) was applied to array slicing in the old data-only executor. With child node execution, this cap must apply to the number of full child-node-execution cycles, not just array elements. There must also be a timeout so a loop over slow nodes doesn't block a worker indefinitely.

**What to do**
Before starting the iteration loop: check `array.length > maxIterations` and slice. Additionally, record `loopStartTime = Date.now()` and check on each iteration if `Date.now() - loopStartTime > MAX_LOOP_TIMEOUT_MS` (default: 5 minutes). If exceeded, throw with: "Loop exceeded maximum duration of 5 minutes after N iterations."

**Files**
- `apps/api/src/executions/engine/langgraph.service.ts`

**Acceptance criteria**
- [ ] Loop with 200-item array and `maxIterations: 100` → stops at 100 iterations
- [ ] Loop with slow child nodes (mocked to 1s each) → stops after 5 minutes with a timeout error
- [ ] Normal loops under both limits complete without interruption

---

### ISSUE-025: Update loop panel UI to show child node connections

**Labels:** `sprint-1` `fe` `improvement`
**Phase:** 1F — Loop Node Fix

**Problem**
The `loop-panel.tsx` sidebar panel shows array path and transform expression — a data-transform interface. Now that the loop executes child nodes, the panel must communicate that child nodes are connected via the canvas (like how subworkflow shows a linked workflow), not configured by expression.

**What to do**
Update `loop-panel.tsx` to: (1) remove the `itemTransform` JEXL expression field (or move it to "advanced / legacy"), (2) add an instructional callout: "Connect nodes to this loop in the canvas — they will run for each item in the array." (3) show a read-only list of currently connected child node names if `children` is populated. Keep the `arrayPath` and `maxIterations` fields.

**Files**
- `apps/web/components/workflow-builder/loop-panel.tsx`

**Acceptance criteria**
- [ ] Loop panel shows instruction text about connecting child nodes
- [ ] Connected child nodes listed by name in the panel
- [ ] `arrayPath` and `maxIterations` still configurable
- [ ] JEXL transform field removed or clearly marked as legacy

---

## Sprint 2 — SDK + Observability

---

### ISSUE-026: SDK — Add workflow CRUD methods

**Labels:** `sprint-2` `be` `feature`
**Phase:** 2A — SDK Resource Management

**Problem**
The Linea TypeScript SDK only exposes execution lifecycle methods (`trigger`, `run`, `waitForCompletion`, `streamEvents`). Developers automating Linea from external scripts cannot manage workflows, pods, or secrets programmatically. The entire resource management surface of the API is unreachable from the SDK.

**What to do**
Add a `workflows` namespace to `LineaClient` with methods: `list(workspaceId, podId)`, `get(workspaceId, podId, workflowId)`, `create(workspaceId, podId, definition)`, `update(workspaceId, podId, workflowId, definition)`, `delete(workspaceId, podId, workflowId)`. Each method maps to the existing REST API routes. Export a `Workflow` TypeScript type.

**Files**
- `packages/sdk/src/client.ts`
- `packages/sdk/src/types.ts`

**Acceptance criteria**
- [ ] `client.workflows.list(wsId, podId)` returns array of `Workflow`
- [ ] `client.workflows.create(...)` returns the created `Workflow`
- [ ] All methods throw `LineaApiError` with status code on failure
- [ ] Types exported from SDK root

---

### ISSUE-027: SDK — Add pods, secrets, schedules, webhooks management

**Labels:** `sprint-2` `be` `feature`
**Phase:** 2A — SDK Resource Management

**Problem**
Following ISSUE-026, pods, secrets, schedules, and webhooks are also unreachable from the SDK.

**What to do**
Add namespaces: `pods` (`list`, `get`, `create`), `secrets` (`list`, `set`, `delete`), `schedules` (`list`, `create`, `delete`), `webhooks` (`list`, `create`, `delete`). Export types: `Pod`, `Secret`, `Schedule`, `Webhook`.

**Files**
- `packages/sdk/src/client.ts`
- `packages/sdk/src/types.ts`

**Acceptance criteria**
- [ ] Each namespace method maps correctly to the existing API route
- [ ] `client.secrets.set(wsId, { name, value })` creates or updates a secret
- [ ] `client.schedules.create(wsId, podId, { workflowId, cronExpr })` returns a `Schedule`
- [ ] All types exported

---

### ISSUE-028: SDK — Rewrite SSE parser for spec compliance

**Labels:** `sprint-2` `be` `bug`
**Phase:** 2B — SDK SSE + Observability

**Problem**
The SSE parser in `packages/sdk/src/client.ts` (lines 127–141) splits events by newlines and parses `data:` lines, but does not handle: multi-line event data (multiple `data:` lines in one event), `\r\n` line endings (Windows servers), `:` heartbeat frames (empty comment lines sent to keep connections alive), or `event:` type lines. This causes dropped events and parse errors in real-world SSE streams.

**What to do**
Rewrite the SSE parser from scratch following the W3C EventSource spec. Buffer incoming chunks, split on `\n\n` (or `\r\n\r\n`) event boundaries, parse each event by extracting `id:`, `event:`, and `data:` fields (handling multiple `data:` lines by joining with `\n`), skip `:` comment lines silently, and dispatch the parsed event. Handle the `Last-Event-ID` reconnect header correctly.

**Files**
- `packages/sdk/src/client.ts` (lines 127–141 and surrounding)

**Acceptance criteria**
- [ ] Multi-line `data:` field → joined correctly into one event
- [ ] `\r\n` line endings → parsed the same as `\n`
- [ ] `:` heartbeat lines → silently ignored, no parse error
- [ ] Reconnect with `Last-Event-ID` header → correct event replay

---

### ISSUE-029: SDK — Add onError callback and observability methods

**Labels:** `sprint-2` `be` `feature`
**Phase:** 2B — SDK SSE + Observability

**Problem**
`streamEvents()` currently has no error callback. If the SSE connection drops or the server sends an error, the caller has no way to handle it. Additionally, `listExecutions()`, `getMetrics()`, and `getAuditLogs()` are absent — external tools cannot build dashboards or observability pipelines against Linea.

**What to do**
- Add `onError?: (err: Error) => void` as a fourth parameter to `streamEvents()`
- Add `client.executions.list(wsId, podId, workflowId?, options?)` → paginated execution list
- Add `client.metrics.get(wsId, period?)` → execution stats + token usage
- Add `client.audit.list(wsId, options?)` → audit log entries

**Files**
- `packages/sdk/src/client.ts`
- `packages/sdk/src/types.ts`

**Acceptance criteria**
- [ ] SSE connection drop → `onError` callback called with the error
- [ ] `client.executions.list(wsId, podId)` returns paginated result
- [ ] `client.metrics.get(wsId, '7d')` returns the same shape as the API
- [ ] Integration test: SSE disconnect mid-stream → `onError` fires, no unhandled rejection

---

### ISSUE-030: SDK — Write integration tests for all new methods

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2B — SDK SSE + Observability

**Problem**
The SDK has no integration tests. New methods added in ISSUE-026–029 need test coverage to prevent regressions and to document expected behavior.

**What to do**
Add a `packages/sdk/src/__tests__/` directory. Write tests using `msw` (mock service worker) or a local test server to mock the API. Cover: each resource CRUD method (happy path + 404 + 401), SSE reconnect with `Last-Event-ID`, `onError` callback on disconnect, `waitForCompletion` timeout.

**Files**
- `packages/sdk/src/__tests__/` (new)
- `packages/sdk/package.json` (add test script + jest config)

**Acceptance criteria**
- [ ] `pnpm --filter=@linea/sdk test` passes
- [ ] SSE reconnect test simulates mid-stream disconnect and verifies `Last-Event-ID` is sent
- [ ] All resource methods have at least a happy-path test
- [ ] Tests run in CI

---

### ISSUE-031: Add debug log level to execution logging

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2C — Logging Restructure

**Problem**
The `workflow_log_level` enum supports `none`, `errors`, and `info`. There is no `debug` level for detailed per-variable, per-step tracing. Developers debugging complex workflows have no way to get more granular logging without instrumenting the code directly.

**What to do**
Add `debug` to the `workflow_log_level` enum in the DB schema. Update the log filtering logic in `execution.processor.ts` (lines 122–127) to pass through all log entries when level is `debug`. Update the workflow settings UI to expose `debug` as an option. Document that `debug` logs can be verbose and are automatically archived faster.

**Files**
- `packages/db/src/schema/` (enum definition)
- `apps/api/src/executions/queue/execution.processor.ts` (lines 122–127)
- `apps/web/` (workflow settings log level dropdown)

**Acceptance criteria**
- [ ] Workflow with `log_level: debug` shows all log entries including debug-gated ones
- [ ] `info` level still filters debug entries
- [ ] DB migration runs without errors
- [ ] UI dropdown shows Debug option

---

### ISSUE-032: Add cursor-based pagination to execution logs API

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2C — Logging Restructure

**Problem**
`GET /executions/:id/logs` loads all log entries for an execution in a single query. Long-running agent workflows can generate thousands of log entries. Loading all of them in one request is slow, memory-intensive, and causes frontend hangs when rendering large log lists.

**What to do**
Add `?cursor=<logId>&limit=<n>` query params to the logs endpoint. Default `limit: 100`. Return `{ logs: LogEntry[], nextCursor: string | null }`. Frontend log viewer makes paginated requests and appends results. Update the execution detail page log viewer to use paginated fetching with a "Load more" button.

**Files**
- `apps/api/src/executions/executions.controller.ts`
- `apps/api/src/executions/executions.service.ts`
- `apps/web/app/(dashboard)/pods/[podId]/executions/[id]/page.tsx`

**Acceptance criteria**
- [ ] `GET /executions/:id/logs?limit=50` returns 50 entries and a `nextCursor`
- [ ] `GET /executions/:id/logs?cursor=<id>&limit=50` returns the next 50 entries
- [ ] Last page returns `nextCursor: null`
- [ ] Frontend "Load more" button appends next page to the list

---

### ISSUE-033: Truncate large data payloads before writing to execution_logs

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2C — Logging Restructure

**Problem**
The `data` JSONB column in `execution_logs` stores raw node output. Agent nodes with large knowledge base retrievals, HTTP responses, or tool call results can produce outputs in the megabyte range. These are stored in full, bloating the logs table and slowing queries.

**What to do**
Before inserting any log entry, serialize the `data` field and check its byte length. If it exceeds 50KB, truncate the serialized JSON at 50KB and append `"[truncated: X bytes omitted]"` as a marker. Store the truncated version. Log a warning with the execution ID and node ID.

**Files**
- `apps/api/src/executions/queue/execution.processor.ts` (log write path, lines 130–137)

**Acceptance criteria**
- [ ] Log entry with 1MB output → stored as 50KB + truncation marker
- [ ] Log entry with 10KB output → stored in full, no truncation
- [ ] Truncation marker is valid JSON (wraps the truncated content)

---

### ISSUE-034: Add archived_at column and retention job for execution logs

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2C — Logging Restructure

**Problem**
Execution logs accumulate indefinitely in the `execution_logs` table. Old logs from months-ago executions sit in the hot table alongside recent logs, degrading query performance. There is no automated cleanup mechanism.

**What to do**
Add `archived_at: timestamp` (nullable) column to `execution_logs`. Create a BullMQ repeatable job (`LOG_ARCHIVE_JOB`, daily at 02:00 UTC) that sets `archived_at = now()` for all logs older than the workspace's `logRetentionDays` setting (default 90 days). A second weekly job hard-deletes rows where `archived_at` is older than 7 days. Exclude currently running executions from archival.

**Files**
- `packages/db/src/schema/`
- `apps/api/src/executions/` (new archive job)

**Acceptance criteria**
- [ ] Logs older than retention period get `archived_at` set on daily run
- [ ] Logs with `archived_at` older than 7 days get hard-deleted on weekly run
- [ ] Logs for active executions are not archived
- [ ] Job runs without locking the table (use batched deletes with LIMIT)

---

### ISSUE-035: Add workspace-level default log level setting

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2C — Logging Restructure

**Problem**
Every workflow currently has its own `log_level` setting. New workflows default to whatever is hardcoded in the service, not what the workspace operator prefers. There is no way to set "all workflows in this workspace should log at info level by default."

**What to do**
Add `defaultLogLevel: enum(none|errors|info|debug)` to the workspace settings table (default `info`). When creating a new workflow, inherit the workspace default. Expose the setting in the workspace general settings page. Existing workflows keep their individually configured level.

**Files**
- `packages/db/src/schema/` (workspaces table)
- `apps/api/src/workspaces/workspaces.service.ts`
- `apps/web/app/(dashboard)/settings/general/page.tsx`

**Acceptance criteria**
- [ ] Set workspace default to `errors` → new workflows created with `log_level: errors`
- [ ] Existing workflows unaffected
- [ ] General settings page shows and updates the default log level

---

### ISSUE-036: Log execution lifecycle events to audit log

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2D — Audit Log Completion

**Problem**
The audit log captures resource CRUD (create workflow, delete pod) but completely ignores runtime events. There is no audit trail for when executions start, succeed, fail, or are suspended. This makes it impossible to audit "who triggered what and when" for compliance purposes.

**What to do**
In `execution.processor.ts`, after the execution transitions to each terminal or notable state, call `auditService.log()`:
- On queue pick-up: `execution.started` with `{ workflowId, triggeredBy, inputHash }`
- On completion: `execution.completed` with `{ duration, tokenUsage, nodeCount }`
- On failure: `execution.failed` with `{ errorSummary }` (first 500 chars of error)
- On suspension: `execution.suspended` with `{ nodeId, reason }`
- On resumption: `execution.resumed` with `{ respondedBy }`

**Files**
- `apps/api/src/executions/queue/execution.processor.ts`
- `apps/api/src/audit/audit.service.ts`

**Acceptance criteria**
- [ ] Run a workflow → audit log shows `execution.started` and `execution.completed` entries
- [ ] Fail a workflow intentionally → `execution.failed` entry appears with error summary
- [ ] Suspend and approve → both `execution.suspended` and `execution.resumed` entries appear

---

### ISSUE-037: Log API key usage to audit log

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2D — Audit Log Completion

**Problem**
When an `lnk_` SDK API key is used to authenticate a request, there is no record in the audit log. If an API key is leaked and used maliciously, there is no way to detect or investigate the usage after the fact.

**What to do**
In `ClerkAuthGuard`, when authentication succeeds via `UsersService.findByApiKey()` (the `lnk_` path), call `auditService.log()` with: `action: 'api_key.used'`, `resourceType: 'api_key'`, `resourceId: apiKey.id`, `metadata: { endpoint: request.url, method: request.method }`.

**Files**
- `apps/api/src/common/guards/clerk-auth.guard.ts`
- `apps/api/src/audit/audit.service.ts`

**Acceptance criteria**
- [ ] Make an API call with `lnk_` key → audit log entry created
- [ ] Entry includes the endpoint and HTTP method
- [ ] Bearer token (Clerk) authentication does not create audit entries (too high volume)

---

### ISSUE-038: Add pagination to audit log API

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2D — Audit Log Completion

**Problem**
The audit log query has a hardcoded `LIMIT 500` (or similar). Workspaces with high activity will hit this limit, silently dropping older entries from the response. There is no way to page through the full audit history.

**What to do**
Replace the hardcoded limit with cursor-based pagination: `?cursor=<auditLogId>&limit=<n>` (default 50, max 200). Return `{ logs: AuditLog[], nextCursor: string | null }`. Update the audit log UI to use paginated fetching with a "Load more" button.

**Files**
- `apps/api/src/audit/audit.controller.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/web/app/(dashboard)/audit/page.tsx`

**Acceptance criteria**
- [ ] `GET /audit-logs?limit=50` returns 50 entries and a cursor
- [ ] Next page returns the next 50 in correct chronological order
- [ ] UI "Load more" appends results without resetting the filter state

---

### ISSUE-039: MCP server background health check job

**Labels:** `sprint-2` `be` `feature`
**Phase:** 2E — MCP Health Checks

**Problem**
MCP server `status` field exists in the schema but is never updated. The status shown in the UI (`unknown` by default) is always stale. Users cannot tell whether a configured MCP server is reachable until they actually try to use it in a workflow execution — at which point the failure surfaces mid-execution.

**What to do**
Create a BullMQ repeatable job (`MCP_HEALTH_JOB`, every 5 minutes) that: fetches all `mcp_servers` across all workspaces, makes a lightweight ping request to each (e.g., `GET /` or the MCP info endpoint), updates `status` to `connected` on 2xx or `error` on failure, writes the error message to `lastError`, and updates `lastCheckedAt`.

**Files**
- `apps/api/src/mcp/mcp.service.ts`
- `apps/api/src/mcp/mcp-health.job.ts` (new)
- `packages/db/src/schema/` (add `lastError`, `lastCheckedAt` columns to `mcp_servers`)

**Acceptance criteria**
- [ ] Healthy MCP server → status becomes `connected` within 5 minutes
- [ ] Unreachable server → status becomes `error`, `lastError` set
- [ ] `lastCheckedAt` timestamp updates on each run
- [ ] Job does not block execution queue workers

---

### ISSUE-040: Cache MCP tool discovery per server in Redis

**Labels:** `sprint-2` `be` `improvement`
**Phase:** 2E — MCP Health Checks

**Problem**
Every time an MCP node executes in a workflow, the executor fetches the available tools from the MCP server. This is an unnecessary network call on every execution — the tool list rarely changes. For workspaces with many executions hitting the same MCP server, this is wasteful and adds latency.

**What to do**
In `mcp.executor.ts` (or the node-executor dispatch path), after fetching the tool list from an MCP server, cache the result in Redis under key `mcp:tools:{mcpServerId}` with TTL of 5 minutes. On subsequent executions within the TTL, use the cached list. Invalidate the cache when the MCP server is updated or deleted.

**Files**
- `apps/api/src/mcp/mcp.service.ts`
- `apps/api/src/executions/engine/executors/mcp.executor.ts`

**Acceptance criteria**
- [ ] First call to MCP server → tool list fetched and cached
- [ ] Second call within 5 minutes → cache hit, no network request
- [ ] MCP server updated → cache invalidated, next call fetches fresh list
- [ ] Cache miss (expired or absent) → falls back to live fetch gracefully

---

### ISSUE-041: Show MCP server health status in UI

**Labels:** `sprint-2` `fe` `improvement`
**Phase:** 2E — MCP Health Checks

**Problem**
The MCP servers page and connections settings page show server URL and auth type but no connectivity status. Users cannot tell which servers are reachable without running a test execution.

**What to do**
On both the MCP servers page (`settings/mcp-servers`) and the connections page (`settings/connections`), add a status indicator next to each server: green dot for `connected`, red dot for `error`, grey dot for `unknown`. Show "Last checked X minutes ago" as a subtitle. Show `lastError` message in a tooltip on hover when status is `error`.

**Files**
- `apps/web/app/(dashboard)/settings/mcp-servers/page.tsx`
- `apps/web/app/(dashboard)/settings/connections/page.tsx`

**Acceptance criteria**
- [ ] Healthy server → green dot + "Last checked N min ago"
- [ ] Unreachable server → red dot + error tooltip
- [ ] Unknown (never checked) → grey dot + "Not yet checked"
- [ ] Status updates reflect within one page refresh after the health job runs

---

## Sprint 3 — Memory, Evals, Usage

---

### ISSUE-042: Replace zero-vector fallback with hard failure in EmbeddingService

**Labels:** `sprint-3` `be` `bug`
**Phase:** 3A — Memory Hardening

**Problem**
When the embedding API call fails (network error, rate limit, invalid key), `EmbeddingService` silently returns a zero-vector (all zeros) instead of throwing. Zero-vectors are catastrophically bad for cosine similarity search — every stored vector will appear equally "similar" to the zero vector, making semantic search return random results. This is a silent data corruption bug.

**What to do**
Remove the zero-vector fallback. Replace with: log the error with `this.logger.error()` and rethrow it. All callers of `EmbeddingService.embed()` must now handle the failure. In `memory.service.ts`, catch the error at the write path and return a structured error instead of silently writing corrupt data.

**Files**
- `apps/api/src/memory/embedding.service.ts`
- `apps/api/src/memory/memory.service.ts`

**Acceptance criteria**
- [ ] Embedding API fails → error thrown, logged, memory write aborted
- [ ] Retrieval queries where embedding fails → error returned, no search executed
- [ ] No zero-vectors written to the database
- [ ] Existing valid memory entries unaffected

---

### ISSUE-043: Paginate memory loading in agent context injection

**Labels:** `sprint-3` `be` `improvement`
**Phase:** 3A — Memory Hardening

**Problem**
`MemoryService.loadForExecution()` loads all memory entries for a session/thread into the agent's context. Long-running sessions can accumulate hundreds of entries. Injecting all of them into the system prompt inflates token usage, can exceed the context budget, and slows down every agent call in the session.

**What to do**
Add `limit: number` (default 20) and `offset: number` (default 0) parameters to `loadForExecution()`. Return the most-recent N entries by default (sorted by `createdAt` descending). Update the agent executor's memory injection call to use the default limit. Document that older entries beyond the limit are not injected unless explicitly requested.

**Files**
- `apps/api/src/memory/memory.service.ts` (`loadForExecution` method)
- `apps/api/src/executions/engine/executors/agent.executor.ts` (call site)

**Acceptance criteria**
- [ ] Session with 100 memory entries → agent context receives only 20 most recent
- [ ] `loadForExecution(wsId, threadId, { limit: 5 })` returns 5 entries
- [ ] Order is most-recent first (latest memory most prominent in context)

---

### ISSUE-044: Cap memory entry content size at 10KB

**Labels:** `sprint-3` `be` `improvement`
**Phase:** 3A — Memory Hardening

**Problem**
Memory entries have no size limit. An agent using `__memoryWrite` with a large tool result or document as the content can write multi-megabyte entries. These are stored in full, bloating the `memories` table and consuming excessive context budget when loaded back.

**What to do**
In `MemoryService.writeEntry()`, before inserting, check `content.length`. If it exceeds 10KB (10,240 bytes), truncate at 10KB and append `" [content truncated at 10KB]"`. Log a warning with the workspace ID and entry key. Do not throw — the write should still succeed with the truncated content.

**Files**
- `apps/api/src/memory/memory.service.ts` (`writeEntry` method)

**Acceptance criteria**
- [ ] Write a 50KB string → stored as 10KB + truncation marker
- [ ] Write a 5KB string → stored in full, no truncation
- [ ] Truncation warning appears in logs

---

### ISSUE-045: Integration test for cross-workspace memory isolation

**Labels:** `sprint-3` `be` `improvement`
**Phase:** 3A — Memory Hardening

**Problem**
Memory scoping is critical for B2B isolation — workspace A's memories must never be accessible to workspace B, even if they use the same `threadId`. There are no tests validating this isolation boundary.

**What to do**
Write a Jest integration test that: creates two workspaces (A and B), writes a memory entry in workspace A with `threadId: 'shared-thread-id'`, attempts to retrieve memories in workspace B with the same `threadId`, and asserts that the retrieval returns an empty result.

**Files**
- `apps/api/src/memory/memory.service.spec.ts` (new integration test)

**Acceptance criteria**
- [ ] Test passes: workspace B retrieves 0 entries for a thread owned by workspace A
- [ ] Test fails if `workspaceId` filter is removed from the query (proving it's load-bearing)
- [ ] Test runs in CI with `pnpm test`

---

### ISSUE-046: Add TTL support to memory entries

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3A — Memory Hardening

**Problem**
Memory entries persist indefinitely. There is no way to set session-scoped memories that expire after a conversation ends, or short-lived workflow-scoped memories that should be cleaned up after a run. Stale memories from old sessions continue to surface in future queries.

**What to do**
Add `expiresAt: timestamp` (nullable) column to the `memories` table. Update `MemoryService.writeEntry()` to accept an optional `ttlSeconds` parameter — if provided, set `expiresAt = now() + ttlSeconds`. In retrieval queries, add `WHERE (expires_at IS NULL OR expires_at > NOW())` filter. Add a daily BullMQ cron job that hard-deletes expired entries.

**Files**
- `packages/db/src/schema/` (memories table)
- `apps/api/src/memory/memory.service.ts`
- New cron job for cleanup

**Acceptance criteria**
- [ ] Memory written with `ttlSeconds: 3600` → `expiresAt` set to 1 hour from now
- [ ] Retrieval after TTL expiry → entry not returned
- [ ] Daily cleanup job removes expired rows
- [ ] Memories without TTL (`expiresAt: null`) never expire

---

### ISSUE-047: Evaluator node throws on missing API key instead of silent fail

**Labels:** `sprint-3` `be` `bug`
**Phase:** 3B — Evaluator Node Fixes

**Problem**
When `ANTHROPIC_API_KEY` (or the workspace Anthropic key) is not configured, `evaluator.executor.ts` silently returns `{ score: 0, passed: false, reasoning: "API key not configured" }` (lines 36–44). This is indistinguishable from a genuine "this output failed the evaluation" result. Workflows silently get a fail verdict when the node was never actually evaluated.

**What to do**
Replace the silent return with a hard throw: `throw new Error('Evaluator node requires an Anthropic API key. Configure it in workspace model keys (Settings → Model Keys).')` The node-executor supervisor will handle the error appropriately (retry, skip, or abort based on node configuration).

**Files**
- `apps/api/src/executions/engine/executors/evaluator.executor.ts` (lines 36–44)

**Acceptance criteria**
- [ ] Run evaluator node with no API key → execution fails with clear error message
- [ ] Error message contains the path to configure the key
- [ ] Run evaluator with valid API key → no change in behavior

---

### ISSUE-048: Evaluator node supports multiple weighted criteria

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3B — Evaluator Node Fixes

**Problem**
The evaluator node accepts a single `criteria` string. Real evaluation scenarios require scoring across multiple dimensions (accuracy, tone, completeness, safety) with different weights. There is no way to express multi-dimensional evaluation in a single node.

**What to do**
Add `criteriaList: { name: string, weight: number, description: string }[]` to the evaluator's `nodeData`. If `criteriaList` is provided, score each criterion independently in separate LLM calls (or a single structured call), then compute a weighted aggregate score. Return both the aggregate and per-criterion breakdown in the output.

**Files**
- `apps/api/src/executions/engine/executors/evaluator.executor.ts`
- `apps/web/components/workflow-builder/evaluator-panel.tsx` (add criteria list UI)

**Acceptance criteria**
- [ ] Evaluator with `criteriaList: [{name: 'accuracy', weight: 0.7}, {name: 'tone', weight: 0.3}]` → two scores computed, weighted aggregate returned
- [ ] Single `criteria` string still works as before (backward compatible)
- [ ] Panel UI allows adding/removing criteria with weights

---

### ISSUE-049: Evaluator node exposes per-criterion scores and reasoning

**Labels:** `sprint-3` `be` `improvement`
**Phase:** 3B — Evaluator Node Fixes

**Problem**
The evaluator currently returns `{ score, passed, reasoning }`. The `reasoning` is a single string. When using multiple criteria (ISSUE-048), users need per-criterion scores and reasoning to understand which dimension failed and why.

**What to do**
Update the output schema to `{ score, passed, reasoning, criteriaScores: { [criterionName]: { score, reasoning, passed } } }`. When a single criterion is used, `criteriaScores` contains one entry. This gives downstream nodes (and the evals UI) structured access to individual criterion results.

**Files**
- `apps/api/src/executions/engine/executors/evaluator.executor.ts`

**Acceptance criteria**
- [ ] Output includes `criteriaScores` object with per-criterion breakdown
- [ ] Each criterion entry has `score`, `reasoning`, and `passed` fields
- [ ] Aggregate `score` matches weighted sum of `criteriaScores`

---

### ISSUE-050: Eval framework — DB schema and dataset management

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3C — Evals Framework

**Problem**
The evals UI exists and shows test cases, but there is no backend infrastructure for managing evaluation datasets. Test cases are defined inline in the workflow definition and cannot be managed as a separate resource, versioned, or reused across workflows.

**What to do**
Create three new tables:
- `eval_datasets (id uuid PK, workspaceId uuid, workflowId uuid nullable, name text, description text, createdAt)`
- `eval_cases (id uuid PK, datasetId uuid FK, input JSONB, expectedOutput JSONB nullable, assertions JSONB, tags text[])`
- `eval_runs (id uuid PK, datasetId uuid FK, workflowId uuid, status enum(pending/running/completed/failed), results JSONB, passRate numeric, createdAt, completedAt)`

**Files**
- `packages/db/src/schema/`
- DB migration file

**Acceptance criteria**
- [ ] Migration runs without errors
- [ ] Foreign keys and indexes created correctly
- [ ] Existing tables unaffected

---

### ISSUE-051: Eval framework — Dataset and cases CRUD API

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3C — Evals Framework

**Problem**
Following ISSUE-050, the API layer for managing datasets and cases is missing.

**What to do**
Create `apps/api/src/evals/` NestJS module with:
- `POST /workspaces/:wsId/eval-datasets` — create dataset
- `GET /workspaces/:wsId/eval-datasets` — list datasets
- `GET /workspaces/:wsId/eval-datasets/:id` — get dataset with case count
- `DELETE /workspaces/:wsId/eval-datasets/:id` — delete dataset + all cases
- `POST /workspaces/:wsId/eval-datasets/:id/cases` — bulk insert cases (accepts JSON array or CSV upload)
- `GET /workspaces/:wsId/eval-datasets/:id/cases` — paginated case list
- `DELETE /workspaces/:wsId/eval-datasets/:id/cases/:caseId` — delete single case
Register `EvalsModule` in `app.module.ts`.

**Files**
- `apps/api/src/evals/` (new module)
- `apps/api/src/app.module.ts`

**Acceptance criteria**
- [ ] All endpoints return correct status codes and response shapes
- [ ] Bulk case insert accepts both JSON array and CSV (with `input` and `expectedOutput` columns)
- [ ] Role guard: editor minimum to create/delete

---

### ISSUE-052: Eval framework — Run API and BullMQ processor

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3C — Evals Framework

**Problem**
Following ISSUE-051, the run trigger and processing pipeline is missing.

**What to do**
- `POST /eval-datasets/:id/run` → creates an `eval_run` record (status: pending), enqueues one BullMQ job per case (up to 50 concurrent), returns `{ runId }`
- `GET /eval-datasets/:id/runs` → paginated run history with `passRate` and `status`
- `GET /eval-datasets/:id/runs/:runId` → full results per case
- BullMQ processor: for each case, calls `ExecutionsService.createFromTrigger()` with case `input`, polls until completion, compares output against `assertions`, writes `passed/failed` to the run result.

**Files**
- `apps/api/src/evals/evals.service.ts`
- `apps/api/src/evals/evals.processor.ts` (new BullMQ processor)

**Acceptance criteria**
- [ ] Trigger run on a 10-case dataset → all 10 executions created and tracked
- [ ] Run status updates from `pending` → `running` → `completed`
- [ ] `passRate` computed correctly (passed cases / total cases)

---

### ISSUE-053: Eval framework — Regression detection between runs

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3C — Evals Framework

**Problem**
When a new eval run completes, there is no comparison against the previous run. Developers cannot tell if a code change caused previously-passing test cases to start failing (a regression).

**What to do**
After an eval run completes, compare its per-case results against the most recent prior run on the same dataset. For each case that was `passed` in the prior run and is `failed` in the current run, mark it as a regression in the results. Expose `regressions: { caseId, input }[]` in the run result response.

**Files**
- `apps/api/src/evals/evals.service.ts`
- `apps/api/src/evals/evals.processor.ts`

**Acceptance criteria**
- [ ] Run that causes a previously-passing case to fail → `regressions` array contains that case
- [ ] First ever run on a dataset → `regressions: []` (no prior run to compare against)
- [ ] Run that fixes a failing case → not flagged as a regression

---

### ISSUE-054: Eval UI — Dataset manager and run history page

**Labels:** `sprint-3` `fe` `feature`
**Phase:** 3C — Evals Framework

**Problem**
The existing evals UI (`/evals`) shows test cases from the workflow definition inline. With the new dataset framework (ISSUE-050–053), users need a dedicated UI to manage datasets, upload cases, and view run history with regression diffs.

**What to do**
Build or extend the evals page to include: dataset list (create, delete, select), case management (view cases in a table, upload CSV/JSON, delete individual cases), run trigger button, run history table (timestamp, pass rate, regression count), and run detail view (per-case pass/fail with regression badges and diff vs previous run).

**Files**
- `apps/web/app/(dashboard)/evals/page.tsx`
- New sub-pages as needed

**Acceptance criteria**
- [ ] Create a dataset, upload 5 cases as JSON → cases visible in table
- [ ] Trigger a run → status updates in real time (poll every 3s while running)
- [ ] Run completes → pass rate shown, regressions highlighted in red
- [ ] Click a regression → shows old result vs new result side-by-side

---

### ISSUE-055: Write execution data to resource_usage table

**Labels:** `sprint-3` `be` `improvement`
**Phase:** 3D — Usage Tracking

**Problem**
The `resource_usage` table was designed to track per-execution resource consumption (CPU time, tokens, duration). It has never been written to. The table is dead code. Without this data, there is no way to compute actual per-execution costs, identify expensive workflows, or enforce resource-based billing in the future.

**What to do**
In `execution.processor.ts`, after an execution reaches a terminal state, insert a row into `resource_usage`: `{ executionId, workspaceId, durationMs: finishedAt - startedAt, inputTokens, outputTokens, totalTokens, nodeCount, queueWaitMs: startedAt - createdAt }`.

**Files**
- `apps/api/src/executions/queue/execution.processor.ts`
- `apps/api/src/quotas/` or `apps/api/src/executions/` (wherever the insert goes)

**Acceptance criteria**
- [ ] Run a workflow → `resource_usage` row created with correct values
- [ ] `durationMs` matches `finishedAt - startedAt` from the executions table
- [ ] `queueWaitMs` reflects time spent in BullMQ queue before pickup

---

### ISSUE-056: Add GET /quotas endpoint for user-facing quota visibility

**Labels:** `sprint-3` `be` `feature`
**Phase:** 3D — Usage Tracking

**Problem**
Users have no way to check their current quota usage via the API or the UI. The quota enforcement runs internally but is invisible until a user hits the limit and gets a 402 error. There is no endpoint to query remaining quota.

**What to do**
Add `GET /workspaces/:id/quotas` that returns: `{ executions: { used, limit, resetAt }, tokens: { used, limit }, percentages: { executions, tokens } }`. Read from the `resource_quotas` table. Protect with workspace member guard (any role can read their own workspace quotas).

**Files**
- `apps/api/src/quotas/quotas.controller.ts`
- `apps/api/src/quotas/quotas.service.ts`

**Acceptance criteria**
- [ ] `GET /quotas` returns correct used/limit values from `resource_quotas`
- [ ] `resetAt` is the monthly reset timestamp
- [ ] Percentages are 0–100 numbers, not strings

---

### ISSUE-057: Quota progress widget on dashboard home page

**Labels:** `sprint-3` `fe` `feature`
**Phase:** 3D — Usage Tracking

**Problem**
The dashboard home page has no visibility into quota consumption. Users discover they've hit the limit only when an execution fails with a 402 error — at which point they may have already lost important work.

**What to do**
Fetch `GET /workspaces/:id/quotas` on the dashboard home page. Show a compact widget with: execution quota progress bar (used / limit), token quota progress bar, reset date ("Resets on June 30"). Color the bar yellow at 80% and red at 95%. Link "Upgrade" to the billing settings page.

**Files**
- `apps/web/app/(dashboard)/page.tsx` (or `home/page.tsx`)

**Acceptance criteria**
- [ ] Dashboard shows execution and token quota bars
- [ ] Bar color changes at 80% (yellow) and 95% (red)
- [ ] Reset date shown
- [ ] Upgrade link navigates to billing page

---

### ISSUE-058: Compute and store estimated cost per execution

**Labels:** `sprint-3` `be` `improvement`
**Phase:** 3D — Usage Tracking

**Problem**
Token usage is tracked per execution but never converted to a cost estimate. Users and operators have no way to understand the monetary cost of running workflows, making it impossible to budget, optimize, or do cost attribution per workflow.

**What to do**
Add `estimatedCostUsd: numeric` column to the `executions` table. After execution completes, look up the model used (from execution logs or agent executor output), apply the known input/output token rates for that model, and compute `estimatedCostUsd`. Store it. Expose it in the execution detail API response, the metrics API, and the execution detail page.

**Files**
- `packages/db/src/schema/` (executions table)
- `apps/api/src/executions/queue/execution.processor.ts`
- `apps/api/src/executions/engine/models/registry.ts` (add pricing data)
- `apps/web/app/(dashboard)/pods/[podId]/executions/[id]/page.tsx`

**Acceptance criteria**
- [ ] Run an agent workflow → `estimatedCostUsd` populated in the executions table
- [ ] Execution detail page shows estimated cost (e.g., "$0.0042")
- [ ] Metrics API includes total estimated cost for the period

---

## Sprint 4 — Architecture + Security

---

### ISSUE-059: GDPR — Async data export endpoint

**Labels:** `sprint-4` `be` `security`
**Phase:** 4A — GDPR Data Export

**Problem**
There is no mechanism for users to export their data from Linea. Under GDPR Article 20, data subjects have the right to receive their personal data in a portable format. The absence of a data export endpoint is a legal compliance gap for EU users.

**What to do**
Create `POST /workspaces/:id/gdpr/export`. This endpoint: (1) creates a `gdpr_requests` record with `type: export, status: pending`, (2) enqueues a BullMQ job, (3) returns `{ requestId, message: "Export will be emailed when ready" }`. The job collects all workspace data into a ZIP and stores it at a signed URL with 24-hour expiry.

**Files**
- `apps/api/src/gdpr/` (new module)
- `apps/api/src/app.module.ts`
- `packages/db/src/schema/` (gdpr_requests table)

**Acceptance criteria**
- [ ] `POST /export` returns 202 with requestId
- [ ] `gdpr_requests` row created with `status: pending`
- [ ] BullMQ job queued
- [ ] Only workspace owner or admin can trigger export

---

### ISSUE-060: GDPR — Data export job and ZIP packaging

**Labels:** `sprint-4` `be` `security`
**Phase:** 4A — GDPR Data Export

**Problem**
Following ISSUE-059, the BullMQ processor that actually assembles and packages the export data is missing.

**What to do**
The export job processor fetches: workflow definitions, execution history (last 12 months, input/output), memory entries, knowledge base entries, audit logs, secret names (not values), member list. Serializes each as JSON. Packages all into a ZIP with one file per resource type. Stores the ZIP in the configured object storage (S3/R2), generates a signed 24-hour download URL, updates the `gdpr_requests` record to `status: completed, downloadUrl: <url>`, and sends the download link via email to the requesting user.

**Files**
- `apps/api/src/gdpr/gdpr.processor.ts` (new)
- Uses existing email service and storage adapter

**Acceptance criteria**
- [ ] Trigger export → ZIP contains files for each data type
- [ ] ZIP does not contain secret values (names only)
- [ ] Download URL works and expires after 24 hours
- [ ] `gdpr_requests` record updated to `completed`

---

### ISSUE-061: GDPR — Hard delete user account endpoint

**Labels:** `sprint-4` `be` `security`
**Phase:** 4B — GDPR Data Deletion

**Problem**
Under GDPR Article 17 (right to erasure), users must be able to permanently delete their account and associated data. Currently there is no endpoint to delete a user account. The workspace soft-delete does not cascade to all user data.

**What to do**
Add `DELETE /users/me` endpoint. It: (1) checks if the user is the sole owner of any workspace — if yes, blocks deletion with a message to transfer ownership or delete the workspace first; (2) removes the user from all workspace memberships; (3) calls Clerk's user deletion API; (4) soft-deletes the user record in the local DB; (5) creates a `gdpr_requests` record with `type: delete`. The actual data deletion happens asynchronously (personal data removed, contributions anonymized).

**Files**
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/users/users.service.ts`

**Acceptance criteria**
- [ ] Sole workspace owner tries to delete account → 400 with clear message
- [ ] Member tries to delete account → removed from workspaces, Clerk user deleted
- [ ] `gdpr_requests` record created for audit trail

---

### ISSUE-062: GDPR — Workspace hard delete with cascade

**Labels:** `sprint-4` `be` `security`
**Phase:** 4B — GDPR Data Deletion

**Problem**
Workspace deletion currently soft-deletes (sets `deletedAt`). Data remains in the database indefinitely. For GDPR compliance, a hard-delete path must exist that removes all workspace data permanently.

**What to do**
Add a hard-delete flag to `DELETE /workspaces/:id` (e.g., `?hard=true`, owner-only). When triggered: cascade-delete all related records (members, workflows, executions, execution_logs, memories, knowledge entries, secrets, schedules, webhooks, api_keys, mcp_servers). Run in a transaction. Log to `gdpr_requests`.

**Files**
- `apps/api/src/workspaces/workspaces.service.ts`
- `apps/api/src/workspaces/workspaces.controller.ts`

**Acceptance criteria**
- [ ] Hard delete removes all rows associated with the workspace across all tables
- [ ] Only workspace owner can trigger hard delete
- [ ] Operation runs in a DB transaction — fails completely or succeeds completely
- [ ] `gdpr_requests` record created

---

### ISSUE-063: GDPR — Log retention policy and daily cleanup job

**Labels:** `sprint-4` `be` `security`
**Phase:** 4B — GDPR Data Deletion

**Problem**
Execution logs are retained indefinitely. GDPR and general data minimization principles require that personal data not be kept longer than necessary. There is no automated cleanup for old execution logs.

**What to do**
Add `logRetentionDays: integer` (default 90) to workspace settings. Create a daily BullMQ cron job that queries each workspace's `logRetentionDays`, deletes `execution_logs` older than the configured period for that workspace (in batches of 1000 to avoid table locks), and logs the count of deleted rows.

**Files**
- `packages/db/src/schema/` (workspace settings)
- New cron job file
- `apps/web/app/(dashboard)/settings/general/page.tsx` (expose retention setting)

**Acceptance criteria**
- [ ] Set retention to 30 days → logs older than 30 days deleted on next daily run
- [ ] Batched delete: runs in batches of 1000, not one giant DELETE
- [ ] Active execution logs (running executions) not deleted
- [ ] Deletion count logged for audit purposes

---

### ISSUE-064: GDPR — Consent prompt on first login

**Labels:** `sprint-4` `fe` `security`
**Phase:** 4B — GDPR Data Deletion

**Problem**
There is no consent mechanism in place. GDPR requires that data processing be based on a lawful basis — for individual users, explicit consent is the most straightforward. Without a consent record, the platform cannot demonstrate compliance.

**What to do**
Add `gdprConsentAt: timestamp` (nullable) to the users table. After Clerk authentication, check if `gdprConsentAt` is null for the current user. If null, show a modal (non-dismissable) on first login explaining what data is collected and why. "Agree & Continue" button calls `PATCH /users/me/consent`, which sets `gdprConsentAt = now()`. Store the timestamp as proof of consent.

**Files**
- `packages/db/src/schema/` (users table)
- `apps/api/src/users/users.controller.ts` (`PATCH /users/me/consent`)
- `apps/web/` (consent modal component, shown on layout if `gdprConsentAt` is null)

**Acceptance criteria**
- [ ] New user logs in for the first time → consent modal appears, cannot be dismissed
- [ ] User clicks "Agree" → modal disappears, `gdprConsentAt` set in DB
- [ ] Returning user with consent → no modal
- [ ] `gdprConsentAt` timestamp visible in user record

---

### ISSUE-065: Per-workspace BullMQ queue isolation

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4C — Queue Isolation

**Problem**
All workflow executions across all workspaces share a single `EXECUTION_QUEUE`. A workspace running a slow or CPU-intensive workflow starves other workspaces' executions. This is particularly problematic for multi-tenant scenarios where one heavy user degrades the experience for all others.

**What to do**
Change execution queueing to use per-workspace queues: `exec:${workspaceId}`. In `executions.service.ts`, when adding a job, use the workspace-specific queue name. In `execution.processor.ts`, create workers dynamically for new queues (using BullMQ's `Worker` with the queue name). Keep a registry of active workers. Tear down workers that have been idle for 5 minutes.

**Files**
- `apps/api/src/executions/executions.service.ts`
- `apps/api/src/executions/queue/execution.processor.ts`

**Acceptance criteria**
- [ ] Two workspaces each trigger an execution → each has its own queue
- [ ] Worker created for each new queue, torn down after 5 min idle
- [ ] Total active workers capped at `CPU_CORES × 2`
- [ ] Existing execution behavior unchanged (same processor logic)

---

### ISSUE-066: Expose queue stats in metrics API

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4C — Queue Isolation

**Problem**
There is no visibility into queue health — how many jobs are waiting, how long they've been waiting, how many workers are active. This makes it impossible to detect queue backup or tune worker count.

**What to do**
In the metrics API (`GET /workspaces/:id/metrics`), add a `queue` section: `{ waiting: number, active: number, delayed: number, avgWaitMs: number }`. Read these from BullMQ's `Queue.getJobCounts()` and `Queue.getWaiting()`. Expose in the metrics dashboard.

**Files**
- `apps/api/src/metrics/metrics.service.ts`
- `apps/web/app/(dashboard)/metrics/page.tsx`

**Acceptance criteria**
- [ ] Metrics API includes `queue` section with job counts
- [ ] Metrics page shows queue depth and average wait time
- [ ] Values update on page refresh

---

### ISSUE-067: Cache model registry in Redis

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4D — Caching

**Problem**
The model registry (list of available models, their API keys, and fallback chains) is re-read from the database or recomputed on every workflow execution. For high-frequency workspaces, this is a repeated unnecessary DB query. The registry changes only when a user updates their model keys.

**What to do**
In `apps/api/src/executions/engine/models/registry.ts`, wrap the registry fetch in a Redis cache with key `model:registry:{workspaceId}` and TTL of 5 minutes. Invalidate (delete the key) whenever a workspace model key is created, updated, or deleted in `model-keys.service.ts`.

**Files**
- `apps/api/src/executions/engine/models/registry.ts`
- `apps/api/src/model-keys/model-keys.service.ts` (cache invalidation)

**Acceptance criteria**
- [ ] First execution → cache miss, DB query runs, result cached
- [ ] Second execution within 5 min → cache hit, no DB query
- [ ] Model key updated → cache invalidated, next execution gets fresh registry

---

### ISSUE-068: Cache decrypted secrets per workspace in Redis

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4D — Caching

**Problem**
Secrets are AES-256-GCM encrypted at rest. Every request that needs secrets (execution start, tool calls, integration nodes) performs a DB read + AES-GCM decryption. For high-frequency executions, this is repeated crypto work on every call.

**What to do**
In `secrets.service.ts`, after decrypting a secret, cache the plaintext value in Redis under `secret:{workspaceId}:{secretName}` with TTL of 60 seconds. On cache hit, return the cached value. Invalidate the specific key when a secret is updated or deleted. Use Redis `SET ... EX 60` with no persistence (`appendonly no` for secrets cache namespace).

**Files**
- `apps/api/src/secrets/secrets.service.ts`

**Acceptance criteria**
- [ ] First access → cache miss, decrypt, cache
- [ ] Second access within 60s → cache hit, no AES decrypt
- [ ] Secret updated → cache invalidated immediately
- [ ] Secret deleted → cached value invalidated

---

### ISSUE-069: Replace hardcoded list limits with cursor pagination

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4D — Caching

**Problem**
Multiple service methods use hardcoded limits (`LIMIT 500`, `LIMIT 100`, etc.) without pagination. This causes: silent data truncation (users with >500 executions can't see old ones), slow queries on large datasets, and high memory usage when loading large result sets into memory.

**What to do**
Audit all `db.query` calls with hardcoded limits. Replace with cursor-based pagination: add `?cursor=<id>&limit=<n>` to the affected API endpoints (default limit 50, max 200). Return `{ data: T[], nextCursor: string | null }`. Priority endpoints: execution list, audit logs, execution logs, webhook deliveries, knowledge entries.

**Files**
- Multiple service and controller files across `apps/api/src/`

**Acceptance criteria**
- [ ] All audited endpoints accept `cursor` and `limit` params
- [ ] Response includes `nextCursor: null` on last page
- [ ] Default limit is 50 (not 500)
- [ ] No hardcoded LIMIT values over 200 remain in service layer

---

### ISSUE-070: Pre-substitution variable size limit in node executor

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4D — Caching

**Problem**
In `node-executor.service.ts` (lines 214–217), variable substitution replaces `{{variableName}}` placeholders in node config strings. If a variable contains a large value (e.g., a 5MB HTTP response stored in a variable), substituting it into a node's instruction field creates a multi-megabyte string in memory. With many concurrent executions, this can cause OOM conditions.

**What to do**
Before performing substitution, compute the total size of all variables in the current state. If it exceeds 100KB, log a warning and truncate individual variable values at 10KB each before substituting. Variables in the raw `state.variables` object are unaffected — only the substituted strings are capped.

**Files**
- `apps/api/src/executions/engine/node-executor.service.ts` (lines 214–217)

**Acceptance criteria**
- [ ] State with a 5MB variable → substituted string capped at 10KB for that variable
- [ ] Warning logged with variable name and original size
- [ ] State with small variables (<100KB total) → no change in behavior

---

### ISSUE-071: Clamp agent budgetPct to valid range [0, 1]

**Labels:** `sprint-4` `be` `bug`
**Phase:** 4E — Executor Fixes

**Problem**
`agent.executor.ts` line 306 reads `budgetPct` from `nodeData.contextBudgetPct` without clamping. If a user sets this to `1.5` (150%) via the API or a malformed workflow definition, the executor requests 150% of the model's context window, causing API errors or silent truncation.

**What to do**
Add: `const budgetPct = Math.min(1, Math.max(0, nodeData.contextBudgetPct ?? 0.8));`

**Files**
- `apps/api/src/executions/engine/executors/agent.executor.ts` (line 306)

**Acceptance criteria**
- [ ] `contextBudgetPct: 1.5` → clamped to 1.0
- [ ] `contextBudgetPct: -0.1` → clamped to 0.0
- [ ] `contextBudgetPct: 0.8` → unchanged

---

### ISSUE-072: Fix IP address regex in guardrails executor

**Labels:** `sprint-4` `be` `bug`
**Phase:** 4E — Executor Fixes

**Problem**
The PII detection regex for IP addresses in `guardrails.executor.ts` (line 37) uses `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`. This matches invalid IPs like `999.888.777.666`. While not a security issue (it over-detects, not under-detects), it can cause false positives on version numbers like `1.2.3.4` style strings.

**What to do**
Replace with a regex that validates each octet is 0–255: `\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b`. Add a unit test for both valid IPs and edge cases like `999.999.999.999` and `1.2.3.456`.

**Files**
- `apps/api/src/executions/engine/executors/guardrails.executor.ts` (line 37)

**Acceptance criteria**
- [ ] `192.168.1.1` detected as IP → true positive
- [ ] `999.999.999.999` → not detected
- [ ] `1.2.3.456` → not detected
- [ ] `0.0.0.0` → detected

---

### ISSUE-073: Expand guardrails moderation vocabulary or integrate API

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4E — Executor Fixes

**Problem**
The moderation check in `guardrails.executor.ts` (line 51) uses a hardcoded list of 7 keywords. This is wholly inadequate for real content moderation — it will miss the vast majority of harmful content while catching benign text that happens to contain these words.

**What to do**
Two-track approach:
1. **If `OPENAI_API_KEY` is available in the workspace:** Route moderation requests through OpenAI's Moderation API (`POST https://api.openai.com/v1/moderations`). Map the response categories to Linea's violation types.
2. **Fallback (no OpenAI key):** Expand the keyword list from 7 to a comprehensive set (~200 terms) covering major categories. Document that this is a basic fallback.

**Files**
- `apps/api/src/executions/engine/executors/guardrails.executor.ts`

**Acceptance criteria**
- [ ] With OpenAI key: moderation call made to OpenAI API, categories mapped correctly
- [ ] Without OpenAI key: expanded keyword list used
- [ ] Both paths respect `actionOnViolation` setting (block/redact/warn)

---

### ISSUE-074: Log warning on invalid HTTP header JSON

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4E — Executor Fixes

**Problem**
In `http.executor.ts` line 84, if the `headers` field is a string that fails JSON parsing, the parse error is silently swallowed and the headers are simply omitted from the request. Users configuring a workflow with invalid header JSON will see the request succeed but without their intended headers — a confusing silent failure.

**What to do**
In the catch block for header JSON parsing, call `this.logger.warn()` (or use the execution logger) with: `"HTTP node: failed to parse headers JSON: <first 100 chars of the string>"`. Do not throw — the request should still proceed without the invalid headers.

**Files**
- `apps/api/src/executions/engine/executors/http.executor.ts` (line 84)

**Acceptance criteria**
- [ ] Invalid header JSON → warning logged with partial content
- [ ] Request still proceeds without the invalid headers
- [ ] Valid header JSON → no warning, headers applied normally

---

### ISSUE-075: Surface Notion filter JSON parse error

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4E — Executor Fixes

**Problem**
In `notion.executor.ts` line 108, if the user provides a `filter` parameter for `query_database` that is not valid JSON, the parse is silently skipped and the query runs without any filter. The user gets back all database records rather than the filtered subset, with no indication that their filter was ignored.

**What to do**
Replace the silent skip with a throw: `throw new Error('Notion query_database: filter must be valid JSON. Received: <first 100 chars>')`. This surfaces the misconfiguration clearly instead of returning incorrect results silently.

**Files**
- `apps/api/src/executions/engine/executors/notion.executor.ts` (line 108)

**Acceptance criteria**
- [ ] Invalid JSON filter → execution fails with descriptive error
- [ ] Valid JSON filter → query runs with filter applied
- [ ] No filter provided (null/undefined) → query runs without filter (unchanged)

---

### ISSUE-076: Make retriever node RRF weights configurable

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4E — Executor Fixes

**Problem**
The hybrid search in `KnowledgeService` uses hardcoded RRF weights of 0.7 (vector) and 0.3 (BM25 keyword) defined in `node-executor.service.ts` lines 517–518. Different use cases benefit from different balances — keyword-heavy searches (code, proper nouns) should weight BM25 higher; semantic searches should weight vector higher. Users have no way to tune this per-node.

**What to do**
Add `vectorWeight: number` (default 0.7) and `keywordWeight: number` (default 0.3) fields to `RetrieverNodeData`. Pass these through from `node-executor.service.ts` to `KnowledgeService.hybridSearch()`. Validate that `vectorWeight + keywordWeight === 1.0` (or normalize automatically). Expose the fields in `retriever-panel.tsx` as an advanced settings section.

**Files**
- `apps/api/src/executions/engine/node-executor.service.ts` (lines 517–518)
- `apps/api/src/knowledge/knowledge.service.ts` (`hybridSearch` signature)
- `apps/web/components/workflow-builder/retriever-panel.tsx`

**Acceptance criteria**
- [ ] Retriever with `vectorWeight: 1.0, keywordWeight: 0.0` → pure vector search
- [ ] Retriever with `vectorWeight: 0.5, keywordWeight: 0.5` → equal hybrid
- [ ] Default weights (no config) → 0.7/0.3 as before
- [ ] Panel shows weight sliders in advanced section

---

### ISSUE-077: Add deadline/timeout to approval nodes

**Labels:** `sprint-4` `be` `feature`
**Phase:** 4E — Executor Fixes

**Problem**
Approval nodes (via `interrupt()`) wait indefinitely for a human response (timeout = 0 in `node-executor.service.ts` lines 66–67). If an approver is on vacation or forgets, the execution hangs forever, consuming a worker slot and preventing the workflow from either completing or failing cleanly.

**What to do**
Add `deadlineHours: number` (optional, default: no deadline) to approval node data. When `deadlineHours` is set, schedule a BullMQ delayed job to check if the execution is still suspended after the deadline. If still suspended, auto-resume the execution with `{ approved: false, timedOut: true, reason: 'Approval deadline exceeded' }` and notify the workspace.

**Files**
- `apps/api/src/executions/engine/node-executor.service.ts`
- Approval handler / LangGraph interrupt resume path
- `apps/web/components/workflow-builder/approval-panel.tsx` (add deadline field)

**Acceptance criteria**
- [ ] Approval node with `deadlineHours: 24` → auto-rejected after 24 hours if not approved
- [ ] Auto-rejection sets `approved: false, timedOut: true` in resume payload
- [ ] Workspace notification sent on auto-rejection
- [ ] Approval without deadline → unchanged (waits indefinitely)

---

### ISSUE-078: Include node name in all executor error messages

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4E — Executor Fixes

**Problem**
When a node fails during execution, the error log in `node-executor.service.ts` includes `nodeId` but not `nodeName`. Debugging a failure in a large workflow requires cross-referencing the `nodeId` against the workflow definition to find the node. This is tedious and slows down debugging.

**What to do**
In `node-executor.service.ts`, wherever an error is logged or thrown with `nodeId`, also include `nodeName` (which is available from the node definition). Update the error message format to: `"[NodeName (nodeId)] Error: <message>"`.

**Files**
- `apps/api/src/executions/engine/node-executor.service.ts`

**Acceptance criteria**
- [ ] Node failure log includes both `nodeId` and `nodeName`
- [ ] Error message visible in execution detail page includes node name
- [ ] No change to the error propagation behavior

---

### ISSUE-079: Add per-node debug trace logging

**Labels:** `sprint-4` `be` `improvement`
**Phase:** 4E — Executor Fixes

**Problem**
There is no way to trace what variables a node received as input, what it returned, and how long each step took. Debugging complex multi-node workflows requires inserting manual logging or guessing from the node outputs. This is particularly painful for workflows with branching logic or loops.

**What to do**
When `workflow_log_level === 'debug'`, emit a log entry at node start: `{ level: 'debug', message: 'Node started', nodeId, nodeName, inputKeys: Object.keys(variables) }` and at node end: `{ level: 'debug', message: 'Node completed', nodeId, nodeName, durationMs, outputKeys: Object.keys(output) }`. These are written to `execution_logs` as debug-level entries and streamed via SSE.

**Files**
- `apps/api/src/executions/engine/node-executor.service.ts`

**Acceptance criteria**
- [ ] Workflow with `log_level: debug` → start/end entries for every node in execution logs
- [ ] `log_level: info` → no debug entries (filtered out)
- [ ] `durationMs` in end entry matches actual node execution time

---

## Sprint 5 — Growth Features

---

### ISSUE-080: Install E2B SDK and implement code executor

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5A — Code Node

**Problem**
The code node executor (`code.executor.ts`) is intentionally disabled and throws an error. It requires a sandboxed execution environment. E2B (e2b.dev) provides managed sandboxes via API with 150ms cold start, support for Node.js and Python, and a simple SDK. This is the fastest path to enabling the code node without self-hosting Firecracker or Daytona.

**What to do**
Run `pnpm add @e2b/code-interpreter` in `apps/api`. Implement `code.executor.ts`: create an E2B sandbox for the specified language (`nodeData.language`: `javascript` or `python`), execute `nodeData.code` with the sandbox's `runCode()` method, capture stdout/stderr, close the sandbox, return `{ stdout, stderr, output }` where `output` is the final evaluated value.

**Files**
- `apps/api/src/executions/engine/executors/code.executor.ts`
- `apps/api/package.json`

**Acceptance criteria**
- [ ] Code node with `console.log('hello')` → stdout: "hello"
- [ ] Code node with a syntax error → stderr captured, execution fails with error output
- [ ] Python code node runs in Python 3 environment
- [ ] Sandbox is always closed in `finally` block (no leaked sandboxes)

---

### ISSUE-081: Code node timeout and variable injection

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5A — Code Node

**Problem**
Following ISSUE-080, two critical features are missing: timeout enforcement (user code could run forever) and access to workflow variables from within the code (making the node useful for data transformation).

**What to do**
- **Timeout:** Apply `nodeData.timeoutMs` (default 30,000ms, hard cap 120,000ms) as the E2B sandbox timeout. If the timeout is exceeded, the sandbox throws a timeout error — catch it and return a clear message: "Code execution timed out after Xs."
- **Variable injection:** Before running the code, serialize `state.variables` as a JSON string and inject it into the sandbox as `process.env.LINEA_VARIABLES` (Node.js) or an environment variable in Python. Document this in the code panel UI.

**Files**
- `apps/api/src/executions/engine/executors/code.executor.ts`
- `apps/web/components/workflow-builder/code-panel.tsx` (add documentation callout)

**Acceptance criteria**
- [ ] Code running `JSON.parse(process.env.LINEA_VARIABLES)` returns current workflow variables
- [ ] Code that sleeps for 60s with a 30s timeout → times out with clear message
- [ ] Hard cap: `timeoutMs: 200000` → capped to 120s

---

### ISSUE-082: Track code node execution cost and re-enable in builder

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5A — Code Node

**Problem**
E2B charges by sandbox runtime seconds. Without tracking this cost, code node usage cannot be attributed, limited by quota, or surfaced to users. Additionally, the code node panel in the builder is currently marked as disabled and needs to be re-enabled.

**What to do**
After each code node execution, record the sandbox runtime in seconds in `resource_usage` (the `computeSeconds` or similar column). In the builder, remove the `disabled` prop (or `isDisabled` flag) from the code node in the node type list. Remove the "coming soon" badge from `code-panel.tsx`.

**Files**
- `apps/api/src/executions/engine/executors/code.executor.ts`
- `apps/web/components/workflow-builder/code-panel.tsx`
- `apps/web/components/workflow-builder/` (node type palette)

**Acceptance criteria**
- [ ] Code node runtime written to resource_usage after each execution
- [ ] Code node appears as a regular (non-disabled) node in the builder palette
- [ ] Code panel shows no "coming soon" messaging

---

### ISSUE-083: Stripe Checkout flow and subscription management

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5B — Stripe Integration

**Problem**
Polar.sh is the only payment gateway. Stripe has broader global reach, especially for US and European enterprise customers who prefer or require Stripe for procurement compliance. Not offering Stripe limits the addressable market.

**What to do**
Install `stripe` package. Create `POST /billing/stripe/checkout` that creates a Stripe Checkout Session for the selected plan (Pro/Team/Enterprise), configured with `mode: subscription`, the plan's price ID, and a success/cancel redirect URL. Return `{ checkoutUrl }`.

**Files**
- `apps/api/src/billing/billing.service.ts`
- `apps/api/src/billing/billing.controller.ts`
- `apps/api/package.json`

**Acceptance criteria**
- [ ] `POST /billing/stripe/checkout` with `plan: 'pro'` returns a valid Stripe Checkout URL
- [ ] Checkout URL redirects to Stripe's hosted page
- [ ] Success redirect returns to the billing settings page with a `?success=true` param

---

### ISSUE-084: Stripe webhook handler and subscription sync

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5B — Stripe Integration

**Problem**
Following ISSUE-083, Stripe sends lifecycle events (subscription created, updated, cancelled, payment failed) to a webhook endpoint. Without handling these, workspace plan state will never update after checkout completes.

**What to do**
Create `POST /billing/stripe/webhook` decorated with `@Public()` and using raw body. Verify Stripe signature using `STRIPE_WEBHOOK_SECRET`. Handle events:
- `customer.subscription.created` / `updated` → update workspace `subscriptionStatus`, `currentPeriodEnd`, plan tier
- `customer.subscription.deleted` → downgrade to Free
- `invoice.payment_failed` → emit workspace notification, do not immediately downgrade

**Files**
- `apps/api/src/billing/billing.service.ts`
- `apps/api/src/billing/billing.controller.ts`

**Acceptance criteria**
- [ ] `customer.subscription.updated` → workspace plan updated in DB
- [ ] `customer.subscription.deleted` → workspace downgraded to Free
- [ ] Invalid signature → 400 rejected
- [ ] `invoice.payment_failed` → notification emitted, plan unchanged

---

### ISSUE-085: Add Stripe as payment option in billing settings UI

**Labels:** `sprint-5` `fe` `feature`
**Phase:** 5B — Stripe Integration

**Problem**
The billing settings page currently only shows Polar.sh payment options. Stripe needs to be surfaced as an alternative checkout method.

**What to do**
On the billing settings page, when a user clicks an upgrade plan card, show a payment method selector: "Pay with Polar" or "Pay with Stripe". Each option calls the respective checkout endpoint and redirects to the provider's hosted page. Both options should show the same plan details and pricing.

**Files**
- `apps/web/app/(dashboard)/settings/billing/page.tsx`

**Acceptance criteria**
- [ ] Upgrade plan card shows payment method options
- [ ] "Pay with Stripe" triggers the Stripe checkout flow
- [ ] "Pay with Polar" continues existing behavior
- [ ] Payment method selector is clearly labelled

---

### ISSUE-086: Linea Agent — workflow editing and knowledge tools

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5C — Linea Agent Tools

**Problem**
The Linea Agent can read workflow definitions and run them, but cannot modify them or interact with knowledge bases. Users asking "add a slack notification node to my workflow" or "add this document to my knowledge base" get a response of "I can't do that" rather than actual execution of the task.

**What to do**
Add to `apps/api/src/agent-chat/tools/`:
- `edit_workflow(workflowId, podId, patch)` — applies a JSON patch to the workflow definition and saves it. Returns the updated definition.
- `add_knowledge(knowledgeBaseId, content, title)` — adds a new entry to a knowledge base. Returns `entryId`.
- `search_knowledge(knowledgeBaseId, query, topK?)` — queries a knowledge base and returns top results.

**Files**
- `apps/api/src/agent-chat/tools/` (new tool files)
- `apps/api/src/agent-chat/agent-chat.service.ts` (register new tools)

**Acceptance criteria**
- [ ] Ask agent "add a wait node after node X in workflow Y" → workflow updated
- [ ] Ask agent "add this text to my knowledge base" → entry created
- [ ] Ask agent "what does my KB say about X" → search results returned in response

---

### ISSUE-087: Linea Agent — scheduling and debug tools

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5C — Linea Agent Tools

**Problem**
Following ISSUE-086, users want to manage schedules and debug executions conversationally.

**What to do**
Add:
- `create_schedule(workflowId, podId, cronExpr, label?)` — creates a schedule. Returns the schedule ID and next run time.
- `delete_schedule(scheduleId)` — removes a schedule.
- `debug_execution(executionId)` — fetches the execution detail, node logs, and error messages. Summarizes what succeeded, what failed, and suggests a likely fix based on the error.

**Files**
- `apps/api/src/agent-chat/tools/` (new tool files)

**Acceptance criteria**
- [ ] "Schedule my workflow to run every Monday at 9am" → schedule created with correct cron
- [ ] "Delete the Monday schedule" → schedule deleted
- [ ] "Why did execution X fail?" → agent uses `debug_execution`, explains the failure node and error

---

### ISSUE-088: Linea Agent — Builder mode vs Run mode

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5C — Linea Agent Tools

**Problem**
The Linea Agent is currently a general-purpose assistant. As the tool set grows (ISSUE-086, 087), the agent needs different personas depending on who is using it: a developer building workflows vs an end-user running them. A single system prompt and tool list cannot serve both effectively.

**What to do**
Add `mode: 'builder' | 'run'` to the agent session creation API and the `tasks/page.tsx` UI (a mode toggle). **Builder mode:** full tool access (create, edit, delete workflows, schedules, knowledge), system prompt focused on "you are a workflow automation assistant helping developers build Linea workflows." **Run mode:** read-only tools (run workflow, search knowledge, list executions), system prompt focused on "you are an assistant that helps users get work done by running their team's workflows."

**Files**
- `apps/api/src/agent-chat/agent-chat.service.ts`
- `apps/web/app/(dashboard)/tasks/page.tsx`

**Acceptance criteria**
- [ ] Mode toggle visible in the tasks page UI
- [ ] Builder mode: all tools available, developer-focused prompting
- [ ] Run mode: only read/run tools available, end-user-focused prompting
- [ ] Mode persists per session (stored on the session record)

---

### ISSUE-089: Slack node — thread replies and Block Kit support

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5D — Integration Expansions

**Problem**
The Slack executor supports `send_message` and `send_dm` with plain text only. Users building Slack notification workflows need to: (1) reply to existing message threads (for status updates), and (2) send rich formatted messages using Slack Block Kit (for interactive cards, structured data, buttons).

**What to do**
- Add `thread_ts?: string` parameter to `send_message` action — if provided, post as a reply in that thread.
- Add `blocks?: object[]` parameter to `send_message` and `send_dm` — if provided, send as Slack Block Kit blocks. Plain `text` becomes the fallback for notifications.

**Files**
- `apps/api/src/executions/engine/executors/slack.executor.ts`
- `apps/web/components/workflow-builder/slack-panel.tsx`

**Acceptance criteria**
- [ ] `send_message` with `thread_ts` → reply appears in thread
- [ ] `send_message` with `blocks` → rich message rendered in Slack
- [ ] Existing `send_message` without new params → unchanged behavior

---

### ISSUE-090: Gmail node — HTML body and thread reply support

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5D — Integration Expansions

**Problem**
The Gmail executor sends plain text emails only (line 37 in `gmail.executor.ts`). Marketing, notification, and transactional email use cases require HTML bodies. Users also cannot reply to an existing email thread — every `send_email` starts a new thread.

**What to do**
- Add `bodyHtml?: string` field to `send_email` action — if provided, construct a `multipart/alternative` MIME message with both `text/plain` (from `body`) and `text/html` (from `bodyHtml`) parts.
- Add `threadId?: string` field — if provided, set the Gmail `threadId` in the send request to reply within the existing thread.

**Files**
- `apps/api/src/executions/engine/executors/gmail.executor.ts`
- `apps/web/components/workflow-builder/gmail-panel.tsx`

**Acceptance criteria**
- [ ] `send_email` with `bodyHtml` → email received with HTML rendering
- [ ] `send_email` with `threadId` → appears as a reply in the specified thread
- [ ] `send_email` without new params → unchanged (plain text, new thread)

---

### ISSUE-091: GitHub node — assignees on create_issue and draft PR support

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5D — Integration Expansions

**Problem**
`create_issue` accepts labels but not assignees. `create_pr` cannot create draft PRs. These are common GitHub workflow needs — automatically assigning issues to team members or creating PRs for review before they're ready to merge.

**What to do**
- Add `assignees?: string[]` to `create_issue` action — pass through to GitHub API `assignees` field.
- Add `draft?: boolean` to `create_pr` action — pass through to GitHub API `draft` field.

**Files**
- `apps/api/src/executions/engine/executors/github.executor.ts`
- `apps/web/components/workflow-builder/github-panel.tsx`

**Acceptance criteria**
- [ ] `create_issue` with `assignees: ['username']` → issue created with assignee
- [ ] `create_pr` with `draft: true` → draft PR created (marked as draft in GitHub UI)
- [ ] Both params optional — existing behavior unchanged when omitted

---

### ISSUE-092: Notion node — typed property support on create_page

**Labels:** `sprint-5` `be` `feature`
**Phase:** 5D — Integration Expansions

**Problem**
`create_page` in the Notion executor uses the Notion API's `properties` field but only supports the default `title` property. Notion databases have typed properties (rich_text, number, select, date, checkbox, url, email). There is no way to set these from the workflow, making the Notion integration useful only for simple page titles.

**What to do**
Add `properties?: Record<string, { type: string, value: unknown }>` to the `create_page` action. Map each property to the correct Notion API property format based on `type`. Support at minimum: `rich_text`, `number`, `select`, `date`, `checkbox`, `url`, `email`. Surface in `notion-panel.tsx` as a key-value table with type selector.

**Files**
- `apps/api/src/executions/engine/executors/notion.executor.ts`
- `apps/web/components/workflow-builder/notion-panel.tsx`

**Acceptance criteria**
- [ ] `properties: { Status: { type: 'select', value: 'In Progress' } }` → Notion page created with Status set
- [ ] `properties: { Due: { type: 'date', value: '2026-12-31' } }` → date property set correctly
- [ ] Existing `create_page` without `properties` → unchanged (title only)
