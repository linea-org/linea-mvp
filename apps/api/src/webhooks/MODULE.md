# Webhooks Module

> Inbound webhook triggers — generate signed URLs that fire a deployed workflow when called.

## Base Path
`/v1/workspaces/:workspaceId/pods/:podId/webhooks`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | admin+ | Create a webhook. Body: `{ workflowId, label? }`. Returns `{ id, triggerUrl, secretToken }` — `secretToken` only returned on creation. |
| GET | `/` | viewer+ | List webhooks for the pod. Returns `[{ id, label, workflowId, triggerUrl, createdAt }]` — `secretToken` never returned after creation. |
| DELETE | `/:id` | admin+ | Delete a webhook. Returns 204. |

## Inbound trigger (no auth prefix)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/trigger/:secretToken` | HMAC signature | Trigger the associated workflow. Header: `X-Linea-Signature: sha256=<hmac>`. Body: arbitrary JSON passed as workflow `input`. Returns `{ executionId }` or 401 if signature invalid. |

## Business Logic

- Each webhook has a unique `secretToken`; the trigger URL is `POST /webhooks/trigger/:secretToken`
- Inbound requests must include an HMAC-SHA256 signature in `X-Linea-Signature`; mismatch returns 401
- Workflow must be `deployed: true`; undeploy silently ignores incoming requests

## Dependencies

- `WorkspacesModule` — workspace + pod guard
- `ExecutionsModule` — enqueues execution on trigger

## Changelog

_No recent changes._

## Missing / Gaps

- **Secret rotation**: no `POST /:id/rotate` to generate a new `secretToken` without deleting the webhook
- **Delivery history**: no `GET /:id/deliveries` to inspect past trigger attempts and their HTTP responses
- **Signature algorithm choice**: only HMAC-SHA256 is supported; no option to accept unsigned requests for low-security use cases

## Status

Stable.
