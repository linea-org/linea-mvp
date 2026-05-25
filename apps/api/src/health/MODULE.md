# Health Module

> Liveness and readiness probes — used by Docker, load balancers, and uptime monitors.

## Base Path
`/health` (public — excluded from global `/v1` prefix and auth)

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | public | Returns `{ status: 'ok' }` if DB is reachable; 503 otherwise |

## Dependencies

- `DatabaseModule` — tests DB connectivity

## Changelog

_No recent changes._

## Status

Stable.
