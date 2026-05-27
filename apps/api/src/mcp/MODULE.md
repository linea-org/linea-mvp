# MCP Module

> Model Context Protocol server registry — connect, test, and manage external MCP servers and their tool catalog.

## Base Path
`/v1/workspaces/:workspaceId/mcp-servers`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Register an MCP server. Body: `{ name, url, authType, authConfig? }`. Returns created server with `status: unknown`. |
| GET | `/` | viewer+ | List MCP servers. Returns `[{ id, name, url, status, toolCount }]`. |
| GET | `/:id` | viewer+ | Get an MCP server with full tool catalog. Returns server with `tools: [{ name, description, inputSchema }]`. |
| PATCH | `/:id` | editor+ | Update server URL or auth config. Body: partial `{ url?, authType?, authConfig? }`. Returns updated server. |
| DELETE | `/:id` | editor+ | Remove an MCP server and its tool catalog. Returns 204. |
| POST | `/:id/connect` | editor+ | Test connection and refresh tool list. Returns `{ status, tools[] }` after connecting. |

## Key Types

- `McpAuthType` — `none | api_key | bearer | oauth`
- `McpServerStatus` — `unknown | connected | error`

## Dependencies

- `WorkspacesModule` — workspace guard
- `SecretsModule` — encrypted auth credential storage

## Changelog

_No recent changes._

## Missing / Gaps

- **Tool invocation endpoint**: no `POST /:id/tools/:toolName/invoke` — tools are only callable from inside workflow nodes, not directly via the API
- **Auth secret rotation**: updating `authConfig` with a new API key requires a full PATCH; no dedicated `POST /:id/rotate-auth`
- **Auto-reconnect on deploy**: servers set `status: error` after a failed connection but there's no automatic retry — users must manually call `/:id/connect`

## Status

Stable.
