# OAuth Module

> OAuth provider connections — authorize, store encrypted tokens, and refresh.

## Base Path
`/v1/workspaces/:workspaceId/oauth`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/providers` | viewer+ | List supported OAuth providers. Returns `[{ id, name, scopes }]`. |
| GET | `/connections` | viewer+ | List active OAuth connections. Returns `[{ id, provider, connectedAt, scopes }]`; tokens never exposed. |
| POST | `/:provider/authorize` | admin+ | Start OAuth flow. Body: `{ redirectUri? }`. Returns `{ authorizationUrl }` to redirect the user. |
| GET | `/:provider/callback` | public | OAuth callback. Query: `{ code, state }`. Exchanges code, stores encrypted tokens. Redirects to app. |
| DELETE | `/connections/:id` | admin+ | Disconnect an OAuth connection. Deletes stored tokens. Returns 204. |

## Business Logic

- Access and refresh tokens are stored encrypted in `oauth_connections`
- Token refresh is handled transparently when a workflow uses an OAuth-connected tool

## Dependencies

- `WorkspacesModule` — workspace guard
- `SecretsModule` — encryption utilities

## Changelog

_No recent changes._

## Missing / Gaps

- **Manual token refresh**: no `POST /connections/:id/refresh` to force a token refresh; refresh happens transparently only during workflow execution
- **Scope re-authorization**: no way to expand scopes on an existing connection — user must disconnect and reconnect
- **Connection health check**: no `GET /connections/:id/status` to verify token is still valid without running a workflow

## Status

Stable.
