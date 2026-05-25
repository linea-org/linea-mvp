# MCP Module

> Model Context Protocol server registry — connect, test, and manage external MCP servers and their tool catalog.

## Base Path
`/v1/workspaces/:workspaceId/mcp-servers`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Register an MCP server |
| GET | `/` | viewer+ | List MCP servers with connection status |
| GET | `/:id` | viewer+ | Get an MCP server and its tools |
| PATCH | `/:id` | editor+ | Update server URL or auth config |
| DELETE | `/:id` | editor+ | Remove an MCP server |
| POST | `/:id/connect` | editor+ | Test connection and refresh tool list |

## Key Types

- `McpAuthType` — `none | api_key | bearer | oauth`
- `McpServerStatus` — `unknown | connected | error`

## Dependencies

- `WorkspacesModule` — workspace guard
- `SecretsModule` — encrypted auth credential storage

## Changelog

_No recent changes._

## Status

Stable.
