# Public Run Module

> Unauthenticated workflow execution endpoint — used for public-facing APIs and embedded workflows.

## Base Path
`/v1/run` (public — no Clerk auth required)

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:workspaceSlug/:podSlug/:workflowId` | Linea API key | Execute a deployed workflow. Header: `Authorization: Bearer <api-key>`. Body: `{ input?, stream? }`. Returns execution output or streams SSE events if `stream: true`. |

## Business Logic

- Requires a valid Linea API key in `Authorization: Bearer <key>` header (not a Clerk JWT)
- Workflow must be `deployed: true`; requests for non-deployed workflows return 403
- Response streams execution output or blocks until completion depending on `stream` flag in body

## Dependencies

- `WorkspacesModule` — workspace/pod lookup by slug
- `ExecutionsModule` — delegates execution creation

## Changelog

_No recent changes._

## Missing / Gaps

- **Streaming response shape**: SSE event schema for `stream: true` is not formally documented alongside this endpoint
- **Input validation**: workflow input is passed through without schema validation — malformed input surfaces only inside the execution engine
- **CORS config**: this endpoint is intended for external callers but CORS policy is inherited from the global NestJS config — no per-route override

## Status

Stable.
