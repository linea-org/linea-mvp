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
| `nodes/custom-node.tsx` | Base ReactFlow node component. Renders the node card, status badge, and output preview strip. |
| `nodes/` | Individual ReactFlow node components (one per node type). |

## Chat Preview Panel

The panel sends `POST /executions` with `{ workflowId, input }` and connects to the SSE stream for real-time trace output.

**Input modes** (pill tabs above the textarea):

| Mode | Trigger | Input sent |
|------|---------|-----------|
| Text | Enter | `{ message: "<text>" }` |
| JSON | Ctrl+Enter | Parsed JSON sent directly as `input` |

JSON mode **simulates a webhook payload** — the execution engine receives the JSON identically to a real inbound webhook, with no URL, secret, or HMAC signing needed. User messages sent in JSON mode are rendered with a muted `Simulated` badge to distinguish them from text runs.

**SSE event format** — NestJS serialises `MessageEvent` objects as `data: {"data":{...},"id":"..."}`. The client unwraps `parsed.data` before dispatching the event.

**Duplicate-terminal guard** — `terminalShownRef` ensures `execution_complete` / `execution_failed` is rendered exactly once even when the SSE event, the `execution_status` sync, and the REST fallback all fire within the same turn.

**Token refresh** — Clerk dev tokens expire in ~30 s. `getTokenRef` (updated every render, read from stable callbacks) ensures a fresh token is fetched before every API call and SSE reconnect.

## Canvas Node Output Preview

After an execution completes, `index.tsx` writes `_outputPreview` (a truncated string of the node's output) into each node's `data`. `custom-node.tsx` reads this field and renders a compact preview strip at the bottom of the node card. Hovering the strip shows a `Tooltip` with the full value (max `max-w-xs`). The field is prefixed with `_` to mark it as ephemeral canvas state — it is never persisted to the workflow graph.

## Changelog

### 2026-06-13 (LIN-15)
- Added **node output preview strip** in `nodes/custom-node.tsx` — after execution, each node card shows a truncated `_outputPreview` string below its content
- Preview uses Radix `Tooltip` (upgraded from a plain `title` attribute) for styled hover display
- `_outputPreview` is written by `index.tsx` post-execution and is not persisted to the workflow definition

### 2026-05-28
- Added **JSON simulation mode** with `Text | JSON` pill tabs, `Simulated` badge on user bubbles, Ctrl+Enter submit, and inline JSON parse error
- Fixed SSE event unwrap (NestJS `MessageEvent` wrapper was causing all events to have `type: undefined`)
- Fixed scroll: replaced Radix `ScrollArea` with native `overflow-y-auto min-h-0` div
- Fixed duplicate terminal messages via `terminalShownRef`
- Fixed Clerk token expiry with per-call `getToken()` refresh
- Removed all custom accent colors — UI now uses muted/foreground palette only
- Added node step trace (`StepsTrace` / `StepRow`) with collapsible output and agent tool-call viewer
- Added human approval and tool-approval flow (Allow/Deny buttons inline in the chat)
