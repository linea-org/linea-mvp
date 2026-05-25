# Quotas Module

> Internal quota enforcement — no HTTP routes; consumed by ExecutionsModule.

## Base Path

None — service-only module.

## Business Logic

- `QuotasService.assertCanRun(workspaceId)` checks `resource_quotas.executions_used < executions_per_month` and `tokens_used_month < tokens_per_month`
- Throws `ForbiddenException` (quota exceeded) if limits are breached
- `QuotasService.increment(workspaceId, tokens)` is called after each execution to update usage counters
- Monthly reset is handled by a scheduled job that zeros `executions_used` and `tokens_used_month`

## Dependencies

- Imported by `ExecutionsModule`

## Changelog

_No recent changes._

## Status

Stable.
