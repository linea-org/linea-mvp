# Audit Module

> Immutable audit log of workspace actions — written by other modules, readable by admins.

## Base Path
`/v1/workspaces/:workspaceId/audit-logs`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | admin+ | List audit log entries. Query: `{ action?, actorId?, resourceType?, resourceId?, from?, to?, cursor?, limit? }`. Returns paginated `AuditLog[]`. |

## Key Types

- `AuditLog` — `{ id, workspaceId, actorId, action, resourceType, resourceId, metadata, createdAt }`

## Business Logic

- `AuditService.log(...)` is called fire-and-forget (`void`) by other modules — never blocks the request
- Common actions: `kb.create`, `kb.delete`, `workflow.create`, `workflow.delete`
- Entries are append-only; no update or delete endpoints

## Dependencies

- Imported by `KnowledgeModule`, `WorkflowsModule`, and others — not the other way around

## Changelog

_No recent changes._

## Missing / Gaps

- **Export**: no `GET /export` (CSV/JSON) for compliance reporting — admins must paginate manually
- **Coverage**: only `KnowledgeModule` and `WorkflowsModule` call `AuditService.log`; modules like `SecretsModule`, `MembersModule`, and `OAuthModule` are not audited
- **Retention policy**: no auto-purge after N days; log grows unbounded

## Status

Stable.
