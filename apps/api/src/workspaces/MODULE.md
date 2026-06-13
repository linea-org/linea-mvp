# Workspaces Module

> Core workspace management — CRUD, member roles, email invites, and workspace-level AI settings.

## Base Path
`/v1/workspaces`

## Endpoints

### Workspace CRUD

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | authenticated | Create a workspace. Body: `{ name, slug }`. Creator is assigned `owner` role. Returns created workspace. |
| GET | `/` | authenticated | List workspaces the current user belongs to. Returns array with current user's role per workspace. |
| GET | `/:id` | viewer+ | Get a workspace. Returns `{ id, name, slug, settings }`. |
| PATCH | `/:id` | admin+ | Update workspace. Body: `{ name?, slug? }`. Returns updated workspace. |
| DELETE | `/:id` | owner | Delete workspace and cascade all data. Returns 204. |

### Settings

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/:id/settings` | viewer+ | Get workspace AI settings. Returns `WorkspaceSettings` JSONB: default model, `ragChunkSize`, `ragSimilarityThreshold`, etc. |
| PATCH | `/:id/settings` | admin+ | Update workspace AI settings. Body: partial `WorkspaceSettings`. Returns updated settings. |

### Members

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/:id/members` | viewer+ | List members. Returns `[{ userId, email, name, role }]`. |
| PATCH | `/:id/members/:userId` | admin+ | Change a member's role. Body: `{ role: WorkspaceMemberRole }`. Returns updated member. |
| DELETE | `/:id/members/:userId` | admin+ | Remove a member. Returns 204. Blocked if removing last owner. |

### Invites

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/:id/invites` | admin+ | Create an email invite. Body: `{ email, role }`. Returns invite with signed token link. |
| GET | `/:id/invites` | admin+ | List pending invites. Returns `[{ id, email, role, expiresAt, createdAt }]`. |
| DELETE | `/:id/invites/:inviteId` | admin+ | Revoke a pending invite. Returns 204. |

## Key Types

- `CreateWorkspaceDto` — `{ name, slug }`
- `UpdateWorkspaceDto` — `{ name?, slug? }`
- `UpdateWorkspaceSettingsDto` — workspace-level RAG and AI defaults
- `InviteMemberDto` — `{ email, role }`
- `UpdateMemberRoleDto` — `{ role: WorkspaceMemberRole }`
- `WorkspaceMemberRole` — `owner | admin | editor | viewer`

## Business Logic

- **Invite flow**: `POST /:id/invites` generates a signed token link; accepting the invite (handled by auth webhook) creates a `workspace_members` row with the specified role
- **Owner protection**: an owner cannot demote themselves or leave a workspace that has no other owner; `DELETE /:id` is owner-only and cascades all data
- **Settings cascade**: workspace settings serve as the default for pod and KB-level overrides; the `WorkspaceSettings` JSONB stores `ragChunkSize`, `ragSimilarityThreshold`, default model, etc.
- **Slug uniqueness**: slug must be globally unique; used in public URLs

## Dependencies

- No module imports (other modules import `WorkspacesModule`)
- `WorkspaceGuard` — exported from this module, used by all workspace-scoped modules

## Changelog

### 2026-06-13 (LIN-16)
- Added `supervisorModel?: string` to `WorkspaceSettings` JSONB schema (`packages/db/src/schema/workspaces.ts`) — no DB migration needed (JSONB optional field)
- Added `supervisorModel` to `UpdateWorkspaceSettingsDto` with `@IsOptional() @IsString()` validation
- Settings UI (`app/(dashboard)/settings/models/page.tsx`) exposes a model picker for the supervisor model — loads from and saves to `PATCH /:id/settings`
- The execution supervisor reads this value via `resolveWorkspaceSupervisorModel()` in `NodeExecutorService` and passes it through `SupervisorContext.workspaceSupervisorModel`; if unset, the supervisor aborts with a clear message directing the user to Settings

## Missing / Gaps

- **Invite acceptance endpoint**: the accept-invite flow is handled by the Clerk auth webhook, so there's no REST endpoint to accept or decline an invite directly
- **Workspace transfer**: no `POST /:id/transfer` to change ownership to another member
- **Settings schema exposure**: no `GET /:id/settings/schema` to document which fields are valid — clients must know the `WorkspaceSettings` type out-of-band

## Status

Stable.
