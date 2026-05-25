# Secrets Module

> Encrypted workspace secrets — API keys and tokens used by workflow nodes at runtime.

## Base Path
`/v1/workspaces/:workspaceId/secrets`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Store a secret (encrypted at rest) |
| GET | `/` | admin+ | List secrets (names only — values never returned) |
| DELETE | `/:id` | admin+ | Delete a secret |

## Business Logic

- Values are encrypted with `ENCRYPTION_KEY` (AES-256) before storage in `secrets.value_encrypted`
- Secret values are **never** returned via the API after creation; only names are listed
- Workflow nodes reference secrets by name; `NodeExecutorService` decrypts at execution time

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Status

Stable.
