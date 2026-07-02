# Connections Module

> Manage encrypted AI provider connections for a workspace.

## Base Path

`/v1/workspaces/:workspaceId/connections`

## Endpoints

| Method | Path         | Role   | Description                                                                                                                                                                                                                                                      |
| ------ | ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/:provider` | admin+ | Create or update a connection for the specified AI provider. The provider is supplied as a path parameter. The request body contains the provider-specific credentials and configuration. Secrets are encrypted at rest and are never returned in API responses. |
| GET    | `/`          | admin+ | List all configured providers for the workspace. Returns connection metadata (such as provider, enabled status, and timestamps). Secret values are never exposed.                                                                                                |
| DELETE | `/:id`       | admin+ | Delete a configured provider connection. Returns `204 No Content`.                                                                                                                                                                                               |

## Supported Providers

The `provider` path parameter must be one of:

- `anthropic`
- `openai`
- `google`
- `groq`
- `ollama`
- `xai`

Requests with any other provider value return `400 Bad Request`.

## Business Logic

- API keys and other sensitive credentials are encrypted using `ENCRYPTION_KEY_1` (AES-256) before being persisted.
- Secret values are never returned after creation.
- Each workspace manages its own provider connections.
- Only workspace administrators can create, list, or delete connections.
- Provider validation is performed before the connection is created.

## Dependencies

- `WorkspacesModule` — workspace resolution and authorization
- `WorkspaceGuard` — validates workspace access
- `RoleGuard` — enforces administrator permissions

## Status

Stable.
