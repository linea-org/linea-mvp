# Comments Module

> Threaded comments on workflows — create, resolve, pin, and react with emoji.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/workflows/:workflowId/comments`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create a comment (top-level or reply via `parentId`) |
| GET | `/` | viewer+ | List comments for a workflow |
| PATCH | `/:id` | editor+ | Edit comment body |
| DELETE | `/:id` | editor+ | Delete a comment |
| PATCH | `/:id/resolve` | editor+ | Mark comment thread as resolved |
| PATCH | `/:id/pin` | admin+ | Pin a comment |
| POST | `/:id/reactions` | viewer+ | Add emoji reaction |
| DELETE | `/:id/reactions/:emoji` | viewer+ | Remove emoji reaction |

## Dependencies

- `WorkspacesModule` — workspace + pod guard

## Changelog

_No recent changes._

## Status

Stable.
