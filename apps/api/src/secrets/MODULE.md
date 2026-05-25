# Secrets Module

> Encrypted workspace secrets — API keys and tokens used by workflow nodes at runtime.

## Base Path
`/v1/workspaces/:workspaceId/secrets`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Store a secret encrypted at rest. Body: `{ name, value }`. AES-256 encrypts `value`. Returns `{ id, name, createdAt }` — value never returned. |
| GET | `/` | admin+ | List secrets. Returns `[{ id, name, createdAt }]` — encrypted values are never exposed. |
| DELETE | `/:id` | admin+ | Delete a secret. Returns 204. |

## Business Logic

- Values are encrypted with `ENCRYPTION_KEY` (AES-256) before storage in `secrets.value_encrypted`
- Secret values are **never** returned via the API after creation; only names are listed
- Workflow nodes reference secrets by name; `NodeExecutorService` decrypts at execution time

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Missing / Gaps

- **Secret update**: no `PATCH /:id` to rotate a secret value — must delete and recreate, breaking all nodes that reference the old name if the name changes
- **Secret versioning**: only the latest value is stored; there's no rollback to a prior value
- **Usage audit**: no tracking of which workflows reference a given secret — can't safely delete without knowing the blast radius

## Status

Stable.
