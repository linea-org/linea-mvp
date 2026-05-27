# Metrics Module

> Execution performance and usage analytics for a workspace.

## Base Path
`/v1/workspaces/:workspaceId/metrics`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/executions` | admin+ | Execution analytics. Query: `{ from, to, workflowId? }`. Returns `{ total, succeeded, failed, avgDurationMs, byDay[] }`. |
| GET | `/usage` | admin+ | Token and resource consumption. Query: `{ from, to }`. Returns `{ tokensUsed, executionsUsed, cost? }`. |

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Missing / Gaps

- **Per-workflow breakdown**: `/executions` aggregates across the workspace — no drill-down by workflow ID in the response
- **Real-time counters**: no live counter endpoint; metrics are aggregated over time ranges only
- **Cost attribution**: `cost?` in usage response is optional and may not be populated for all model providers

## Status

Stable.
