# Pods Module

> Execution environments (pods) within a workspace — each pod scopes its own workflows, executions, schedules, and webhooks.

## Base Path
`/v1/workspaces/:workspaceId/pods`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a pod. Body: `{ name, slug }`. Returns created pod. |
| GET | `/` | viewer+ | List pods in the workspace. Returns `[{ id, name, slug, createdAt }]`. |
| GET | `/:id` | viewer+ | Get a pod. Returns pod with `slug` and workflow count. |
| PATCH | `/:id` | admin+ | Update pod name or slug. Body: `{ name?, slug? }`. Returns updated pod. |
| DELETE | `/:id` | admin+ | Delete a pod and cascade all workflows/executions. Returns 204. |

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

## Missing / Gaps

- **Pod settings**: no per-pod config (e.g. default model, execution concurrency limit) — only workspace-level settings exist
- **Pod-level RBAC**: pod membership inherits workspace roles; there's no way to restrict a member to specific pods
- **Usage stats**: no `GET /:id/stats` for pod-level execution counts or quota usage

## Status

Stable.
