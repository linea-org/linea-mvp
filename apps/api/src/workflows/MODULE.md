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

## Seed Script

Built-in templates can be re-seeded without restarting the API:

```
pnpm --filter api seed:templates
```

This deletes all rows with `source = 'internal'` and re-inserts all 13 templates from `templates.data.ts`. Safe to run multiple times.

## Template Data Architecture

Built-in template definitions live in **`src/workflows/templates.data.ts`** (not in the seeder class). This is the single source of truth — both the NestJS boot seeder (`templates.seeder.ts`) and the CLI seed script import from it.

All 13 start nodes carry:
- `triggerType: 'manual' | 'webhook'` — drives the chat panel input area UI
- `inputVariables: Array<{ name, type, required }>` — schema for context/payload fields
- `testInput: Record<string, string>` — default values pre-loaded in the chat panel

### Canonical input model

| Concept | Variable | Workflow expression |
|---------|----------|---------------------|
| Primary human text | `message` | `{{input.message}}` |
| Supplementary context | named var | `{{input.knowledgeBaseId}}` etc. |
| Webhook payload field | named var | `{{input.url}}` etc. |

For `manual` triggers, `{{input.message}}` maps to the chat textarea. `inputVariables` are supplementary context fields rendered alongside the textarea. For `webhook` triggers, there is no textarea — all `inputVariables` are the full payload.

### Trigger type distribution (13 templates)

**`webhook` (9 templates)** — automation workflows with no human chat aspect:
Web Scraper & Summarizer, Slack Daily Digest, Data Extraction Pipeline, Batch Article Summarizer, Parallel Competitor Monitor, AI Lead Qualifier, Scheduled Metrics Digest, GitHub PR Auto-Reviewer, Notion CRM Lead Pipeline

**`manual` (4 templates)** — conversational workflows where the user types the primary input:
RAG Knowledge Base Q&A (`{{input.message}}` = user question, `knowledgeBaseId` in context), GitHub Issue Triage (`{{input.message}}` = issue body, `owner`/`repo` in context), Content Safety Moderator (`{{input.message}}` = content to review, `platform`/`contentId`/`moderationWebhook` in context), Approval Workflow (`{{input.message}}` = request text, `callbackUrl` in context)

## Changelog

### 2026-06-13 (LIN-16)
- Re-categorized 8 automation templates from `manual` → `webhook` (they have no human chat aspect)
- Updated 4 conversational templates to use `{{input.message}}` instead of named `inputVariables` for their primary user input (`question`, `issueBody`, `content`, `request` removed from inputVariables — `{{input.message}}` used in their place in all agent prompts)
- Trigger type distribution corrected: 9 webhook + 4 manual = 13 total

### 2026-06-13 (earlier)
- Extracted `BUILT_IN_TEMPLATES` array from `templates.seeder.ts` into `templates.data.ts` — NestJS seeder now imports from there
- Added `scripts/seed-templates.ts` — standalone CLI seed script (`pnpm --filter api seed:templates`)
- Added `triggerType`, `inputVariables`, and `testInput` to all 13 built-in template start nodes

## Missing / Gaps

- **Version diff endpoint**: no `GET /:id/versions/:v/diff` to compare two version graphs — clients must diff manually
- **Bulk workflow export/import**: no way to export all workflows in a pod as a ZIP or import from external JSON
- **Eval test case management**: evals accept inline test cases only — no endpoint to manage a persistent test-case library
- **Presence TTL endpoint**: presence staleness is client-enforced (30 s); no server-side cleanup or `DELETE /:id/presence` to explicitly leave

## Status

Stable.
