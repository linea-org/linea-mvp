# Notifications Module

> In-app user notifications — repeated execution failures, quota threshold alerts, mentions, and system alerts.

## Base Path
`/v1/workspaces/:workspaceId/notifications`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | viewer+ | List notifications for the current user, capped at 500 rows, newest first. Returns `[{ id, type, message, read, createdAt, metadata }]`. |
| GET | `/unread-count` | viewer+ | Returns `{ count: number }` of unread notifications. |
| GET | `/stream` | viewer+ | SSE stream — emits a `ping` event every 25s and a `notification` event when one is created. |
| PATCH | `/:id/read` | viewer+ | Mark a notification as read. Sets `readAt`. Returns updated notification. |
| PATCH | `/read-all` | viewer+ | Mark all unread notifications as read. Returns `{ updated: number }`. |
| DELETE | `/:id` | viewer+ | Delete a notification. Returns 204. |

## Dependencies

- `WorkspacesModule` — workspace guard
- Consumed by `ExecutionsModule` — no longer notifies on every successful execution (already visible in execution history); only notifies on failure, and only for unattended triggers (`schedule`/`webhook`/`sdk`, never `manual`), deduped to a consecutive-failure streak (fires at 3, then every +10) so a broken cron doesn't spam the bell
- Consumed by `QuotasModule` — fires a `quota_threshold` notification once when workspace execution or token usage crosses 80%/100% of the monthly limit

## Changelog

- Capped `findAll()` at 500 rows (was unbounded)
- `execution_complete` notifications removed; `execution_failed` now gated to non-manual triggers with failure-streak dedup
- Added `quota_threshold` notification type, fired from `QuotasService.incrementUsed`

## Missing / Gaps

- **Notification preferences**: no `PATCH /preferences` to let users opt out of specific notification types
- **Bulk delete**: no `DELETE /` to clear all notifications at once

## Status

Stable.
