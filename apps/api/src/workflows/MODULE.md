# Workflows Module

> CRUD and lifecycle management for workflows within a pod — versioning, templates, public gallery, AI generation, evals, and presence tracking.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/workflows`

Also exposes a public templates route (no workspace scope):  
`/v1/templates`

And a workflow evals route:  
`/v1/workspaces/:workspaceId/pods/:podId/workflows/:workflowId/evals`

## Endpoints

### Workflows

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create a workflow |
| GET | `/` | viewer+ | List workflows (filterable by status, search, favorites) |
| GET | `/me/favorites` | viewer+ | Get IDs of workflows favorited by current user in this pod |
| GET | `/:id` | viewer+ | Get a workflow (graph, metadata) |
| PATCH | `/:id` | editor+ | Update workflow graph or metadata |
| DELETE | `/:id` | editor+ | Soft-delete (move to trash) |
| POST | `/:id/presence` | viewer+ | Upsert presence heartbeat; returns other active users |
| POST | `/:id/duplicate` | editor+ | Clone a workflow within the same pod |
| POST | `/:id/deploy` | admin+ | Mark workflow as deployed (triggers are live) |
| POST | `/:id/undeploy` | admin+ | Unpublish a deployed workflow |
| GET | `/:id/versions` | viewer+ | List full version history |
| GET | `/:id/versions/:v` | viewer+ | Get a specific version snapshot |
| POST | `/:id/versions/:v/restore` | editor+ | Restore workflow to a previous version |
| PATCH | `/:id/star` | editor+ | Star or unstar |
| PATCH | `/:id/trash` | editor+ | Move to trash |
| PATCH | `/:id/restore` | editor+ | Restore from trash |
| DELETE | `/:id/permanent` | editor+ | Permanently delete a trashed workflow |
| PATCH | `/:id/template` | editor+ | Mark/unmark as a pod-level template |
| POST | `/:id/favorite` | viewer+ | Add to personal favorites |
| DELETE | `/:id/favorite` | viewer+ | Remove from personal favorites |
| POST | `/:id/publish` | admin+ | Publish to the public gallery |
| PATCH | `/:id/log-settings` | admin+ | Configure log verbosity per workflow |
| POST | `from-template/:templateId` | editor+ | Clone a public template into this pod |
| POST | `/:id/generate` | editor+ | AI-generate a workflow from natural language (SSE stream) |

### Public Templates (`/v1/templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | public | List public gallery templates |
| GET | `/me/upvoted` | user | Get IDs of templates upvoted by current user |
| GET | `/:id` | public | Get a template (increments view count) |
| POST | `/:id/upvote` | user | Toggle upvote |
| PATCH | `/:id` | platform-admin | Update a gallery template |
| DELETE | `/:id` | platform-admin | Delete a gallery template |

### Evals (`/v1/workspaces/:wId/pods/:pId/workflows/:wfId/evals`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create an eval run |
| GET | `/` | viewer+ | List eval runs for a workflow |
| GET | `/:id` | viewer+ | Get an eval run result |

## Key Types

- `CreateWorkflowDto` — `{ name, graph, description? }`
- `UpdateWorkflowDto` — partial: `{ name?, graph?, description?, isDeployed? }`
- `ListWorkflowsDto` — `{ search?, status?, cursor?, limit? }`
- `GenerateWorkflowDto` — `{ prompt, canvasContext?, history? }`
- `PublishTemplateDto` — `{ title, description, category, tags? }`

## Business Logic

- **Versioning**: every `PATCH /:id` that changes the `graph` field creates a version snapshot automatically; versions are immutable
- **Trash flow**: `DELETE /:id` soft-deletes (sets `deletedAt`); `DELETE /:id/permanent` hard-deletes (only works on trashed workflows)
- **Deploy gate**: only `deployed` workflows can be triggered by webhooks, schedules, or public-run; `deploy` sets the flag, `undeploy` clears it
- **AI generation**: `POST /:id/generate` streams SSE events (token deltas + a final `workflow_json` event); uses `GenerateWorkflowService` with abort signal tied to request close
- **Presence**: `POST /:id/presence` upserts a `workflow_presence` row with `lastSeenAt = now()`; presence older than 30 s is considered stale on the client
- **Gallery templates**: publishing requires `admin+` role; `GlobalAdminGuard` gates platform-admin mutations

## Dependencies

- `WorkspacesModule` — workspace + pod guard
- `PodsModule` — pod guard
- `AuditModule` — logs `workflow.create`, `workflow.delete`

## Changelog

_No recent changes._

## Status

Stable.
