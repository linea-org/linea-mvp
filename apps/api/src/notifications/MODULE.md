# Notifications Module

> In-app user notifications — execution completions, mentions, and system alerts.

## Base Path
`/v1/workspaces/:workspaceId/notifications`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | viewer+ | List notifications for the current user |
| PATCH | `/:id/read` | viewer+ | Mark a notification as read |
| PATCH | `/read-all` | viewer+ | Mark all notifications as read |
| DELETE | `/:id` | viewer+ | Delete a notification |

## Dependencies

- `WorkspacesModule` — workspace guard
- Consumed by `ExecutionsModule` — pushes notifications on execution completion/failure

## Changelog

_No recent changes._

## Status

Stable.
