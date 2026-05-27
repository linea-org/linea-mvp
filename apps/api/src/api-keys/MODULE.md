# API Keys Module

> Linea-issued API keys for workspace access — create, list, revoke, and expiry management.

## Base Path
`/v1/workspaces/:workspaceId/api-keys`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create an API key. Body: `{ label?, expiresAt? }`. Returns `{ id, key, label, expiresAt }` — raw `key` is only returned on creation. |
| GET | `/` | admin+ | List API keys. Returns `[{ id, label, keyPreview, createdAt, expiresAt, revokedAt }]` — raw key never returned again. |
| DELETE | `/:id` | admin+ | Revoke an API key. Sets `revokedAt`. Returns 204. |

## Key Types

- `CreateApiKeyDto` — `{ label?, expiresAt? }`

## Business Logic

- Raw key is returned only on creation; thereafter only `keyHash` is stored
- Revoked keys set `revokedAt`; expired keys are rejected by `ClerkAuthGuard` equivalent for API key auth

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Missing / Gaps

- **Key rotation**: no `POST /:id/rotate` to generate a new secret while keeping the same key record; must delete and recreate
- **Scope/permissions**: API keys grant full workspace access at the caller's role level — no fine-grained scope (e.g. read-only key)
- **Last-used tracking**: no `lastUsedAt` field; can't audit which keys are stale

## Status

Stable.
