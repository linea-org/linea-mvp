# Schedules Module

> Cron-based workflow scheduling — create, enable/disable, and track last/next run times.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/schedules`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a schedule. Body: `{ workflowId, cronExpr, input?, enabled? }`. Returns created schedule with `nextRunAt`. |
| GET | `/` | viewer+ | List schedules for the pod. Returns `[{ id, workflowId, cronExpr, enabled, lastRunAt, nextRunAt }]`. |
| GET | `/:id` | viewer+ | Get a schedule. Returns `{ cronExpr, enabled, lastRunAt, nextRunAt, input, lastError, consecutiveFailures }`. |
| PATCH | `/:id` | admin+ | Update schedule. Body: `{ cronExpr?, input?, enabled? }`. Recomputes `nextRunAt`. Returns updated schedule. |
| DELETE | `/:id` | admin+ | Delete a schedule. Returns 204. |

## Key Types

- `CreateScheduleDto` — `{ workflowId, cronExpr, input?, enabled? }`

## Business Logic

- `SchedulerService` runs on a polling interval and triggers due schedules by enqueuing executions
- `nextRunAt` is computed from `cronExpr` after each trigger
- On failure in `fireDueSchedules()`, `lastError` is set and `consecutiveFailures` is incremented; both reset on success
- Only `deployed` workflows can be scheduled

## Dependencies

- `WorkspacesModule` — workspace + pod guard
- `ExecutionsModule` — triggers executions

## Changelog

### 2026-06-13 — Schedule failure tracking (LIN-22)
- Added `lastError` and `consecutiveFailures` columns to `schedules` table
- `fireDueSchedules()` records error message and increments `consecutiveFailures` on failure; resets both on success
- `GET /:id` returns `lastError` and `consecutiveFailures`

## Missing / Gaps

- **Manual trigger**: no `POST /:id/run` to fire a schedule immediately without waiting for the next cron time — useful for testing
- **Run history**: no `GET /:id/runs` endpoint to see past triggered executions for a schedule
- **Timezone support**: `cronExpr` is interpreted in UTC; no per-schedule timezone field

## Status

Stable.
