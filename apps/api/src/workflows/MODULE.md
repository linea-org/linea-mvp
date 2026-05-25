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
| POST | `/` | editor+ | Create a workflow. Body: `{ name, graph, description? }`. Returns created workflow. |
| GET | `/` | viewer+ | List workflows. Query: `{ search?, status?, cursor?, limit? }`. Returns paginated array with metadata. |
| GET | `/me/favorites` | viewer+ | Get favorited workflow IDs for the current user. Returns `string[]`. |
| GET | `/:id` | viewer+ | Get a workflow with full `graph`, metadata, and latest version number. |
| PATCH | `/:id` | editor+ | Update workflow. Body: partial `{ name?, graph?, description? }`. Auto-creates version snapshot if `graph` changes. Returns updated workflow. |
| DELETE | `/:id` | editor+ | Soft-delete workflow (sets `deletedAt`). Returns 204. |
| POST | `/:id/presence` | viewer+ | Upsert presence heartbeat. Body: `{}`. Returns array of other active users with `lastSeenAt`. |
| POST | `/:id/duplicate` | editor+ | Clone workflow within the same pod. Returns new workflow with cloned graph. |
| POST | `/:id/deploy` | admin+ | Mark workflow as deployed so triggers go live. Sets `deployed: true`. Returns updated workflow. |
| POST | `/:id/undeploy` | admin+ | Unpublish a deployed workflow. Sets `deployed: false`. Returns updated workflow. |
| GET | `/:id/versions` | viewer+ | List full version history. Returns `[{ versionNumber, createdAt, graph }]`. |
| GET | `/:id/versions/:v` | viewer+ | Get a specific version snapshot. Returns version with full `graph`. |
| POST | `/:id/versions/:v/restore` | editor+ | Restore workflow to a previous version. Copies version graph to current. Returns updated workflow. |
| PATCH | `/:id/star` | editor+ | Star or unstar a workflow. Body: `{ starred: boolean }`. Returns updated workflow. |
| PATCH | `/:id/trash` | editor+ | Move workflow to trash. Sets `deletedAt`. Returns updated workflow. |
| PATCH | `/:id/restore` | editor+ | Restore workflow from trash. Clears `deletedAt`. Returns updated workflow. |
| DELETE | `/:id/permanent` | editor+ | Permanently delete a trashed workflow. Hard-deletes the row. Returns 204. |
| PATCH | `/:id/template` | editor+ | Mark/unmark as a pod-level template. Body: `{ isTemplate: boolean }`. Returns updated workflow. |
| POST | `/:id/favorite` | viewer+ | Add workflow to personal favorites. Returns 201. |
| DELETE | `/:id/favorite` | viewer+ | Remove workflow from personal favorites. Returns 204. |
| POST | `/:id/publish` | admin+ | Publish workflow to the public gallery. Body: `{ title, description, category, tags? }`. Returns created public template. |
| PATCH | `/:id/log-settings` | admin+ | Configure log verbosity. Body: `{ verbosity: 'minimal' \| 'normal' \| 'verbose' }`. Returns updated workflow. |
| POST | `from-template/:templateId` | editor+ | Clone a public template into this pod. Returns new workflow cloned from the template. |
| POST | `/:id/generate` | editor+ | AI-generate a workflow from natural language via SSE. Body: `{ prompt, canvasContext?, history? }`. Streams token deltas then a final `workflow_json` event. |

### Public Templates (`/v1/templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | public | List public gallery templates. Returns paginated templates with upvote counts. |
| GET | `/me/upvoted` | user | Get upvoted template IDs for current user. Returns `string[]`. |
| GET | `/:id` | public | Get a gallery template. Increments `viewCount`. Returns template with full graph and stats. |
| POST | `/:id/upvote` | user | Toggle upvote on a template. Returns `{ upvoted: boolean, count: number }`. |
| PATCH | `/:id` | platform-admin | Update a gallery template. Body: partial template fields. Returns updated template. |
| DELETE | `/:id` | platform-admin | Delete a gallery template. Returns 204. |

### Evals (`/v1/workspaces/:wId/pods/:pId/workflows/:wfId/evals`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create an eval run. Body: `{ testCases: [{ input, expectedOutput? }] }`. Returns created eval run. |
| GET | `/` | viewer+ | List eval runs for the workflow. Returns array of eval runs with summary results. |
| GET | `/:id` | viewer+ | Get an eval run result with per-test-case pass/fail detail. |

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

## Missing / Gaps

- **Version diff endpoint**: no `GET /:id/versions/:v/diff` to compare two version graphs — clients must diff manually
- **Bulk workflow export/import**: no way to export all workflows in a pod as a ZIP or import from external JSON
- **Eval test case management**: evals accept inline test cases only — no endpoint to manage a persistent test-case library
- **Presence TTL endpoint**: presence staleness is client-enforced (30 s); no server-side cleanup or `DELETE /:id/presence` to explicitly leave

## Status

Stable.
