# Agent Chat Module

> Streaming AI agent chat sessions within a workspace — maintains thread history and supports multi-turn conversations.

## Base Path
`/v1/workspaces/:workspaceId/agent`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/chat` | editor+ | Send a message; streams response via SSE or returns when complete |
| GET | `/sessions` | viewer+ | List chat sessions for the workspace |
| GET | `/sessions/:id` | viewer+ | Get a session with full message history |
| DELETE | `/sessions/:id` | editor+ | Delete a session |

## Key Types

- `CreateChatMessageDto` — `{ sessionId?, message, model? }`

## Business Logic

- Sessions are persisted in `agent_chat_sessions` with `messages` as JSONB array
- Each session has a stable `threadId` used for LangGraph memory scoping

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Status

Stable.
