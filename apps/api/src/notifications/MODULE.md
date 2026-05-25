# Notifications Module

> In-app user notifications — execution completions, mentions, and system alerts.

## Base Path
`/v1/workspaces/:workspaceId/notifications`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | viewer+ | List notifications for the current user. Returns `[{ id, type, message, read, createdAt, metadata }]`. |
| PATCH | `/:id/read` | viewer+ | Mark a notification as read. Sets `readAt`. Returns updated notification. |
| PATCH | `/read-all` | viewer+ | Mark all unread notifications as read. Returns `{ updated: number }`. |
| DELETE | `/:id` | viewer+ | Delete a notification. Returns 204. |

## Dependencies

- `WorkspacesModule` — workspace guard
- Consumed by `ExecutionsModule` — pushes notifications on execution completion/failure

## Changelog

_No recent changes._

## Missing / Gaps

- **Real-time push**: notifications are poll-only — no SSE or WebSocket endpoint for live delivery
- **Notification preferences**: no `PATCH /preferences` to let users opt out of specific notification types
- **Bulk delete**: no `DELETE /` to clear all notifications at once

## Status

Stable.
