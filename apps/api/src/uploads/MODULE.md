# Uploads Module

> Presigned URL file uploads — generates short-lived upload URLs for workflow file inputs.

## Base Path
`/v1/workspaces/:workspaceId/uploads`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/presign` | editor+ | Generate a presigned S3 upload URL. Body: `{ filename, mimeType, size? }`. Returns `{ uploadUrl, fileUrl }` — client uploads directly to `uploadUrl`, then references `fileUrl` in workflow inputs. |

## Business Logic

- Client uploads directly to storage (S3-compatible) using the presigned URL
- The final public or signed download URL is returned so workflows can reference the file

## Dependencies

- `WorkspacesModule` — workspace guard

## Changelog

_No recent changes._

## Missing / Gaps

- **File listing**: no `GET /` to list uploaded files for a workspace — there's no file management layer above S3
- **File deletion**: no `DELETE /:fileKey` to remove an uploaded file; files accumulate in S3 indefinitely
- **Size limits**: no server-side enforcement of `size` — the presigned URL is generated regardless; S3 Content-Length restriction is not applied

## Status

Stable.
