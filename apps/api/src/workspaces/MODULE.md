# Workspaces Module

> Core workspace management — CRUD, member roles, email invites, and workspace-level AI settings.

## Base Path
`/v1/workspaces`

## Endpoints

### Workspace CRUD

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | authenticated | Create a workspace (creator becomes owner) |
| GET | `/` | authenticated | List workspaces the current user is a member of |
| GET | `/:id` | viewer+ | Get a workspace |
| PATCH | `/:id` | admin+ | Update name or slug |
| DELETE | `/:id` | owner | Delete workspace and all its data |

### Settings

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/:id/settings` | viewer+ | Get workspace AI settings (default model, RAG config, etc.) |
| PATCH | `/:id/settings` | admin+ | Update workspace AI settings |

### Members

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/:id/members` | viewer+ | List members with roles |
| PATCH | `/:id/members/:userId` | admin+ | Change a member's role |
| DELETE | `/:id/members/:userId` | admin+ | Remove a member |

### Invites

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/:id/invites` | admin+ | Create an email invite link |
| GET | `/:id/invites` | admin+ | List pending invites |
| DELETE | `/:id/invites/:inviteId` | admin+ | Revoke a pending invite |

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

_No recent changes._

## Status

Stable.
