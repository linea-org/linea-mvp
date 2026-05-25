# Pods Module

> Execution environments (pods) within a workspace — each pod scopes its own workflows, executions, schedules, and webhooks.

## Base Path
`/v1/workspaces/:workspaceId/pods`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a pod |
| GET | `/` | viewer+ | List pods in the workspace |
| GET | `/:id` | viewer+ | Get a pod |
| PATCH | `/:id` | admin+ | Update pod name or slug |
| DELETE | `/:id` | admin+ | Delete a pod and all its workflows/executions |

## Key Types

- `CreatePodDto` — `{ name, slug }`
- `UpdatePodDto` — `{ name?, slug? }`

## Business Logic

- Pod slug must be unique within a workspace; used in webhook URLs
- `PodGuard` (exported from `PodsModule`) validates that `:podId` belongs to the current workspace — used by executions, workflows, schedules, webhooks

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Status

Stable.
