# Quotas Module

> Internal quota enforcement — no HTTP routes; consumed by ExecutionsModule.

## Base Path

None — service-only module.

## Business Logic

- `QuotasService.checkLimit(workspaceId)` checks `resource_quotas.executions_used < executions_per_month` and `tokens_used_month < tokens_per_month`, resetting the counters first if `resetAt` has passed
- Throws `ForbiddenException` (quota exceeded) if limits are breached
- `QuotasService.incrementUsed(workspaceId, tokensConsumed, userId?)` is called after each execution to update usage counters. When `userId` is passed, it compares before/after usage against 80%/100% of the executions and token limits and fires a one-time `quota_threshold` notification (via `NotificationsModule`) exactly when a threshold is crossed
- Monthly reset is handled lazily inside `checkLimit`/`getOrCreate`, not a separate scheduled job — the first check/increment past `resetAt` zeros `executions_used` and `tokens_used_month`

## Dependencies

- Imported by `ExecutionsModule`
- Imports `NotificationsModule` — to raise `quota_threshold` alerts

## Changelog

- `incrementUsed` now accepts an optional `userId` and raises a `quota_threshold` notification at 80%/100% usage (before/after comparison, so it fires exactly once per crossing — no persisted flag needed)

## Missing / Gaps

- **No read endpoint**: quota limits and current usage aren't exposed via HTTP — only the billing module shows a summary, and only for admins
- **Threshold alerts go to the triggering user only**: `quota_threshold` notifications use the `userId` of whoever triggered the execution that crossed the threshold, not all workspace admins/owners
- **Token counting accuracy**: `incrementUsed` is called with the actual token count post-execution, but there's no reservation before the execution starts, so concurrent executions can temporarily exceed limits

## Status

Stable.
