# Comments Module

> Threaded comments on workflows — create, resolve, pin, and react with emoji.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/workflows/:workflowId/comments`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create a comment. Body: `{ body, parentId?, nodeId? }`. Returns created comment. |
| GET | `/` | viewer+ | List comments for the workflow. Returns comment tree with resolved status and reaction counts. |
| PATCH | `/:id` | editor+ | Edit comment body. Body: `{ body }`. Returns updated comment. |
| DELETE | `/:id` | editor+ | Delete a comment and its replies. Returns 204. |
| PATCH | `/:id/resolve` | editor+ | Mark comment thread as resolved. Sets `resolved: true`. Returns updated comment. |
| PATCH | `/:id/pin` | admin+ | Pin a comment to the top. Sets `pinned: true`. Returns updated comment. |
| POST | `/:id/reactions` | viewer+ | Add emoji reaction. Body: `{ emoji }`. Returns updated reaction counts. |
| DELETE | `/:id/reactions/:emoji` | viewer+ | Remove emoji reaction. Returns updated reaction counts. |

## Dependencies

- `WorkspacesModule` — workspace + pod guard

## Changelog

_No recent changes._

## Missing / Gaps

- **Unresolve**: no endpoint to clear `resolved` once a thread is marked resolved
- **Edit history**: no `GET /:id/history` to see prior versions of a comment body
- **Mention notifications**: `@user` mentions in comment body don't trigger notifications (NotificationsModule is not wired here)

## Status

Stable.
