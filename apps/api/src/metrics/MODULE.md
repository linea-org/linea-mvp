# Metrics Module

> Execution performance and usage analytics for a workspace.

## Base Path
`/v1/workspaces/:workspaceId/metrics`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/executions` | admin+ | Execution counts, success/failure rates, avg duration over a time range |
| GET | `/usage` | admin+ | Token usage and resource consumption |

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Status

Stable.
