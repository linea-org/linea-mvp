# Uploads Module

> Presigned URL file uploads — generates short-lived upload URLs for workflow file inputs.

## Base Path
`/v1/workspaces/:workspaceId/uploads`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/presign` | editor+ | Generate a presigned upload URL and return the final file URL |

## Business Logic

- Client uploads directly to storage (S3-compatible) using the presigned URL
- The final public or signed download URL is returned so workflows can reference the file

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Status

Stable.
