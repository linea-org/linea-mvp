# Webhooks Module

> Inbound webhook triggers — generate signed URLs that fire a deployed workflow when called.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/webhooks`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a webhook (returns trigger URL + secret) |
| GET | `/` | viewer+ | List webhooks for the pod |
| DELETE | `/:id` | admin+ | Delete a webhook |

## Inbound trigger (no auth prefix)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/trigger/:secretToken` | HMAC signature | Trigger the associated workflow; validates `X-Linea-Signature` header |

## Business Logic

- Each webhook has a unique `secretToken`; the trigger URL is `POST /webhooks/trigger/:secretToken`
- Inbound requests must include an HMAC-SHA256 signature in `X-Linea-Signature`; mismatch returns 401
- Workflow must be `deployed: true`; undeploy silently ignores incoming requests

## Dependencies

- `WorkspacesModule` — workspace + pod guard
- `ExecutionsModule` — enqueues execution on trigger

## Changelog

_No recent changes._

## Status

Stable.
