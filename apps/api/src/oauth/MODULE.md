# OAuth Module

> OAuth provider connections — authorize, store encrypted tokens, and refresh.

## Base Path
`/v1/workspaces/:workspaceId/oauth`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/providers` | viewer+ | List supported OAuth providers |
| GET | `/connections` | viewer+ | List active OAuth connections for the workspace |
| POST | `/:provider/authorize` | admin+ | Start OAuth flow — returns redirect URL |
| GET | `/:provider/callback` | public | OAuth callback — exchanges code for tokens |
| DELETE | `/connections/:id` | admin+ | Disconnect an OAuth connection |

## Business Logic

- Access and refresh tokens are stored encrypted in `oauth_connections`
- Token refresh is handled transparently when a workflow uses an OAuth-connected tool

## Dependencies

- `WorkspacesModule` — workspace guard
- `SecretsModule` — encryption utilities

## Changelog

_No recent changes._

## Status

Stable.
