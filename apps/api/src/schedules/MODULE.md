# Schedules Module

> Cron-based workflow scheduling — create, enable/disable, and track last/next run times.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/schedules`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a schedule |
| GET | `/` | viewer+ | List schedules for the pod |
| GET | `/:id` | viewer+ | Get a schedule |
| PATCH | `/:id` | admin+ | Update cron expression, input, or enabled flag |
| DELETE | `/:id` | admin+ | Delete a schedule |

## Key Types

- `CreateScheduleDto` — `{ workflowId, cronExpr, input?, enabled? }`

## Business Logic

- `SchedulerService` runs on a polling interval and triggers due schedules by enqueuing executions
- `nextRunAt` is computed from `cronExpr` after each trigger
- Only `deployed` workflows can be scheduled

## Dependencies

- `WorkspacesModule` — workspace + pod guard
- `ExecutionsModule` — triggers executions

## Changelog

_No recent changes._

## Status

Stable.
