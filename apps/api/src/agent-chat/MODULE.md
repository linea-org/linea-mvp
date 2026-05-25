# Agent Chat Module

> Streaming AI agent chat sessions within a workspace — maintains thread history and supports multi-turn conversations.

## Base Path
`/v1/workspaces/:workspaceId/agent`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/chat` | editor+ | Send a message to the AI agent. Body: `{ sessionId?, message, model? }`. Creates session if `sessionId` omitted. Streams SSE token deltas or returns `{ reply }` when complete. |
| GET | `/sessions` | viewer+ | List chat sessions for the workspace. Returns `[{ id, title, createdAt, messageCount }]`. |
| GET | `/sessions/:id` | viewer+ | Get a session with full message history. Returns session with `messages` array of `{ role, content, createdAt }`. |
| DELETE | `/sessions/:id` | editor+ | Delete a session and its message history. Returns 204. |

## Key Types

- `CreateChatMessageDto` — `{ sessionId?, message, model? }`

## Business Logic

- Sessions are persisted in `agent_chat_sessions` with `messages` as JSONB array
- Each session has a stable `threadId` used for LangGraph memory scoping

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Missing / Gaps

- **Session rename**: no `PATCH /sessions/:id` to update the session title
- **Message export**: no endpoint to export session history as JSON or Markdown
- **Streaming abort**: no way for the client to cancel an in-flight SSE stream mid-response other than closing the connection

## Status

Stable.
