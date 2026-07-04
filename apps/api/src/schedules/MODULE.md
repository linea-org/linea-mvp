# Schedules Module

> Cron-based workflow scheduling — create, enable/disable, and track last/next run times.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/schedules`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a schedule. Body: `{ workflowId, cronExpr, input?, enabled? }`. Returns created schedule with `nextRunAt`. |
| GET | `/` | viewer+ | List schedules for the pod. Returns `[{ id, workflowId, cronExpr, enabled, lastRunAt, nextRunAt }]`. |
| GET | `/:id` | viewer+ | Get a schedule. Returns `{ cronExpr, enabled, lastRunAt, nextRunAt, input }`. |
| PATCH | `/:id` | admin+ | Update schedule. Body: `{ cronExpr?, input?, enabled? }`. Recomputes `nextRunAt`. Returns updated schedule. |
| DELETE | `/:id` | admin+ | Delete a schedule. Returns 204. |

## Key Types

- `CreateScheduleDto` — `{ workflowId, cronExpr, input?, enabled? }`

## Business Logic

- `SchedulesService.fireDueSchedules()` runs on a polling interval, fetches all enabled schedules with `nextRunAt <= now`, and fires them concurrently via `Promise.allSettled` — one failing schedule no longer blocks or delays the rest of the tick
- Each schedule failure is logged (`Logger.error`) instead of silently swallowed
- `nextRunAt` is computed from `cronExpr` after each trigger
- Only `deployed` workflows can be scheduled

## Dependencies

- `WorkspacesModule` — workspace + pod guard
- `ExecutionsModule` — triggers executions

## Changelog

- `fireDueSchedules` now processes due schedules concurrently (`Promise.allSettled`) instead of sequentially, and logs per-schedule failures instead of swallowing them silently

## Missing / Gaps

- **Manual trigger**: no `POST /:id/run` to fire a schedule immediately without waiting for the next cron time — useful for testing
- **Run history**: no `GET /:id/runs` endpoint to see past triggered executions for a schedule
- **Timezone support**: `cronExpr` is interpreted in UTC; no per-schedule timezone field

## Status

Stable.
