# API Keys Module

> Linea-issued API keys for workspace access — create, list, revoke, and expiry management.

## Base Path
`/v1/workspaces/:workspaceId/api-keys`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create an API key (returns raw key once only) |
| GET | `/` | admin+ | List API keys (hashed — raw key never returned again) |
| DELETE | `/:id` | admin+ | Revoke an API key |

## Key Types

- `CreateApiKeyDto` — `{ label?, expiresAt? }`

## Business Logic

- Raw key is returned only on creation; thereafter only `keyHash` is stored
- Revoked keys set `revokedAt`; expired keys are rejected by `ClerkAuthGuard` equivalent for API key auth

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Status

Stable.
