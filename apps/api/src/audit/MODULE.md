# Audit Module

> Immutable audit log of workspace actions — written by other modules, readable by admins.

## Base Path
`/v1/workspaces/:workspaceId/audit-logs`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | admin+ | List audit log entries (filterable by action, actor, resource, date range) |

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

## Status

Stable.
