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

**Execution start placeholder** — when `send()` is called, a synthetic trace message is immediately inserted with a `__placeholder` step that shows a typing/waiting indicator. The placeholder is replaced by the real `node_started` trace once the SSE stream delivers the first event. If the execution stays queued for more than 5 s, the placeholder upgrades its label to "Waiting in queue…" via a timer.

## Changelog

### 2026-06-13 (LIN-14)
- Added **execution start placeholder**: a typing bubble with a `__placeholder` step appears immediately after `send()`, before the first SSE event arrives
- 5 s queue-wait timer upgrades the placeholder label to "Waiting in queue…" if the first node hasn't started yet
- Placeholder is cleanly replaced (not appended to) when `node_started` fires — no double-message flash

### 2026-05-28
- Added **JSON simulation mode** with `Text | JSON` pill tabs, `Simulated` badge on user bubbles, Ctrl+Enter submit, and inline JSON parse error
- Fixed SSE event unwrap (NestJS `MessageEvent` wrapper was causing all events to have `type: undefined`)
- Fixed scroll: replaced Radix `ScrollArea` with native `overflow-y-auto min-h-0` div
- Fixed duplicate terminal messages via `terminalShownRef`
- Fixed Clerk token expiry with per-call `getToken()` refresh
- Removed all custom accent colors — UI now uses muted/foreground palette only
- Added node step trace (`StepsTrace` / `StepRow`) with collapsible output and agent tool-call viewer
- Added human approval and tool-approval flow (Allow/Deny buttons inline in the chat)
