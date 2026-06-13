# Workflow Builder

> Visual drag-and-drop editor for building, configuring, and testing workflows. Wraps ReactFlow with a custom node library, a properties toolbar, and a live chat preview panel.

## Entry Point

`components/workflow-builder/index.tsx` — exported as `<WorkflowBuilder>`. Consumed by `app/(dashboard)/[workspaceSlug]/[podSlug]/workflows/[workflowId]/page.tsx`.

## Key Files

| File | Purpose |
|------|---------|
| `index.tsx` | Root component. Owns the ReactFlow canvas, node CRUD, save/deploy logic, and its own SSE connection for canvas-level node badges. |
| `toolbar.tsx` | Right-side panel host. Renders either the node property editor or the deploy/webhook panel depending on selection. |
| `chat-preview-panel.tsx` | Live test panel. Sends executions via REST and streams results back over SSE, rendering a chat-style trace. |
| `panels/start-panel.tsx` | Start node property editor — trigger type, input variable schema, test values, cron schedule, extraction model. |
| `nodes/` | Individual ReactFlow node components (one per node type). |

## Chat Preview Panel

The panel sends `POST /executions` with `{ workflowId, input }` and connects to the SSE stream for real-time trace output.

On mount, `fetchDef()` reads the Start node's `triggerType`, `inputVariables`, and `testInput` from the workflow definition to drive the input area UI.

**Input area — controlled by `startTriggerType`:**

| Trigger | Input area | Payload sent |
|---------|-----------|--------------|
| `manual` | Textarea + optional collapsible "Context" fields | `{ message, conversationId, ...contextFields }` |
| `webhook` | Collapsible "Test payload" fields + "Run test" button (no textarea) | `{ ...contextFields }` |

Context field values are seeded from the Start node's saved `testInput` and are editable per-session (changes are local — to persist them, edit the Start node panel). A new `conversationId` UUID is generated per chat session.

**Markdown rendering** — workflow agent reply bubbles (role `'workflow'`) render through `react-markdown` with custom component overrides. Raw asterisks/headers/lists display as formatted text.

**JSON output viewer** — `JsonOrPre` helper renders node outputs as collapsible trees (via `react-json-view-lite`) when the value is or parses as a JSON object. Falls back to `<pre>` for plain strings.

**SSE event format** — NestJS serialises `MessageEvent` objects as `data: {"data":{...},"id":"..."}`. The client unwraps `parsed.data` before dispatching the event.

**Duplicate-terminal guard** — `terminalShownRef` ensures `execution_complete` / `execution_failed` is rendered exactly once even when the SSE event, the `execution_status` sync, and the REST fallback all fire within the same turn.

**Token refresh** — Clerk dev tokens expire in ~30 s. `getTokenRef` (updated every render, read from stable callbacks) ensures a fresh token is fetched before every API call and SSE reconnect.

## Start Panel

`panels/start-panel.tsx` — properties panel for the Start node. Manages:
- **Trigger selector** — Manual / Webhook / Schedule (3-column button grid)
- **Schedule config** — cron expression, human-readable preview, timezone, presets
- **Input variable schema** — name/type/required rows (shown for manual + webhook triggers)
- **Input extraction model** — model used to extract typed variables from a natural-language API message
- **Test values** — editable default values for each input variable, loaded into the chat panel when testing (shown for manual + webhook triggers)

## Changelog

### 2026-06-13 (LIN-16)
- Removed **Text | JSON** pill toggle from chat panel — replaced by inline context fields
- Added **inline context section** in chat panel: editable fields seeded from Start node's `testInput`, collapsible, persist across new chat sessions within a builder session
- Added **webhook trigger input mode**: "Test payload" fields + "Run test" button replaces textarea for webhook workflows
- Added `conversationId` UUID per chat session, included in manual trigger payloads
- Extended Start panel test values section to show for **webhook** trigger (was manual-only)
- Start panel "Input Variables" label renamed to **"Context Variables"** for manual triggers (webhook keeps "Input Variables")
- Added **markdown rendering** for workflow agent reply bubbles via `react-markdown`
- Added **JSON output viewer** (`react-json-view-lite`) in trace step output, node output on execution detail page, and execution input/output grid
- **`<think>` block filtering** — reasoning model streaming tokens (`wrapOnToken` in `agent.executor.ts`) and final output (`buildAgentResult`) both strip `<think>...</think>` so chain-of-thought text never appears in the chat bubble or approval modal
- **Supervisor model tour step** added in `app/(dashboard)/layout.tsx` targeting `[data-tour="supervisor-model"]` — explains why a supervisor model is needed and how to set one

### 2026-05-28
- Added JSON simulation mode with `Text | JSON` pill tabs (later removed in LIN-16)
- Fixed SSE event unwrap (NestJS `MessageEvent` wrapper)
- Fixed scroll, duplicate terminal messages, Clerk token expiry
- Added node step trace (`StepsTrace` / `StepRow`) with collapsible output and agent tool-call viewer
- Added human approval and tool-approval flow (Allow/Deny buttons inline in the chat)
